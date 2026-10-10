'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
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
const AV = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#cffafe"/><circle cx="50" cy="38" r="18" fill="#06b6d4"/><path d="M14 92c4-24 20-32 36-32s32 8 36 32z" fill="#2563eb"/></svg>');

/* ================= ESTADO ================= */
const S = load('sqlx', { profile: {}, done: [], open: 1, drafts: {}, days: [] });
S.profile = S.profile || {};
const save = () => store('sqlx', S);
const dateKey = date => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
if (!S.days.includes(dateKey(new Date()))) {
  S.days.push(dateKey(new Date()));
  save();
}

function streak() {
  let count = 0;
  const day = new Date();
  while (S.days.includes(dateKey(day))) {
    count++;
    day.setDate(day.getDate() - 1);
  }
  return count;
}

/* ================= DATOS Y EJERCICIOS ================= */
const { EX } = window.SQL_DATA;
const unlocked = id => id === 1 || S.done.includes(id - 1);
const current = () => (EX.find(exercise => !S.done.includes(exercise.id)) || EX[EX.length - 1]).id;

/* ================= INICIO ================= */
function renderHome() {
  const completedCount = S.done.length;
  const progress = Math.round(completedCount / EX.length * 100);
  const currentExercise = current();

  $('#doneN').textContent = completedCount;
  $('#pct').textContent = progress + '%';
  $('#heroBar').style.width = progress + '%';
  $('#heroMsg').textContent = completedCount === EX.length
    ? '¡Completaste el módulo! Eres un Mago SQL.'
    : `¡Gran trabajo! Te faltan ${EX.length - completedCount} lecciones para desbloquear la insignia de Mago SQL.`;
  $('#continueBtn').href = 'editor.html?ex=' + currentExercise;
  $('#reviewBtn').href = 'editor.html?ex=' + currentExercise;

  $('#classes').innerHTML = EX.map(exercise => {
    const status = S.done.includes(exercise.id)
      ? 'done'
      : exercise.id === currentExercise ? 'cur' : 'lock';
    const statusLabel = {
      done: '✓ 100%',
      cur: '⏳ En curso',
      lock: '🔒 Bloqueado'
    }[status];
    const footer = {
      done: 'Dominado ✨',
      cur: '<div class="mini"><i></i></div>',
      lock: exercise.id === 4 ? 'Próximo módulo' : 'Requiere clase ' + (exercise.id - 1)
    }[status];

    return `
      <button class="cls ${status}" data-ex="${exercise.id}" ${status === 'lock' ? 'disabled' : ''}>
        <div class="tp"><span>CLASE ${exercise.id}</span><span>${statusLabel}</span></div>
        <h3>${exercise.cls}</h3>
        <div>${footer}</div>
      </button>`;
  }).join('');

  $('#exList').innerHTML = EX.map(exercise => {
    const isDone = S.done.includes(exercise.id);
    const isCurrent = exercise.id === currentExercise;
    const isUnlocked = unlocked(exercise.id);
    const statusClass = isDone ? 'ok' : isCurrent ? 'w' : '';
    const statusText = isDone
      ? '✓ Completado'
      : isCurrent ? '⏳ En curso' : isUnlocked ? 'Pendiente' : '🔒 Bloqueado';

    return `
      <button class="ex ${isCurrent ? 'cur' : ''}" data-ex="${exercise.id}" ${isUnlocked ? '' : 'disabled'}>
        <span class="n">0${exercise.id}</span>
        <span>
          <b>Ejercicio ${exercise.id}: ${exercise.title}</b>
          <span class="st ${statusClass}">${statusText}</span>
          <small>${exercise.desc}</small>
        </span>
        <span class="go">→</span>
      </button>`;
  }).join('');

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  $('#week').innerHTML = 'LMXJVSD'.split('').map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const isActive = S.days.includes(dateKey(date));
    const isToday = dateKey(date) === dateKey(today);
    return `<span class="${isActive ? 'on' : ''} ${isToday ? 'today' : ''}">${label}</span>`;
  }).join('');
}
document.addEventListener('click', event => {
  const exerciseButton = event.target.closest('[data-ex]');
  if (!exerciseButton || exerciseButton.disabled) return;
  event.preventDefault();
  location.href = 'editor.html?ex=' + exerciseButton.dataset.ex;
});

function renderHeaderProfile() {
  const profile = S.profile;
  $('#hAvatar').src = profile.avatar || AV;
  $('#hName').textContent = profile.nombre || 'explorador';
  $('#hFull').textContent = profile.nombre
    ? `${profile.nombre} ${(profile.apellido || '')[0] ? profile.apellido[0] + '.' : ''}`
    : 'Explorador';
}

/* ================= RUTAS, TEMA, AVISOS ================= */
let tt;
function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(tt);
  tt = setTimeout(() => element.classList.remove('show'), 2200);
}

function route() {
  const name = 'inicio';
  $$('.view').forEach(view => view.classList.toggle('on', view.id === 'v-' + name));
  $$('[data-nav]').forEach(link => link.classList.toggle('on', link.dataset.nav === name));
  $$('.streak').forEach(element => {
    element.textContent = streak();
  });
  if (name === 'inicio') renderHome();
  window.scrollTo(0, 0);
}

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
window.addEventListener('hashchange', route);
renderHeaderProfile();
route();
