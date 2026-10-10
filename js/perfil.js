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
const S = load('sqlx', { profile: {}, done: [], open: 1, drafts: {}, days: [] });
S.profile = S.profile || {};
S.days = Array.isArray(S.days) ? S.days : [];
const F = ['nombre', 'apellido', 'edad', 'aficion', 'ig', 'tt', 'yt', 'gh'];
let pendingAvatar;
let toastTimer;
const handle = value => (value || '')
  .trim()
  .replace(/^https?:\/\/[^/]+\/?/i, '')
  .replace(/^@/, '')
  .split(/[/?]/)[0];
const dateKey = date => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
const escapeHTML = value => String(value).replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
if (!S.days.includes(dateKey(new Date()))) {
  S.days.push(dateKey(new Date()));
  store('sqlx', S);
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
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
function fillForm() {
  F.forEach(key => {
    $('#' + key).value = S.profile[key] ?? '';
    $('#' + key).classList.remove('bad');
  });
  $$('.profile-page label em').forEach(el => {
    el.textContent = '';
  });
  pendingAvatar = undefined;
  $('#fAvatar').src = S.profile.avatar || AV;
}
function renderProfile() {
  const profile = S.profile;
  $('#sNombre').textContent = profile.nombre || '—';
  $('#sApellido').textContent = profile.apellido || '—';
  $('#sEdad').textContent = profile.edad ? profile.edad + ' años' : '—';
  $('#sAficion').textContent = profile.aficion || 'Cuéntanos qué te gusta hacer';
  $('#pBadge').textContent = profile.nombre ? 'Estudiante SQL destacado' : 'Completa tu perfil';
  $('#pAvatar').src = profile.avatar || AV;
  $('.streak').textContent = streak();
  const networks = [
    ['ig', 'Instagram', 'instagram.com/'],
    ['tt', 'TikTok', 'tiktok.com/@'],
    ['yt', 'YouTube', 'youtube.com/@'],
    ['gh', 'GitHub', 'github.com/']
  ].filter(([key]) => profile[key]);
  $('#sSocial').innerHTML = networks.length
    ? networks.map(([key, name, url]) => `<a class="soc" target="_blank" rel="noopener" href="https://${url}${encodeURIComponent(profile[key])}"><b>${name}</b><em>@${escapeHTML(profile[key])}</em></a>`).join('')
    : '<p class="sub">Aún no agregaste redes sociales.</p>';
}

$('#file').onchange = event => {
  const file = event.target.files[0];
  if (!file) return;
  if (!/^image\/(png|jpeg)$/.test(file.type)) {
    return toast('Usa una imagen PNG o JPG');
  }
  if (file.size > 5 * 1024 * 1024) {
    return toast('La imagen pesa más de 5 MB');
  }
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    const size = Math.min(image.width, image.height);
    canvas.width = canvas.height = 256;
    canvas.getContext('2d').drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 256, 256);
    pendingAvatar = canvas.toDataURL('image/jpeg', .85);
    $('#fAvatar').src = pendingAvatar;
    URL.revokeObjectURL(image.src);
  };
  image.src = URL.createObjectURL(file);
};
$('#profForm').onsubmit = event => {
  event.preventDefault();
  let valid = true;
  function showError(id, message) {
    const input = $('#' + id);
    input.classList.add('bad');
    input.closest('label').querySelector('em').textContent = message;
    valid = false;
  }
  F.forEach(key => {
    $('#' + key).classList.remove('bad');
    const message = $('#' + key).closest('label').querySelector('em');
    if (message) message.textContent = '';
  });
  if (!$('#nombre').value.trim()) {
    showError('nombre', 'Escribe tu nombre.');
  }
  if (!$('#apellido').value.trim()) {
    showError('apellido', 'Escribe tu apellido.');
  }
  const age = $('#edad').value;
  if (age && (age < 9 || age > 16)) {
    showError('edad', 'La edad debe estar entre 9 y 16.');
  }
  if (!valid) {
    return toast('Revisa los campos marcados');
  }
  F.forEach(key => {
    const value = $('#' + key).value.trim();
    const isSocialProfile = ['ig', 'tt', 'yt', 'gh'].includes(key);
    S.profile[key] = isSocialProfile ? handle(value) : value;
  });
  if (pendingAvatar) S.profile.avatar = pendingAvatar;
  store('sqlx', S);
  fillForm();
  renderProfile();
  toast('Perfil guardado ✓');
};
$('#cancelBtn').onclick = () => {
  fillForm();
  toast('Cambios descartados');
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
fillForm();
renderProfile();