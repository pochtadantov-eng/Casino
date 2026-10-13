// Plinko, Slot 777, Luck cases and the Shaft (dig) mode. The server decides every outcome; this file only draws it.
// Loaded after app.js (uses its globals: state, api, apply, say, setBalance, showResult, lockPlay, betValue, ruError, $, R, OPTS).
(() => {
  const XG = new Set(['plinko', 'slot', 'luck', 'dig']);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const fmt = (m) => (m >= 100 ? Math.round(m) : m >= 10 ? +m.toFixed(1) : +m.toFixed(2)) + '';
  const mcolor = (m) => (m >= 100 ? '#ffd23f' : m >= 10 ? '#ff9a3c' : m >= 3 ? '#ff6b6b' : m >= 1.4 ? '#e0488f' : m >= 0.9 ? '#9b5de5' : m >= 0.5 ? '#5b6cf5' : '#3a4a8f');
  const chips = (items, cur, attr) => items.map(([v, label]) => `<button class="xchip${String(v) === String(cur) ? ' on' : ''}" data-${attr}="${v}">${label}</button>`).join('');
  const canvasIn = (stage, w, h) => {
    stage.innerHTML = `<canvas class="xcv" style="width:${w}px;height:${h}px"></canvas>`;
    const cv = stage.firstChild, dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr); return { cv, g };
  };
  // after an animated outcome: balance, banner (win / refund / loss)
  const finishRound = (j, delay = 0.1) => {
    setBalance(j.balance);
    const r = j.round; if (!r) return;
    if (r.payout >= r.bet) { showResult(r, delay, 'win'); try { Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success'); } catch {} }
    else {
      showResult(r, delay, 'loss');
      if (r.payout > 0) { const el = document.querySelector('.resban'); if (el) { el.querySelector('b').textContent = 'ВОЗВРАТ'; el.querySelector('span').textContent = `+${r.payout} ⭐`; } }
    }
  };
  Object.assign(RES_LOSS, { slot: 'МИМО', luck: 'ПУСТО', dig: 'ЛАВА!', plinko: 'ПРОИГРЫШ' });
  const goText = (t) => { const g = $('#go'); if (g && !g.hidden) g.textContent = t; };
  const optClicks = (attr, key, redo) => document.querySelectorAll(`#opts [data-${attr}]`).forEach((b) => b.onclick = () => { state[key] = b.dataset[attr]; redo(); });

  // =========================================== PLINKO ===========================================
  const PL = { rows: 12, W: 360, H: 440, top: 34, balls: [], hits: new Map(), raf: 0, table: null };
  state.plRisk = 'med'; state.plBalls = '1';
  const plGeom = () => { const dx = (PL.W - 34) / 12.6, dy = (PL.H - 44 - PL.top - 36) / PL.rows; return { dx, dy, cx: PL.W / 2, slotY: PL.top + PL.rows * dy + 4 }; };
  const plTable = (risk) => ({ low: [13, 4, 1.8, 1.3, 1.1, 0.8, 0.5, 0.8, 1.1, 1.3, 1.8, 4, 13], med: [120, 14, 3.5, 1.6, 0.95, 0.5, 0.3, 0.5, 0.95, 1.6, 3.5, 14, 120], high: [300, 30, 5.5, 1.6, 0.5, 0.2, 0.2, 0.2, 0.5, 1.6, 5.5, 30, 300] }[risk]);
  OPTS.plinko = () => `<div class="xopts"><div class="xrow">${chips([['low', 'Лёгкий'], ['med', 'Средний'], ['high', 'Сложный']], state.plRisk, 'risk')}</div><div class="xrow">${chips([[1, '×1'], [3, '×3'], [5, '×5'], [10, '×10']], state.plBalls, 'balls')}</div></div>`;
  const plOpts = () => { $('#opts').innerHTML = OPTS.plinko(); optClicks('risk', 'plRisk', () => { plOpts(); PL.table = null; R.plinko(null); }); optClicks('balls', 'plBalls', plOpts); $('#go').querySelector?.('small'); setPlGo(); };
  const setPlGo = () => { const g = $('#go'); if (state.game === 'plinko' && !g.hidden) g.textContent = state.plBalls === '1' ? 'Бросить' : `Бросить ×${state.plBalls}`; };
  function plDraw() {
    const { g } = PL.ctx, { dx, dy, cx, slotY } = plGeom(), now = performance.now();
    g.clearRect(0, 0, PL.W, PL.H);
    const table = PL.table || plTable(state.plRisk);
    for (let r = 0; r < PL.rows; r++) for (let j = 0; j <= r; j++) {
      const x = cx + (j - r / 2) * dx, y = PL.top + r * dy, hit = PL.hits.get(r * 20 + j) || 0, a = Math.max(0, 1 - (now - hit) / 380);
      g.beginPath(); g.arc(x, y, 3.2 + a * 2.2, 0, 7); g.fillStyle = a > 0 ? `rgba(120,255,200,${0.5 + a * 0.5})` : '#aab6d6'; g.fill();
    }
    const sw = dx - 4, sh = 26;
    table.forEach((m, k) => {
      const x = cx + (k - 6) * dx, lit = PL.lit?.k === k && now - PL.lit.t < 700, y = slotY + (lit ? 4 : 0);
      g.fillStyle = mcolor(m); g.globalAlpha = lit ? 1 : 0.9; g.beginPath(); g.roundRect(x - sw / 2, y, sw, sh, 6); g.fill(); g.globalAlpha = 1;
      g.fillStyle = '#fff'; g.font = '700 ' + (m >= 100 ? 10 : 11) + 'px system-ui'; g.textAlign = 'center'; g.fillText(fmt(m), x, y + 17);
    });
    PL.balls = PL.balls.filter((b) => {
      const t = now - b.t0; if (t < 0) return true;
      const seg = 135, i = Math.floor(t / seg);
      let x, y;
      if (i < 0) return true;
      if (i >= PL.rows) { x = cx + (b.slot - 6) * dx; y = slotY + 8; if (!b.done) { b.done = true; PL.lit = { k: b.slot, t: now }; b.land?.(); } if (t > PL.rows * seg + 260) return false; }
      else {
        const f = (t - i * seg) / seg, k0 = b.path.slice(0, i).reduce((a, v) => a + v, 0), k1 = k0 + b.path[i];
        const x0 = cx + (k0 - i / 2) * dx, x1 = cx + (k1 - (i + 1) / 2) * dx, y0 = i === 0 ? PL.top - 30 : PL.top + i * dy - 7, y1 = PL.top + (i + 1) * dy - 7;
        x = x0 + (x1 - x0) * f; y = i === 0 ? y0 + (PL.top - 7 - y0) * Math.min(1, f * 1.4) + (f > 0.7 ? (f - 0.7) * 3.3 * dy * 0.6 : 0) : y0 + (y1 - y0) * f - 9 * 4 * f * (1 - f);
        if (f < 0.12) PL.hits.set(i * 20 + k0, now);
      }
      g.beginPath(); g.arc(x, y, 6.5, 0, 7); const gr = g.createRadialGradient(x - 2, y - 2, 1, x, y, 7); gr.addColorStop(0, '#fff6c2'); gr.addColorStop(1, '#ffb703'); g.fillStyle = gr; g.fill();
      return true;
    });
    PL.raf = (PL.balls.length || (PL.lit && now - PL.lit.t < 700)) ? requestAnimationFrame(plDraw) : 0;
  }
  const plKick = () => { if (!PL.raf) PL.raf = requestAnimationFrame(plDraw); };
  R.plinko = (round) => {
    const st = $('#stage'); st.className = 'xstage plinkostage';
    cancelAnimationFrame(PL.raf); PL.raf = 0; PL.balls = [];
    PL.W = Math.min(380, st.clientWidth - 8 || 360); PL.H = Math.max(380, Math.min(520, (st.clientHeight || 440) - 8));
    PL.ctx = canvasIn(st, PL.W, PL.H); PL.table = round?.view?.table || null;
    plOpts(); plDraw();
  };
  async function plDrop() {
    if (PL.busy) return; PL.busy = true;
    const n = Number(state.plBalls) || 1, bet = betValue();
    try {
      for (let i = 0; i < n; i++) {
        const j = await api('games/plinko/start', { bet, risk: state.plRisk });
        const v = j.round.view; PL.table = v.table; setBalance(j.balance - j.round.payout);
        PL.balls.push({ t0: performance.now(), path: v.path, slot: v.slot, land: () => {
          setBalance(j.balance); const m = v.table[v.slot];
          const el = document.createElement('div'); el.className = 'plpop ' + (m >= 1 ? 'up' : 'dn'); el.textContent = (m >= 1 ? '+' : '') + j.round.payout + ' ⭐'; el.style.left = (50 + (v.slot - 6) * 6.6) + '%'; $('#stage').append(el); setTimeout(() => el.remove(), 1300);
        } });
        plKick(); if (i < n - 1) await wait(230);
      }
    } catch (e) { say(ruError(e.message), 'lose'); } finally { PL.busy = false; }
  }

  // =========================================== SLOT 777 ===========================================
  const SYM = { cherry: '🍒', grape: '🍇', bell: '🔔', star: '⭐', diamond: '💎', bar: 'BAR', seven: '7' };
  const symHtml = (id) => `<i class="sy sy-${id}">${SYM[id]}</i>`;
  const SL = { ids: ['cherry', 'grape', 'bell', 'star', 'diamond', 'bar', 'seven'], pays: [5, 11, 22, 44, 125, 380, 1400] };
  OPTS.slot = () => '';
  R.slot = (round) => {
    const st = $('#stage'); st.className = 'xstage slotstage'; goText('Крутить'); $('#opts').innerHTML = '';
    const ids = round?.view?.symbols || SL.ids, pays = round?.view?.pays || SL.pays;
    const reel = (k) => `<div class="reel"><div class="strip" id="rl${k}">${symHtml(ids[(k * 2 + 1) % ids.length])}${symHtml(ids[(k * 3 + 4) % ids.length])}${symHtml(ids[(k + 5) % ids.length])}</div></div>`;
    st.innerHTML = `<div class="slotbox"><div class="slotlamps"></div><div class="slotwin">${reel(0)}${reel(1)}${reel(2)}</div></div>
      <div class="paytable"><b>МОЖНО ВЫИГРАТЬ</b><div class="payrow">${ids.map((s, i) => `<span class="pay">${symHtml(s)}<em>×${pays[i]}</em></span>`).join('')}<span class="pay two">${symHtml('cherry')}${symHtml('cherry')}<em>×${round?.view?.twoCherries ?? 1.5}</em></span></div></div>`;
    if (round && round.id !== state.lastAnim) { state.lastAnim = round.id; slotAnimate(round, ids); }
  };
  async function slotAnimate(round, ids) {
    const reels = round.view.reels, rnd = () => ids[Math.floor(Math.random() * ids.length)];
    const boxes = [0, 1, 2].map((k) => $('#rl' + k)); if (boxes.some((b) => !b)) return;
    $('#go').disabled = true; state.slotBusy = true;
    const stops = [900, 1350, 1800];
    boxes.forEach((b, k) => { const seq = Array.from({ length: 14 }, rnd); seq.push(ids[reels[k]]); b.innerHTML = seq.map(symHtml).join(''); b.style.transition = 'none'; b.style.transform = 'translateY(0)'; b.offsetWidth; b.style.transition = `transform ${stops[k]}ms cubic-bezier(.12,.7,.2,1)`; b.style.transform = `translateY(-${14 * 84}px)`; });
    await wait(stops[2] + 150);
    const j = state.pendingRound; state.pendingRound = null;
    $('.slotwin')?.classList.toggle('hit', round.status === 'won');
    finishRound({ balance: j?.balance ?? state.balance, round }, 0.05);
    state.slotBusy = false; setTimeout(() => { $('#go').disabled = false; $('.slotwin')?.classList.remove('hit'); }, 1500);
  }
  async function slotGo() {
    if (state.slotBusy || state.busy) return; state.busy = true;
    try { const j = await api('games/slot/start', { bet: betValue() }); setBalance(j.balance - j.round.payout); state.pendingRound = j; state.round = j.round; R.slot(j.round); }
    catch (e) { say(ruError(e.message), 'lose'); } finally { state.busy = false; }
  }

  // =========================================== LUCK CASES ===========================================
  state.luckTier = '1';
  const LK = { 1: [[0, .2216], [.5, .3112], [1, .2334], [1.5, .1400], [2, .0622], [5, .0233], [10, .0078]] };
  OPTS.luck = () => `<div class="xopts"><div class="xrow luckrow">${chips([[1, '1X'], [10, '10X'], [25, '25X'], [50, '50X'], [100, '100X']], state.luckTier, 'tier')}</div></div>`;
  const luckCard = (m, bet) => `<div class="lkc${m === 0 ? ' z' : ''}" style="--c:${m === 0 ? '#39406a' : mcolor(m)}"><b>${m === 0 ? '—' : '×' + fmt(m)}</b><span>${m === 0 ? 'пусто' : fmt(m * bet) + ' ⭐'}</span></div>`;
  R.luck = (round) => {
    const st = $('#stage'); st.className = 'xstage luckstage'; goText('Крутить');
    $('#opts').innerHTML = OPTS.luck(); optClicks('tier', 'luckTier', () => { R.luck(null); });
    const prizes = round?.view?.prizes, bet = betValue(), mults = (prizes || [{ mult: 0 }, { mult: .5 }, { mult: 1 }, { mult: 2 }, { mult: 5 }, { mult: 10 }]).map((p) => p.mult);
    st.innerHTML = `<div class="lkhead"><span>Удача <b>${state.luckTier}X</b></span><small>${state.luckTier === '1' ? 'ровный кейс' : 'чем выше удача, тем больше приз и реже выигрыш'}</small></div>
      <div class="lkwin"><div class="lkmark"></div><div class="lkstrip" id="lkstrip">${mults.map((m) => luckCard(m, bet)).join('')}</div></div>
      <div class="lkres" id="lkres">Выбери удачу и крути</div>`;
    if (round && round.id !== state.lastAnim) { state.lastAnim = round.id; luckAnimate(round, bet); }
  };
  async function luckAnimate(round, bet) {
    const prizes = round.view.prizes, strip = $('#lkstrip'); if (!strip) return;
    const pick = () => { let x = Math.random(); for (const p of prizes) { if (x < p.p) return p.mult; x -= p.p; } return 0; };
    const N = 46, T = 38, items = Array.from({ length: N }, (_, i) => (i === T ? round.view.mult : pick()));
    strip.style.transition = 'none'; strip.style.transform = 'translateX(0)'; strip.innerHTML = items.map((m) => luckCard(m, bet)).join('');
    const w = strip.firstChild.offsetWidth + 8, vw = strip.parentElement.clientWidth, jit = (Math.random() - 0.5) * w * 0.5;
    strip.offsetWidth; strip.style.transition = 'transform 4.2s cubic-bezier(.08,.6,.12,1)'; strip.style.transform = `translateX(${-(T * w + w / 2 - vw / 2 + jit)}px)`;
    $('#go').disabled = true; state.slotBusy = true;
    await wait(4400);
    strip.children[T]?.classList.add('win');
    const j = state.pendingRound; state.pendingRound = null;
    $('#lkres').innerHTML = round.view.mult > 0 ? `<b>×${fmt(round.view.mult)}</b> · ${round.payout} ⭐` : 'Пусто';
    finishRound({ balance: j?.balance ?? state.balance, round }, 0.15);
    state.slotBusy = false; setTimeout(() => { $('#go').disabled = false; }, 1800);
  }
  async function luckGo() {
    if (state.slotBusy || state.busy) return; state.busy = true;
    try { const j = await api('games/luck/start', { bet: betValue(), luck: Number(state.luckTier) }); setBalance(j.balance - j.round.payout); state.pendingRound = j; state.round = j.round; R.luck(j.round); }
    catch (e) { say(ruError(e.message), 'lose'); } finally { state.busy = false; }
  }

  // =========================================== SHAFT (dig) ===========================================
  const DG = { L: 28, step: Math.log(1.15), W: 360, H: 430, raf: 0, poll: 0, off: 0, sc: null };
  const rh = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const BL = (layer, col) => {                     // block palette by depth, with ore veins
    const r = rh(layer, col);
    if (layer < 1) return ['#5db04a', '#7a5a35'];
    if (layer < 4) return r < 0.12 ? ['#7a5a35', '#3a3a3a'] : ['#7a5a35', '#8a6a42'];
    if (layer < 12) return r < 0.1 ? ['#8b8b8b', '#1f1f1f'] : r < 0.14 ? ['#8b8b8b', '#c79a6b'] : ['#8b8b8b', '#9a9a9a'];
    if (layer < 22) return r < 0.1 ? ['#7d7d7d', '#f2c230'] : r < 0.16 ? ['#7d7d7d', '#e0e0e0'] : ['#777', '#868686'];
    if (layer < 32) return r < 0.12 ? ['#6a6a72', '#5be6ff'] : r < 0.2 ? ['#6a6a72', '#d83a3a'] : ['#65656d', '#76767e'];
    return r < 0.14 ? ['#3d3d46', '#4fe08a'] : ['#38383f', '#46464e'];
  };
  OPTS.dig = () => '';
  const digLayerAt = (ms) => (ms <= 0 ? 0 : Math.floor((DG.growth * ms) / DG.step));
  function drawPick(g, x, y, ang, burn) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = '#6b4423'; g.fillRect(-3, -4, 6, 40); g.fillStyle = '#8a5a2e'; g.fillRect(-3, -4, 3, 40);
    g.fillStyle = burn ? '#ff7a2f' : '#3fe0d0'; g.fillRect(-22, -12, 44, 9); g.fillRect(-26, -6, 8, 9); g.fillRect(18, -6, 8, 9);
    g.fillStyle = burn ? '#ffc27a' : '#b9fff7'; g.fillRect(-20, -12, 38, 3); g.restore();
  }
  function digDraw() {
    const sc = DG.sc, g = DG.ctx.g, W = DG.W, H = DG.H, L = DG.L, now = Date.now() + DG.off;
    const ms = sc ? now - sc.startedAt : -1e9, layer = sc ? digLayerAt(ms) : 0, frac = sc ? ((DG.growth * Math.max(0, ms)) / DG.step) % 1 : 0;
    const lost = sc?.status === 'lost', crashLayer = lost ? Math.ceil(Math.log(Math.max(1.01, sc.crash)) / DG.step) : null;
    const maxLayer = lost ? Math.min(layer, crashLayer) : layer;
    const cam = Math.max(0, (maxLayer + frac) * L - 150), groundY = 150;
    const sky = g.createLinearGradient(0, 0, 0, groundY); sky.addColorStop(0, '#5aa7ff'); sky.addColorStop(1, '#bfe3ff'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // clouds
    g.fillStyle = 'rgba(255,255,255,.85)'; [[40, 40], [220, 70], [300, 28]].forEach(([cx, cy]) => { const o = (cx - cam * 0.2 + now / 90) % (W + 80); g.fillRect(o - 40, cy - cam * 0.4, 56, 14); g.fillRect(o - 28, cy - 10 - cam * 0.4, 32, 12); });
    const cols = 9, bw = W / cols, shaft = [3, 4, 5];            // three centre columns are dug out
    for (let ly = 0; ly < 80; ly++) {
      const y = groundY + ly * L - cam; if (y > H || y < -L) continue;
      for (let c = 0; c < cols; c++) {
        const dug = shaft.includes(c) && ly < maxLayer + (ly === maxLayer ? (frac > 0.55 ? 1 : 0) : 0);
        const [a, b] = BL(ly, c);
        if (dug) { g.fillStyle = '#1b1426'; g.fillRect(c * bw, y, bw + 0.5, L); continue; }
        const lava = lost && ly === crashLayer && shaft.includes(c);
        g.fillStyle = lava ? '#ff5a1f' : a; g.fillRect(c * bw, y, bw + 0.5, L);
        g.fillStyle = lava ? '#ffb347' : b; g.fillRect(c * bw + 4, y + 4, bw * 0.45, L * 0.4); g.fillRect(c * bw + bw * 0.5, y + L * 0.5, bw * 0.38, L * 0.34);
        g.strokeStyle = 'rgba(0,0,0,.28)'; g.strokeRect(c * bw + 0.5, y + 0.5, bw - 1, L - 1);
      }
    }
    // pickaxe: falls from the sky until the launch, then swings at the layer it is breaking
    let px = W / 2, py, ang;
    if (!sc) { py = 40; ang = 0.3; }
    else if (ms < 0) { const f = Math.min(1, 1 - -ms / 1800); py = -60 + (groundY - 12 + 60) * f * f; ang = 0.9 + f * 9; }
    else { const swing = Math.sin(frac * Math.PI); py = groundY + (maxLayer + Math.min(1, frac * 1.3)) * L - cam - 18 - swing * 10; ang = -0.55 + swing * 1.1; if (ms < 260) py -= Math.sin(ms / 260 * Math.PI) * 14; }
    if (lost && layer >= crashLayer) { py = groundY + crashLayer * L - cam - 6 + (now - sc.lostAt) / 12; ang = 2.4; }
    drawPick(g, px, py, ang, lost && layer >= crashLayer);
    // debris at every new layer
    if (sc && ms > 0 && layer !== DG.lastLayer) { DG.lastLayer = layer; for (let i = 0; i < 9; i++) DG.parts.push({ x: px + (Math.random() - 0.5) * 40, y: py + 18, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3 - 1, c: BL(layer, 4)[0], t: 0 }); }
    DG.parts = DG.parts.filter((p) => { p.t++; p.x += p.vx; p.y += p.vy; p.vy += 0.25; g.fillStyle = p.c; g.fillRect(p.x, p.y, 5, 5); return p.t < 40; });
    // multiplier
    const m = sc ? (lost ? sc.crash : sc.status === 'won' ? sc.cashedAt : Math.max(1, Math.exp(DG.growth * Math.max(0, ms)))) : 1;
    g.fillStyle = 'rgba(8,10,20,.62)'; g.beginPath(); g.roundRect(W / 2 - 62, 10, 124, 44, 12); g.fill();
    g.fillStyle = lost ? '#ff6b6b' : sc?.status === 'won' ? '#6dffb0' : '#fff'; g.font = '800 26px system-ui'; g.textAlign = 'center'; g.fillText('x' + (Math.floor(m * 100) / 100).toFixed(2), W / 2, 40);
    g.fillStyle = '#9fb0d9'; g.font = '600 11px system-ui'; g.fillText('глубина ' + maxLayer + ' м', W / 2, H - 8);
    // keep the cash button label live
    if (sc?.status === 'active' && state.game === 'dig') { const c = $('#cash'); c.disabled = ms < 0; c.textContent = ms < 0 ? 'Ставка принята' : 'Забрать ' + Math.floor(state.round.bet * m) + ' ⭐'; }
    if (state.game === 'dig' && $('#view-game').classList.contains('on')) DG.raf = requestAnimationFrame(digDraw);
  }
  async function digPoll() {
    clearTimeout(DG.poll); if (state.game !== 'dig' || state.round?.status !== 'active') return;
    try { const j = await api('games/dig'); if (state.game === 'dig' && j.round?.status !== 'active') { apply(j); return; } } catch {}
    DG.poll = setTimeout(digPoll, 450);
  }
  R.dig = (round) => {
    const st = $('#stage'); st.className = 'xstage digstage'; goText('Копать'); $('#opts').innerHTML = '';
    if (!DG.ctx || !st.querySelector('canvas')) { DG.W = Math.min(400, st.clientWidth - 8 || 360); DG.H = Math.max(380, Math.min(560, (st.clientHeight || 430) - 8)); DG.ctx = canvasIn(st, DG.W, DG.H); DG.parts = []; }
    const v = round?.view;
    if (!round) DG.sc = null;
    else {
      DG.growth = v.growth; DG.off = v.serverNow - Date.now() + (state.rtt || 0) / 2;
      const was = DG.sc;
      DG.sc = { startedAt: v.startedAt, status: round.status, crash: v.crash, cashedAt: v.cashedAt, lostAt: was?.lostAt || (round.status === 'lost' ? Date.now() : 0) };
      if (!was || was.id !== round.id) { DG.lastLayer = 0; DG.sc.id = round.id; } else DG.sc.id = was.id;
    }
    cancelAnimationFrame(DG.raf); digDraw();
    if (round?.status === 'active') digPoll();
  };

  // ---------- wiring ----------
  window.XP = { plinko: () => ({ risk: state.plRisk }), slot: () => ({}), luck: () => ({ luck: Number(state.luckTier) }), dig: () => ({}) };
  const oldGo = $('#go').onclick;
  $('#go').onclick = () => {
    if (state.game === 'plinko') return plDrop();
    if (state.game === 'slot') return slotGo();
    if (state.game === 'luck') return luckGo();
    return oldGo();
  };
  window.XGAMES = XG;
  window.fxGamesLeave = () => { cancelAnimationFrame(PL.raf); PL.raf = 0; cancelAnimationFrame(DG.raf); clearTimeout(DG.poll); DG.ctx = null; DG.sc = null; state.slotBusy = false; state.pendingRound = null; PL.ctx = null; };
})();
