const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand();

const $ = (s) => document.querySelector(s);
const state = { game: 'rocket', round: null, balance: 0, limits: { minBet: 1, maxBet: 1000, minWithdraw: 100 }, busy: false, raf: 0 };

const RU_ERR = {
  'No active round': 'Раунд уже завершён', 'Insufficient balance': 'Недостаточно звёзд на балансе', 'Finish your current round first': 'Сначала завершите текущий раунд',
  'Open at least one tile': 'Откройте хотя бы одну плитку', 'Make at least one move': 'Сделайте хотя бы один ход', 'Tile already open': 'Плитка уже открыта',
  'Unknown game': 'Игра не найдена', 'Bad tile': 'Неверная плитка', 'Bad choice': 'Неверный выбор', 'Unknown variant': 'Неверная сложность', 'Bad auto cashout': 'Неверный авто-вывод',
};
function ruError(m) {
  if (RU_ERR[m]) return RU_ERR[m];
  if (/undefined|is not|null|TypeError|Failed to fetch|NetworkError|JSON|Unexpected/i.test(String(m))) { console.error(m); return 'Что-то пошло не так, попробуйте ещё раз'; }
  const b = /^Bet must be (\d+)\.\.(\d+) Stars$/.exec(m); if (b) return `Ставка должна быть от ${b[1]} до ${b[2]} ⭐`;
  const k = /^mines must be/.exec(m); if (k) return 'Количество мин: от 1 до 24';
  return m;
}
async function api(path, body) {
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
const betValue = () => Math.max(1, Math.floor(Number($('#bet').value) || 0));


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
  mines: () => `<label>Количество мин</label><div class="row"><select id="mines">${[1,2,3,5,8,10,15,20,24].map((n) => `<option ${n === 3 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`,
  tower: () => `<label>Сложность</label><div class="row"><select id="variant"><option value="easy">Лёгкая (1 из 4 плохой)</option><option value="medium" selected>Средняя (1 из 3)</option><option value="hard">Сложная (1 из 2)</option><option value="expert">Эксперт (2 из 3)</option></select></div>`,
  seagull: () => '',
};
const startParams = () => ({
  rocket: () => ({ autoCashout: $('#auto')?.value ? Number($('#auto').value) : undefined }),
  mines: () => ({ mines: Number($('#mines').value) }),
  tower: () => ({ variant: $('#variant').value }),
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
    st.innerHTML = '<canvas id="fx"></canvas><div class="big mult-over" id="mult">1.00x</div>';
    sc = state.scene = new RocketScene($('#fx'));
  }
  const el = $('#mult'), v = round?.view;
  const paint = (m, cls = '') => { el.textContent = m.toFixed(2) + 'x'; el.className = 'big mult-over ' + cls + tier(m); };
  const poll = async () => { // learn the real outcome from the server
    try { apply(await api('games/rocket/act', {})); } catch (e) { say(e.message, 'lose'); }
  };
  if (!round) { sc.idle(); paint(1); return; }
  if (round.status === 'active') {
    const offset = v.serverNow - Date.now(); // align local clock with server
    sc.fly(v.startedAt, offset, v.growth, (m) => {
      paint(m);
      if (v.auto && m >= v.auto && !sc.polled) { sc.polled = true; poll(); }
    });
    state.pollTimer = setTimeout(poll, 1500); // each poll re-renders and re-arms the timer
  } else {
    paint(round.status === 'won' ? round.multiplier : v.crash, round.status === 'lost' ? 'crashed' : 'won');
    sc.finish(round.status);
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
R.tower = R.seagull = R.steps;

// ---------- flow ----------
function apply(j) {
  if (j.balance !== undefined) setBalance(j.balance);
  const prev = state.round;
  state.round = j.round;
  const r = j.round;
  R[state.game](r);
  const active = r?.status === 'active';
  $('#go').hidden = active; $('#cash').hidden = !active;
  $('#cash').textContent = active ? `Забрать ${Math.floor(r.bet * (state.game === 'rocket' ? 1 : r.multiplier))} ⭐` : 'Забрать';
  if (state.game === 'rocket') $('#cash').textContent = 'Забрать';
  if (r && !active && prev?.status === 'active') {
    if (r.status === 'won') { say(`Выигрыш +${r.payout} ⭐ (x${r.multiplier.toFixed(2)})`, 'win'); tg?.HapticFeedback?.notificationOccurred('success'); }
    else { say('Проигрыш', 'lose'); tg?.HapticFeedback?.notificationOccurred('error'); }
  } else if (active) say('');
  $('#fair').innerHTML = r ? `hash(serverSeed): ${r.serverSeedHash}<br>clientSeed: ${r.clientSeed}<br>nonce: ${r.nonce}<br>serverSeed: ${r.serverSeed ?? '— (откроется после раунда)'}` : '';
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

$('#go').onclick = () => guard(async () => apply(await api(`games/${state.game}/start`, { bet: betValue(), ...startParams() })));
$('#cash').onclick = () => guard(async () => apply(await api(`games/${state.game}/cashout`, {})));
$('#bet-minus').onclick = () => $('#bet').value = Math.max(1, betValue() - 10);
$('#bet-plus').onclick = () => $('#bet').value = Math.min(state.limits.maxBet, betValue() + 10);
$('#bet-x2').onclick = () => $('#bet').value = Math.min(state.limits.maxBet, betValue() * 2);

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
