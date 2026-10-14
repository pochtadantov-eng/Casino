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
  Object.assign(RES_LOSS, { slot: 'МИМО', luck: 'ПУСТО', dig: 'КИРКА СЛОМАНА', plinko: 'ПРОИГРЫШ' });
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
  const DG = { L: 36, step: Math.log(1.15), W: 360, H: 430, raf: 0, poll: 0, off: 0, sc: null, COLS: 10, shaft: [3, 4, 5, 6] };
  const rh = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  // ---- pixel-art tiles (16x16, generated once, drawn without smoothing) ----
  const TILE = {}, cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const hexA = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const shade = (h, k) => { const [r, g, b] = hexA(h); return `rgb(${Math.max(0, Math.min(255, r * k)) | 0},${Math.max(0, Math.min(255, g * k)) | 0},${Math.max(0, Math.min(255, b * k)) | 0})`; };
  function noiseTile(base, seed, spread = 0.18, cobble = false) {
    const c = cvs(16, 16), g = c.getContext('2d');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { let k = 1 + (rh(x + seed * 17, y + seed * 31) - 0.5) * spread * 2; if (cobble) { const cx = (x + (y > 7 ? 4 : 0)) % 8, edge = cx === 0 || y % 8 === 0 || y % 8 === 7; if (edge) k *= 0.72; } g.fillStyle = shade(base, k); g.fillRect(x, y, 1, 1); }
    return [c, g];
  }
  function dots(g, col, seed, n, hi) { for (let i = 0; i < n; i++) { const x = 1 + Math.floor(rh(seed, i * 3) * 13), y = 1 + Math.floor(rh(i * 5, seed) * 13); g.fillStyle = col; g.fillRect(x, y, 2, 2); if (hi) { g.fillStyle = hi; g.fillRect(x, y, 1, 1); } } }
  function mkTile(type, seed) {
    if (type === 'grass') { const [c, g] = noiseTile('#7a5a35', seed, 0.14); g.fillStyle = '#5fb04a'; g.fillRect(0, 0, 16, 5); for (let x = 0; x < 16; x++) { const h = 5 + Math.floor(rh(x, seed) * 3); g.fillStyle = x % 3 ? '#4f9a3c' : '#6ac455'; g.fillRect(x, 3, 1, h - 3); } return c; }
    if (type === 'dirt') return noiseTile('#8a5e36', seed, 0.26)[0];
    if (type === 'cobble') return noiseTile('#8d8d8d', seed, 0.14, true)[0];
    if (type === 'deep') return noiseTile('#4d4d58', seed, 0.14, true)[0];
    if (type === 'bed') { const [c, g] = noiseTile('#4a4566', seed, 0.1); g.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 1); for (let y = 0; y < 16; y += 8) { g.fillRect(((y / 8) % 2) * 8, y, 1, 4); g.fillRect(((y / 8) % 2) * 8 + 8, y + 4, 1, 4); } return c; }
    const deep = type.endsWith('_d'), t = type.replace('_d', ''), [c, g] = noiseTile(deep ? '#4d4d58' : '#8d8d8d', seed, 0.14, true);
    const OREC = { coal: ['#23232a', '#4a4a55'], iron: ['#d8a88a', '#f3d4bf'], gold: ['#f0a53a', '#ffe08a'], red: ['#d23a3a', '#ff8a7a'], lapis: ['#2a4fd0', '#6f93ff'], dia: ['#35d6e6', '#d8fbff'], em: ['#22b955', '#9cf5b6'] };
    if (OREC[t]) { for (let q = 0; q < 3; q++) dots(g, OREC[t][0], seed + 1 + t.length + q * 7, 6, OREC[t][1]); if (t === 'dia' || t === 'em') dots(g, OREC[t][0], seed + 9, 3, OREC[t][1]); }
    else if (t === 'tnt') { g.fillStyle = '#c83030'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#e8e4d8'; g.fillRect(0, 5, 16, 6); g.fillStyle = '#222'; g.font = 'bold 6px monospace'; g.textAlign = 'center'; g.fillText('TNT', 8, 10.4); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 15, 16, 1); for (let x = 3; x < 16; x += 5) g.fillRect(x, 0, 1, 5); }
    else if (t === 'up') { g.fillStyle = '#2a2140'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#ffd84a'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1); g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16); g.fillStyle = '#7a4a1e'; g.fillRect(7, 5, 2, 9); g.fillStyle = '#6ae6ff'; g.fillRect(3, 3, 10, 3); g.fillRect(2, 5, 2, 2); g.fillRect(12, 5, 2, 2); g.fillStyle = '#4dff8a'; g.fillRect(12, 9, 1, 4); g.fillRect(11, 10, 3, 1); }
    else if (t === 'arrow') { g.fillStyle = '#e8932a'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#ffc25a'; g.fillRect(1, 1, 14, 14); g.fillStyle = '#2fbf4a'; g.fillRect(7, 6, 2, 8); g.fillRect(5, 8, 6, 1); g.fillRect(6, 7, 4, 1); g.fillRect(4, 9, 8, 1); g.fillStyle = '#18892f'; g.fillRect(8, 6, 1, 8); }
    return c;
  }
  const getTile = (type, seed) => TILE[type + seed] || (TILE[type + seed] = mkTile(type, seed));
  const ORES = [['em', 0.012, 20], ['dia', 0.022, 16], ['lapis', 0.032, 12], ['red', 0.045, 9], ['gold', 0.06, 6], ['iron', 0.1, 3], ['coal', 0.14, 1]];
  const OREN = { coal: 'УГОЛЬ', iron: 'ЖЕЛЕЗО', gold: 'ЗОЛОТО', red: 'РЕДСТОУН', lapis: 'ЛАПИС', dia: 'АЛМАЗ', em: 'ИЗУМРУД' };
  const OREK = { coal: '#8a8a96', iron: '#f3d4bf', gold: '#ffd24a', red: '#ff5a5a', lapis: '#6f93ff', dia: '#5ff0ff', em: '#4dff8a' };
  const tileAt = (ly, c) => {
    if (c === 0 || c === DG.COLS - 1) return ['bed', (ly + c) % 3];
    if (ly === 0) return ['grass', c % 3];
    const deep = ly > 26, sd = (ly * 3 + c) % 3, sp = rh(ly * 11 + c + (DG.seed || 0), c * 5 + ly);
    if (ly >= 3 && sp < 0.028) return ['tnt', 0];
    if (ly >= 6 && sp > 0.987) return ['up', 0];
    if (ly < 3) return ['dirt', sd];
    const one = rh(ly * 7 + c + (DG.seed || 0), c * 13 + ly);
    let acc = 0; for (let i = ORES.length - 1; i >= 0; i--) { const [k, p, from] = ORES[i]; if (ly < from) continue; acc += p; if (one < acc) return [deep ? k + '_d' : k, sd]; }
    return [deep ? 'deep' : 'cobble', sd];
  };
  // where the pick is horizontally while it works at depth t: it drifts left and right through the field
  const pickX = (t, L) => L * (1.6 + (Math.sin(t * 0.9) * 0.5 + 0.5) * (DG.COLS - 3.2) + 0.0);
  let BG = null;
  function backdrop(W, H) {
    if (BG && BG.width === W && BG.height === H) return BG;
    BG = cvs(W, H); const g = BG.getContext('2d'); const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#7bb8f5'); sky.addColorStop(0.6, '#bfe0ff'); sky.addColorStop(1, '#dff3ff'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const ridge = (base, amp, col, seed, step) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W + step; x += step) g.lineTo(x, base - Math.abs(Math.sin(x * 0.011 + seed) * amp) - rh(x, seed) * 14); g.lineTo(W, H); g.fill(); };
    ridge(H * 0.62, 110, '#8fb4d6', 1, 12); ridge(H * 0.74, 80, '#6f9fc8', 4, 12); ridge(H * 0.84, 50, '#58b36a', 9, 10); ridge(H * 0.92, 30, '#3f9a56', 2, 10);
    return BG;
  }
  // ---- wooden pickaxe sprite (12x12), roughly one block in size ----
  const PICK = ['....cccc....', '..ccBBBBcc..', '.cBB....BBc.', 'cBB..hh..BBc', 'cB..hhh...Bc', 'c...hh.....c', '....hh......', '....hh......', '...hh.......', '...hh.......', '..hh........', '..hh........'];
  function drawPick(g, x, y, ang, sz) {
    g.save(); g.translate(x, y); g.rotate(ang); g.imageSmoothingEnabled = false; const u = 3.1 * (sz || 1), pal = { c: '#7a5326', B: '#c99a56', h: '#6b4420' };
    PICK.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '.') return; g.fillStyle = pal[ch]; g.fillRect((i - 6) * u, (j - 9) * u, u + 0.6, u + 0.6); })); g.restore();
  }
  OPTS.dig = () => '';
  const digLayerAt = (ms) => (ms <= 0 ? 0 : Math.floor((DG.growth * ms) / DG.step));
  function digDraw() {
    const sc = DG.sc, g = DG.ctx.g, W = DG.W, H = DG.H, L = W / DG.COLS, now = Date.now() + DG.off;
    DG.L = L; g.imageSmoothingEnabled = false;
    const ms = sc ? now - sc.startedAt : -1e9, layer = sc ? digLayerAt(ms) : 0, frac = sc ? ((DG.growth * Math.max(0, ms)) / DG.step) % 1 : 0;
    const lost = sc?.status === 'lost', crashLayer = lost ? Math.ceil(Math.log(Math.max(1.01, sc.crash)) / DG.step) : null;
    const cur = lost ? Math.min(layer, crashLayer) : layer, boomT = lost ? (Date.now() - sc.lostAt) / 1000 : 0, groundY = H * 0.2, cam = Math.max(0, (cur + frac) * L - H * 0.34);
    const ccx = (c) => c * L + L / 2, cellY = (ly) => Math.round(groundY + ly * L - cam);
    g.save(); if (DG.shake > 0) { g.translate((Math.random() - 0.5) * DG.shake, (Math.random() - 0.5) * DG.shake); DG.shake *= 0.9; if (DG.shake < 0.3) DG.shake = 0; }
    g.drawImage(backdrop(W, H), 0, 0);
    const broken = sc && ms > 0 ? (lost ? Math.min(crashLayer, cur + (frac > 0.5 ? 1 : 0)) : cur + (frac > 0.5 ? 1 : 0)) : 0;
    for (let ly = 0; ly < 90; ly++) {
      const y = cellY(ly); if (y > H || y < -L) continue;
      for (let c = 0; c < DG.COLS; c++) {
        if (DG.holes.has(ly * 16 + c)) continue;
        const [t, sd] = tileAt(ly, c); g.drawImage(getTile(t, sd), Math.round(c * L), y, Math.ceil(L), Math.ceil(L));
      }
    }
    // the pick works in the middle of an open cavity and breaks everything around itself
    const depthT = cur + frac;
    let px = pickX(depthT, L), py = groundY + (cur + Math.min(1, frac)) * L - cam - L * 0.1, ang;
    if (!sc) { px = W / 2; py = groundY - L * 0.4; ang = 0.2; }
    else if (ms < 0) { const f = Math.min(1, 1 - -ms / 1500); px = pickX(0, L); py = -50 + (groundY - 8 + 50) * f * f; ang = 1.2 - f * 1.4; }
    else { ang = -0.6 + Math.sin(depthT * 7) * 0.7; if (lost) { px = pickX(crashLayer, L) + (boomT < 0.7 ? (Math.random() - 0.5) * 3 : 0); py = groundY + crashLayer * L - cam; ang = 0.2 + Math.min(1, boomT) * 0.5; } }
    if (lost) DG.hp = Math.max(0, Math.round((DG.hp0 || DG.hp) * (1 - Math.min(1, boomT / 0.7))));
    if (lost && !DG.hp0) DG.hp0 = DG.hp;
    if (!(lost && boomT >= 0.7)) drawPick(g, px, py, ang, DG.psize);
    const mCur = sc ? (lost ? sc.crash : sc.status === 'won' ? sc.cashedAt : Math.max(1, Math.exp(DG.growth * Math.max(0, ms)))) : 1;
    if (sc && ms > 0 && broken > (DG.lastLayer || 0)) {
      for (let ly = (DG.lastLayer || 0); ly < broken; ly++) {
        const pcx = pickX(ly + 0.5, L), cc = Math.min(DG.COLS - 2, Math.max(1, Math.round((pcx - L / 2) / L)));
        const todo = [];
        for (let dc = -1; dc <= 1; dc++) { if (dc === 0 || Math.random() < 0.85) todo.push([ly, cc + dc]); }
        if (Math.random() < 0.8) todo.push([ly + 1, cc]);
        if (Math.random() < 0.4) todo.push([ly + 1, cc + (Math.random() < 0.5 ? -1 : 1)]);
        let n = 0;
        todo.forEach(([yy, c2]) => {
          if (c2 < 1 || c2 > DG.COLS - 2 || DG.holes.has(yy * 16 + c2)) return;
          const [tt] = tileAt(yy, c2), k = tt.replace('_d', ''), ore = OREN[k], tx = ccx(c2), tyy = cellY(yy) + L / 2;
          DG.holes.add(yy * 16 + c2); n++;
          const col = ore ? OREK[k] : tt === 'tnt' ? '#c83030' : '#8d8d8d';
          for (let i = 0; i < (ore ? 14 : 6); i++) DG.parts.push({ x: tx, y: tyy, vx: (Math.random() - 0.5) * (ore ? 6 : 4), vy: -Math.random() * 4 - 1, c: i % 3 ? col : '#8d8d8d', t: 0 });
          if (ore && state.round) { const gain = Math.max(1, Math.round(state.round.bet * (Math.exp(DG.step * (yy + 1)) - Math.exp(DG.step * yy)) * 1.2)); DG.nums.push({ x: Math.min(W - 46, Math.max(46, tx)), y: tyy - 6, txt: '+' + gain + ' ⭐ ' + ore, col, t: 0 }); DG.shake = Math.max(DG.shake || 0, 6); }
          if (tt === 'up') { DG.hp = 100; DG.psize = Math.min(1.9, DG.psize + 0.3); DG.shake = 8; for (let i = 0; i < 20; i++) DG.parts.push({ x: tx, y: tyy, vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 5 - 1, c: i % 2 ? '#ffd84a' : '#6ae6ff', t: 0 }); DG.nums.push({ x: W / 2, y: tyy - 6, txt: 'КИРКА УЛУЧШЕНА! ❤ 100', col: '#6ae6ff', t: 0 }); }
          if (tt === 'tnt') {
            const m = 4 + Math.floor(Math.random() * 7), cand = [];
            for (let dl = -2; dl <= 2; dl++) for (let dc = -2; dc <= 2; dc++) { const y3 = yy + dl, c3 = c2 + dc; if (y3 < 1 || c3 < 1 || c3 > DG.COLS - 2 || (dl === 0 && dc === 0) || DG.holes.has(y3 * 16 + c3)) continue; cand.push([y3, c3]); }
            cand.sort(() => Math.random() - 0.5).slice(0, m).forEach(([y3, c3]) => { DG.holes.add(y3 * 16 + c3); for (let i = 0; i < 6; i++) DG.parts.push({ x: ccx(c3), y: cellY(y3) + L / 2, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 4 - 1, c: ['#ff9a1f', '#8d8d8d', '#555'][i % 3], t: 0 }); });
            DG.booms.push({ x: tx, y: tyy, t: 0 }); DG.shake = 12; DG.nums.push({ x: Math.min(W - 40, Math.max(40, tx)), y: tyy - 6, txt: 'ТНТ! −' + Math.min(m, cand.length) + ' блоков', col: '#ff9a1f', t: 0 });
          }
        });
        DG.shake = Math.max(DG.shake || 0, 2); DG.hp = Math.max(1, DG.hp - n);
      }
      DG.lastLayer = broken;
    }
    if (lost && boomT >= 0.7 && !DG.boomed) {
      DG.boomed = true; DG.shake = 9;
      for (let i = 0; i < 26; i++) DG.parts.push({ x: px, y: py, vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 5 - 1, c: ['#c99a56', '#7a5326', '#6b4420', '#8d8d8d'][i % 4], t: 0 });
      DG.nums.push({ x: W / 2, y: py - 20, txt: 'КИРКА СЛОМАНА', col: '#ff6b6b', t: 0 });
    }
    DG.booms = DG.booms.filter((bm) => { bm.t++; const r = bm.t * 6, al = Math.max(0, 1 - bm.t / 22); if (al <= 0) return false; const gr = g.createRadialGradient(bm.x, bm.y, 0, bm.x, bm.y, Math.max(1, r)); gr.addColorStop(0, 'rgba(255,255,220,' + al + ')'); gr.addColorStop(0.4, 'rgba(255,170,40,' + al * 0.9 + ')'); gr.addColorStop(1, 'rgba(200,40,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(bm.x, bm.y, r, 0, 7); g.fill(); return true; });
    DG.parts = DG.parts.filter((p) => { p.t++; p.x += p.vx; p.y += p.vy; p.vy += 0.25; g.fillStyle = p.c; g.fillRect(p.x, p.y, 4, 4); return p.t < 40; });
    g.textAlign = 'center';
    DG.nums = DG.nums.filter((n) => { n.t++; g.font = '900 13px monospace'; g.globalAlpha = Math.max(0, 1 - n.t / 55); g.fillStyle = 'rgba(0,0,0,.7)'; g.fillText(n.txt, n.x + 1, n.y - n.t * 0.8 + 1); g.fillStyle = n.col; g.fillText(n.txt, n.x, n.y - n.t * 0.8); g.globalAlpha = 1; return n.t < 55; });
    g.restore();
    const bw = 150, bx = W / 2 - bw / 2, by = 8;
    g.fillStyle = '#2f4a2c'; g.fillRect(bx - 4, by - 4, bw + 8, 46); g.fillStyle = '#4b3a28'; g.fillRect(bx, by, bw, 38);
    g.fillStyle = '#f5c518'; g.beginPath(); g.arc(bx + 20, by + 19, 12, 0, 7); g.fill(); g.fillStyle = '#7a4a1e'; g.beginPath(); g.arc(bx + 20, by + 19, 5, 0, 7); g.fill();
    const col = lost ? '#ff6b6b' : sc?.status === 'won' ? '#6dffb0' : '#ffd84a'; g.textAlign = 'left'; g.font = '900 24px monospace'; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText('x' + (Math.floor(mCur * 100) / 100).toFixed(2), bx + 42, by + 29); g.fillStyle = col; g.fillText('x' + (Math.floor(mCur * 100) / 100).toFixed(2), bx + 40, by + 27);
    const hp = DG.hp == null ? 100 : DG.hp; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(bx, by + 44, bw, 12); g.fillStyle = hp > 50 ? '#3fd16a' : hp > 20 ? '#f0a53a' : '#e04a4a'; g.fillRect(bx + 1, by + 45, (bw - 2) * hp / 100, 10); g.fillStyle = '#fff'; g.font = '700 10px monospace'; g.textAlign = 'center'; g.fillText('❤ ' + hp + '/100', W / 2, by + 54);
    g.textAlign = 'center'; g.font = '700 11px monospace'; g.fillStyle = '#fff'; g.fillText('глубина ' + cur + ' м', W / 2, H - 8);
    if (sc?.status === 'active' && state.game === 'dig') { const c = $('#cash'); c.disabled = ms < 0; c.textContent = ms < 0 ? 'Ставка принята' : 'Забрать ' + Math.floor(state.round.bet * mCur) + ' ⭐'; }
    if (state.game === 'dig' && $('#view-game').classList.contains('on')) DG.raf = requestAnimationFrame(digDraw);
  }
  async function digPoll() {
    clearTimeout(DG.poll); if (state.game !== 'dig' || state.round?.status !== 'active') return;
    try { const j = await api('games/dig'); if (state.game === 'dig' && j.round?.status !== 'active') { apply(j); return; } } catch {}
    DG.poll = setTimeout(digPoll, 450);
  }
  R.dig = (round) => {
    const st = $('#stage'); st.className = 'xstage digstage'; goText('Копать'); $('#opts').innerHTML = '';
    if (!DG.ctx || !st.querySelector('canvas')) { DG.W = Math.min(400, st.clientWidth - 8 || 360); DG.H = Math.max(380, Math.min(560, (st.clientHeight || 430) - 8)); DG.ctx = canvasIn(st, DG.W, DG.H); DG.parts = []; DG.nums = []; }
    DG.booms = DG.booms || []; DG.holes = DG.holes || new Set(); DG.hp = DG.hp || 100; DG.psize = DG.psize || 1;
    const v = round?.view;
    if (!round) DG.sc = null;
    else {
      DG.growth = v.growth; DG.off = v.serverNow - Date.now() + (state.rtt || 0) / 2;
      const was = DG.sc;
      DG.sc = { startedAt: v.startedAt, status: round.status, crash: v.crash, cashedAt: v.cashedAt, lostAt: was?.lostAt || (round.status === 'lost' ? Date.now() : 0) };
      if (!was || was.id !== round.id) { DG.lastLayer = 0; DG.seed = (Math.random() * 1e5) | 0; DG.path = null; DG.boomed = false; DG.booms = []; DG.holes = new Set(); DG.hp0 = 0; DG.hp = 100; DG.psize = 1; DG.parts = []; DG.sc.id = round.id; } else DG.sc.id = was.id;
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
