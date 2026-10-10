'use strict';
const $ = s => document.querySelector(s);
const SESSION_KEY = 'sqlx-session';
const HOME = 'index.html';

/* Si ya hay sesión, ir directo al panel */
try { if (localStorage.getItem(SESSION_KEY)) location.replace(HOME); } catch { /* sin almacenamiento */ }

/* ============================================================
   CONEXIÓN CON EL BACK-END
   Reemplaza el cuerpo de authenticate() por tu llamada real.
   Debe devolver { ok: true, user: {...}, token } o lanzar un Error
   con el mensaje que se mostrará al usuario.
   Mientras no exista back-end, acepta cualquier credencial válida.
   ============================================================ */
async function authenticate(user, pass) {
  /* Ejemplo:
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, pass })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Usuario o contraseña incorrectos.');
  return data;
  */
  await new Promise(r => setTimeout(r, 700));
  return { ok: true, user: { name: user }, token: null };
}

/* ---------- Validación ---------- */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function validUser(v) {
  if (!v) return 'Escribe tu usuario o correo.';
  if (v.includes('@')) return EMAIL.test(v) ? '' : 'El correo no tiene un formato válido.';
  return v.length < 3 ? 'El usuario debe tener al menos 3 caracteres.' : '';
}
function validPass(v) {
  if (!v) return 'Escribe tu contraseña.';
  return v.length < 6 ? 'La contraseña debe tener al menos 6 caracteres.' : '';
}
function setError(id, msg) {
  $('#' + id + 'Err').textContent = msg;
  document.querySelector(`.field[data-for="${id}"]`).classList.toggle('bad', !!msg);
  $('#' + id).setAttribute('aria-invalid', msg ? 'true' : 'false');
}

/* Limpia el error de un campo mientras el usuario lo corrige */
['user', 'pass'].forEach(id => $('#' + id).addEventListener('input', () => { setError(id, ''); $('#alert').hidden = true; }));

/* ---------- Mostrar / ocultar contraseña ---------- */
$('#eye').addEventListener('click', e => {
  const input = $('#pass'), show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  e.currentTarget.setAttribute('aria-pressed', show);
  e.currentTarget.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  input.focus();
});

/* ---------- Envío ---------- */
$('#form').addEventListener('submit', async e => {
  e.preventDefault();
  const user = $('#user').value.trim(), pass = $('#pass').value;
  const eu = validUser(user), ep = validPass(pass);
  setError('user', eu); setError('pass', ep);
  if (eu || ep) {
    (eu ? $('#user') : $('#pass')).focus();
    const card = document.querySelector('.card'); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    return;
  }
  const btn = $('#submit'); btn.disabled = true; btn.classList.add('load'); $('#alert').hidden = true;
  try {
    const res = await authenticate(user, pass);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ user: res.user, token: res.token, at: Date.now() })); } catch { /* ignorar */ }
    location.replace(HOME);
  } catch (err) {
    $('#alert').textContent = err.message || 'No se pudo iniciar sesión. Inténtalo de nuevo.';
    $('#alert').hidden = false;
    btn.disabled = false; btn.classList.remove('load');
    $('#pass').select();
  }
});
