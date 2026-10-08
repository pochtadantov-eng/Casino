const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand();

const $ = (s) => document.querySelector(s);
const state = { game: 'rocket', round: null, balance: 0, limits: { minBet: 1, maxBet: 1000, minWithdraw: 100 }, busy: false, raf: 0 };

async function api(path, body) {
  if (window.__mockApi) return window.__mockApi(path, body);
  const headers = { 'Content-Type': 'application/json' };
  if (tg?.initData) headers.Authorization = 'tma ' + tg.initData;
  else headers['x-dev-user'] = new URLSearchParams(location.search).get('dev') || '1'; // works only if server has DEV_AUTH=1
  const r = await fetch('/api/' + path, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || j.message || 'Ошибка ' + r.status);
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

R.mines = (round) => {
  const v = round?.view; const size = 25;
  let h = '<div class="grid">';
  for (let i = 0; i < size; i++) {
    let cls = '', txt = '', dis = !round || round.status !== 'active';
    if (v?.revealed.includes(i)) { const mine = v.mines?.includes(i) || (round.status === 'lost' && v.revealed.at(-1) === i); cls = mine ? 'mine' : 'safe'; txt = mine ? '💣' : '⭐'; dis = true; }
    else if (v?.mines?.includes(i)) { cls = 'mine ghost'; txt = '💣'; }
    h += `<button class="tile ${cls}" data-i="${i}" ${dis ? 'disabled' : ''}>${txt}</button>`;
  }
  $('#stage').innerHTML = h + '</div>';
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
  try { await fn(); } catch (e) { say(e.message, 'lose'); } finally { state.busy = false; }
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
