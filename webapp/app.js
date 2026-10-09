const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand();

const $ = (s) => document.querySelector(s);
const state = { game: 'rocket', round: null, balance: 0, limits: { minBet: 50, maxBet: 100000, minWithdraw: 100 }, busy: false, raf: 0 };

const RU_ERR = {
  'No active round': 'Раунд уже завершён', 'Insufficient balance': 'Недостаточно звёзд на балансе', 'Finish your current round first': 'Сначала завершите текущий раунд',
  'Open at least one tile': 'Откройте хотя бы одну плитку', 'Make at least one move': 'Сделайте хотя бы один ход', 'Tile already open': 'Плитка уже открыта',
  'Unknown game': 'Игра не найдена', 'Bad tile': 'Неверная плитка', 'Bad choice': 'Неверный выбор', 'Unknown variant': 'Неверная сложность', 'Too early': 'Подождите, пока домик раскачается', 'Bad auto cashout': 'Неверный авто-вывод',
};
function ruError(m) {
  if (RU_ERR[m]) return RU_ERR[m];
  if (/undefined|is not|null|TypeError|Failed to fetch|NetworkError|JSON|Unexpected/i.test(String(m))) { console.error(m); return 'Что-то пошло не так, попробуйте ещё раз'; }
  const b = /^Bet must be (\d+)\.\.(\d+) Stars$/.exec(m); if (b) return `Ставка должна быть от ${b[1]} до ${b[2]} ⭐`;
  const k = /^mines must be/.exec(m); if (k) return 'Количество мин: от 3 до 24';
  return m;
}
async function api(path, body) {
  const t0 = performance.now();
  try { return await api0(path, body); } finally { const d = performance.now() - t0; state.rtt = state.rtt ? state.rtt * 0.7 + d * 0.3 : d; }
}
async function api0(path, body) {
  if (window.__mockApi) { try { return await window.__mockApi(path, body); } catch (e) { throw new Error(ruError(e.message)); } }
  const headers = { 'Content-Type': 'application/json' };
  if (tg?.initData) headers.Authorization = 'tma ' + tg.initData;
  else headers['x-dev-user'] = new URLSearchParams(location.search).get('dev') || '1'; // works only if server has DEV_AUTH=1
  const r = await fetch('/api/' + path, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(ruError(j.error || j.message || 'Ошибка ' + r.status));
  return j;
}

const setBalance = (b) => { state.balance = b; $('#balance').textContent = b; const pb = $('#pbal'); if (pb) pb.textContent = b; };
const say = (t, cls = '') => { const m = $('#msg'); m.textContent = t; m.className = cls; };
const betValue = () => clampBet(Math.floor(Number($('#bet').value) || 0));
const clampBet = (v) => Math.min(state.limits.maxBet, Math.max(state.limits.minBet, v));
const setBet = (v) => { $('#bet').value = clampBet(Math.floor(v)); document.querySelectorAll('.chip[data-bet]').forEach((c) => c.classList.toggle('on', Number(c.dataset.bet) === Number($('#bet').value))); };
const betStep = (v) => (v < 500 ? 50 : v < 1000 ? 100 : v < 5000 ? 500 : v < 20000 ? 1000 : 5000);


// prompt() is unavailable in some webviews, so ask for amounts in the page itself
function askAmount(title, def) {
  return new Promise((resolve) => {
    const d = document.createElement('div');
    d.className = 'modal';
    d.innerHTML = `<div class="box"><p>${title}</p><input id="ask" type="number" inputmode="numeric" value="${def}"><div class="row"><button class="small ghost" id="ask-no">Отмена</button><button class="small" id="ask-ok">ОК</button></div></div>`;
    document.body.append(d);
    const done = (v) => { d.remove(); resolve(v); };
    d.querySelector('#ask-ok').onclick = () => done(Math.floor(Number(d.querySelector('#ask').value)) || 0);
    d.querySelector('#ask-no').onclick = () => done(0);
  });
}

// ---------- per-game option controls ----------
const OPTS = {
  rocket: () => `<label>Авто-вывод (необязательно)</label><div class="row"><input id="auto" type="number" step="0.1" min="1.01" placeholder="например 2.0"></div>`,
  mines: () => `<label>Количество мин</label><div class="row"><select id="mines">${[3,5,7,10,15,20,24].map((n) => `<option ${n === 5 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`,
  tower: () => '',
  towerOld: () => `<label>Сложность</label><div class="row"><select id="variant"><option value="easy">Лёгкая (1 из 4 плохой)</option><option value="medium" selected>Средняя (1 из 3)</option><option value="hard">Сложная (1 из 2)</option><option value="expert">Эксперт (2 из 3)</option></select></div>`,
  seagull: () => '',
};
const startParams = () => ({
  rocket: () => ({ autoCashout: $('#auto')?.value ? Number($('#auto').value) : undefined }),
  mines: () => ({ mines: Number($('#mines').value) }),
  tower: () => ({}),
  seagull: () => ({}),
}[state.game]());

// ---------- renderers ----------
const R = {};

const tier = (m) => (m < 2 ? '' : m < 5 ? ' t2' : m < 10 ? ' t3' : ' t4');
R.rocket = (round) => {
  clearTimeout(state.pollTimer);
  const st = $('#stage');
  let sc = state.scene;
  if (!sc || !st.contains(sc.canvas ?? sc.c)) { // keep one running scene; rebuild only after another game replaced the stage
    st.classList.add('rocketstage');
    st.innerHTML = '<canvas id="fx"></canvas><div class="big mult-over" id="mult">1.00x</div>';
    sc = state.scene = new RocketScene($('#fx'));
    state.rfeed = new RocketFeed($('#rfeed'));
  }
  const feed = state.rfeed, panel = $('#rfeed-panel'); if (panel) panel.hidden = false;
  const el = $('#mult'), v = round?.view;
  const paint = (m, cls = '') => { el.textContent = m.toFixed(2) + 'x'; el.className = 'big mult-over ' + cls + tier(m); };
  const poll = async () => { // learn the real outcome from the server
    try { apply(await api('games/rocket/act', {})); } catch (e) { say(e.message, 'lose'); }
  };
  if (!round) { sc.idle(); paint(1); feed?.reset(); return; }
  if (round.status === 'active') {
    const offset = v.serverNow - Date.now(); // align local clock with server
    if (!feed._started || feed._roundId !== round.id) { feed._started = true; feed._roundId = round.id; feed.reset(); feed.start({ name: tgUser ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') : 'Вы', photo: tgUser?.photo_url, bet: round.bet, auto: v.auto }); }
    sc.fly(v.startedAt, offset, v.growth, (m) => {
      paint(m); feed.tick(m, true);
      if (v.auto && m >= v.auto && !sc.polled) { sc.polled = true; poll(); }
    });
    state.pollTimer = setTimeout(poll, 1500); // each poll re-renders and re-arms the timer
  } else {
    const final = round.status === 'won' ? round.multiplier : v.crash;
    paint(final, round.status === 'lost' ? 'crashed' : 'won');
    sc.finish(round.status);
    if (feed._roundId === round.id) { feed._roundId = null; feed._started = false; if (round.status === 'lost') feed.crash(final); else { feed.userWon(final); feed.tick(final, false); } }
  }
};

// solid fills only (no gradient ids: 25 copies of one id make WebKit pick a hidden, dull copy)
const STAR_SVG = '<svg class="gstar" viewBox="0 0 24 24"><path d="M12 2.2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.1 5.9 20.6l1.5-6.8L2.2 9.2l6.9-.7z" fill="#ffd21f" stroke="#fff3a0" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 5.6l1.7 3.9 4.2.4-3.2 2.8.9 4.1L12 14.6l-3.6 2.2.9-4.1-3.2-2.8 4.2-.4z" fill="#ffee7a"/></svg>';
R.mines = (round) => {
  const v = round?.view; const size = 25;
  const prev = (round && v.revealed.length) ? (state.prevOpen || new Set()) : new Set();   // a fresh round starts with nothing open
  const open = new Set();
  let h = '<div class="grid">';
  for (let i = 0; i < size; i++) {
    const isRev = v?.revealed.includes(i), isGhost = !isRev && v?.mines?.includes(i);
    const mine = isRev ? (v.mines?.includes(i) || (round.status === 'lost' && v.revealed.at(-1) === i)) : isGhost;
    const isOpen = isRev || isGhost; if (isOpen) open.add(i);
    const dis = !round || round.status !== 'active' || isOpen;
    const cls = ['tile', isOpen ? 'open' : '', isOpen && !prev.has(i) ? 'anim' : '', isGhost ? 'ghost' : ''].join(' ');
    const boom = isRev && mine && !prev.has(i);                      // the bomb the player stepped on blows up after the flip
    let fx = ''; if (boom) { for (let k = 0; k < 14; k++) { const a = (k / 14) * 6.283 + Math.random() * 0.4, d = 34 + Math.random() * 36; fx += `<i style="--dx:${(Math.cos(a) * d).toFixed(1)}px;--dy:${(Math.sin(a) * d).toFixed(1)}px"></i>`; } }
    h += `<button class="${cls}${boom ? ' boom' : ''}" data-i="${i}" ${dis ? 'disabled' : ''}><span class="inner"><span class="face front"></span><span class="face back ${mine ? 'mine' : 'safe'}">${mine ? '<span class="bomb">💣</span>' : STAR_SVG}</span></span>${boom ? `<span class="fx">${fx}</span>` : ''}</button>`;
  }
  state.prevOpen = open;
  $('#stage').innerHTML = h.replace('<div class="grid">', open.size && round?.status === 'lost' && [...open].some((i) => !prev.has(i) && v.revealed.includes(i)) ? '<div class="grid shake">' : '<div class="grid">') + '</div>';
  document.querySelectorAll('.tile').forEach((b) => b.onclick = () => act({ tile: Number(b.dataset.i) }));
};

const STEP_ICONS = { tower: ['🧱', '💥'], seagull: ['👶', '🕊'] };
R.steps = (round) => {
  const g = state.game; const v = round?.view;
  if (!v) { $('#stage').innerHTML = `<div style="text-align:center;color:var(--hint)">${g === 'tower' ? 'Строй башню как можно выше 🏗' : 'Чайка летит над тремя детьми 🕊 — угадай, кого она не заберёт'}</div>`; return; }
  const cur = v.picks.length; const over = round.status !== 'active';
  const [ok, bad] = STEP_ICONS[g];
  let h = '<div class="tower">';
  for (let f = 0; f < v.maxSteps; f++) {
    const cls = !over && f === cur ? 'floor cur' : 'floor';
    h += `<div class="${cls}"><div class="x">${v.multipliers[f].toFixed(2)}x</div>`;
    for (let c = 0; c < v.choices; c++) {
      let label = g === 'seagull' ? '👶' : '▫️', k = '';
      if (f < v.picks.length || (over && f === v.picks.length - 1)) {
        const deadly = v.deadly ? v.deadly[f].includes(c) : false;
        if (v.picks[f] === c) { k = deadly ? 'bad' : 'safe'; label = deadly ? bad : ok; }
        else if (deadly) label = bad;
      }
      h += `<button class="${k}" data-c="${c}" ${over || f !== cur ? 'disabled' : ''}>${label}</button>`;
    }
    h += '</div>';
  }
  $('#stage').innerHTML = h + '</div>';
  document.querySelectorAll('.floor button').forEach((b) => b.onclick = () => act({ choice: Number(b.dataset.c) }));
};
R.seagull = R.steps;
// background track for the tower game: starts on entering the game (a user gesture), loops, stops on leaving / when the app is hidden
const Music = (() => {
  const LISTS = { tower: ['tower', 'tower2'] };      // the tower plays its first track, then the second, then starts over
  const pos = {};                                    // per section: where the music was left ({ idx, t }) so coming back resumes instead of restarting
  let a = null, want = false, cur = null, idx = 0;
  const url = (n) => (window.MUSIC_SRC && window.MUSIC_SRC[n]) || `audio/${n}.mp3` + (window.BUILD ? '?v=' + window.BUILD : '');
  const list = () => LISTS[cur] || [cur];
  const save = () => { if (a && cur) pos[cur] = { idx, t: a.currentTime || 0 }; };
  const load = (startAt = 0) => {
    a = new Audio(url(list()[idx])); a.loop = list().length === 1; a.volume = 0.5; a.onended = () => { if (!want) return; idx = (idx + 1) % list().length; load(); };
    if (startAt > 0.1) { const seek = () => { try { if (a.duration && startAt < a.duration - 1) a.currentTime = startAt; } catch {} }; a.addEventListener('loadedmetadata', seek, { once: true }); }
    a.play().catch(() => {});
  };
  // browsers only allow sound after a tap: the first tap starts whatever should be playing
  document.addEventListener('pointerdown', () => { if (want && a && a.paused && !document.hidden) a.play().catch(() => {}); }, { capture: true });
  return {
    play(name = 'tower') { try {
      if (a && cur === name) { want = true; a.play().catch(() => {}); return; }
      if (a) { save(); a.onended = null; a.pause(); a = null; }
      cur = name; const p = pos[name]; idx = p ? p.idx : 0; want = true; load(p ? p.t : 0);
    } catch {} },
    time() { return a && want && cur === 'tower' && !a.paused && a.currentTime > 0 ? a.currentTime : null; },
    track() { return cur === 'tower' ? list()[idx] : null; },
    stop() { try { save(); want = false; if (a) { a.onended = null; a.pause(); a = null; } } catch {} },      // remembers the spot; the next play() of this section continues from it
    pause(on) { try { if (a && want) { on ? a.pause() : a.play().catch(() => {}); } } catch {} },
  };
})();
document.addEventListener('visibilitychange', () => Music.pause(document.hidden));
R.tower = (round) => {                       // flat construction-site scene; the server decides every step
  const st = $('#stage');
  if (!state.tscene && !state.tpending) {
    state.tpending = true; st.classList.add('towerstage'); st.innerHTML = '<canvas class="cv" id="cv-tgame"></canvas>';
    const cv = $('#cv-tgame'), sc = new TowerGame(cv), hint = document.createElement('div');
    hint.className = 'taphint'; hint.textContent = 'Тапни по экрану, чтобы поставить'; st.append(hint);
    state.tpending = false; state.tscene = sc; Music.play();
    sc.onReady = (ok) => { $('#cash').disabled = !ok; hint.classList.toggle('on', ok); };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); if (state.tscene === sc && sc._ready && sc.tap()) { $('#cash').disabled = true; hint.classList.remove('on'); act({ tap: true, lat: Math.round((state.rtt || 80) / 2) }); } });
  }
  state.tscene?.sync(round);
};

// ---------- flow ----------
const RES_LOSS = { mines: 'ПРОИГРЫШ', tower: 'ПРОИГРЫШ', seagull: 'ПРОИГРЫШ', rocket: 'РАКЕТА УЛЕТЕЛА' };
function showResult(r, delay, kind) {          // "win" / "loss" plaque over the board (glass background, opaque text)
  document.querySelector('.resban')?.remove();
  const el = document.createElement('div'); el.className = 'resban ' + kind + (kind === 'win' && state.game === 'tower' ? ' tw' : '') + (state.game === 'mines' ? ' mn' : ''); el.style.setProperty('--d', delay + 's');
  el.innerHTML = kind === 'win'
    ? `<b>ВЫИГРЫШ</b><span>+${r.payout} ⭐ <em>x${r.multiplier.toFixed(2)}</em></span>`
    : `<b>${RES_LOSS[state.game] || 'ПРОИГРЫШ'}</b><span>−${r.bet} ⭐</span>`;
  $('#stage').append(el);
  setTimeout(() => el.remove(), (delay + (state.game === 'mines' ? 2.0 : 3.4)) * 1000);
  lockPlay((delay + (state.game === 'tower' ? 3.4 : state.game === 'mines' ? 1.7 : 2.95)) * 1000);               // no new round while the result animation is still playing
}
// Play button stays disabled until the animation has finished
function lockPlay(ms) {
  state.lockUntil = Date.now() + ms; $('#go').disabled = true;
  clearTimeout(state.lockTimer);
  state.lockTimer = setTimeout(() => { state.lockUntil = 0; $('#go').disabled = false; }, ms);
}
function unlockPlay() { clearTimeout(state.lockTimer); state.lockUntil = 0; $('#go').disabled = false; }
function apply(j) {
  if (j.balance !== undefined) setBalance(j.balance);
  const prev = state.round;
  state.round = j.round;
  const r = j.round;
  R[state.game](r);
  renderDebug(r);
  const active = r?.status === 'active';
  const towerActive = active && state.game === 'tower';
  $('#go').hidden = active; $('#cash').hidden = !active; $('#place').hidden = true;
  
  $('#cash').disabled = towerActive ? !state.tscene?._ready : false;
  $('#cash').textContent = active ? `Забрать ${Math.floor(r.bet * (state.game === 'rocket' ? 1 : r.multiplier))} ⭐` : 'Забрать';
  if (state.game === 'rocket') $('#cash').textContent = 'Забрать';
  $('#cash').classList.toggle('dim', state.game === 'mines' && active && !r.view.revealed.length);      // greyed until the first tile is opened
  if (r && !active && prev?.status === 'active') {
    if (r.status === 'won') { showResult(r, state.game === 'tower' ? 0.9 : 0.15, 'win'); tg?.HapticFeedback?.notificationOccurred('success'); }
    else {
      const delay = state.game === 'mines' ? 0.6 : state.game === 'tower' ? 1.7 : 0.15;                  // mines: wait for the flip and the blast
      showResult(r, delay, 'loss');
      setTimeout(() => tg?.HapticFeedback?.notificationOccurred('error'), delay * 1000);
    }
  } else if (active) say('');
}

async function guard(fn) {
  if (state.busy) return; state.busy = true;
  try { await fn(); } catch (e) { const m = ruError(e.message); say(m, 'lose'); try { apply(await api('games/' + state.game)); say(m, 'lose'); } catch {} } finally { state.busy = false; }
}
const act = (input) => guard(async () => apply(await api(`games/${state.game}/act`, input)));

async function load() {
  clearTimeout(state.pollTimer);
  $('#opts').innerHTML = OPTS[state.game]();
  say('');
  try { apply(await api('games/' + state.game)); } catch (e) { say(e.message, 'lose'); }
}

$('#place').onclick = () => { if ($('#place').disabled) return; state.tscene?.tap?.(); $('#place').disabled = true; $('#cash').disabled = true; act({ choice: 0 }); };   // the house drops at once; the server's verdict arrives a moment later
$('#go').onclick = () => { if (Date.now() < (state.lockUntil || 0)) return; guard(async () => apply(await api(`games/${state.game}/start`, { bet: betValue(), ...startParams() }))); };
function fieldHint(txt) { document.querySelector('.fieldhint')?.remove(); const el = document.createElement('div'); el.className = 'fieldhint'; el.textContent = txt; $('#stage').append(el); setTimeout(() => el.remove(), 2000); }
$('#cash').onclick = () => { if ($('#cash').classList.contains('dim')) { fieldHint('Открой хотя бы одну плитку, чтобы забрать'); return; } cashOut(); };
const cashOut = () => guard(async () => apply(await api(`games/${state.game}/cashout`, {})));
$('#bet-minus').onclick = () => setBet(betValue() - betStep(betValue() - 1));
$('#bet-plus').onclick = () => setBet(betValue() + betStep(betValue()));
$('#bet-x2').onclick = () => setBet(betValue() * 2);
$('#bet-half').onclick = () => setBet(betValue() / 2);
$('#bet-max').onclick = () => setBet(Math.min(state.limits.maxBet, state.balance || state.limits.maxBet));
document.querySelectorAll('.chip[data-bet]').forEach((c) => c.onclick = () => setBet(Number(c.dataset.bet)));
$('#bet').onchange = () => setBet(betValue());
setBet(100);

$('#btn-deposit').onclick = async () => {
  const a = await askAmount('Сколько Stars внести?', 50);
  if (!a) return;
  try {
    const { link } = await api('deposit', { amount: a });
    if (window.__mockApi) { setBalance((await api('me')).balance); say(`Демо: +${a} ⭐`, 'win'); return; }
    tg.openInvoice(link, async (status) => { if (status === 'paid') { await new Promise((r) => setTimeout(r, 1500)); const me = await api('me'); setBalance(me.balance); } });
  } catch (e) { say(e.message, 'lose'); }
};
$('#btn-withdraw').onclick = async () => {
  const a = await askAmount(`Сколько Stars вывести? (минимум ${state.limits.minWithdraw})`, state.limits.minWithdraw);
  if (!a) return;
  try { const j = await api('withdraw', { amount: a }); setBalance(j.balance); say(`Заявка #${j.id} создана, ожидает проверки`, 'win'); } catch (e) { say(e.message, 'lose'); }
};

async function boot() { try { const me = await api('me'); setBalance(me.balance); state.limits = me.limits; } catch (e) { console.warn(e.message); } }

// --- admin / demo debug overlay (opt-in): shows the round's hidden state while developing.
// Enable with ?debug=1 in the URL, or in the console: localStorage.setItem('nova.debug','1')
function renderDebug(round) {
  let box = document.getElementById('dbgbox');
  if (!round?.debug) { if (box) box.hidden = true; return; }
  if (!box) {
    box = document.createElement('div'); box.id = 'dbgbox'; box.className = 'dbgbox';
    box.innerHTML = '<div class="dbg-h">ADMIN · раунд видно</div><div class="dbg-body"></div>';
    document.getElementById('stage')?.append(box);
  }
  box.hidden = false;
  const d = round.debug, body = box.querySelector('.dbg-body'); let html = '';
  if (round.game === 'rocket') html = `<div>Крэш: <b>x${d.crash.toFixed(2)}</b></div><div>Авто-вывод: ${d.auto ? 'x' + d.auto.toFixed(2) : '—'}</div><div>До крэша: <b>${d.msToCrash}мс</b></div>`;
  else if (round.game === 'mines') { const g = []; for (let i = 0; i < d.size; i++) g.push(`<span class="dbg-c ${d.mines.includes(i) ? 'bomb' : (d.revealed.includes(i) ? 'open' : 'safe')}">${d.mines.includes(i) ? '💣' : '·'}</span>`); html = `<div>Бомбы: ${d.mines.length} из ${d.size}</div><div class="dbg-grid">${g.join('')}</div>`; }
  else if (round.game === 'tower') html = `<div>Этаж: ${d.picks + 1}</div><div>Старт качания: ${new Date(d.swingStart).toLocaleTimeString()}</div><div>Период: ${d.period}мс · допуск: ±${d.tol.toFixed(3)}</div>`;
  body.innerHTML = html;
}
