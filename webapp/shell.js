// App shell: lobby navigation, liquid-glass dock, bonus and profile tabs.
const TITLES = { rocket: '🚀 Ракета', mines: '💣 Мины', tower: '🏗 Башня', seagull: '🕊 Чайка' };
const GICON = { rocket: '🚀', mines: '💣', tower: '🏗', seagull: '🕊' };
const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
const fmtTime = (ms) => { const m = Math.max(0, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`; };

// ---------- views ----------
let view = 'play', tab = 'play';
function show(name) {
  if (name !== 'game') { RC.stop(); clearTimeout(state.pollTimer); cancelAnimationFrame(state.raf); state.scene = null; state.tscene = null; state.tpending = false; Music.play('menu'); $('#stage').className = ''; $('#stage').innerHTML = ''; const rp = $('#rfeed-panel'); if (rp) { rp.hidden = true; $('#rfeed').innerHTML = ''; } state.rfeed = null; }
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
  RC.stop(); $('#go').textContent = 'Играть'; $('#go').disabled = false; $('#go').hidden = false; $('#cash').hidden = true;
  state.game = g; state.round = null; unlockPlay(); state.tscene = null; state.tpending = false; Music.stop(); $('#stage').className = '';
  { const rp = $('#rfeed-panel'); if (rp) { rp.hidden = g !== 'rocket'; if (g !== 'rocket') $('#rfeed').innerHTML = ''; } state.rfeed = null; }
  $('#gtitle').textContent = TITLES[g]; document.querySelector('.ctrl').dataset.game = g;
  show('game');
  document.querySelector('.loadgate')?.remove();
  if (g === 'mines' || g === 'rocket') Music.play(g);
  if (g === 'tower') {                                       // 5 s loading screen: nothing in the app can be pressed meanwhile
    const gate = document.createElement('div'); gate.className = 'loadgate'; document.body.append(gate);
    const kill = (e) => { e.preventDefault(); e.stopPropagation(); }; ['click', 'pointerdown', 'touchstart', 'mousedown'].forEach((ev) => gate.addEventListener(ev, kill, { passive: false }));
    setTimeout(() => gate.remove(), 5000);
  }
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
let chestPrizes = [];
async function loadBonus() {
  const btn = $('#bonus-claim'), txt = $('#bonus-text');
  try {
    const b = await api('bonus');
    chestPrizes = b.prizes || [];
    const wait = b.availableAt ? new Date(b.availableAt).getTime() - Date.now() : 0;
    if (b.enabled === false) { txt.textContent = 'Сундук сейчас недоступен.'; btn.disabled = true; return; }
    btn.disabled = wait > 0; $('#bonus-panel').classList.toggle('ready', wait <= 0);
    txt.textContent = wait > 0 ? `Следующий сундук через ${fmtTime(wait)}` : b.unlimited ? 'Тестовый режим: крути рулетку сколько хочешь!' : 'Крути рулетку: от 15 до 1000 ⭐ и подарки Telegram прямо в чат!';
    btn.textContent = wait > 0 ? 'Уже открыт' : 'Открыть сундук';
  } catch (e) { txt.textContent = e.message; btn.disabled = true; }
}

// ---------- the chest roulette: the server draws the prize, the strip below only shows it ----------
const RARITY = (p) => (p.giftStars ? 'gift' : p.stars >= 1000 ? 'r6' : p.stars >= 500 ? 'r5' : p.stars >= 150 ? 'r4' : p.stars >= 100 ? 'r3' : p.stars >= 50 ? 'r2' : p.stars >= 25 ? 'r1' : 'r0');
const cardHtml = (p) => `<div class="rcard ${RARITY(p)}"><div class="rico">${p.giftStars ? (p.emoji || '🎁') : '⭐'}</div><b>${p.giftStars ? 'Подарок' : p.stars}</b><span>${p.giftStars ? '≈' + p.giftStars + ' ⭐' : 'звёзд'}</span></div>`;
function openChestRoulette() {
  if (document.querySelector('.chestmodal')) return;
  const prizes = chestPrizes.length ? chestPrizes : [{ id: 's15', stars: 15, label: '15 ⭐' }];
  const m = document.createElement('div'); m.className = 'chestmodal';
  m.innerHTML = `<div class="cm-box"><h3>Ежедневный сундук</h3>
    <div class="cm-chest" id="cm-chest"><i class="rays"></i><img src="${document.querySelector('.panel.bonus .chest')?.src || 'img/chest.webp'}" alt=""></div>
    <div class="cm-roul" id="cm-roul"><div class="cm-mark"></div><div class="cm-strip" id="cm-strip"></div></div>
    <div class="cm-res" id="cm-res"></div><button class="primary cm-ok" id="cm-ok" hidden>Забрать</button></div>`;
  document.body.append(m); requestAnimationFrame(() => m.classList.add('on'));
  const hap = (t) => { try { window.Telegram?.WebApp?.HapticFeedback?.[t === 's' ? 'selectionChanged' : 'notificationOccurred'](t === 's' ? undefined : t); } catch {} };
  const close = () => { m.classList.remove('on'); setTimeout(() => m.remove(), 250); loadBonus(); };
  m.querySelector('#cm-ok').onclick = close;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  (async () => {
    let res;
    const req = api('bonus/daily', {}).then((r) => (res = r)).catch((e) => ({ error: e.message }));
    await wait(900);                                                 // the chest shakes while the server decides
    const out = await req;
    if (out.error) { m.querySelector('#cm-res').innerHTML = `<p class="cm-err">${out.error}</p>`; const ok = m.querySelector('#cm-ok'); ok.hidden = false; ok.textContent = 'Закрыть'; return; }
    const prize = out.prize, T = 54, N = 64, W = 98, G = 8;
    const strip = m.querySelector('#cm-strip'), pool = prizes.flatMap((p) => Array(p.giftStars ? 1 : p.stars >= 500 ? 1 : p.stars >= 100 ? 2 : 4).fill(p));
    const items = Array.from({ length: N }, (_, i) => (i === T ? { ...(prizes.find((p) => p.id === prize.id) || prize), emoji: prize.gift?.emoji } : pool[Math.floor(Math.random() * pool.length)]));
    strip.innerHTML = items.map(cardHtml).join('');
    m.classList.add('spin'); await wait(450);                         // the chest opens, the roulette appears
    const view = m.querySelector('#cm-roul').clientWidth, jitter = (Math.random() - 0.5) * W * 0.6;
    const x = -(T * (W + G) + W / 2) + view / 2 + jitter;
    strip.style.transition = 'transform 5.4s cubic-bezier(.1,.62,.08,1)'; strip.style.transform = `translateX(${x}px)`;
    let last = -1; const tick = setInterval(() => { const cur = new DOMMatrix(getComputedStyle(strip).transform).m41, idx = Math.floor((view / 2 - cur) / (W + G)); if (idx !== last) { last = idx; hap('s'); } }, 60);
    await wait(5600); clearInterval(tick);
    strip.children[T].classList.add('win'); m.classList.add('done'); setBalance(out.balance); hap('success');
    m.querySelector('#cm-res').innerHTML = prize.gift ? `<b>${prize.gift.emoji} Вам выпал подарок!</b><span>Он в вашем Инвентаре (Профиль): продай за звёзды или выведи в чат 🎁</span>` : `<b>Вы выиграли ${prize.stars} ⭐</b><span>Уже на вашем балансе</span>`;
    for (let i = 0; i < 26; i++) { const s = document.createElement('i'); s.className = 'cm-conf'; const a = Math.random() * 6.283, d = 90 + Math.random() * 150; s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d - 40 + 'px'); s.style.background = ['#ffd84a', '#ff8a4a', '#6fd6a5', '#6aa8ff', '#e879f9'][i % 5]; s.style.animationDelay = Math.random() * 0.2 + 's'; m.querySelector('.cm-box').append(s); setTimeout(() => s.remove(), 1700); }
    const ok = m.querySelector('#cm-ok'); ok.hidden = false;
  })();
}
$('#bonus-claim').onclick = () => { if (!$('#bonus-claim').disabled) openChestRoulette(); };

// ---------- profile ----------
const CASH_LABEL = { inventory_sell: ['💰 Продажа подарка', 'w'], deposit: ['⭐ Пополнение', 'w'], deposit_refund: ['↩️ Возврат пополнения', 'l'], withdraw: ['📤 Вывод (заявка)', 'l'], withdraw_refund: ['↩️ Вывод отклонён', 'w'], bonus: ['🎁 Бонус', 'w'], gift_withdraw: ['🎁 Подарок в чат', 'l'], gift_refund: ['↩️ Подарок не доставлен', 'w'] };
async function loadCash() {
  const box = $('#cashlog'); if (!box) return;
  try {
    const rows = await api('cash');
    box.innerHTML = rows.length ? rows.map((r) => { let [t, c] = CASH_LABEL[r.kind] || [r.kind, '']; if (r.kind === 'gift_withdraw') { if (r.status === 'pending' || r.status === 'sending') { t = '⏳ Вывод в обработке…'; c = 'l'; } else if (r.status === 'sent') { t = '✅ Выведено · подарок в чате'; c = 'l'; } else if (r.status === 'failed') t = '❌ Подарок не отправлен'; }
    else if (r.kind === 'withdraw') { if (r.status === 'pending') t = '⏳ Вывод в обработке…'; else if (r.status === 'approved') { t = '✅ Выведено'; c = 'l'; } else if (r.status === 'rejected') t = '↩️ Вывод отклонён'; } const d = new Date(r.at); return `<div class="hrow"><span>${t}<small class="hdate">${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</small></span><span class="${c}">${r.amount > 0 ? '+' : ''}${r.amount} ⭐</span></div>`; }).join('') : '<p class="hint">Пока пусто</p>';
  } catch (e) { box.innerHTML = `<p class="hint">${e.message}</p>`; }
}
async function loadProfile() {
  paintUser(); loadCash(); loadInventory();
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


// ---------- inventory: gifts won in the chest; sell for Stars or withdraw into the chat with the bot ----------
let invItems = [], invSellPct = 85;
async function loadInventory() {
  const box = $('#inv'); if (!box) return;
  try {
    const j = await api('inventory'); invItems = j.items || []; invSellPct = j.sellPct || 85;
    box.hidden = false;
    const total = invItems.reduce((a, g) => a + g.stars, 0), n = invItems.length;
    $('#inv-sub').textContent = n ? `${n} ${n === 1 ? 'подарок' : n < 5 ? 'подарка' : 'подарков'} · ${total} ⭐` : 'Пока пусто — открывай сундук';
    $('#inv-all').style.visibility = n ? 'visible' : 'hidden';
    $('#inv-row').innerHTML = n ? invItems.slice(0, 3).map(giftCardHtml).join('') : '<div class="invempty">Подарки из сундука появятся здесь</div>';
    $('#inv-row').querySelectorAll('.icard').forEach((c) => c.onclick = () => openItem(invItems.find((g) => g.id === Number(c.dataset.id))));
  } catch (e) { box.hidden = true; }
}
const giftCardHtml = (g) => `<button class="icard" data-id="${g.id}"><span class="iem">${g.emoji}</span><b>${g.stars} ⭐</b></button>`;
function openItem(g) {
  if (!g || document.querySelector('.itemsheet')) return;
  const d = document.createElement('div'); d.className = 'paysheet itemsheet';
  d.innerHTML = `<div class="pbox"><i class="grab"></i><div class="ibig">${g.emoji}</div><h3 style="text-align:center">Подарок · ${g.stars} ⭐</h3><p class="psub" style="text-align:center">Продай за звёзды или выведи подарок в чат с ботом.</p>
    <p class="perr" id="i-err" style="text-align:center"></p>
    <button class="primary" id="i-sell">Продать за ${g.sell} ⭐</button><button class="primary alt" id="i-wd">Вывести в чат</button><button class="plink" id="i-no">Закрыть</button></div>`;
  document.body.append(d); requestAnimationFrame(() => d.classList.add('on'));
  const close = () => { d.classList.remove('on'); setTimeout(() => d.remove(), 250); };
  d.querySelector('#i-no').onclick = close; d.onclick = (e) => { if (e.target === d) close(); };
  const err = d.querySelector('#i-err'), lock = (v) => d.querySelectorAll('button').forEach((b) => b.disabled = v);
  d.querySelector('#i-sell').onclick = async () => { lock(true); try { const r = await api('inventory/sell', { id: g.id }); setBalance(r.balance); close(); toast(`Продано: +${r.pay} ⭐`, 'ok'); loadInventory(); loadCash(); } catch (e) { err.textContent = e.message; lock(false); } };
  d.querySelector('#i-wd').onclick = async () => { lock(true); try { const r = await api('inventory/withdraw', { id: g.id }); close(); toast(`Подарок ${g.emoji} в обработке: придёт в чат с ботом через ~${r.etaSec} с`, 'wait', 5200); loadInventory(); } catch (e) { err.textContent = e.message; lock(false); } };
}
$('#inv-all').onclick = () => {
  if (document.querySelector('.invsheet')) return;
  const d = document.createElement('div'); d.className = 'paysheet invsheet';
  d.innerHTML = `<div class="pbox"><i class="grab"></i><h3>Инвентарь</h3><p class="psub">Нажми на подарок, чтобы продать или вывести его.</p><div class="ggrid" id="inv-grid">${invItems.map(giftCardHtml).join('')}</div><button class="plink" id="inv-no">Закрыть</button></div>`;
  document.body.append(d); requestAnimationFrame(() => d.classList.add('on'));
  const close = () => { d.classList.remove('on'); setTimeout(() => d.remove(), 250); };
  d.querySelector('#inv-no').onclick = close; d.onclick = (e) => { if (e.target === d) close(); };
  d.querySelectorAll('.icard').forEach((c) => c.onclick = () => { close(); setTimeout(() => openItem(invItems.find((g) => g.id === Number(c.dataset.id))), 260); });
};
