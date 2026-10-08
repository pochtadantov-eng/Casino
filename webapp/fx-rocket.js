// Canvas scene for the Rocket game: parallax stars, vector rocket, flame/trail particles, crash explosion, win fly-off.
class RocketScene {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.mode = 'idle'; // idle | flying | crashed | won
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.stars = Array.from({ length: 80 }, () => ({ x: Math.random(), y: Math.random(), z: 0.25 + Math.random() * 0.75 }));
    this.parts = []; this.trail = [];
    this.m = 1; this.shake = 0; this.flash = 0; this.flashColor = '255,255,255';
    this.rx = 0.5; this.ry = 0.74; this.gone = false; this.hue = 232;
    this.last = performance.now();
    this.resize();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas);
  }
  resize() {
    const r = this.c.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.c.width = this.w * d; this.c.height = this.h * d;
    this.g.setTransform(d, 0, 0, d, 0, 0);
  }
  _reset() { this.parts = []; this.trail = []; this.gone = false; this.ry = 0.74; this.rx = 0.5; this.shake = 0; this.flash = 0; }
  idle() { if (this.mode !== 'idle') this._reset(); this.mode = 'idle'; this.m = 1; this.onTick = null; }
  fly(startedAt, offset, growth, onTick) {
    if (this.mode !== 'flying') { this._reset(); this.polled = false; }
    this.mode = 'flying'; this.startedAt = startedAt; this.offset = offset; this.growth = growth; this.onTick = onTick;
  }
  finish(status) {
    const was = this.mode;
    this.onTick = null;
    if (was === 'flying') {
      if (status === 'lost') this._explode(); else this._win();
    } else if (was === 'idle') { this.gone = true; this.mode = status === 'lost' ? 'crashed' : 'won'; }
  }
  _explode() {
    this.mode = 'crashed'; this.gone = true; this.flash = 1; this.flashColor = '255,90,60'; this.shake = this.reduced ? 0 : 1;
    const x = this.rx * this.w, y = this.ry * this.h;
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 260;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.9, max: 1.5, size: 2 + Math.random() * 5, rgb: i % 3 ? '255,170,40' : '255,70,50', add: true });
    }
    for (let i = 0; i < 14; i++) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 80, life: 1.8, max: 1.8, size: 10 + Math.random() * 18, rgb: '90,90,110', add: false });
  }
  _win() { this.mode = 'won'; this.flash = 0.6; this.flashColor = '34,197,94'; this.vy = 0; }
  _emit(x, y, n, power) {
    for (let i = 0; i < n; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 6, y, vx: (Math.random() - 0.5) * 30, vy: 90 + Math.random() * 90 * power, life: 0.35 + Math.random() * 0.3, max: 0.65, size: 3 + Math.random() * 5 * power, rgb: Math.random() < 0.5 ? '255,190,60' : '255,110,40', add: true });
  }
  _loop(now) {
    if (!this.c.isConnected) { this._ro.disconnect(); return; }
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const { g, w, h } = this;

    if (this.mode === 'flying') {
      this.m = Math.max(1, Math.floor(Math.exp(this.growth * Math.max(0, Date.now() + this.offset - this.startedAt)) * 100) / 100);
      this.onTick?.(this.m);
    }
    const lm = Math.log(this.m);
    const speed = this.mode === 'flying' ? 0.6 + lm * 1.8 : this.mode === 'won' ? 3 : this.mode === 'crashed' ? 0.15 : 0.35;
    const targetHue = this.mode === 'crashed' ? 350 : 232 + Math.min(70, lm * 38);
    this.hue += (targetHue - this.hue) * Math.min(1, dt * 2);

    // sky
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, `hsl(${this.hue},55%,9%)`); sky.addColorStop(1, `hsl(${this.hue + 25},60%,${16 + Math.min(12, lm * 5)}%)`);
    g.save();
    if (this.shake > 0) { g.translate((Math.random() - 0.5) * 14 * this.shake, (Math.random() - 0.5) * 14 * this.shake); this.shake = Math.max(0, this.shake - dt * 2.2); }
    g.fillStyle = sky; g.fillRect(-20, -20, w + 40, h + 40);

    // stars (streak when fast)
    g.strokeStyle = '#fff'; g.lineCap = 'round';
    for (const s of this.stars) {
      s.y += speed * s.z * dt * 0.35; if (s.y > 1.05) { s.y = -0.05; s.x = Math.random(); }
      g.globalAlpha = 0.35 + s.z * 0.65; g.lineWidth = 0.6 + s.z * 1.4;
      const len = Math.min(26, speed * s.z * 3);
      g.beginPath(); g.moveTo(s.x * w, s.y * h); g.lineTo(s.x * w, s.y * h - len); g.stroke();
      if (len < 1) g.fillRect(s.x * w, s.y * h, 1.2, 1.2);
    }
    g.globalAlpha = 1;

    // rocket motion
    const t = now / 1000;
    if (this.mode === 'flying' || this.mode === 'idle') {
      const ty = this.mode === 'flying' ? 0.74 - Math.min(0.42, lm * 0.2) : 0.74 + Math.sin(t * 2) * 0.01;
      this.ry += (ty - this.ry) * Math.min(1, dt * 3);
      this.rx = 0.5 + (this.mode === 'flying' ? Math.sin(t * 3.1) * 0.025 * Math.min(1, lm + 0.3) : 0);
    } else if (this.mode === 'won' && !this.gone) {
      this.vy -= dt * 1.6; this.ry += this.vy * dt * 2.2;
      if (this.ry < -0.25) this.gone = true;
    }
    const rx = this.rx * w, ry = this.ry * h, s = Math.min(w, h) * 0.085;

    // trail
    if (this.mode === 'flying' && !this.gone) { this.trail.push({ x: rx, y: ry + s * 0.9, a: 1 }); if (this.trail.length > 60) this.trail.shift(); }
    g.lineCap = 'round';
    for (let i = 1; i < this.trail.length; i++) {
      const p = this.trail[i], q = this.trail[i - 1];
      p.a -= dt * 0.9; p.y += speed * dt * 40;
      if (p.a <= 0) continue;
      g.strokeStyle = `rgba(255,170,70,${p.a * 0.35})`; g.lineWidth = 2 + p.a * 7;
      g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(p.x, p.y); g.stroke();
    }
    this.trail = this.trail.filter((p) => p.a > 0);

    // flame emission
    if (!this.gone && this.mode !== 'crashed') this._emit(rx, ry + s * 0.85, this.mode === 'idle' ? 1 : 3, this.mode === 'idle' ? 0.5 : 1 + Math.min(1.5, lm * 0.6));

    // particles
    for (const p of this.parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.add) p.size += dt * 14;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.max);
      g.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      g.fillStyle = `rgba(${p.rgb},${p.add ? a : a * 0.35})`;
      g.beginPath(); g.arc(p.x, p.y, p.size * (p.add ? a * 0.8 + 0.2 : 1), 0, 6.283); g.fill();
    }
    g.globalCompositeOperation = 'source-over';

    // rocket body
    if (!this.gone) {
      g.save(); g.translate(rx, ry); g.rotate(this.mode === 'flying' ? Math.cos(t * 3.1) * 0.05 : 0);
      if (this.mode === 'won') { g.shadowColor = '#22c55e'; g.shadowBlur = 24; }
      g.fillStyle = '#ef4444'; // fins
      g.beginPath(); g.moveTo(-s * 0.45, s * 0.25); g.lineTo(-s * 1.0, s * 1.0); g.lineTo(-s * 0.3, s * 0.72); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(s * 0.45, s * 0.25); g.lineTo(s * 1.0, s * 1.0); g.lineTo(s * 0.3, s * 0.72); g.closePath(); g.fill();
      const body = g.createLinearGradient(-s * 0.6, 0, s * 0.6, 0);
      body.addColorStop(0, '#cbd5e1'); body.addColorStop(0.5, '#fff'); body.addColorStop(1, '#94a3b8');
      g.fillStyle = body;
      g.beginPath(); g.moveTo(0, -s * 1.25);
      g.bezierCurveTo(s * 0.78, -s * 0.55, s * 0.62, s * 0.55, s * 0.36, s * 0.85);
      g.lineTo(-s * 0.36, s * 0.85);
      g.bezierCurveTo(-s * 0.62, s * 0.55, -s * 0.78, -s * 0.55, 0, -s * 1.25); g.fill();
      g.fillStyle = '#ef4444'; g.beginPath(); g.moveTo(0, -s * 1.25); g.bezierCurveTo(s * 0.34, -s * 0.95, s * 0.5, -s * 0.72, s * 0.52, -s * 0.62); g.lineTo(-s * 0.52, -s * 0.62); g.bezierCurveTo(-s * 0.5, -s * 0.72, -s * 0.34, -s * 0.95, 0, -s * 1.25); g.fill();
      g.fillStyle = '#0ea5e9'; g.strokeStyle = '#334155'; g.lineWidth = s * 0.09;
      g.beginPath(); g.arc(0, -s * 0.1, s * 0.24, 0, 6.283); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(-s * 0.08, -s * 0.18, s * 0.07, 0, 6.283); g.fill();
      g.restore();
    }
    g.restore();

    // flash overlay
    if (this.flash > 0) { g.fillStyle = `rgba(${this.flashColor},${this.flash * 0.5})`; g.fillRect(0, 0, w, h); this.flash = Math.max(0, this.flash - dt * 2.5); }
  }
}
window.RocketScene = RocketScene;
