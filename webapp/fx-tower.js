// Tower game scene: flat front view (2D canvas), like the reference video. Rendering only.
// The swing is a function of SERVER time (view.swing); a tap releases the house at once, and the server's verdict
// (computed from the same formula) is only reconciled afterwards. Nothing here decides who wins.
(() => {
  const TowerFx = { worker: null, loading: false };
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const rand = (a, b) => a + Math.random() * (b - a);

  const HW = 1.9, HH = 1.55, INC = 1.66, SLAB_H = 0.55, SLAB_W = 5.4;       // house width/height, floor step, foundation slab (world units)
  const R = 5.4, SLING = 0.95, PIVOT_UP = 8.8;                               // pendulum: the pivot hangs above the frame
  const LROPE_HOVER = R - SLING - HH / 2, LROPE_HIDE = -3.4;

  // ---------------------------------------------------------------- colours
  const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mixc = (h, t, to) => { const a = hexRgb(h), b = to === 'w' ? [255, 255, 255] : [0, 0, 0]; return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`; };
  const PAL = [
    { wall: '#e3544a', trim: '#fff2e4', roof: '#43364a', awn: '#ffd24a' },
    { wall: '#f1a43a', trim: '#fff6df', roof: '#4a3a30', awn: '#e3544a' },
    { wall: '#2fae8a', trim: '#effff8', roof: '#2f4650', awn: '#f6d34a' },
    { wall: '#4b7fe0', trim: '#eef4ff', roof: '#34405e', awn: '#ff8a4a' },
    { wall: '#8b5fd6', trim: '#f6efff', roof: '#3d3358', awn: '#ffcf4a' },
    { wall: '#e8679b', trim: '#fff0f5', roof: '#4a3445', awn: '#6fd6a5' },
    { wall: '#e9d29b', trim: '#fffaf0', roof: '#5a4638', awn: '#d9534a' },
  ];

  const rngSeed = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // ---------------------------------------------------------------- house facades, painted once per size and cached
  const cache = new Map();
  function houseBitmap(vRaw, ppu) {
    const v = vRaw % 42, key = v + '@' + Math.round(ppu * 10);
    if (cache.has(key)) return cache.get(key);
    const pal = PAL[v % PAL.length], bw = Math.round(HW * ppu * DPR), bh = Math.round(HH * ppu * DPR), over = Math.round(bw * 0.07), top = Math.round(bh * 0.2);
    const cv = document.createElement('canvas'); cv.width = bw + over * 2; cv.height = bh + top + 2; const g = cv.getContext('2d');
    const x0 = over, y0 = top, S = bw / 190, brick = v % 2 === 0, door = v % 3 === 0;
    let gr = g.createLinearGradient(0, y0, 0, y0 + bh); gr.addColorStop(0, mixc(pal.wall, 0.12, 'w')); gr.addColorStop(0.55, pal.wall); gr.addColorStop(1, mixc(pal.wall, 0.22, 'k'));
    g.fillStyle = gr; g.fillRect(x0, y0, bw, bh);
    g.save(); g.beginPath(); g.rect(x0, y0, bw, bh); g.clip(); g.globalAlpha = 0.09; g.strokeStyle = '#000'; g.lineWidth = Math.max(1, S * 0.8);
    if (brick) { const rh = 9 * S; for (let y = y0 + rh, r = 0; y < y0 + bh; y += rh, r++) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + bw, y); g.stroke(); for (let x = x0 + (r % 2 ? 9 : 0) * S; x < x0 + bw; x += 18 * S) { g.beginPath(); g.moveTo(x, y - rh); g.lineTo(x, y); g.stroke(); } } }
    else { for (let x = x0 + 24 * S; x < x0 + bw; x += 24 * S) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + bh); g.stroke(); } }
    g.restore();
    g.fillStyle = mixc(pal.wall, 0.2, 'k'); g.fillRect(x0, y0 + bh * 0.5 - 3 * S, bw, 6 * S); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x0, y0 + bh * 0.5 - 3 * S, bw, 1.5 * S);
    g.fillStyle = mixc(pal.wall, 0.38, 'k'); g.fillRect(x0, y0 + bh - 9 * S, bw, 9 * S);
    const win = (cx, cy, w, h, curtain, box) => {
      const x = cx - w / 2, y = cy - h / 2;
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x - 1 * S, y + 3 * S, w + 4 * S, h + 4 * S);
      g.fillStyle = pal.trim; g.fillRect(x - 3 * S, y - 3 * S, w + 6 * S, h + 6 * S);
      const gg = g.createLinearGradient(0, y, 0, y + h); gg.addColorStop(0, '#9fe0ff'); gg.addColorStop(0.55, '#4aa8ee'); gg.addColorStop(1, '#2468b8'); g.fillStyle = gg; g.fillRect(x, y, w, h);
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = 'rgba(255,255,255,.38)'; g.beginPath(); g.moveTo(x + w * 0.05, y + h); g.lineTo(x + w * 0.45, y); g.lineTo(x + w * 0.7, y); g.lineTo(x + w * 0.3, y + h); g.closePath(); g.fill();
      if (curtain) { g.fillStyle = curtain; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * 0.34, y); g.quadraticCurveTo(x + w * 0.1, y + h * 0.4, x + w * 0.18, y + h * 0.7); g.lineTo(x, y + h * 0.7); g.fill(); g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w * 0.66, y); g.quadraticCurveTo(x + w * 0.9, y + h * 0.4, x + w * 0.82, y + h * 0.7); g.lineTo(x + w, y + h * 0.7); g.fill(); }
      g.restore();
      g.fillStyle = pal.trim; g.fillRect(cx - 1.5 * S, y, 3 * S, h); g.fillRect(x, cy - 1.5 * S, w, 3 * S);
      g.fillStyle = mixc(pal.trim, 0.18, 'k'); g.fillRect(x - 5 * S, y + h + 3 * S, w + 10 * S, 4 * S);
      if (box) { g.fillStyle = '#7a5a3a'; g.fillRect(x - 3 * S, y + h + 7 * S, w + 6 * S, 6 * S); for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#ff6f9a' : '#ffd24a'; g.beginPath(); g.arc(x + (i + 0.5) * (w / 6), y + h + 5 * S, 3.2 * S, 0, 6.283); g.fill(); g.fillStyle = '#3f9a45'; g.fillRect(x + (i + 0.5) * (w / 6) - 1 * S, y + h + 6 * S, 2 * S, 3 * S); } }
    };
    const curt = ['#ff6f9a', '#ffd24a', '#fff', '#8be0a8', '#ff9a4a'];
    const upY = y0 + bh * 0.27, loY = y0 + bh * 0.74, ww = 34 * S, wh = 40 * S;
    if (door) { win(x0 + bw * 0.2, upY, ww, wh, curt[v % 5]); win(x0 + bw * 0.5, upY, ww, wh, null); win(x0 + bw * 0.8, upY, ww, wh, curt[(v + 2) % 5]); win(x0 + bw * 0.2, loY, ww, wh * 0.9, curt[(v + 1) % 5], v % 2 === 0); win(x0 + bw * 0.8, loY, ww, wh * 0.9, null, v % 2 === 1); }
    else { for (const f of [0.28, 0.72]) { win(x0 + bw * f, upY, ww * 1.1, wh, curt[(v + (f > 0.5 ? 2 : 0)) % 5]); win(x0 + bw * f, loY, ww * 1.1, wh * 0.95, curt[(v + 1 + (f > 0.5 ? 3 : 0)) % 5], v % 3 === 1); } }
    if (door) {
      const dw = 38 * S, dh = 56 * S, dx = x0 + bw * 0.5 - dw / 2, dy = y0 + bh - 9 * S - dh;
      g.fillStyle = pal.trim; g.fillRect(dx - 4 * S, dy - 4 * S, dw + 8 * S, dh + 4 * S);
      const dg = g.createLinearGradient(0, dy, 0, dy + dh); dg.addColorStop(0, '#9a6232'); dg.addColorStop(1, '#5c3519'); g.fillStyle = dg; g.fillRect(dx, dy, dw, dh);
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1.5 * S; g.strokeRect(dx + 5 * S, dy + 6 * S, dw - 10 * S, dh * 0.38); g.strokeRect(dx + 5 * S, dy + dh * 0.5, dw - 10 * S, dh * 0.42);
      g.fillStyle = '#ffd86b'; g.beginPath(); g.arc(dx + dw - 8 * S, dy + dh * 0.55, 2.6 * S, 0, 6.283); g.fill();
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#fff' : pal.awn; g.beginPath(); g.moveTo(dx - 8 * S + i * ((dw + 16 * S) / 6), dy - 12 * S); g.lineTo(dx - 8 * S + (i + 1) * ((dw + 16 * S) / 6), dy - 12 * S); g.lineTo(dx - 12 * S + (i + 1) * ((dw + 24 * S) / 6), dy - 1 * S); g.lineTo(dx - 12 * S + i * ((dw + 24 * S) / 6), dy - 1 * S); g.fill(); }
    }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0, y0, bw, 9 * S);
    gr = g.createLinearGradient(0, y0 - 11 * S, 0, y0 + 1 * S); gr.addColorStop(0, mixc(pal.roof, 0.3, 'w')); gr.addColorStop(1, pal.roof); g.fillStyle = gr; g.fillRect(x0 - over, y0 - 11 * S, bw + over * 2, 13 * S);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x0 - over, y0 - 11 * S, bw + over * 2, 1.6 * S); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0 - over, y0 + 1 * S, bw + over * 2, 2 * S);
    if (v % 3 === 1) { g.fillStyle = '#9aa7b4'; g.fillRect(x0 + bw * 0.7, y0 - 24 * S, 22 * S, 14 * S); g.fillStyle = '#6c7a88'; g.fillRect(x0 + bw * 0.7, y0 - 14 * S, 22 * S, 3 * S); }
    else if (v % 3 === 2) { g.fillStyle = '#5a4a3a'; g.fillRect(x0 + bw * 0.22, y0 - 27 * S, 8 * S, 17 * S); g.fillStyle = '#3d3329'; g.fillRect(x0 + bw * 0.22 - 2 * S, y0 - 29 * S, 12 * S, 4 * S); }
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x0, y0, 4 * S, bh); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x0 + bw - 5 * S, y0, 5 * S, bh);
    const out = { cv, w: cv.width / DPR, h: cv.height / DPR, bodyH: bh / DPR, top: top / DPR }; cache.set(key, out); return out;
  }

  // ---------------------------------------------------------------- scene
  class TowerGame {
    constructor(canvas) {
      this.c = canvas; this.g = canvas.getContext('2d'); this.ci = 0; this.roundId = null; this.onReady = null; this._ready = null; this.clockOffset = 0; this.swing = null;
      this.buildBackdrop(); this.reset(); this.resize();
      this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas);
      this.last = performance.now(); this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    }
    buildBackdrop() {
      this.clouds = Array.from({ length: 7 }, () => ({ x: rand(-6, 6), fy: rand(0.04, 0.7), s: rand(1.1, 2.4), v: rand(0.05, 0.16), z: rand(0.2, 0.7) }));
      this.birds = [{ x: -8, y: 7.2, v: 0.9, t: 0 }];
    }
    reset() {
      this.state = 'idle'; this.u = 0; this.floors = []; this.base = 0; this.landed = 0; this.targetSucc = 0; this.queue = []; this.failQueued = false; this.pendingVerdicts = 0;
      this.debris = []; this.lostT = 0; this.camV = 0; this.wreckT = -1; this.pieces = []; this.tractorX = 0; this.struck = false;
      this.wob = 0; this.wv = 0; this.shake = 0; this.puffs = []; this.pops = []; this.fall = null; this.tumble = null; this.rest = null; this.intro = null; this.hang = null; this.popFor = 0;
      this.th = 0; this.thv = 0; this.lrope = LROPE_HIDE; this.roundStatus = 'idle'; this.maxSteps = 10; this.mults = []; this.camBottom = -0.7; this.camSet = false;
    }
    resize() { const r = this.c.getBoundingClientRect(); this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); this.c.width = Math.round(this.w * DPR); this.c.height = Math.round(this.h * DPR); this.g.setTransform(DPR, 0, 0, DPR, 0, 0); this.hv = Math.max(8.4, 6.9 / (this.w / this.h)); this.ppu = this.h / this.hv; window.TowerProps && TowerProps.clear(); }

    // ---------------------------------------------------------------- state from the round
    now() { return Date.now() + this.clockOffset; }
    swingAt(t) { const w = this.swing; if (!w || t < w.start) return { x: 0, v: 0 }; const k = (2 * Math.PI) / w.period, ph = k * (t - w.start); return { x: w.amp * Math.sin(ph), v: w.amp * k * 1000 * Math.cos(ph) }; }
    sync(round) {
      if (!round) { if (this.roundId !== null) { this.reset(); this.roundId = null; } this._setReady(false); return; }
      const v = round.view, succ = v.picks; this.swing = v.swing; this.clockOffset = v.serverNow - Date.now();
      if (round.id !== this.roundId) {
        this.reset(); this.roundId = round.id;
        const fresh = round.status === 'active' && succ === 0, total = succ + (fresh ? 0 : 1);
        for (let i = 0; i < total; i++) this.floors.push({ v: this.ci++, ox: 0, tilt: 0, sq: 0, dmg: [] });
        this.base = fresh ? 0 : 1; this.landed = this.targetSucc = succ;
        if (fresh) this.startIntro();
        else if (round.status === 'active') { this.state = 'land'; this.u = 2; this.newHang(); }
        else { this.state = 'done'; if (round.status === 'lost') { this.failQueued = true; this.rest = { x: SLAB_W / 2 + 1.4, rot: 1.5708, v: this.ci++ }; } }
        this.camBottom = this.camTarget();
      }
      this.maxSteps = v.maxSteps; this.mults = v.multipliers; this.roundStatus = round.status;
      while (this.targetSucc < succ) { if (this.pendingVerdicts > 0) { this.pendingVerdicts--; this.reconcile(true); } else this.queue.push({ ok: true }); this.targetSucc++; }
      if (round.status === 'lost' && !this.failQueued) { if (this.pendingVerdicts > 0) { this.pendingVerdicts--; this.reconcile(false); } else this.queue.push({ ok: false }); this.failQueued = true; }
      if (round.status === 'won' && !this.queue.length && ['sway', 'arrive'].includes(this.state)) { this.state = 'leave'; this.u = 0; this.leaveFrom = this.lrope; }
    }
    reconcile(ok) { if (this.fall && this.fall.ok !== ok) { this.fall.ok = ok; this.fall.kicked = false; } }       // the server's verdict is final
    startIntro() { this.intro = { x: 0.1, y: SLAB_H + 14 + HH / 2, vy: -2, rot: 0.25, vr: -0.9, v: this.ci++ }; this.state = 'intro'; this.u = 0; }
    newHang() { this.hang = { v: this.ci++ }; }
    _setReady(v) { if (v !== this._ready) { this._ready = v; this.onReady?.(v); } }
    landTop() { return SLAB_H + (this.landed + this.base) * INC; }
    camTarget() { return Math.max(-0.7, this.landTop() - 0.36 * this.hv); }   // tower top stays at a steady height; everything below scrolls away at the same speed
    pivotY() { return this.landTop() + PIVOT_UP; }
    tap() {
      if (this.state !== 'sway' || this.roundStatus !== 'active' || !this.hang || this.fall || !this.swing) return false;
      const t = this.now(); if (t < this.swing.start + 40) return false;
      const x = this.swingAt(t).x; this.pendingVerdicts++; this.release({ ok: Math.abs(x) <= this.swing.tol }); return true;
    }
    release(item) {
      if (!this.hang) return; const sp = this.swingAt(this.now()), x = R * Math.sin(this.th), y = this.pivotY() - R * Math.cos(this.th);
      const side = Math.abs(x) < 0.15 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(x), vx = sp.v / 1000;
      const ox = clamp(x * 0.22 + vx * 0.02, -0.3, 0.3), tilt = clamp(-x * 0.03 - vx * 0.004, -0.06, 0.06);
      this.fall = { dmg: [], v: this.hang.v, x, y, vy: 0, vx, rot: this.th, ok: item.ok, side, ox, tilt, y0: y }; this.hang = null; this.state = 'drop'; this.u = 0; this.thv *= 0.3;
    }

    // ---------------------------------------------------------------- loop
    _loop(now) {
      if (!this.c.isConnected) { this._ro.disconnect(); return; }
      requestAnimationFrame(this._loop);
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      if (!this.w) return; this.update(dt); this.draw(this.g, now / 1000);
    }
    // chips/cracks live on the house (local coords: x, y in -0.5..0.5 of the body); debris flies off in the wall colour
    hit(target, edge, xFrac, power, who) {
      if (!target) return; if (!target.dmg) target.dmg = [];
      if (edge === 'top') target.dmg.push({ kind: 'dent', x: clamp(xFrac, -0.4, 0.4), s: 0.6 + power * 0.8, seed: Math.floor(rand(1, 1e6)) });
      else target.dmg.push({ kind: 'corner', side: xFrac < 0 ? -1 : xFrac > 0 ? 1 : (Math.random() < 0.5 ? -1 : 1), s: 0.55 + power * 0.8, seed: Math.floor(rand(1, 1e6)) });
      if (target.dmg.length > 6) target.dmg.shift();
    }
    spray(x, y, n, col) { for (let i = 0; i < n; i++) this.debris.push({ x: x + rand(-0.25, 0.25), y: y + rand(-0.05, 0.15), vx: rand(-2.2, 2.2), vy: rand(1.2, 4.2), rot: rand(0, 6), vr: rand(-9, 9), s: rand(0.035, 0.09), col: Math.random() < 0.65 ? col : '#8d949b', life: rand(0.6, 1.2) }); }
    puff(x, y, n = 10, spread = 0.9) { for (let i = 0; i < n; i++) { const s = i % 2 ? 1 : -1; this.puffs.push({ x: x + s * spread * rand(0.7, 1.1), y: y + rand(0, 0.12), vx: s * rand(0.5, 1.9), vy: rand(0.05, 0.5), r: rand(0.22, 0.45), life: rand(0.5, 0.95), max: 0.95 }); } }
    // after a loss: once the plaque is gone a bulldozer drives in from the left, knocks the tower over and the houses fall apart and vanish
    wreck() { if (this.state !== 'done' || this.roundStatus !== "lost" || this.wreckT !== -1) return; this.wreckT = 0; this.struck = false; this.tractorX = -(this.w / 2 / this.ppu + 2.0); }
    stepWreck(dt) {
      this.wreckT += dt; const v = 4.6; this.tractorX += v * dt; this.tw = (this.tw || 0) + v * dt * 1.6;
      if (Math.random() < dt * 14) this.puffs.push({ x: this.tractorX - 1.9, y: 0.12, vx: -rand(0.3, 0.9), vy: rand(0.4, 0.9), r: rand(0.18, 0.32), life: 0.7, max: 0.7 });
      if (!this.struck && this.tractorX + 1.95 >= -HW / 2 - 0.05) {
        this.struck = true; this.shake = 0.9; this.puff(-HW / 2, 0.2, 14, 0.9);
        this.floors.forEach((f, i) => this.pieces.push({ v: f.v, dmg: f.dmg, x: f.ox, y: SLAB_H + i * INC + HH / 2, vx: 6 + rand(0, 3) + i * 0.3, vy: rand(1.5, 4.5) + Math.min(i, 5) * 0.4, rot: f.tilt, vr: -rand(2, 5), age: 0, down: 0 }));
        if (this.rest) this.pieces.push({ v: this.rest.v, dmg: this.rest.dmg, x: this.rest.x, y: 1, vx: 6, vy: 3, rot: this.rest.rot, vr: -3, age: 0, down: 0 });
        this.floors = []; this.rest = null; this.spray(-HW / 2, 1.2, 26, '#c9b79a');
      }
      const tip = this.tractorX + 1.95, late = this.struck && this.tractorX > 1.5;
      for (const q of this.pieces) {
        if (tip > q.x - HW / 2 && q.x < tip + HW) { q.x = Math.max(q.x, tip + HW / 2 * Math.abs(Math.cos(q.rot)) + 0.02); q.vx = Math.max(q.vx, 4.6 * 1.7); }    // the blade shoves everything ahead of it
        if (late) q.age += dt * 1.5;
        q.vy -= 22 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
        const low = (HW / 2) * Math.abs(Math.sin(q.rot)) + (HH / 2) * Math.abs(Math.cos(q.rot)), gnd = Math.abs(q.x) < SLAB_W / 2 ? SLAB_H : 0;
        if (q.y - low <= gnd && q.vy < 0) { q.y = gnd + low; q.vy = -q.vy * 0.28; q.vx *= 0.7; q.vr *= 0.6; if (Math.abs(q.vy) > 1.2 && q.down < 3) { this.puff(q.x, gnd + 0.1, 5, 0.6); this.shake = Math.max(this.shake, 0.25); this.spray(q.x, gnd + 0.2, 6, '#c9b79a'); } q.down++; }
        if (q.down > 0) q.age += dt;
      }
      this.pieces = this.pieces.filter((q) => q.age < 0.9 && q.x < this.w / 2 / this.ppu + 3);
      if (this.tractorX - 2.0 > this.w / 2 / this.ppu && !this.pieces.length) { this.wreckT = -2; }
    }
    support(x, top) { const a = Math.abs(x); return a < HW / 2 + 0.25 ? top : a < SLAB_W / 2 ? SLAB_H : 0; }
    update(dt) {
      if (this.state === 'done' && this.roundStatus === 'lost' && this.wreckT === -1 && this.lostT > 0.9) this.wreck();      // the bulldozer rolls in while the plaque is still up
      if (this.wreckT >= 0) this.stepWreck(dt);
      const tS = this.now(), sw0 = this.swing ? this.swing.start : tS, top = this.landTop();
      this.u += dt; this.wv += (-60 * this.wob - 5.5 * this.wv) * dt; this.wob += this.wv * dt;
      for (const f of this.floors) if (f.sq) { f.sq *= Math.exp(-9 * dt); if (f.sq < 0.002) f.sq = 0; }
      let hasHouse = false;
      switch (this.state) {
        case 'intro': {
          const f = this.intro; f.vy -= 22 * dt; f.y += f.vy * dt; f.rot += f.vr * dt * Math.min(1, (f.y - HH / 2 - top) / 5); f.x = lerp(f.x, 0, clamp(dt * 2));
          if (f.y - HH / 2 <= top) { this.floors.push({ v: f.v, ox: 0, tilt: 0.01, sq: 0.1, dmg: [] }); this.base = 1; this.intro = null; this.wv += 3.4; this.shake = 0.7; this.puff(0, top + 0.1, 14, 1.1); this.state = 'land'; this.u = 0; }
          break; }
        case 'land': case 'drop': case 'tumble': this.lrope = lerp(this.lrope, LROPE_HIDE, clamp(dt * 3.2)); break;
        case 'arrive': { const k = sm(clamp(1 - (sw0 - tS) / 1100)); this.lrope = lerp(LROPE_HIDE, LROPE_HOVER, k); hasHouse = true; if (tS >= sw0) { this.state = 'sway'; this.u = 0; } break; }
        case 'sway': this.lrope = LROPE_HOVER; hasHouse = true; if (this.queue.length && this.hang) this.release(this.queue.shift()); break;   // a verdict that arrived without a tap (resumed round)
        case 'leave': { this.lrope = lerp(this.leaveFrom, LROPE_HIDE, sm(clamp(this.u / 0.9))); hasHouse = !!this.hang; if (this.u >= 0.9) { this.hang = null; this.state = 'done'; } break; }
        default: this.lrope = lerp(this.lrope, LROPE_HIDE, clamp(dt * 3));
      }
      if (this.state === 'drop' || this.state === 'land' || this.state === 'tumble') this.stepFall(dt, top, tS, sw0);
      if (hasHouse && this.swing) { const sp = this.swingAt(tS); this.th = Math.asin(clamp(sp.x / R, -0.95, 0.95)); this.thv = sp.v / 1000 / R; } else { this.thv *= 0.9; this.th *= 0.92; }
      this._setReady(this.state === 'sway' && this.roundStatus === 'active' && !this.fall && !!this.swing && tS >= this.swing.start + 60);
      if (this.state === 'done' && this.roundStatus === 'lost') this.lostT += dt;
      if (this.lostT > 0.45) {                                  // the result plaque is up: the camera drops to the first house, faster and faster
        const floor = -0.7; if (this.camBottom > floor) { this.camV += 17 * dt; this.camBottom = Math.max(floor, this.camBottom - this.camV * dt); if (this.camBottom <= floor) { this.camV = 0; this.shake = Math.max(this.shake, 0.35); } }
      } else { const ct = this.camTarget(); this.camBottom = this.camSet ? this.camBottom + (ct - this.camBottom) * Math.min(1, dt * 2.0) : ct; }
      this.camSet = true;
      this.shake = Math.max(0, this.shake - dt * 2.2);
      for (const p of this.puffs) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 0.5; } this.puffs = this.puffs.filter((p) => p.life > 0);
      for (const d of this.debris) { d.vy -= 16 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt; d.life -= dt; if (d.y < 0.02) { d.y = 0.02; d.vy *= -0.3; d.vx *= 0.6; } } this.debris = this.debris.filter((d) => d.life > 0);
      for (const p of this.pops) p.life -= dt; this.pops = this.pops.filter((p) => p.life > 0);
      for (const c of this.clouds) { c.x += c.v * dt; if (c.x > 9) c.x = -9; }
      for (const b of this.birds) { b.t += dt; b.x += b.v * dt; if (b.x > 9) { b.x = -9; b.y = rand(5.5, 9); } }
    }
    stepFall(dt, top, tS, sw0) {
      const f = this.fall;
      if (f) {
        f.vy -= 26 * dt; f.y += f.vy * dt;
        const prog = clamp((f.y0 - f.y) / Math.max(0.5, f.y0 - (top + HH / 2)));
        if (!f.ok && !f.kicked) { f.kicked = true; if (Math.abs(f.x) < 0.6) f.vx += f.side * (1.6 - Math.abs(f.x)); }
        f.vx *= Math.exp(-(f.ok ? 5 : 0.5) * dt); f.x += f.vx * dt;
        if (f.ok) { f.x = lerp(f.x, f.ox, clamp(dt * (1.2 + 16 * prog * prog))); f.rot = lerp(f.rot, f.tilt, clamp(dt * 7)); } else f.rot -= f.side * 0.7 * dt;
        if (f.y - HH / 2 <= top) {
          if (f.ok) {
            const impact = -f.vy, pw = clamp((impact - 6) / 9), under = this.floors[this.floors.length - 1], col = PAL[(f.v % 42) % PAL.length].wall;
            const nf = { v: f.v, ox: f.ox, tilt: f.tilt, sq: clamp(impact / 130, 0.03, 0.09), dmg: f.dmg }; this.puff(f.ox - 0.7, top + 0.08, 4, 0.5); this.puff(f.ox + 0.7, top + 0.08, 4, 0.5);
            this.floors.push(nf); this.landed++; this.fall = null; this.wv += 1.3 + impact * 0.08;
            this.puff(f.ox, top + 0.1, 12, 1.0); this.state = 'land'; this.u = 0; this.shake = 0.25;
            const m = this.mults[this.landed - 1]; if (m != null && this.popFor !== this.landed) { this.popFor = this.landed; this.pops.push({ txt: 'x' + m.toFixed(2), x: -0.2, y0: top + INC + 0.5, life: 1.5, max: 1.5 }); }
          } else { this.tumble = { dmg: f.dmg, x: f.x, y: f.y, vx: f.side * 1.4 + f.vx * 0.3, vy: 2.4, rot: f.rot, vr: -f.side * 2.6, side: f.side, hit: 0, v: f.v }; this.fall = null; this.wv += f.side * 2.6; this.puff(f.x, top + 0.1, 8, 0.8); this.state = 'tumble'; }
        }
      }
      const q = this.tumble;
      if (q) {
        q.vy -= 26 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
        { const lim = this.w / 2 / this.ppu - HH / 2 - 0.15; if (Math.abs(q.x) > lim) { q.x = Math.sign(q.x) * lim; q.vx = -q.vx * 0.3; } }
        const sup = this.support(q.x, top), low = (HW / 2) * Math.abs(Math.sin(q.rot)) + (HH / 2) * Math.abs(Math.cos(q.rot));
        if (q.y - low <= sup && q.vy < 0) {
          q.y = sup + low; q.hit++; this.puff(q.x, sup + 0.1, 6, 0.6);
          const onTower = Math.abs(q.x) < HW / 2 + 0.2 && sup === top && top > SLAB_H; if (!q.dmg) q.dmg = [];
          if (onTower) this.hit(this.floors[this.floors.length - 1], 'top', clamp(q.x / HW, -0.45, 0.45), 1, 'T');
          this.hit(q, 'bottom', clamp(q.side * 0.4, -0.45, 0.45), 0.6 + (q.hit < 2 ? 0.4 : 0), 'W'); this.spray(q.x, sup + 0.1, 8, PAL[(q.v % 42) % PAL.length].wall); this.shake = Math.max(this.shake, 0.3);
          if (Math.abs(q.x) < HW / 2 + 0.2 && q.hit < 6) { q.vx = q.side * Math.max(Math.abs(q.vx), 1.9); q.vy = Math.max(Math.abs(q.vy) * 0.5, 2.0); q.vr = -q.side * 2.6; }           // still on the tower: shove it over the edge
          else if (q.hit >= 3 || (q.hit >= 2 && Math.abs(q.vy) < 2.6)) { this.rest = { x: q.x, rot: -q.side * 1.5708, v: q.v, dmg: q.dmg }; this.tumble = null; this.state = 'done'; this.u = 0; this.shake = 0.2; this.puff(q.x, sup + 0.1, 8, 0.7); }
          else { q.vy *= -0.3; q.vx *= 0.6; q.vr *= 0.55; }
        }
      }
      if (this.state === 'land' && this.u > 1.05) {
        if (this.roundStatus === 'active' && this.landed < this.maxSteps) { if (!this.hang) this.newHang(); if (tS >= sw0 - 1100) { this.state = 'arrive'; this.u = 0; } } else this.state = 'done';
      }
    }

    // ---------------------------------------------------------------- drawing
    X(wx) { return this.w / 2 + wx * this.ppu; }
    Y(wy) { return this.h - (wy - this.camBottom) * this.ppu; }
    drawHouse(g, v, wx, wyCenter, rot = 0, sq = 0, dmg = null) {
      const b = houseBitmap(v, this.ppu), cx = this.X(wx), cy = this.Y(wyCenter), cv = dmg && dmg.length ? this.damaged(b, dmg) : b.cv;
      g.save(); g.translate(cx, cy); g.rotate(-rot); g.scale(1 + sq * 0.5, 1 - sq); g.drawImage(cv, -b.w / 2, -(b.top + b.bodyH / 2), b.w, b.h); g.restore();
    }
    // house sprite with its damage baked in: a broken-off corner where it hit, a crushed dent in the roof edge that was hit
    damaged(b, dmg) {
      const key = dmg.length + ':' + dmg[dmg.length - 1].seed + ':' + b.cv.width;
      if (dmg._c && dmg._k === key) return dmg._c;
      const W = b.cv.width, H = b.cv.height, k = W / b.w, bw = HW * this.ppu * k, bh = b.bodyH * k, top = b.top * k, x0 = (W - bw) / 2;
      const c = document.createElement('canvas'); c.width = W; c.height = H; const q = c.getContext('2d'); q.drawImage(b.cv, 0, 0);
      for (const m of dmg) {
        const r = rngSeed(m.seed);
        if (m.kind === 'corner') {
          const sz = bw * (0.07 + 0.08 * m.s), X = m.side < 0 ? x0 : x0 + bw, Y = top + bh, dir = -m.side;   // dir: into the body
          const pts = [[X, Y - sz * 1.5]]; for (let i = 1; i < 5; i++) pts.push([X + dir * sz * (i / 5) * (0.6 + r() * 0.7), Y - sz * 1.5 * (1 - i / 5) * (0.5 + r() * 0.7) - sz * 0.1 * i]); pts.push([X + dir * sz * 1.5, Y]);
          pts.unshift([X - dir * 4, Y - sz * 1.5 - 2]); pts.push([X + dir * sz * 1.5 + 2, Y + 4]); pts.push([X - dir * 4, Y + 4]);
          const path = () => { q.beginPath(); pts.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); q.closePath(); };
          q.globalCompositeOperation = 'destination-out'; path(); q.fill();
          q.globalCompositeOperation = 'source-atop'; q.strokeStyle = 'rgba(30,22,16,.75)'; q.lineWidth = Math.max(2, bw * 0.02); q.lineJoin = 'round'; q.beginPath(); pts.slice(1, -2).forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); q.stroke();
          q.strokeStyle = 'rgba(255,240,215,.35)'; q.lineWidth = 1; q.beginPath(); pts.slice(1, -2).forEach(([x, y], i) => (i ? q.lineTo(x + dir * 2, y - 2) : q.moveTo(x + dir * 2, y - 2))); q.stroke();
        } else {
          const w = bw * 0.15 * (0.7 + 0.4 * m.s), d = w * 0.85, X = W / 2 + m.x * bw, Y = 0;
          const pts = [[X - w * 1.1, Y - 2]]; for (let i = 1; i < 6; i++) { const t = i / 6, e = Math.sin(t * Math.PI); pts.push([X - w * 1.1 + t * w * 2.2 + (r() - 0.5) * w * 0.2, Y + d * e * (0.75 + r() * 0.5)]); } pts.push([X + w * 1.1, Y - 2]);
          q.globalCompositeOperation = 'destination-out'; q.beginPath(); pts.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); q.closePath(); q.fill();
          q.globalCompositeOperation = 'source-atop';
          const gr = q.createRadialGradient(X, Y + d * 0.6, 1, X, Y + d * 0.6, w * 2); gr.addColorStop(0, 'rgba(15,10,6,.65)'); gr.addColorStop(1, 'rgba(15,10,6,0)'); q.fillStyle = gr; q.fillRect(X - w * 2.2, Y, w * 4.4, d * 3);   // crushed shadow under the dent
          q.strokeStyle = 'rgba(30,22,16,.7)'; q.lineWidth = Math.max(1.5, bw * 0.014); q.lineJoin = 'round'; q.beginPath(); pts.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); q.stroke();
          q.lineWidth = 1; for (let i = 0; i < 3; i++) { let x = X + (i - 1) * w * 0.7, y = Y + d * 0.8, a = 1.57 + (r() - 0.5) * 0.9; q.beginPath(); q.moveTo(x, y); for (let j = 0; j < 3; j++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * w * 0.35; y += Math.sin(a) * w * 0.35; q.lineTo(x, y); } q.stroke(); }
        }
      }
      q.globalCompositeOperation = 'source-over'; dmg._c = c; dmg._k = key; return c;
    }
    cloud(g, x, y, s, a) {
      g.save(); g.globalAlpha = a; const r = s * this.ppu * 0.42;
      for (const [dx, dy, k] of [[-1.5, 0.2, 0.75], [-0.6, -0.35, 1], [0.5, -0.3, 0.95], [1.4, 0.15, 0.7], [0.1, 0.15, 1.1]]) { const cx = x + dx * r * 0.7, cy = y + dy * r * 0.7, gr = g.createRadialGradient(cx, cy - r * 0.15, r * 0.1, cx, cy, r * k); gr.addColorStop(0, '#fff'); gr.addColorStop(0.7, '#f2f8ff'); gr.addColorStop(1, 'rgba(214,232,250,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r * k, 0, 6.283); g.fill(); }
      g.restore();
    }
    cityLayer(g, layer, par) {
      const { ppu } = this, c = TowerProps.city(layer, ppu, 30), off = (this.camBottom + 0.7) * ppu * par, by = this.Y(0) - off + 0.25 * ppu, y = by - c.base;
      if (y > this.h) return; g.drawImage(c.cv, this.X(-15), y, c.w, c.h);
    }
    sprite(g, s, wx, baseY, flip = false, sway = 0) { const ax = s.anchorX != null ? s.anchorX : s.w / 2; g.save(); g.translate(this.X(wx), baseY); if (flip) g.scale(-1, 1); if (sway) g.transform(1, 0, sway, 1, 0, 0); g.drawImage(s.cv, -ax, -s.h, s.w, s.h); g.restore(); }
    draw(g, t) {
      this._t = t;
      const { w, h, ppu } = this, cam = this.camBottom;
      g.save(); if (this.shake > 0) g.translate((Math.random() - 0.5) * 7 * this.shake, (Math.random() - 0.5) * 7 * this.shake);
      const sk = g.createLinearGradient(0, 0, 0, h); sk.addColorStop(0, '#1f78d8'); sk.addColorStop(0.45, '#4aa6ee'); sk.addColorStop(0.8, '#9ad6f7'); sk.addColorStop(1, '#d8f0fb'); g.fillStyle = sk; g.fillRect(-10, -10, w + 20, h + 20);
      const sun = g.createRadialGradient(w * 0.8, h * 0.16, 2, w * 0.8, h * 0.16, w * 0.55); sun.addColorStop(0, 'rgba(255,248,214,.95)'); sun.addColorStop(0.18, 'rgba(255,240,180,.55)'); sun.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = sun; g.fillRect(0, 0, w, h);
      for (const c of this.clouds) { const span = h * 1.15, base = c.fy * h + (cam + 0.9) * ppu * c.z * 0.35, y = ((base % span) + span) % span - h * 0.07; this.cloud(g, this.X(c.x), y, c.s, 0.55 + c.z * 0.45); }
      for (const b of this.birds) { const x = this.X(b.x), y = this.Y(b.y) - (cam + 0.9) * ppu * 0.3, f = Math.sin(b.t * 9) * 4; g.strokeStyle = 'rgba(20,50,90,.7)'; g.lineWidth = 1.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 7, y - f); g.quadraticCurveTo(x - 3, y - 4, x, y); g.quadraticCurveTo(x + 3, y - 4, x + 7, y - f); g.stroke(); }
      this.cityLayer(g, 0, 0.16); this.cityLayer(g, 1, 0.3);
      const gy = this.Y(0); const gp = gy;      // the landscape scrolls away with the camera
      if (gp < h + 8 * ppu) {                       // trees / fence / lamp rise above the ground line: keep drawing them until their tops leave the frame
        const gg = g.createLinearGradient(0, gp, 0, h); gg.addColorStop(0, '#5fbf4a'); gg.addColorStop(0.07, '#3f9a3a'); gg.addColorStop(0.1, '#9a7a56'); gg.addColorStop(1, '#6d5238'); g.fillStyle = gg; if (gp < h) g.fillRect(0, gp, w, h - gp + 4);
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, gp, w, 2); g.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 18; i++) { g.beginPath(); g.ellipse(((i * 97) % 211) / 211 * w, gp + 0.45 * ppu + ((i * 53) % 37) / 37 * 0.9 * ppu, 5 + (i % 4) * 2, 2.5, 0, 0, 6.283); g.fill(); }
        this.props(g, gp);
      }
      const sy = this.Y(SLAB_H), sw = SLAB_W * ppu;
      if (sy < h + 40) {
        const x = this.X(-SLAB_W / 2), gr = g.createLinearGradient(0, sy, 0, gy); gr.addColorStop(0, '#d7dee6'); gr.addColorStop(1, '#8e9aa7'); g.fillStyle = gr; g.fillRect(x, sy, sw, gy - sy);
        g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(x, sy, sw, 2.5); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, sy + (gy - sy) * 0.55, sw, 1.5);
        const bandH = (gy - sy) * 0.3, by = sy + (gy - sy) * 0.18; g.save(); g.beginPath(); g.rect(x, by, sw, bandH); g.clip(); for (let i = -2, ix = x; ix < x + sw + 40; i++, ix += 22) { g.fillStyle = i % 2 ? '#2b333c' : '#f6b50b'; g.beginPath(); g.moveTo(ix, by + bandH); g.lineTo(ix + 11, by + bandH); g.lineTo(ix + 22, by); g.lineTo(ix + 11, by); g.fill(); } g.restore();
        g.fillStyle = '#6f7c89'; for (const bx of [x + 8, x + sw - 8]) { g.beginPath(); g.arc(bx, by + bandH + (gy - sy) * 0.18, 2.6, 0, 6.283); g.fill(); }
      }
      if (gp < h + 8 * ppu) this.propsFront(g, gp);
      const n = this.floors.length;
      this.floors.forEach((f, i) => { const k = n > 1 ? i / (n - 1) : 1, kf = 0.1 + 0.9 * k, wy = SLAB_H + i * INC + HH / 2; if (this.Y(wy) < -HH * ppu) return; this.drawHouse(g, f.v, f.ox + this.wob * 0.2 * kf, wy, f.tilt - this.wob * 0.02 * kf, f.sq, f.dmg); });
      if (this.intro) this.drawHouse(g, this.intro.v, this.intro.x, this.intro.y, this.intro.rot);
      if (this.fall) this.drawHouse(g, this.fall.v, this.fall.x, this.fall.y, this.fall.rot, 0, this.fall.dmg);
      if (this.tumble) this.drawHouse(g, this.tumble.v, this.tumble.x, this.tumble.y, this.tumble.rot, 0, this.tumble.dmg);
      if (this.rest) { const q = this.rest, sup = this.support(q.x, this.landTop()), low = (HW / 2) * Math.abs(Math.sin(q.rot)) + (HH / 2) * Math.abs(Math.cos(q.rot)); g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(this.X(q.x), this.Y(sup) + 2, HW * ppu * 0.55, 5, 0, 0, 6.283); g.fill(); this.drawHouse(g, q.v, q.x, sup + low, q.rot, 0, q.dmg); }
      for (const q of this.pieces) { g.save(); g.globalAlpha = clamp(1 - q.age / 0.9); this.drawHouse(g, q.v, q.x, q.y, q.rot, 0, q.dmg); g.restore(); }
      if (this.wreckT >= 0) this.drawTractor(g, this.tractorX, gy);
      // the allowed release window on the roof of the tower while the swing is live
      if (this.swing && ['arrive', 'sway'].includes(this.state) && this.roundStatus === 'active') {
        const tol = this.swing.tol, x1 = this.X(-tol), x2 = this.X(tol), y = this.Y(this.landTop()), live = this.state === 'sway', pulse = 0.5 + 0.5 * Math.sin(t * 5);
        g.save(); g.fillStyle = `rgba(80,255,150,${live ? 0.3 + 0.2 * pulse : 0.12})`; g.fillRect(x1, y - 5, x2 - x1, 5); g.strokeStyle = `rgba(190,255,215,${live ? 0.95 : 0.4})`; g.lineWidth = 1.5; g.setLineDash([4, 3]); g.lineDashOffset = -t * 12; g.strokeRect(x1, y - 5, x2 - x1, 5); g.restore();
      }
      this.drawHook(g);
      for (const d of this.debris) { g.save(); g.globalAlpha = clamp(d.life / 0.35); g.translate(this.X(d.x), this.Y(d.y)); g.rotate(d.rot); g.fillStyle = d.col; const z = d.s * this.ppu; g.fillRect(-z / 2, -z / 2, z, z * 0.7); g.restore(); }
      for (const p of this.puffs) { const a = clamp(p.life / p.max), x = this.X(p.x), y = this.Y(p.y), r = p.r * ppu, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${0.95 * a})`); gr.addColorStop(0.6, `rgba(250,250,250,${0.7 * a})`); gr.addColorStop(1, 'rgba(240,240,240,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); }
      for (const p of this.pops) { const k = 1 - p.life / p.max, y = this.Y(p.y0 + 1.6 * (1 - Math.pow(1 - k, 2))), x = this.X(p.x), sc = 1 + 0.4 * Math.sin(clamp(k * 4) * Math.PI); g.save(); g.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3; g.translate(x, y); g.scale(sc, sc); g.font = "800 28px 'Unbounded',system-ui,sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 7; g.strokeStyle = 'rgba(110,55,0,.95)'; g.strokeText(p.txt, 0, 0); const tg = g.createLinearGradient(0, -14, 0, 14); tg.addColorStop(0, '#fff2a0'); tg.addColorStop(0.5, '#ffc533'); tg.addColorStop(1, '#ff9a14'); g.fillStyle = tg; g.fillText(p.txt, 0, 0); g.restore(); }
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75); vg.addColorStop(0, 'rgba(0,30,70,0)'); vg.addColorStop(1, 'rgba(0,30,70,.22)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
      g.restore();
    }
    props(g, gy) {                                  // behind the tower: site fence, trees, park lamp
      const { ppu } = this, P = TowerProps, f = P.fence(ppu);
      for (let i = -2; i <= 1; i++) this.sprite(g, f, i * 3.2 + 1.6, gy + 0.12 * ppu);
      const tt = this._t || 0, gust = 0.5 + 0.5 * Math.sin(tt * 0.5);       // wind: slow sway plus a gust; the crown leans more than the trunk base
      this.sprite(g, P.tree('birch', ppu), -3.15, gy + 0.05 * ppu, false, (Math.sin(tt * 1.7) * 0.022 + Math.sin(tt * 3.1 + 1) * 0.008) * (0.6 + gust));
      this.sprite(g, P.tree('linden', ppu), 3.35, gy + 0.05 * ppu, false, (Math.sin(tt * 1.3 + 2) * 0.018 + Math.sin(tt * 2.7) * 0.007) * (0.6 + gust));
      const l = P.lamp(ppu); this.sprite(g, l, -2.95 + (l.anchorX != null ? 0 : 0), gy + 0.02 * ppu);
    }
    // the foreman and his speaker on the ground in front: he sways to the beat, the speaker cone pumps and notes float up
    drawCrew(g, gy, t) {
      const u = this.ppu, beat = 0.5, ph = (t % beat) / beat, pulse = Math.pow(Math.max(0, Math.cos(ph * 6.283)), 3);
      if (!TowerFx.loading) { TowerFx.loading = true; const im = new Image(); im.onload = () => { TowerFx.worker = im; }; im.src = window.WORKER_SRC || 'img/worker.webp' + (window.BUILD ? '?v=' + window.BUILD : ''); }
      const sx = this.X(-2.3), sw = 0.62 * u, sh = 0.9 * u, shake = pulse * 0.6;
      g.save(); g.translate(sx + (Math.random() - 0.5) * shake, gy + 0.1 * u);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(0, 0, sw * 0.75, 4, 0, 0, 6.283); g.fill();
      let gr = g.createLinearGradient(-sw / 2, 0, sw / 2, 0); gr.addColorStop(0, '#2a2f38'); gr.addColorStop(0.5, '#3d4452'); gr.addColorStop(1, '#20242b'); g.fillStyle = gr;
      g.beginPath(); g.roundRect ? g.roundRect(-sw / 2, -sh, sw, sh, 6) : g.rect(-sw / 2, -sh, sw, sh); g.fill(); g.strokeStyle = '#11141a'; g.lineWidth = 1.5; g.stroke();
      const cone = (cy, r, k) => { const rr = r * (1 + 0.1 * pulse * k); const cg = g.createRadialGradient(0, cy, rr * 0.1, 0, cy, rr); cg.addColorStop(0, '#6b7482'); cg.addColorStop(0.45, '#1a1d23'); cg.addColorStop(1, '#2d323b'); g.fillStyle = cg; g.beginPath(); g.arc(0, cy, rr, 0, 6.283); g.fill(); g.strokeStyle = '#8b94a3'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = '#9aa3b1'; g.beginPath(); g.arc(0, cy, rr * 0.2, 0, 6.283); g.fill(); };
      cone(-sh * 0.3, sw * 0.34, 1); cone(-sh * 0.74, sw * 0.18, 0.6);
      g.fillStyle = '#ff3b5c'; g.beginPath(); g.arc(sw * 0.34, -sh * 0.95, 2.2, 0, 6.283); g.fill();
      for (let i = 0; i < 2; i++) { const k = ((t * 1.1 + i * 0.5) % 1); g.strokeStyle = `rgba(255,255,255,${0.35 * (1 - k)})`; g.lineWidth = 2; g.beginPath(); g.arc(0, -sh * 0.45, sw * (0.6 + k * 0.8), -0.9, 0.9); g.stroke(); g.beginPath(); g.arc(0, -sh * 0.45, sw * (0.6 + k * 0.8), 3.14 - 0.9, 3.14 + 0.9); g.stroke(); }
      g.font = `700 ${Math.round(0.34 * u)}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < 3; i++) { const k = ((t * 0.5 + i / 3) % 1); g.globalAlpha = Math.sin(k * Math.PI) * 0.95; g.fillStyle = i % 2 ? '#ffd84a' : '#ffffff'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 3; g.fillText(i % 2 ? '♪' : '♫', (i - 1) * 0.28 * u + Math.sin(k * 6) * 5, -sh - k * 1.5 * u); }
      g.restore();
      const im = TowerFx.worker;
      if (im && im.width) {
        // the foreman is a jointed puppet cut from one picture: legs, torso (arms crossed) and head move on their own pivots
        const hgt = 1.8 * u, iw = im.width, ih = im.height, sc = hgt / ih, wid = iw * sc, b = t * 12.566, w1 = Math.sin(b / 2), w2 = Math.sin(b / 2 + 3.1416);
        const cut = 0.62 * ih, neck = 0.295 * ih, split = 0.52 * iw, hip = (Math.abs(w1)) * 0.045 * hgt;
        g.save(); g.translate(this.X(-1.45), gy + 0.12 * u); g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(0, 0, wid * 0.5 * (1 - Math.abs(w1) * 0.06), 4.5, 0, 0, 6.283); g.fill();
        const piece = (sx, sy, sw, sh, px, py, rot, dx, dy) => { g.save(); g.translate((px - iw / 2) * sc + dx, (py - ih) * sc + dy); g.rotate(rot); g.drawImage(im, sx, sy, sw, sh, (sx - px) * sc, (sy - py) * sc, sw * sc, sh * sc); g.restore(); };
        const legTop = cut - 0.05 * ih, shiftX = w1 * 0.03 * wid;
        piece(0, legTop, split + 2, ih - legTop, 0.42 * iw, cut, 0.075 * w1, shiftX * 0.5, -Math.max(0, w1) * 0.035 * hgt);          // left leg
        piece(split - 2, legTop, iw - split + 2, ih - legTop, 0.6 * iw, cut, 0.075 * w2, shiftX * 0.5, -Math.max(0, w2) * 0.035 * hgt);   // right leg, opposite step
        const tr = 0.055 * Math.sin(b / 2 + 0.6), tdx = shiftX + w1 * 0.01 * wid, tdy = -hip - pulse * 0.012 * hgt;
        piece(0, neck - 0.05 * ih, iw, cut + 0.012 * ih - (neck - 0.05 * ih), 0.5 * iw, cut, tr, tdx, tdy);                                // torso
        const hr = 0.05 * Math.sin(b) + 0.05 * Math.sin(b / 2 + 1.2);
        const hy = (cut - ih) * sc; g.save(); g.translate(tdx, hy + tdy); g.rotate(tr); g.translate(0, -hy);                                  // head rides on the torso
        piece(0, 0, iw, neck + 0.015 * ih, 0.5 * iw, neck, hr, 0, 0);
        g.restore(); g.restore();
      }
    }
    propsFront(g, gy) {                             // in front of the slab: bricks on a pallet, traffic cones
      const { ppu } = this, P = TowerProps;
      this.drawCrew(g, gy, this._t || 0);
      this.sprite(g, P.pallet(ppu), 3.0, gy + 0.1 * ppu); const c = P.cone(ppu); this.sprite(g, c, -2.85, gy + 0.14 * ppu); this.sprite(g, c, 2.4, gy + 0.14 * ppu);
    }
    drawTractor(g, wx, gy) {
      const u = this.ppu, x = this.X(wx), bob = Math.sin(this.tw * 3.1) * 0.012 * u;
      g.save(); g.translate(x, gy + 0.05 * u + bob);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(0, 0.02 * u, 1.9 * u, 0.1 * u, 0, 0, 6.283); g.fill();
      const rr = (X, Y, W, H, R) => { g.beginPath(); g.roundRect ? g.roundRect(X, Y, W, H, R) : g.rect(X, Y, W, H); };
      // tracks
      g.fillStyle = '#23272d'; rr(-1.45 * u, -0.62 * u, 2.9 * u, 0.62 * u, 0.31 * u); g.fill();
      g.strokeStyle = '#3a4048'; g.lineWidth = 2; g.setLineDash([6, 5]); g.lineDashOffset = -this.tw * u * 0.9; g.beginPath(); g.moveTo(-1.2 * u, -0.6 * u); g.lineTo(1.2 * u, -0.6 * u); g.moveTo(-1.2 * u, -0.02 * u); g.lineTo(1.2 * u, -0.02 * u); g.stroke(); g.setLineDash([]);
      for (const wxp of [-1.0, -0.35, 0.3, 0.95]) { g.fillStyle = '#5a626c'; g.beginPath(); g.arc(wxp * u, -0.31 * u, 0.2 * u, 0, 6.283); g.fill(); g.fillStyle = '#2b3037'; g.beginPath(); g.arc(wxp * u, -0.31 * u, 0.08 * u, 0, 6.283); g.fill(); }
      // body: yellow engine hood and cab
      let gr = g.createLinearGradient(0, -1.5 * u, 0, -0.55 * u); gr.addColorStop(0, '#ffd23a'); gr.addColorStop(1, '#e0a000'); g.fillStyle = gr;
      rr(-1.2 * u, -1.0 * u, 2.5 * u, 0.5 * u, 0.06 * u); g.fill();
      rr(0.2 * u, -1.28 * u, 1.05 * u, 0.4 * u, 0.06 * u); g.fill();                 // hood
      rr(-1.0 * u, -1.75 * u, 1.15 * u, 0.85 * u, 0.08 * u); g.fill();               // cab
      g.fillStyle = '#7fc4ee'; rr(-0.88 * u, -1.64 * u, 0.9 * u, 0.55 * u, 0.05 * u); g.fill(); g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.moveTo(-0.8 * u, -1.6 * u); g.lineTo(-0.45 * u, -1.6 * u); g.lineTo(-0.7 * u, -1.1 * u); g.lineTo(-0.88 * u, -1.1 * u); g.fill();
      g.fillStyle = '#2b3037'; rr(-1.1 * u, -1.82 * u, 1.35 * u, 0.1 * u, 0.04 * u); g.fill();                          // cab roof
      g.fillStyle = '#3a3f46'; rr(0.82 * u, -1.62 * u, 0.1 * u, 0.36 * u, 0.03 * u); g.fill();                         // exhaust
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.2; rr(-1.2 * u, -1.0 * u, 2.5 * u, 0.5 * u, 0.06 * u); g.stroke();
      g.fillStyle = '#ffee9a'; g.beginPath(); g.arc(1.24 * u, -1.08 * u, 0.06 * u, 0, 6.283); g.fill();
      // blade
      const bg = g.createLinearGradient(1.5 * u, 0, 1.9 * u, 0); bg.addColorStop(0, '#9aa4ae'); bg.addColorStop(1, '#5b6570'); g.fillStyle = bg;
      g.beginPath(); g.moveTo(1.48 * u, -1.22 * u); g.lineTo(1.9 * u, -1.1 * u); g.lineTo(1.98 * u, -0.1 * u); g.lineTo(1.5 * u, -0.05 * u); g.closePath(); g.fill();
      g.strokeStyle = '#444c55'; g.lineWidth = 3; g.beginPath(); g.moveTo(1.25 * u, -0.75 * u); g.lineTo(1.55 * u, -0.7 * u); g.stroke();
      g.restore();
    }
    drawHook(g) {
      const { ppu } = this, px = this.X(0), py = this.Y(this.pivotY()), L = this.lrope, th = this.th, sx = Math.sin(th), cs = Math.cos(th);
      if (L <= LROPE_HIDE + 0.05) return;
      const hx = px + L * ppu * sx, hy = py + L * ppu * cs;
      g.save(); g.lineCap = 'round';
      g.strokeStyle = '#2a323c'; g.lineWidth = 4; g.beginPath(); g.moveTo(px, py - 60); g.lineTo(px, py); g.lineTo(hx, hy); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px - 1, py); g.lineTo(hx - 1, hy); g.stroke();
      g.save(); g.translate(hx, hy); g.rotate(-th); const hg = g.createLinearGradient(-9, 0, 9, 0); hg.addColorStop(0, '#f7c33a'); hg.addColorStop(1, '#d58a10'); g.fillStyle = hg; g.beginPath(); g.rect(-9, 0, 18, 20); g.fill(); g.fillStyle = '#1f2630'; g.fillRect(-9, 7, 18, 3); g.strokeStyle = '#59646f'; g.lineWidth = 3; g.beginPath(); g.arc(0, 26, 6.5, -1.1, 2.6); g.stroke(); g.restore();
      if (this.hang) {
        const roofX = px + (L + SLING) * ppu * sx, roofY = py + (L + SLING) * ppu * cs, ex = Math.cos(th), ey = -Math.sin(th), half = HW * ppu * 0.44, ax = hx + 30 * sx, ay = hy + 30 * cs;
        g.strokeStyle = 'rgba(30,38,48,.9)'; g.lineWidth = 1.6; for (const o of [-1, 0, 1]) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(roofX + o * half * ex, roofY + o * half * ey); g.stroke(); }
        const d = L + SLING + HH / 2; g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 10; g.shadowOffsetY = 5; this.drawHouse(g, this.hang.v, d * sx, this.pivotY() - d * cs, th);
      }
      g.restore();
    }
  }
  window.TowerGame = TowerGame;
})();
