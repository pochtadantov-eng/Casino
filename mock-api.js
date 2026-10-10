// DEMO backend that runs entirely in the browser with the same API shape as the real server.
// Used only for the shareable preview (scripts/build-preview.mjs). Not secure: secrets live on the client.
(() => {
  const DAILY = 10, EDGE = 0.08, GROWTH = 0.0001, SIZE = 25;
  const LIMITS = { minBet: 50, maxBet: 100000, maxPayout: 1000000, minWithdraw: 100, minDeposit: 50, maxDeposit: 10000 };
  const floor2 = (x) => Math.floor(x * 100 + 1e-9) / 100;
  const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  const int = (n) => Math.floor(rnd() * n);
  const hex = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');

  let db = { balance: 1000, nonce: 0, id: 0, rounds: {}, hist: [], lastDaily: 0 };
  try {   // saved state from older versions may lack newer fields: merge with defaults instead of trusting it
    const saved = JSON.parse(localStorage.getItem('demo-casino') || 'null');
    if (saved && typeof saved === 'object') db = { ...db, ...saved };
  } catch {}
  if (!Array.isArray(db.hist)) db.hist = [];
  if (!db.rounds || typeof db.rounds !== 'object') db.rounds = {};
  if (!Number.isFinite(db.balance)) db.balance = 1000;
  const save = () => { try { localStorage.setItem('demo-casino', JSON.stringify(db)); } catch {} };
  const fail = (m) => { throw new Error(m); };

  // Tower (skill) - mirrors src/games/engines/tower.ts. The swing is a function of (server) time.
  const TW = { grace: 40, maxSteps: 20, spaceFrom: 10, spaceGrowth: 1.1, ladderGrowth: 1.2, easyFloors: 5, easyMult: 2, amp: 1.6, firstDelay: 2700, nextDelay: 2500, maxLat: 250 };
  const TW_EASY = !!window.EASY_TOWER || /[?&]easy(=|&|$)/.test(location.search);        // demo shortcut: every drop lands, to look at the space floors
  const twPeriod = (k) => (k === 0 ? 3000 : k === 1 ? 2400 : k === 2 ? 2100 : k < TW.spaceFrom ? Math.max(1250, 2000 - 90 * (k - 3)) : Math.max(1050, 1400 - 35 * (k - TW.spaceFrom)));
  const twTol = (k) => TW_EASY ? 3 : twTol0(k);
  const TW_HW = 1.9, TW_SNAP = 0.3;
  const twTol0 = (k) => (k < TW.spaceFrom ? Math.max(0.1, 0.42 - 0.055 * k) : Math.max(0.06, 0.1 - 0.004 * (k - TW.spaceFrom)));
  const twTop = (s) => (s.offsets && s.offsets.length ? s.offsets[s.offsets.length - 1] : 0);
  const twX = (t, start, k) => TW.amp * Math.sin((2 * Math.PI * (t - start)) / twPeriod(k));
  const twMult = (n) => (n === 0 ? 1 : n <= TW.easyFloors ? floor2(Math.pow(TW.easyMult, n / TW.easyFloors)) : n <= TW.spaceFrom ? floor2(TW.easyMult * Math.pow(TW.ladderGrowth, n - TW.easyFloors)) : floor2(TW.easyMult * Math.pow(TW.ladderGrowth, TW.spaceFrom - TW.easyFloors) * Math.pow(TW.spaceGrowth, n - TW.spaceFrom)));
  const stepsCfg = {
    seagull: { variants: { classic: [3, 1] }, def: 'classic', max: 12 },
  };
  const stepsMult = (c, b, k) => (k === 0 ? 1 : floor2((1 - EDGE) * Math.pow(c / (c - b), k)));
  const minesMult = (m, k) => { let x = 1 - 0.15; for (let i = 0; i < k; i++) x *= (SIZE - i) / (SIZE - m - i); return k === 0 ? 1 : floor2(x); };
  const multAt = (ms) => floor2(Math.exp(GROWTH * Math.max(0, ms)));
  const crashPoint = () => Math.min(1000, Math.max(1, floor2((1 - EDGE) / (1 - rnd()))));

  // Rocket as one shared endless sequence of rounds (mirrors src/games/engines/rocket-schedule.ts; the demo derives crash points from a plain PRNG)
  const RK = { BET: 5000, PAUSE: 3500, EPOCH: Date.UTC(2026, 9, 1) };
  const rkCrash = (k) => { let s = ((k + 1) * 2654435761) >>> 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296; return Math.min(1000, Math.max(1, floor2((1 - EDGE) / (1 - u)))); };
  const rkBuild = (k, start) => { const crash = rkCrash(k), fs = start + RK.BET, ca = fs + Math.ceil(Math.log(crash) / GROWTH); return { k, betStart: start, flightStart: fs, crashAt: ca, nextStart: ca + RK.PAUSE, crash }; };
  let rkc = { k: 0, start: RK.EPOCH };
  const rkAt = (now) => { let r = rkBuild(rkc.k, rkc.start); while (r.nextStart <= now) { r = rkBuild(r.k + 1, r.nextStart); rkc = { k: r.k, start: r.betStart }; } return r; };
  const rkPublic = (now) => { const r = rkAt(now), crashed = now >= r.crashAt; return { k: r.k, serverNow: now, betStart: r.betStart, flightStart: r.flightStart, nextStart: r.nextStart, growth: GROWTH, phase: now < r.flightStart ? 'bet' : crashed ? 'crash' : 'fly', ...(crashed ? { crash: r.crash, crashAt: r.crashAt } : {}), history: Array.from({ length: Math.min(14, r.k + (crashed ? 1 : 0)) }, (_, i) => rkCrash(r.k + (crashed ? 0 : -1) - i)) }; };

  const view = (r, now) => {
    const s = r.state, done = r.status !== 'active';
    if (r.game === 'rocket') return { growth: GROWTH, startedAt: s.startedAt, serverNow: now, auto: s.auto, k: s.k ?? null, ...(done ? { crash: s.crash, cashedAt: s.cashedAt ?? null } : {}) };
    if (r.game === 'tower') return { picks: s.picks, maxSteps: TW.maxSteps, last: s.last, serverNow: now, multipliers: Array.from({ length: TW.maxSteps }, (_, i) => twMult(i + 1)), offsets: s.offsets || [], hw: TW_HW, stress: 0, range: [twTop(s) - twTol(s.picks), twTop(s) + twTol(s.picks)], swing: { start: s.swingStart, period: twPeriod(s.picks), amp: TW.amp, tol: twTol(s.picks) } };
    if (r.game === 'mines') return { count: s.count, revealed: s.revealed, size: SIZE, ...(done ? { mines: s.mines } : {}) };
    return { variant: s.variant, choices: s.choices, bad: s.bad, maxSteps: s.max, picks: s.picks,
      multipliers: Array.from({ length: s.max }, (_, i) => stepsMult(s.choices, s.bad, i + 1)), ...(done ? { deadly: s.deadly } : {}) };
  };
  const DEBUG = /[?&]debug(=|&|$)/.test(location.search) || localStorage.getItem('nova.debug') === '1';
  const debugOf = (r, now) => {                           // admin/demo peek at the current round state
    const s = r.state; if (r.game === 'rocket') return { crash: s.crash, auto: s.auto, msToCrash: Math.max(0, Math.round((Math.log(s.crash) / GROWTH * 1000) - (now - s.startedAt))) };
    if (r.game === 'mines') return { mines: s.mines, revealed: s.revealed, size: SIZE };
    if (r.game === 'tower') return { picks: s.picks, swingStart: s.swingStart, period: twPeriod(s.picks), offsets: s.offsets, tol: twTol(s.picks) };
    return { picks: s.picks, deadly: s.deadly };
  };
  const present = (r, now = Date.now()) => ({ id: r.id, game: r.game, bet: r.bet, status: r.status, multiplier: r.multiplier, payout: r.payout,
    serverSeedHash: 'demo-mode', clientSeed: r.clientSeed, nonce: r.nonce, serverSeed: r.status === 'active' ? null : 'demo-mode', view: view(r, now), debug: DEBUG ? debugOf(r, now) : undefined });

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

  // daily chest (mirrors src/wallet/chest.ts)
  const CHEST_W = [['s15', 15, 55], ['s25', 25, 25], ['s50', 50, 12], ['s100', 100, 5], ['s150', 150, 1.8], ['s500', 500, 0.8], ['s1000', 1000, 0.3], ['g25', 0, 0.5], ['g50', 0, 0.25], ['g100', 0, 0.1]];
  const CHEST = CHEST_W.map(([id, stars]) => id[0] === 'g' ? { id, giftStars: Number(id.slice(1)), label: 'Подарок ≈' + id.slice(1) + ' ⭐' } : { id, stars, label: stars + ' ⭐' });
  const GIFT_EMOJI = { 25: ['🎁', '🌹'], 50: ['🎂', '🚀', '💐'], 100: ['🏆', '💍', '💎'] };
  const drawChest = () => { const forced = new URLSearchParams(location.search).get('prize'); if (forced === 'gift') return CHEST.find((p) => p.id === 'g50'); if (forced) { const f = CHEST.find((p) => p.id === forced); if (f) return f; } let r = Math.random() * CHEST_W.reduce((s, x) => s + x[2], 0); for (const [id, , w] of CHEST_W) { r -= w; if (r < 0) return CHEST.find((p) => p.id === id); } return CHEST[0]; };

  const GIFTS = [['g1', '🧸', 15], ['g2', '❤️', 15], ['g3', '🎁', 25], ['g4', '🌹', 25], ['g5', '🎂', 50], ['g6', '💐', 50], ['g7', '🚀', 50], ['g8', '🏆', 100], ['g9', '💍', 100], ['g10', '💎', 100]].map(([id, emoji, stars]) => ({ id, emoji, stars }));
  const handlers = {
    me: () => ({ id: 1, balance: db.balance, limits: LIMITS }),
    history: () => db.hist.slice(0, 20).map((r) => present(r)),
    bonus: () => ({ enabled: true, unlimited: true, availableAt: null, prizes: CHEST }),      // demo: the chest can be opened again and again
    'bonus/daily': () => { db.lastDaily = Date.now(); const p = drawChest(); if (p.stars) { db.balance += p.stars; (db.cash = db.cash || []).unshift({ kind: 'bonus', amount: p.stars, balance: db.balance, at: new Date().toISOString() }); } save(); const gift = p.giftStars ? { emoji: GIFT_EMOJI[p.giftStars][Math.floor(Math.random() * GIFT_EMOJI[p.giftStars].length)], stars: p.giftStars, delivered: true } : null; return { prize: { id: p.id, stars: p.stars, giftStars: p.giftStars, label: p.label, gift }, balance: db.balance }; },
    gifts: () => ({ perDay: 5, gifts: GIFTS.map((g) => ({ ...g, price: Math.ceil(g.stars * 1.1), limited: false })) }),
    'gifts/send': (b) => { const g = GIFTS.find((x) => x.id === b.giftId); if (!g) fail('Подарок недоступен'); const price = Math.ceil(g.stars * 1.1); if (price > db.balance) fail('Недостаточно звёзд'); db.balance -= price; const etaSec = 15 + Math.round(Math.random() * 5); (db.cash = db.cash || []).unshift({ kind: 'gift_withdraw', amount: -price, balance: db.balance, at: new Date().toISOString(), doneAt: Date.now() + etaSec * 1000 }); save(); return { price, etaSec, balance: db.balance }; },
    cash: () => (db.cash || []).slice(0, 20).map((r) => (r.kind === 'gift_withdraw' ? { ...r, status: Date.now() >= (r.doneAt || 0) ? 'sent' : 'pending' } : r.kind === 'withdraw' ? { ...r, status: Date.now() >= (r.doneAt || 0) ? 'approved' : 'pending' } : r)),
    deposit: (b) => { const a = Number(b.amount) || 0; if (!Number.isInteger(a) || a < LIMITS.minDeposit || a > LIMITS.maxDeposit) fail(`Deposit must be ${LIMITS.minDeposit}..${LIMITS.maxDeposit} Stars`); db.balance += a; (db.cash = db.cash || []).unshift({ kind: 'deposit', amount: a, balance: db.balance, at: new Date().toISOString() }); save(); return { link: 'demo' }; },
    withdraw: (b) => { const a = Number(b.amount); if (a < LIMITS.minWithdraw) fail('Минимум ' + LIMITS.minWithdraw); if (a > db.balance) fail('Insufficient balance'); db.balance -= a; (db.cash = db.cash || []).unshift({ kind: 'withdraw', amount: -a, balance: db.balance, at: new Date().toISOString(), doneAt: Date.now() + 17000 }); save(); return { id: 1, balance: db.balance }; },
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__mockApi = async (path, body) => { await sleep(30); const out = await handle(path, body); await sleep(30); return out; };      // symmetric 30 ms each way, like a real network
  const handle = async (path, body) => {
    if (handlers[path]) return handlers[path](body || {});
    const g = path.split('/')[1], o = path.split('/')[2];
    if (!['rocket', 'mines', 'tower', 'seagull'].includes(g)) fail('Unknown game');
    let r = active(g);
    const now = Date.now();
    if (g === 'rocket' && o === 'round') return rkPublic(now);
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
        const rr = rkAt(now); if (now >= rr.flightStart) fail('Betting is closed, wait for the next round');
        state = { k: rr.k, crash: rr.crash, startedAt: rr.flightStart, auto };
      } else if (g === 'mines') {
        const count = Number(body.mines); if (!Number.isInteger(count) || count < 3 || count > 24) fail('mines must be 3..24');
        const board = [...Array(SIZE).keys()]; for (let i = 0; i < count; i++) { const j = i + int(SIZE - i); [board[i], board[j]] = [board[j], board[i]]; }
        state = { count, mines: board.slice(0, count), revealed: [] };
      } else if (g === 'tower') {
        state = { picks: 0, swingStart: now + TW.firstDelay, offsets: [], last: null };
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
      } else if (g === 'tower') {
        if (body.tap) {
          if (now < s.swingStart) fail('Too early');
          const lat = Math.min(TW.maxLat, Math.max(0, Number(body.lat) || 0)), t = Math.max(s.swingStart, now - lat);
          const offs = s.offsets || (s.offsets = []), top = twTop(s), tol = twTol(s.picks);
          const judge = (tt) => { const x = twX(Math.max(s.swingStart, tt), s.swingStart, s.picks); return { x, ok: TW_EASY || Math.abs(x - top) <= tol }; };
          const cands = [t, t - TW.grace, t + TW.grace].map(judge), pk = cands.find((c) => c.ok) || cands[0], ok = pk.ok, x = ok ? top + (pk.x - top) * TW_SNAP : pk.x, xr = Math.round(x * 1000) / 1000;
          s.last = { x: xr, ok, miss: !ok, collapse: null, tol: Math.round(tol * 1000) / 1000 };
          if (!ok) finish(r, 'lost', 0);
          else { s.picks++; offs.push(xr); r.multiplier = twMult(s.picks); s.swingStart = now + TW.nextDelay; if (s.picks >= TW.maxSteps) finish(r, 'won', r.multiplier); }
        }
      } else {
        const c = Number(body.choice); if (!Number.isInteger(c) || c < 0 || c >= s.choices) fail('Bad choice');
        const step = s.picks.length; s.picks.push(c);
        if (s.deadly[step].includes(c)) finish(r, 'lost', 0);
        else { r.multiplier = stepsMult(s.choices, s.bad, s.picks.length); if (s.picks.length === s.max) finish(r, 'won', r.multiplier); }
      }
      return reply(r);
    }
    if (o === 'cashout') {
      if (g === 'rocket') { if (now < s.startedAt) fail('Wait for the launch'); settleRocket(r, now); if (r.status === 'active') { s.cashedAt = r.multiplier; finish(r, 'won', r.multiplier); } }
      else if (g === 'mines') { if (!s.revealed.length) fail('Open at least one tile'); finish(r, 'won', minesMult(s.count, s.revealed.length)); }
      else if (g === 'tower') { if (s.picks < 1) fail('Make at least one move'); finish(r, 'won', twMult(s.picks)); }
      else { if (!s.picks.length) fail('Make at least one move'); finish(r, 'won', stepsMult(s.choices, s.bad, s.picks.length)); }
      return reply(r);
    }
    fail('Not found');
  };
})();
