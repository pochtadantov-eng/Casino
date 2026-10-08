// DEMO backend that runs entirely in the browser with the same API shape as the real server.
// Used only for the shareable preview (scripts/build-preview.mjs). Not secure: secrets live on the client.
(() => {
  const DAILY = 10, EDGE = 0.03, GROWTH = 0.0001, SIZE = 25;
  const LIMITS = { minBet: 1, maxBet: 1000, maxPayout: 10000, minWithdraw: 100 };
  const floor2 = (x) => Math.floor(x * 100 + 1e-9) / 100;
  const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  const int = (n) => Math.floor(rnd() * n);
  const hex = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');

  let db = { balance: 1000, nonce: 0, id: 0, rounds: {}, hist: [], lastDaily: 0 };
  try { const s = JSON.parse(localStorage.getItem('demo-casino') || 'null'); if (s) db = s; } catch {}
  const save = () => { try { localStorage.setItem('demo-casino', JSON.stringify(db)); } catch {} };
  const fail = (m) => { throw new Error(m); };

  const stepsCfg = {
    tower: { variants: { easy: [4, 1], medium: [3, 1], hard: [2, 1], expert: [3, 2] }, def: 'medium', max: 10 },
    seagull: { variants: { classic: [3, 1] }, def: 'classic', max: 12 },
  };
  const stepsMult = (c, b, k) => (k === 0 ? 1 : floor2((1 - EDGE) * Math.pow(c / (c - b), k)));
  const minesMult = (m, k) => { let x = 1 - EDGE; for (let i = 0; i < k; i++) x *= (SIZE - i) / (SIZE - m - i); return k === 0 ? 1 : floor2(x); };
  const multAt = (ms) => floor2(Math.exp(GROWTH * Math.max(0, ms)));
  const crashPoint = () => Math.min(1000, Math.max(1, floor2((1 - EDGE) / (1 - rnd()))));

  const view = (r, now) => {
    const s = r.state, done = r.status !== 'active';
    if (r.game === 'rocket') return { growth: GROWTH, startedAt: s.startedAt, serverNow: now, auto: s.auto, ...(done ? { crash: s.crash, cashedAt: s.cashedAt ?? null } : {}) };
    if (r.game === 'mines') return { count: s.count, revealed: s.revealed, size: SIZE, ...(done ? { mines: s.mines } : {}) };
    return { variant: s.variant, choices: s.choices, bad: s.bad, maxSteps: s.max, picks: s.picks,
      multipliers: Array.from({ length: s.max }, (_, i) => stepsMult(s.choices, s.bad, i + 1)), ...(done ? { deadly: s.deadly } : {}) };
  };
  const present = (r, now = Date.now()) => ({ id: r.id, game: r.game, bet: r.bet, status: r.status, multiplier: r.multiplier, payout: r.payout,
    serverSeedHash: 'demo-mode', clientSeed: r.clientSeed, nonce: r.nonce, serverSeed: r.status === 'active' ? null : 'demo-mode', view: view(r, now) });

  const finish = (r, status, mult) => {
    r.status = status; r.multiplier = mult;
    r.payout = status === 'won' ? Math.min(Math.floor(r.bet * mult), LIMITS.maxPayout) : 0;
    db.balance += r.payout;
    db.hist.unshift({ ...r }); db.hist = db.hist.slice(0, 20);
  };
  const settleRocket = (r, now) => {
    const s = r.state, m = multAt(now - s.startedAt);
    if (s.auto && s.crash >= s.auto && m >= s.auto) { s.cashedAt = s.auto; finish(r, 'won', s.auto); }
    else if (m >= s.crash) finish(r, 'lost', s.crash);
    else r.multiplier = m;
  };

  const active = (game) => Object.values(db.rounds).find((r) => r.game === game && r.status === 'active');
  const reply = (r) => { save(); return { round: r ? present(r) : null, balance: db.balance }; };

  const handlers = {
    me: () => ({ id: 1, balance: db.balance, limits: LIMITS }),
    history: () => db.hist.slice(0, 20).map((r) => present(r)),
    bonus: () => ({ reward: DAILY, availableAt: db.lastDaily && Date.now() - db.lastDaily < 864e5 ? new Date(db.lastDaily + 864e5).toISOString() : null }),
    'bonus/daily': () => { if (db.lastDaily && Date.now() - db.lastDaily < 864e5) fail('Бонус уже получен, приходите позже'); db.lastDaily = Date.now(); db.balance += DAILY; save(); return { reward: DAILY, balance: db.balance }; },
    deposit: (b) => { db.balance += Number(b.amount) || 0; save(); return { link: 'demo' }; },
    withdraw: (b) => { const a = Number(b.amount); if (a < LIMITS.minWithdraw) fail('Минимум ' + LIMITS.minWithdraw); if (a > db.balance) fail('Insufficient balance'); db.balance -= a; save(); return { id: 1, balance: db.balance }; },
  };

  window.__mockApi = async (path, body) => {
    await new Promise((r) => setTimeout(r, 60)); // feel like a network call
    if (handlers[path]) return handlers[path](body || {});
    const g = path.split('/')[1], o = path.split('/')[2];
    if (!['rocket', 'mines', 'tower', 'seagull'].includes(g)) fail('Unknown game');
    let r = active(g);
    const now = Date.now();
    if (!o) { if (r && g === 'rocket') settleRocket(r, now); return reply(r || null); }
    if (o === 'start') {
      const bet = Number(body.bet);
      if (!Number.isInteger(bet) || bet < LIMITS.minBet || bet > LIMITS.maxBet) fail(`Bet must be ${LIMITS.minBet}..${LIMITS.maxBet} Stars`);
      if (r) fail('Finish your current round first');
      if (bet > db.balance) fail('Insufficient balance');
      let state;
      if (g === 'rocket') {
        let auto = null;
        if (body.autoCashout != null) { auto = floor2(Number(body.autoCashout)); if (!(auto >= 1.01 && auto <= 1000)) fail('Bad auto cashout'); }
        state = { crash: crashPoint(), startedAt: now, auto };
      } else if (g === 'mines') {
        const count = Number(body.mines); if (!Number.isInteger(count) || count < 1 || count > 24) fail('mines must be 1..24');
        const board = [...Array(SIZE).keys()]; for (let i = 0; i < count; i++) { const j = i + int(SIZE - i); [board[i], board[j]] = [board[j], board[i]]; }
        state = { count, mines: board.slice(0, count), revealed: [] };
      } else {
        const c = stepsCfg[g], name = body.variant || c.def, v = c.variants[name]; if (!v) fail('Unknown variant');
        const deadly = Array.from({ length: c.max }, () => { const pool = [...Array(v[0]).keys()]; for (let i = 0; i < v[1]; i++) { const j = i + int(v[0] - i); [pool[i], pool[j]] = [pool[j], pool[i]]; } return pool.slice(0, v[1]); });
        state = { variant: name, choices: v[0], bad: v[1], max: c.max, deadly, picks: [] };
      }
      db.balance -= bet; db.nonce++; db.id++;
      r = { id: db.id, game: g, bet, status: 'active', multiplier: 1, payout: 0, state, clientSeed: body.clientSeed || hex(), nonce: db.nonce };
      db.rounds[r.id] = r; return reply(r);
    }
    if (!r) fail('No active round');
    const s = r.state;
    if (o === 'act') {
      if (g === 'rocket') settleRocket(r, now);
      else if (g === 'mines') {
        const t = Number(body.tile); if (!Number.isInteger(t) || t < 0 || t >= SIZE) fail('Bad tile'); if (s.revealed.includes(t)) fail('Tile already open');
        s.revealed.push(t);
        if (s.mines.includes(t)) finish(r, 'lost', 0);
        else { r.multiplier = minesMult(s.count, s.revealed.length); if (s.revealed.length === SIZE - s.count) finish(r, 'won', r.multiplier); }
      } else {
        const c = Number(body.choice); if (!Number.isInteger(c) || c < 0 || c >= s.choices) fail('Bad choice');
        const step = s.picks.length; s.picks.push(c);
        if (s.deadly[step].includes(c)) finish(r, 'lost', 0);
        else { r.multiplier = stepsMult(s.choices, s.bad, s.picks.length); if (s.picks.length === s.max) finish(r, 'won', r.multiplier); }
      }
      return reply(r);
    }
    if (o === 'cashout') {
      if (g === 'rocket') { settleRocket(r, now); if (r.status === 'active') { s.cashedAt = r.multiplier; finish(r, 'won', r.multiplier); } }
      else if (g === 'mines') { if (!s.revealed.length) fail('Open at least one tile'); finish(r, 'won', minesMult(s.count, s.revealed.length)); }
      else { if (!s.picks.length) fail('Make at least one move'); finish(r, 'won', stepsMult(s.choices, s.bad, s.picks.length)); }
      return reply(r);
    }
    fail('Not found');
  };
})();
