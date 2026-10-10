'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const load = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const store = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento */
  }
};
const esc = value => String(value).replace(/[&<>\"]/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}[char]));
const { DB, EX } = window.SQL_DATA;
const S = load('sqlx', { profile: {}, done: [], open: 1, drafts: {}, days: [] });
S.done = Array.isArray(S.done) ? S.done : [];
S.drafts = S.drafts || {};
const save = () => store('sqlx', S);
const unlocked = id => id === 1 || S.done.includes(id - 1);
const current = () => (EX.find(exercise => !S.done.includes(exercise.id)) || EX[EX.length - 1]).id;
const START = '-- Escribe tu consulta aquí y presiona Ejecutar\n';
const code = $('#code'), hl = $('#hl'), gutter = $('#gutter');
let lastResult = null;
let toastTimer;

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function runSQL(q) {
  q = q.replace(/--.*$/gm, '').trim().replace(/;\s*$/, '');
  if (!q) throw new Error('Escribe una consulta antes de ejecutar.');
  const queryPattern = /^select\s+(distinct\s+)?(.+?)\s+from\s+(\w+)(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+(\w+)(?:\s+(asc|desc))?)?(?:\s+limit\s+(\d+))?$/is;
  const match = q.match(queryPattern);
  if (!match) {
    throw new Error('No entendí la consulta.\nForma: SELECT columnas FROM tabla [WHERE ...] [ORDER BY ...] [LIMIT n]');
  }
  const [, distinct, columnsSource, tableName, where, orderBy, direction, limit] = match;
  const table = DB[tableName.toLowerCase()];
  if (!table) {
    throw new Error(`La tabla "${tableName}" no existe. Tablas: ${Object.keys(DB).join(', ')}.`);
  }

  const columnNames = table.cols.map(column => column[0]);
  const checkColumn = column => {
    if (!columnNames.includes(column)) {
      throw new Error(`La columna "${column}" no existe en ${tableName}.`);
    }
    return column;
  };
  const columns = columnsSource.trim() === '*'
    ? columnNames
    : columnsSource.split(',').map(column => checkColumn(column.trim().toLowerCase()));
  let rows = table.rows.map(row => Object.fromEntries(columnNames.map((name, index) => [name, row[index]])));

  if (where) {
    const createCondition = expression => {
      const condition = expression.trim().match(/^(\w+)\s*(<=|>=|<>|!=|=|<|>|like)\s*('[^']*'|-?\d+(?:\.\d+)?)$/i);
      if (!condition) {
        throw new Error(`Condición no válida: "${expression.trim()}".\nRecuerda: el texto va entre comillas simples.`);
      }

      const column = checkColumn(condition[1].toLowerCase());
      const operator = condition[2].toLowerCase();
      const rawValue = condition[3];
      const value = rawValue[0] === "'" ? rawValue.slice(1, -1) : Number(rawValue);
      const likePattern = operator === 'like'
        ? new RegExp('^' + String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i')
        : null;

      return row => ({
        '=': row[column] === value,
        '!=': row[column] !== value,
        '<>': row[column] !== value,
        '<': row[column] < value,
        '>': row[column] > value,
        '<=': row[column] <= value,
        '>=': row[column] >= value,
        like: likePattern && likePattern.test(row[column])
      })[operator];
    };

    const groups = where.split(/\s+or\s+/i).map(group =>
      group.split(/\s+and\s+/i).map(createCondition));
    rows = rows.filter(row => groups.some(group => group.every(condition => condition(row))));
  }

  if (orderBy) {
    const column = checkColumn(orderBy.toLowerCase());
    const sortDirection = /desc/i.test(direction || '') ? -1 : 1;
    rows.sort((left, right) =>
      (left[column] > right[column] ? 1 : left[column] < right[column] ? -1 : 0) * sortDirection);
  }

  let outputRows = rows.map(row => columns.map(column => row[column]));
  if (distinct) {
    outputRows = outputRows.filter((row, index) =>
      outputRows.findIndex(candidate => JSON.stringify(candidate) === JSON.stringify(row)) === index);
  }
  if (limit) outputRows = outputRows.slice(0, +limit);
  return { cols: columns, rows: outputRows };
}

function highlight(src) {
  return esc(src).replace(/(--.*$)|('[^']*')|\b(select|distinct|from|where|and|or|order by|asc|desc|limit|like)\b|\b(\d+(?:\.\d+)?)\b/gim,
    (match, comment, string, keyword, number) => {
      if (comment) return `<span class="cm">${comment}</span>`;
      if (string) return `<span class="s">${string}</span>`;
      if (keyword) return `<span class="k">${keyword}</span>`;
      return `<span class="nu">${number}</span>`;
    }) + '\n';
}
function paint() {
  const lines = code.value.split('\n');
  const height = lines.length * 27 + 28;
  const width = Math.max(...lines.map(line => line.length)) * 8.6 + 48;
  hl.innerHTML = highlight(code.value);
  gutter.textContent = lines.map((_, i) => i + 1).join('\n');
  gutter.style.height = height + 'px';
  const wrap = code.parentElement;
  wrap.style.height = height + 'px';
  wrap.style.minWidth = width + 'px';
}
function renderTable(result) {
  if (!result.rows.length) {
    $('#result').innerHTML = '<p class="empty">La consulta no devolvió filas.</p>';
    return;
  }

  const header = result.cols.map(column => `<th>${esc(column)}</th>`).join('');
  const body = result.rows.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      ${row.map(value => `<td>${esc(value)}</td>`).join('')}
    </tr>`).join('');
  $('#result').innerHTML = `<table><thead><tr><th>#</th>${header}</tr></thead><tbody>${body}</tbody></table>`;
}
function renderSchema() {
  $('#schema').innerHTML = Object.entries(DB).map(([name, table], index) => {
    const columns = table.cols.map(([column, type]) => `<li>${column} <b>${type}</b></li>`).join('');
    return `
      <details class="tb" ${index === 0 ? 'open' : ''}>
        <summary>${name}</summary>
        <ul>${columns}</ul>
        <button class="link" data-prev="${name}">Ver ${table.rows.length} filas</button>
      </details>`;
  }).join('');
}
function openEx(id, updateUrl = true) {
  S.open = id;
  save();
  if (updateUrl) history.replaceState(null, '', `editor.html?ex=${id}`);
  const exercise = EX[id - 1];
  $('#exTag').textContent = `Ejercicio ${exercise.id}`;
  $('#exDiff').textContent = exercise.diff;
  $('#exMission').innerHTML = '<b>Misión:</b> ' + exercise.mission;
  $('#hint').hidden = true;
  $('#hint').textContent = exercise.hint;
  $('#fileName').textContent = `ejercicio_${exercise.id}.sql`;
  code.value = S.drafts[id] ?? START;
  paint();
  $('#result').innerHTML = '<p class="empty">Escribe una consulta y presiona Ejecutar para ver los datos.</p>';
  $('#resInfo').textContent = 'Aún sin ejecutar';
  $('#success').hidden = true;
  lastResult = null;
  $('#prevEx').disabled = id === 1;
  $('#nextEx').hidden = id === EX.length;
  renderSchema();
}
function runQuery() {
  const exercise = EX[S.open - 1];
  const startedAt = performance.now();
  try {
    const result = runSQL(code.value);
    lastResult = result;
    const elapsed = Math.max(1, Math.round(performance.now() - startedAt));
    renderTable(result);
    $('#resInfo').textContent = `${result.rows.length} filas obtenidas en ${elapsed}ms`;
    const success = JSON.stringify(runSQL(exercise.sol)) === JSON.stringify(result);
    $('#success').hidden = !success;
    if (success) {
      $('#okMsg').textContent = 'Tu consulta devolvió justo los datos que pedía la misión.';
      if (!S.done.includes(exercise.id)) {
        S.done.push(exercise.id);
        save();
        toast('¡Ejercicio completado! 🎉');
      }
    } else {
      toast('La consulta funciona, pero aún no cumple la misión');
    }
  } catch (error) {
    lastResult = null;
    $('#success').hidden = true;
    $('#result').innerHTML = `<div class="err">${esc(error.message)}</div>`;
    $('#resInfo').textContent = 'Error en la consulta';
  }
}

code.addEventListener('input', () => {
  S.drafts[S.open] = code.value;
  save();
  paint();
});
code.addEventListener('keydown', event => {
  if (event.key === 'Tab') {
    event.preventDefault();
    const position = code.selectionStart;
    code.setRangeText('  ', position, code.selectionEnd, 'end');
    code.dispatchEvent(new Event('input'));
  }
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    runQuery();
  }
});
$('#runBtn').onclick = runQuery;
$('#resetBtn').onclick = () => {
  delete S.drafts[S.open];
  openEx(S.open);
};
$('#fmtBtn').onclick = () => {
  code.value = code.value.replace(/\s+/g, ' ').replace(/\b(select|distinct|from|where|and|or|order by|asc|desc|limit|like)\b/gi, match => match.toUpperCase())
    .replace(/ (FROM|WHERE|ORDER BY|LIMIT) /g, '\n$1 ').trim() + '\n';
  code.dispatchEvent(new Event('input'));
};
$('#hintBtn').onclick = () => {
  $('#hint').hidden = !$('#hint').hidden;
};
$('#prevEx').onclick = () => S.open > 1 && openEx(S.open - 1);
$('#nextEx').onclick = () => S.open < EX.length && openEx(S.open + 1);
$('#schema').addEventListener('click', event => {
  const name = event.target.dataset.prev;
  if (!name) return;
  const table = DB[name];
  renderTable({ cols: table.cols.map(col => col[0]), rows: table.rows });
  $('#resInfo').textContent = `Vista previa de ${name}`;
});
$('#csvBtn').onclick = () => {
  if (!lastResult) {
    return toast('Primero ejecuta una consulta');
  }
  const csv = [lastResult.cols, ...lastResult.rows]
    .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: 'resultado.csv'
  });
  link.click();
  URL.revokeObjectURL(link.href);
};

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#themeBtn').textContent = theme === 'dark' ? '☀️' : '🌙';
  store('sqlx-theme', theme);
}
$('#themeBtn').onclick = () => {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme);
};
setTheme(load('sqlx-theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

const requested = Number(new URLSearchParams(location.search).get('ex'));
const isValidRequest = Number.isInteger(requested) && EX[requested - 1] && unlocked(requested);
const selected = isValidRequest ? requested : (unlocked(S.open) ? S.open : current());
openEx(selected, false);