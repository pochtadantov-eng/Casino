// App shell: lobby navigation, liquid-glass dock, bonus and profile tabs.
const TITLES = { rocket: '🚀 Ракета', mines: '💣 Мины', tower: '🏗 Башня', seagull: '🕊 Чайка' };
const GICON = { rocket: '🚀', mines: '💣', tower: '🏗', seagull: '🕊' };
const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
const fmtTime = (ms) => { const m = Math.max(0, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`; };

// ---------- views ----------
let view = 'play', tab = 'play';
function show(name) {
  if (name !== 'game') { clearTimeout(state.pollTimer); cancelAnimationFrame(state.raf); state.scene = null; state.tscene = null; state.tpending = false; Music.stop(); $('#stage').className = ''; $('#stage').innerHTML = ''; }
  view = name;
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === 'view-' + name));
  const inGame = name === 'game'; document.body.classList.toggle('ingame', inGame);
  $('#dock').style.display = inGame ? 'none' : '';
  const bb = window.Telegram?.WebApp?.BackButton;
  if (bb) inGame ? bb.show() : bb.hide();
  window.scrollTo(0, 0);
  if (name === 'bonus') loadBonus();
  if (name === 'profile') loadProfile();
}
function openGame(g) {
  state.game = g; state.round = null; unlockPlay(); state.tscene = null; state.tpending = false; Music.stop(); $('#stage').className = '';
  $('#gtitle').textContent = TITLES[g];
  show('game');
  load();
}
document.querySelectorAll('[data-game]').forEach((c) => c.onclick = () => openGame(c.dataset.game));
document.querySelectorAll('[data-go]').forEach((c) => c.onclick = () => selectTab(c.dataset.go));
$('#back').onclick = () => { show(tab); };
if (window.Telegram?.WebApp?.initData) $('#back').hidden = true; // inside Telegram the native Back button is used instead
window.Telegram?.WebApp?.BackButton?.onClick(() => show(tab));

// ---------- liquid glass dock ----------
const dock = $('#dock'), glass = $('#glass'), blob = glass.firstElementChild;
const dockBtns = [...dock.querySelectorAll('button')];
const TABS = dockBtns.map((b) => b.dataset.tab);
const place = (i) => { const b = dockBtns[i]; glass.style.width = b.offsetWidth + 'px'; glass.style.transform = `translateX(${b.offsetLeft}px)`; };
function selectTab(name, silent) {
  const i = TABS.indexOf(name); if (i < 0) return;
  const changed = tab !== name; tab = name;
  dockBtns.forEach((b, k) => b.classList.toggle('on', k === i));
  place(i);
  if (changed && !silent) { blob.classList.remove('squish'); void blob.offsetWidth; blob.classList.add('squish'); window.Telegram?.WebApp?.HapticFeedback?.selectionChanged(); }
  show(name);
}
let drag = null;
dock.addEventListener('pointerdown', (e) => {
  dock.setPointerCapture(e.pointerId);
  drag = { startX: e.clientX, moved: false };
  glass.classList.add('drag');
  moveGlass(e.clientX);
});
dock.addEventListener('pointermove', (e) => { if (!drag) return; if (Math.abs(e.clientX - drag.startX) > 4) drag.moved = true; moveGlass(e.clientX); });
const endDrag = (e) => {
  if (!drag) return;
  glass.classList.remove('drag');
  const r = dock.getBoundingClientRect(), x = e.clientX - r.left;
  let best = 0, d = 1e9;
  dockBtns.forEach((b, i) => { const c = b.offsetLeft + b.offsetWidth / 2, dd = Math.abs(c - x); if (dd < d) { d = dd; best = i; } });
  drag = null;
  selectTab(TABS[best]);
  place(best);
};
dock.addEventListener('pointerup', endDrag);
dock.addEventListener('pointercancel', endDrag);
function moveGlass(clientX) {
  const r = dock.getBoundingClientRect(), w = glass.offsetWidth;
  const x = Math.min(r.width - 6 - w, Math.max(6, clientX - r.left - w / 2));
  glass.style.transform = `translateX(${x}px)`;
}
new ResizeObserver(() => { if (!drag) place(TABS.indexOf(tab)); }).observe(dock);

// ---------- user chip ----------
function paintUser() {
  const name = tgUser ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') : 'Гость';
  const init = (name[0] || '?').toUpperCase();
  for (const id of ['#ava', '#ava2']) {
    const a = $(id);
    if (tgUser?.photo_url) { a.style.backgroundImage = `url(${tgUser.photo_url})`; a.textContent = ''; } else a.textContent = init;
  }
  $('#uname').textContent = name; $('#pname').textContent = name;
  $('#pid').textContent = tgUser ? '@' + (tgUser.username || tgUser.id) : 'Демо-режим';
}

// ---------- bonus ----------
async function loadBonus() {
  const btn = $('#bonus-claim'), txt = $('#bonus-text');
  try {
    const b = await api('bonus');
    const wait = b.availableAt ? new Date(b.availableAt).getTime() - Date.now() : 0;
    if (b.reward <= 0) { txt.textContent = 'Бонус сейчас недоступен.'; btn.disabled = true; return; }
    btn.disabled = wait > 0;
    txt.textContent = wait > 0 ? `Следующий бонус через ${fmtTime(wait)}` : `Забери ${b.reward} ⭐ прямо сейчас!`;
    btn.textContent = wait > 0 ? 'Уже получено' : `Забрать ${b.reward} ⭐`;
  } catch (e) { txt.textContent = e.message; btn.disabled = true; }
}
$('#bonus-claim').onclick = async () => {
  try { const r = await api('bonus/daily', {}); setBalance(r.balance); window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success'); } catch (e) { $('#bonus-text').textContent = e.message; }
  loadBonus();
};

// ---------- profile ----------
async function loadProfile() {
  paintUser();
  const box = $('#history');
  try {
    const rows = await api('history');
    box.innerHTML = rows.length ? rows.map((r) => `<div class="hrow"><span>${GICON[r.game] || '🎲'} ${TITLES[r.game]?.slice(2) || r.game} · ${r.bet} ⭐</span><span class="${r.status === 'won' ? 'w' : 'l'}">${r.status === 'won' ? '+' + r.payout : '−' + r.bet} ⭐</span></div>`).join('') : '<p class="hint">Пока пусто</p>';
  } catch (e) { box.innerHTML = `<p class="hint">${e.message}</p>`; }
}
$('#p-deposit').onclick = () => $('#btn-deposit').click();

// ---------- boot ----------
paintUser();
boot().then(() => { selectTab('play', true); });

// keep the bottom padding of the game screen equal to the real height of the pinned control panel
const ctrl = document.querySelector('.ctrl');
if (ctrl) new ResizeObserver(() => document.documentElement.style.setProperty('--ctrl-h', ctrl.offsetHeight + 16 + 'px')).observe(ctrl);
