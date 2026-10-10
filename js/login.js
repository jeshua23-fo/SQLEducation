'use strict';
const $ = s => document.querySelector(s);
const SESSION_KEY = 'sqlx-session';
const HOME = 'index.html';
const API_BASE = (window.SQLEDUCATION_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

/* Comprueba una sesión guardada con el backend antes de reutilizarla. */
(async function restoreSession() {
  let session;
  try {
    session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    session = null;
  }
  if (!session?.token) {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* sin almacenamiento */ }
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${session.token}` }
    });
    if (!response.ok) throw new Error('La sesión ha caducado.');
    const data = await response.json();
    const refreshed = { ...session, user: data.user };
    localStorage.setItem(SESSION_KEY, JSON.stringify(refreshed));
    location.replace(HOME);
  } catch {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* sin almacenamiento */ }
  }
})();

/* Autenticación real contra la API Express. */
async function authenticate(user, pass) {
  let response;
  try {
    response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, pass })
    });
  } catch {
    throw new Error('No se puede conectar con el servidor. Comprueba que el backend esté iniciado.');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('El servidor devolvió una respuesta no válida.');
  }

  if (!response.ok) {
    throw new Error(data.message || 'Usuario o contraseña incorrectos.');
  }
  if (!data.token || !data.user) {
    throw new Error('El servidor no devolvió una sesión válida.');
  }
  return data;
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
    const session = {
      user: res.user,
      token: res.token,
      refreshToken: res.refreshToken,
      expiresAt: res.expiresAt,
      at: Date.now()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    location.replace(HOME);
  } catch (err) {
    $('#alert').textContent = err.message || 'No se pudo iniciar sesión. Inténtalo de nuevo.';
    $('#alert').hidden = false;
    btn.disabled = false; btn.classList.remove('load');
    $('#pass').select();
  }
});
