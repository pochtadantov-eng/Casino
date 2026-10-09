// Tower game scene: flat front view (2D canvas), like the reference video. Rendering only.
// The swing is a function of SERVER time (view.swing); a tap releases the house at once, and the server's verdict
// (computed from the same formula) is only reconciled afterwards. Nothing here decides who wins.
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const rand = (a, b) => a + Math.random() * (b - a);

  const HW = 1.9, HH = 1.55, INC = 1.5, SLAB_H = 0.55, SLAB_W = 5.4;       // house width/height, floor step, foundation slab (world units)
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
      this.cityA = []; this.cityB = [];
      for (let x = -14, i = 0; x < 16; i++) { const w = rand(1.1, 2.2), h = rand(1.5, 4.8); this.cityA.push({ x, w, h, seed: i }); x += w + rand(-0.15, 0.2); }
      for (let x = -14, i = 0; x < 16; i++) { const w = rand(1.4, 2.8), h = rand(1.0, 3.2); this.cityB.push({ x, w, h, seed: i }); x += w + rand(-0.2, 0.3); }
      this.clouds = Array.from({ length: 7 }, () => ({ x: rand(-6, 6), fy: rand(0.04, 0.7), s: rand(1.1, 2.4), v: rand(0.05, 0.16), z: rand(0.2, 0.7) }));
      this.birds = [{ x: -8, y: 7.2, v: 0.9, t: 0 }];
    }
    reset() {
      this.state = 'idle'; this.u = 0; this.floors = []; this.base = 0; this.landed = 0; this.targetSucc = 0; this.queue = []; this.failQueued = false; this.pendingVerdicts = 0;
      this.wob = 0; this.wv = 0; this.shake = 0; this.puffs = []; this.pops = []; this.fall = null; this.tumble = null; this.rest = null; this.intro = null; this.hang = null; this.popFor = 0;
      this.th = 0; this.thv = 0; this.lrope = LROPE_HIDE; this.roundStatus = 'idle'; this.maxSteps = 10; this.mults = []; this.camBottom = -0.7; this.camSet = false;
    }
    resize() { const r = this.c.getBoundingClientRect(); this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); this.c.width = Math.round(this.w * DPR); this.c.height = Math.round(this.h * DPR); this.g.setTransform(DPR, 0, 0, DPR, 0, 0); this.hv = Math.max(8.4, 6.9 / (this.w / this.h)); this.ppu = this.h / this.hv; }

    // ---------------------------------------------------------------- state from the round
    now() { return Date.now() + this.clockOffset; }
    swingAt(t) { const w = this.swing; if (!w || t < w.start) return { x: 0, v: 0 }; const k = (2 * Math.PI) / w.period, ph = k * (t - w.start); return { x: w.amp * Math.sin(ph), v: w.amp * k * 1000 * Math.cos(ph) }; }
    sync(round) {
      if (!round) { if (this.roundId !== null) { this.reset(); this.roundId = null; } this._setReady(false); return; }
      const v = round.view, succ = v.picks; this.swing = v.swing; this.clockOffset = v.serverNow - Date.now();
      if (round.id !== this.roundId) {
        this.reset(); this.roundId = round.id;
        const fresh = round.status === 'active' && succ === 0, total = succ + (fresh ? 0 : 1);
        for (let i = 0; i < total; i++) this.floors.push({ v: this.ci++, ox: 0, tilt: 0, sq: 0 });
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
    camTarget() { return Math.max(-0.7, this.landTop() - 0.26 * this.hv); }
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
      this.fall = { v: this.hang.v, x, y, vy: 0, vx, rot: this.th, ok: item.ok, side, ox, tilt, y0: y }; this.hang = null; this.state = 'drop'; this.u = 0; this.thv *= 0.3;
    }

    // ---------------------------------------------------------------- loop
    _loop(now) {
      if (!this.c.isConnected) { this._ro.disconnect(); return; }
      requestAnimationFrame(this._loop);
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      if (!this.w) return; this.update(dt); this.draw(this.g, now / 1000);
    }
    puff(x, y, n = 10, spread = 0.9) { for (let i = 0; i < n; i++) { const s = i % 2 ? 1 : -1; this.puffs.push({ x: x + s * spread * rand(0.7, 1.1), y: y + rand(0, 0.12), vx: s * rand(0.5, 1.9), vy: rand(0.05, 0.5), r: rand(0.22, 0.45), life: rand(0.5, 0.95), max: 0.95 }); } }
    support(x, top) { const a = Math.abs(x); return a < HW / 2 + 0.25 ? top : a < SLAB_W / 2 ? SLAB_H : 0; }
    update(dt) {
      const tS = this.now(), sw0 = this.swing ? this.swing.start : tS, top = this.landTop();
      this.u += dt; this.wv += (-60 * this.wob - 5.5 * this.wv) * dt; this.wob += this.wv * dt;
      for (const f of this.floors) if (f.sq) { f.sq *= Math.exp(-9 * dt); if (f.sq < 0.002) f.sq = 0; }
      let hasHouse = false;
      switch (this.state) {
        case 'intro': {
          const f = this.intro; f.vy -= 22 * dt; f.y += f.vy * dt; f.rot += f.vr * dt * Math.min(1, (f.y - HH / 2 - top) / 5); f.x = lerp(f.x, 0, clamp(dt * 2));
          if (f.y - HH / 2 <= top) { this.floors.push({ v: f.v, ox: 0, tilt: 0.01, sq: 0.1 }); this.base = 1; this.intro = null; this.wv += 3.4; this.shake = 0.7; this.puff(0, top + 0.1, 14, 1.1); this.state = 'land'; this.u = 0; }
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
      const ct = this.camTarget(); this.camBottom = this.camSet ? this.camBottom + (ct - this.camBottom) * Math.min(1, dt * 2.4) : ct; this.camSet = true;
      this.shake = Math.max(0, this.shake - dt * 2.2);
      for (const p of this.puffs) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 0.5; } this.puffs = this.puffs.filter((p) => p.life > 0);
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
            const impact = -f.vy; this.floors.push({ v: f.v, ox: f.ox, tilt: f.tilt, sq: clamp(impact / 130, 0.03, 0.09) }); this.landed++; this.fall = null; this.wv += 1.3 + impact * 0.08;
            this.puff(f.ox, top + 0.1, 12, 1.0); this.state = 'land'; this.u = 0; this.shake = 0.25;
            const m = this.mults[this.landed - 1]; if (m != null && this.popFor !== this.landed) { this.popFor = this.landed; this.pops.push({ txt: 'x' + m.toFixed(2), x: -0.2, y0: top + INC + 0.5, life: 1.5, max: 1.5 }); }
          } else { this.tumble = { x: f.x, y: f.y, vx: f.side * 1.4 + f.vx * 0.3, vy: 2.4, rot: f.rot, vr: -f.side * 2.6, side: f.side, hit: 0, v: f.v }; this.fall = null; this.wv += f.side * 2.6; this.puff(f.x, top + 0.1, 8, 0.8); this.state = 'tumble'; }
        }
      }
      const q = this.tumble;
      if (q) {
        q.vy -= 26 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
        const sup = this.support(q.x, top), low = (HW / 2) * Math.abs(Math.sin(q.rot)) + (HH / 2) * Math.abs(Math.cos(q.rot));
        if (q.y - low <= sup && q.vy < 0) {
          q.y = sup + low; q.hit++; this.puff(q.x, sup + 0.1, 6, 0.6);
          if (Math.abs(q.x) < HW / 2 + 0.2 && q.hit < 6) { q.vx = q.side * Math.max(Math.abs(q.vx), 1.9); q.vy = Math.max(Math.abs(q.vy) * 0.5, 2.0); q.vr = -q.side * 2.6; }           // still on the tower: shove it over the edge
          else if (q.hit >= 3 || (q.hit >= 2 && Math.abs(q.vy) < 2.6)) { this.rest = { x: q.x, rot: -q.side * 1.5708, v: q.v }; this.tumble = null; this.state = 'done'; this.u = 0; this.shake = 0.2; this.puff(q.x, sup + 0.1, 8, 0.7); }
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
    drawHouse(g, v, wx, wyCenter, rot = 0, sq = 0) {
      const b = houseBitmap(v, this.ppu), cx = this.X(wx), cy = this.Y(wyCenter);
      g.save(); g.translate(cx, cy); g.rotate(-rot); g.scale(1 + sq * 0.5, 1 - sq); g.drawImage(b.cv, -b.w / 2, -(b.top + b.bodyH / 2), b.w, b.h); g.restore();
    }
    cloud(g, x, y, s, a) {
      g.save(); g.globalAlpha = a; const r = s * this.ppu * 0.42;
      for (const [dx, dy, k] of [[-1.5, 0.2, 0.75], [-0.6, -0.35, 1], [0.5, -0.3, 0.95], [1.4, 0.15, 0.7], [0.1, 0.15, 1.1]]) { const cx = x + dx * r * 0.7, cy = y + dy * r * 0.7, gr = g.createRadialGradient(cx, cy - r * 0.15, r * 0.1, cx, cy, r * k); gr.addColorStop(0, '#fff'); gr.addColorStop(0.7, '#f2f8ff'); gr.addColorStop(1, 'rgba(214,232,250,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r * k, 0, 6.283); g.fill(); }
      g.restore();
    }
    cityLayer(g, arr, col, win, par, haze) {
      const { ppu, w } = this, off = (this.camBottom + 0.9) * ppu * par, by = this.Y(0) - off + 0.3 * ppu; if (by - 5 * ppu > this.h) return;
      g.fillStyle = col; for (const b of arr) { const x = this.X(b.x), bw = b.w * ppu, bh = b.h * ppu; g.fillRect(x, by - bh, bw, bh + 90); }
      g.fillStyle = win; for (const b of arr) { const x = this.X(b.x), bw = b.w * ppu, bh = b.h * ppu; for (let yy = by - bh + 6; yy < by - 6; yy += 9) for (let xx = x + 5; xx < x + bw - 5; xx += 8) if (((b.seed * 7 + Math.floor(xx / 8) * 3 + Math.floor(yy / 9)) % 5) < 2) g.fillRect(xx, yy, 3, 4); }
      const hz = g.createLinearGradient(0, by - 100, 0, by + 10); hz.addColorStop(0, 'rgba(216,240,251,0)'); hz.addColorStop(1, `rgba(216,240,251,${haze})`); g.fillStyle = hz; g.fillRect(0, by - 100, w, 110);
    }
    draw(g, t) {
      const { w, h, ppu } = this, cam = this.camBottom;
      g.save(); if (this.shake > 0) g.translate((Math.random() - 0.5) * 7 * this.shake, (Math.random() - 0.5) * 7 * this.shake);
      const sk = g.createLinearGradient(0, 0, 0, h); sk.addColorStop(0, '#1f78d8'); sk.addColorStop(0.45, '#4aa6ee'); sk.addColorStop(0.8, '#9ad6f7'); sk.addColorStop(1, '#d8f0fb'); g.fillStyle = sk; g.fillRect(-10, -10, w + 20, h + 20);
      const sun = g.createRadialGradient(w * 0.8, h * 0.16, 2, w * 0.8, h * 0.16, w * 0.55); sun.addColorStop(0, 'rgba(255,248,214,.95)'); sun.addColorStop(0.18, 'rgba(255,240,180,.55)'); sun.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = sun; g.fillRect(0, 0, w, h);
      for (const c of this.clouds) { const span = h * 1.15, base = c.fy * h + (cam + 0.9) * ppu * c.z * 0.35, y = ((base % span) + span) % span - h * 0.07; this.cloud(g, this.X(c.x), y, c.s, 0.55 + c.z * 0.45); }
      for (const b of this.birds) { const x = this.X(b.x), y = this.Y(b.y) - (cam + 0.9) * ppu * 0.3, f = Math.sin(b.t * 9) * 4; g.strokeStyle = 'rgba(20,50,90,.7)'; g.lineWidth = 1.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 7, y - f); g.quadraticCurveTo(x - 3, y - 4, x, y); g.quadraticCurveTo(x + 3, y - 4, x + 7, y - f); g.stroke(); }
      this.cityLayer(g, this.cityB, '#86b7e2', 'rgba(255,255,255,.35)', 0.16, 0.55); this.cityLayer(g, this.cityA, '#6a9fd3', 'rgba(255,255,255,.28)', 0.3, 0.3);
      const gy = this.Y(0);
      if (gy < h + 4) {
        const gg = g.createLinearGradient(0, gy, 0, h); gg.addColorStop(0, '#5fbf4a'); gg.addColorStop(0.07, '#3f9a3a'); gg.addColorStop(0.1, '#9a7a56'); gg.addColorStop(1, '#6d5238'); g.fillStyle = gg; g.fillRect(0, gy, w, h - gy + 4);
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, gy, w, 2); g.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 18; i++) { g.beginPath(); g.ellipse(((i * 97) % 211) / 211 * w, gy + 0.45 * ppu + ((i * 53) % 37) / 37 * 0.9 * ppu, 5 + (i % 4) * 2, 2.5, 0, 0, 6.283); g.fill(); }
        this.props(g, gy);
      }
      const sy = this.Y(SLAB_H), sw = SLAB_W * ppu;
      if (sy < h + 40) {
        const x = this.X(-SLAB_W / 2), gr = g.createLinearGradient(0, sy, 0, gy); gr.addColorStop(0, '#d7dee6'); gr.addColorStop(1, '#8e9aa7'); g.fillStyle = gr; g.fillRect(x, sy, sw, gy - sy);
        g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(x, sy, sw, 2.5); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, sy + (gy - sy) * 0.55, sw, 1.5);
        const bandH = (gy - sy) * 0.3, by = sy + (gy - sy) * 0.18; g.save(); g.beginPath(); g.rect(x, by, sw, bandH); g.clip(); for (let i = -2, ix = x; ix < x + sw + 40; i++, ix += 22) { g.fillStyle = i % 2 ? '#2b333c' : '#f6b50b'; g.beginPath(); g.moveTo(ix, by + bandH); g.lineTo(ix + 11, by + bandH); g.lineTo(ix + 22, by); g.lineTo(ix + 11, by); g.fill(); } g.restore();
        g.fillStyle = '#6f7c89'; for (const bx of [x + 8, x + sw - 8]) { g.beginPath(); g.arc(bx, by + bandH + (gy - sy) * 0.18, 2.6, 0, 6.283); g.fill(); }
      }
      const n = this.floors.length;
      this.floors.forEach((f, i) => { const k = n > 1 ? i / (n - 1) : 1, kf = 0.1 + 0.9 * k, wy = SLAB_H + i * INC + HH / 2; if (this.Y(wy) < -HH * ppu) return; this.drawHouse(g, f.v, f.ox + this.wob * 0.2 * kf, wy, f.tilt - this.wob * 0.02 * kf, f.sq); });
      if (this.intro) this.drawHouse(g, this.intro.v, this.intro.x, this.intro.y, this.intro.rot);
      if (this.fall) this.drawHouse(g, this.fall.v, this.fall.x, this.fall.y, this.fall.rot);
      if (this.tumble) this.drawHouse(g, this.tumble.v, this.tumble.x, this.tumble.y, this.tumble.rot);
      if (this.rest) { const q = this.rest, sup = this.support(q.x, this.landTop()), low = (HW / 2) * Math.abs(Math.sin(q.rot)) + (HH / 2) * Math.abs(Math.cos(q.rot)); g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(this.X(q.x), this.Y(sup) + 2, HW * ppu * 0.55, 5, 0, 0, 6.283); g.fill(); this.drawHouse(g, q.v, q.x, sup + low, q.rot); }
      // the allowed release window on the roof of the tower while the swing is live
      if (this.swing && ['arrive', 'sway'].includes(this.state) && this.roundStatus === 'active') {
        const tol = this.swing.tol, x1 = this.X(-tol), x2 = this.X(tol), y = this.Y(this.landTop()), live = this.state === 'sway', pulse = 0.5 + 0.5 * Math.sin(t * 5);
        g.save(); g.fillStyle = `rgba(80,255,150,${live ? 0.3 + 0.2 * pulse : 0.12})`; g.fillRect(x1, y - 5, x2 - x1, 5); g.strokeStyle = `rgba(190,255,215,${live ? 0.95 : 0.4})`; g.lineWidth = 1.5; g.setLineDash([4, 3]); g.lineDashOffset = -t * 12; g.strokeRect(x1, y - 5, x2 - x1, 5); g.restore();
      }
      this.drawHook(g);
      for (const p of this.puffs) { const a = clamp(p.life / p.max), x = this.X(p.x), y = this.Y(p.y), r = p.r * ppu, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${0.95 * a})`); gr.addColorStop(0.6, `rgba(250,250,250,${0.7 * a})`); gr.addColorStop(1, 'rgba(240,240,240,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); }
      for (const p of this.pops) { const k = 1 - p.life / p.max, y = this.Y(p.y0 + 1.6 * (1 - Math.pow(1 - k, 2))), x = this.X(p.x), sc = 1 + 0.4 * Math.sin(clamp(k * 4) * Math.PI); g.save(); g.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3; g.translate(x, y); g.scale(sc, sc); g.font = "800 28px 'Unbounded',system-ui,sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 7; g.strokeStyle = 'rgba(110,55,0,.95)'; g.strokeText(p.txt, 0, 0); const tg = g.createLinearGradient(0, -14, 0, 14); tg.addColorStop(0, '#fff2a0'); tg.addColorStop(0.5, '#ffc533'); tg.addColorStop(1, '#ff9a14'); g.fillStyle = tg; g.fillText(p.txt, 0, 0); g.restore(); }
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75); vg.addColorStop(0, 'rgba(0,30,70,0)'); vg.addColorStop(1, 'rgba(0,30,70,.22)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
      g.restore();
    }
    props(g, gy) {
      const { ppu } = this, X = (x) => this.X(x);
      const tree = (x, s) => { const px = X(x); g.fillStyle = '#6b4a2b'; g.fillRect(px - 4 * s, gy - 38 * s, 8 * s, 40 * s); for (const [dx, dy, r, c] of [[0, -58, 26, '#2f9a3d'], [-15, -44, 19, '#3aae48'], [15, -46, 20, '#38a844'], [2, -72, 18, '#4cc05a']]) { const gr = g.createRadialGradient(px + dx * s - r * s * 0.3, gy + dy * s - r * s * 0.3, 1, px + dx * s, gy + dy * s, r * s); gr.addColorStop(0, '#8fe07a'); gr.addColorStop(1, c); g.fillStyle = gr; g.beginPath(); g.arc(px + dx * s, gy + dy * s, r * s, 0, 6.283); g.fill(); } };
      tree(-4.1, ppu / 36 * 1.15); tree(4.6, ppu / 36 * 0.9);
      const bush = (x, s) => { const px = X(x); for (const [dx, r] of [[-10, 11], [0, 14], [11, 10]]) { const gr = g.createRadialGradient(px + dx * s - 3, gy - 10 * s, 1, px + dx * s, gy - 6 * s, r * s); gr.addColorStop(0, '#7edb6a'); gr.addColorStop(1, '#2f8f3a'); g.fillStyle = gr; g.beginPath(); g.arc(px + dx * s, gy - 6 * s, r * s, 0, 6.283); g.fill(); } };
      bush(-3.2, ppu / 36); bush(3.4, ppu / 36 * 1.1);
      const lp = X(-2.9), k = ppu / 36; g.fillStyle = '#4b5662'; g.fillRect(lp - 2 * k, gy - 120 * k, 4 * k, 124 * k); g.fillRect(lp - 2 * k, gy - 120 * k, 22 * k, 4 * k); g.fillStyle = '#ffe58a'; g.beginPath(); g.ellipse(lp + 20 * k, gy - 114 * k, 8 * k, 5 * k, 0, 0, 6.283); g.fill();
      for (const x of [-SLAB_W / 2 - 0.35, SLAB_W / 2 + 0.35]) { const px = X(x); g.fillStyle = '#ff6a2b'; g.beginPath(); g.moveTo(px - 9 * k, gy + 2); g.lineTo(px + 9 * k, gy + 2); g.lineTo(px + 3 * k, gy - 26 * k); g.lineTo(px - 3 * k, gy - 26 * k); g.fill(); g.fillStyle = '#fff'; g.fillRect(px - 6 * k, gy - 14 * k, 12 * k, 4 * k); g.fillStyle = '#333'; g.fillRect(px - 11 * k, gy + 1, 22 * k, 4 * k); }
      const bx = X(3.6); g.fillStyle = '#b4572f'; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) g.fillRect(bx + (c * 13 - 26) * k, gy - (10 + r * 9) * k, 12 * k, 8 * k); g.fillStyle = '#8a6a44'; g.fillRect(bx - 28 * k, gy - 1, 56 * k, 4 * k);
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
