// Canvas scene for the Rocket game: parallax stars, vector rocket, flame/trail particles, crash explosion, win fly-off.
class RocketScene {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.mode = 'idle'; // idle | flying | crashed | won
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.stars = Array.from({ length: 80 }, () => ({ x: Math.random(), y: Math.random(), z: 0.25 + Math.random() * 0.75 }));
    this.neb = Array.from({ length: 7 }, (_, i) => ({ x: Math.random(), y: Math.random(), r: 0.25 + Math.random() * 0.35, z: 0.25 + Math.random() * 0.4, k: i % 3 }));
    this.img = new Image();
    this.img.src = window.ROCKET_SRC || 'rocket.svg';
    this.parts = []; this.trail = [];
    this.m = 1; this.shake = 0; this.flash = 0; this.flashColor = '255,255,255';
    this.pad = 0.64; this.rx = 0.5; this.ry = this.pad; this.gone = false; this.hue = 232;      // pad: where the rocket stands on the ground
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
  _reset() { this.after = 0; this.parts = []; this.trail = []; this.gone = false; this.ry = this.pad; this.rx = 0.5; this.shake = 0; this.flash = 0; }
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
    }
  }
  _explode() {
    this.after = 0; this.mode = 'crashed'; this.gone = true; this.flash = 1; this.flashColor = '255,90,60'; this.shake = this.reduced ? 0 : 1;
    const x = this.rx * this.w, y = this.ry * this.h;
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 260;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.9, max: 1.5, size: 2 + Math.random() * 5, rgb: i % 3 ? '255,170,40' : '255,70,50', add: true });
    }
    for (let i = 0; i < 14; i++) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 80, life: 1.8, max: 1.8, size: 10 + Math.random() * 18, rgb: '90,90,110', add: false });
  }
  _comeBack() { this.mode = 'return'; this.rt = 0; this.after = 0; this.gone = false; this.ry = 1.3; this.rx = 0.5; this.trail = []; this.parts = []; this.m = 1; }
  _win() { this.after = 0; this.mode = 'won'; this.flash = 0.6; this.flashColor = '34,197,94'; this.vy = 0; }
  _emit(x, y, n, power, ww) {
    for (let i = 0; i < n; i++) {
      const hot = Math.random() < 0.6;
      this.parts.push(hot
        ? { x: x + (Math.random() - 0.5) * ww * 0.25, y, vx: (Math.random() - 0.5) * 50, vy: 140 + Math.random() * 160 * power, life: 0.3 + Math.random() * 0.35, max: 0.65, size: 1.5 + Math.random() * 2.5 * power, rgb: Math.random() < 0.5 ? '255,210,100' : '255,130,50', add: true }
        : { x: x + (Math.random() - 0.5) * ww * 0.3, y: y + ww * 0.3, vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 90, life: 0.7 + Math.random() * 0.5, max: 1.2, size: 5 + Math.random() * 6, rgb: '120,110,110', add: false });
    }
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
    const target = this.mode === 'flying' ? 1.6 + lm * 2.4 : this.mode === 'won' && !this.gone ? 5 : this.mode === 'crashed' ? 0.2 : this.mode === 'return' ? 1.6 : 1.0;
    this.sp = (this.sp ?? 1) + (target - (this.sp ?? 1)) * Math.min(1, dt * 4);   // eased, so the sky never jumps between tempos
    const speed = this.sp;
    const targetHue = this.mode === 'crashed' ? 350 : 232 + Math.min(70, lm * 38);
    this.hue += (targetHue - this.hue) * Math.min(1, dt * 2);

    // sky
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, `hsl(${this.hue},55%,9%)`); sky.addColorStop(1, `hsl(${this.hue + 25},60%,${16 + Math.min(12, lm * 5)}%)`);
    g.save();
    if (this.shake > 0) { g.translate((Math.random() - 0.5) * 14 * this.shake, (Math.random() - 0.5) * 14 * this.shake); this.shake = Math.max(0, this.shake - dt * 2.2); }
    g.fillStyle = sky; g.fillRect(-20, -20, w + 40, h + 40);

    // soft nebula clouds drifting down (slower than the stars: depth)
    const NEB = ['255,120,60', '110,90,255', '60,170,255'];
    g.globalCompositeOperation = 'lighter';
    for (const n of this.neb) {
      n.y += speed * n.z * dt * 0.22; if (n.y - n.r > 1.1) { n.y = -n.r; n.x = Math.random(); }
      const cx = n.x * w, cy = n.y * h, r = n.r * w, grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(${NEB[n.k]},0.16)`); grad.addColorStop(1, `rgba(${NEB[n.k]},0)`);
      g.fillStyle = grad; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = 'source-over';

    // stars (streak when fast)
    g.strokeStyle = '#fff'; g.lineCap = 'round';
    for (const s of this.stars) {
      s.y += speed * s.z * dt * 0.5; if (s.y > 1.05) { s.y = -0.05; s.x = Math.random(); }
      g.globalAlpha = 0.35 + s.z * 0.65; g.lineWidth = 0.6 + s.z * 1.4;
      const len = Math.min(34, speed * s.z * 4);
      g.beginPath(); g.moveTo(s.x * w, s.y * h); g.lineTo(s.x * w, s.y * h - len); g.stroke();
      if (len < 1) g.fillRect(s.x * w, s.y * h, 1.2, 1.2);
    }
    g.globalAlpha = 1;

    // rocket motion
    const t = now / 1000;
    const gy = h * 0.905 + Math.max(0, this.pad - this.ry) * h * 2.6;                         // the ground sinks away as the rocket climbs
    if (gy < h + 4 && !(this.mode === 'return' && this.rt < 0.9) && !(this.mode === 'crashed' && this.after > 1.2)) {
      const gg = g.createLinearGradient(0, gy, 0, h); gg.addColorStop(0, '#26304c'); gg.addColorStop(1, '#0d1222'); g.fillStyle = gg; g.fillRect(-20, gy, w + 40, h - gy + 40);
      g.fillStyle = 'rgba(120,150,255,.25)'; g.fillRect(-20, gy, w + 40, 2);
      const pw = h * 0.5 * 0.5 * 2.6; g.fillStyle = '#39456a'; g.fillRect(w / 2 - pw / 2, gy, pw, 7); g.fillStyle = '#1b2440'; g.fillRect(w / 2 - pw / 2 + 4, gy + 7, pw - 8, 4);
      for (let i = 0; i < 7; i++) { g.fillStyle = (Math.floor(t * 2) + i) % 2 ? 'rgba(255,200,60,.95)' : 'rgba(255,90,60,.9)'; g.beginPath(); g.arc(w / 2 - pw / 2 + 8 + (pw - 16) * i / 6, gy + 3.5, 1.7, 0, 6.283); g.fill(); }
      g.strokeStyle = 'rgba(70,86,130,.9)'; g.lineWidth = 2; for (const sx of [-1, 1]) { const bx = w / 2 + sx * pw * 0.62; g.beginPath(); g.moveTo(bx, gy); g.lineTo(bx, gy - h * 0.34); g.moveTo(bx, gy - h * 0.34); g.lineTo(bx - sx * pw * 0.22, gy - h * 0.34); g.stroke(); for (let j = 1; j < 6; j++) { g.beginPath(); g.moveTo(bx, gy - h * 0.34 * j / 6); g.lineTo(bx + sx * 5, gy - h * 0.34 * (j - 0.5) / 6); g.stroke(); } }      // gantry towers
    }
    if (this.mode === 'flying' || this.mode === 'idle') {
      const ty = this.mode === 'flying' ? 0.5 - Math.min(0.2, lm * 0.12) : this.pad + Math.sin(t * 2) * 0.003;
      this.ry += (ty - this.ry) * Math.min(1, dt * (this.mode === 'flying' ? 1.6 : 3));      // lifts off the ground gently
      this.rx = 0.5 + (this.mode === 'flying' ? Math.sin(t * 3.1) * 0.025 * Math.min(1, lm + 0.3) : 0);
    } else if (this.mode === 'won' && !this.gone) {
      this.vy -= dt * 1.6; this.ry += this.vy * dt * 2.2;
      if (this.ry < -0.25) this.gone = true;
    } else if (this.mode === 'return') {
      this.rt += dt; const k = 1 - Math.pow(1 - Math.min(1, this.rt / 1.25), 3);   // ease-out: arrives smoothly at the launch pad
      this.ry = 1.3 + (this.pad - 1.3) * k; this.rx = 0.5;
      if (this.rt >= 1.25) { this.mode = 'idle'; this.ry = this.pad; }
    }
    if ((this.mode === 'won' && this.gone) || this.mode === 'crashed') {
      this.after = (this.after || 0) + dt;
      if (this.after > (this.mode === 'won' ? 0.3 : 1.5)) this._comeBack();
    }
    const hh = h * 0.5, ww = hh * 0.5;                    // rocket size (SVG is 200x400)
    const rx = this.rx * w, ry = this.ry * h, noseY = ry - hh * 0.45, tailY = ry + hh * 0.53;
    const power = this.gone || this.mode === 'crashed' ? 0 : this.mode === 'idle' ? 0.35 : this.mode === 'return' ? 1.5 : this.mode === 'won' ? 2.2 : 1 + Math.min(1.2, lm * 0.5);

    // trail
    if (this.mode === 'flying' && !this.gone) { this.trail.push({ x: rx, y: tailY, a: 1 }); if (this.trail.length > 60) this.trail.shift(); }
    g.lineCap = 'round';
    for (let i = 1; i < this.trail.length; i++) {
      const p = this.trail[i], q = this.trail[i - 1];
      p.a -= dt * 0.9; p.y += speed * dt * 60;
      if (p.a <= 0) continue;
      g.strokeStyle = `rgba(255,170,70,${p.a * 0.3})`; g.lineWidth = 3 + p.a * ww * 0.5;
      g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(p.x, p.y); g.stroke();
    }
    this.trail = this.trail.filter((p) => p.a > 0);

    // exhaust particles: hot sparks + smoke, spawned across the nozzles
    if (power > 0) for (const dx of [-0.21, 0, 0.21]) this._emit(rx + dx * ww, tailY - hh * 0.04, Math.ceil(power * 1.5), power, ww);

    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.add) p.size += dt * 16; }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.max);
      if (p.add) { // sparks: short streaks along their velocity
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = `rgba(${p.rgb},${a})`; g.lineWidth = Math.max(0.8, p.size * 0.45 * a); g.lineCap = 'round';
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); g.stroke();
      } else { // smoke: soft puffs
        g.globalCompositeOperation = 'source-over';
        const sg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        sg.addColorStop(0, `rgba(${p.rgb},${a * 0.22})`); sg.addColorStop(1, `rgba(${p.rgb},0)`);
        g.fillStyle = sg; g.beginPath(); g.arc(p.x, p.y, p.size, 0, 6.283); g.fill();
      }
    }
    g.globalCompositeOperation = 'source-over';

    // animated flame: two booster plumes + the main engine plume, each with three flickering layers
    if (power > 0) {
      g.globalCompositeOperation = 'lighter';
      const flick = 0.82 + 0.12 * Math.sin(t * 47) + 0.06 * Math.sin(t * 91 + 1.3);
      const plume = (x, half, lenK, phase) => {
        for (const [wk, lk, col] of [[1.1, 1.0, '255,90,20'], [0.72, 0.72, '255,170,50'], [0.4, 0.45, '255,245,200']]) {
          const len = hh * 0.55 * power * lenK * lk * (flick + 0.05 * Math.sin(t * 61 + phase));
          const wid = ww * half * wk, top = tailY - hh * 0.04, sway = Math.sin(t * 13 + phase + lk * 4) * ww * 0.025;
          const grad = g.createLinearGradient(0, top, 0, tailY + len);
          grad.addColorStop(0, `rgba(${col},0)`); grad.addColorStop(0.1, `rgba(${col},0.95)`); grad.addColorStop(0.55, `rgba(${col},0.4)`); grad.addColorStop(1, `rgba(${col},0)`);
          g.fillStyle = grad;
          g.beginPath(); g.moveTo(x - wid * 0.6, top);
          g.bezierCurveTo(x - wid * 1.15, tailY + len * 0.2, x - wid * 0.45 + sway, tailY + len * 0.7, x + sway * 2, tailY + len);
          g.bezierCurveTo(x + wid * 0.45 + sway, tailY + len * 0.7, x + wid * 1.15, tailY + len * 0.2, x + wid * 0.6, top);
          g.closePath(); g.fill();
        }
      };
      plume(rx - ww * 0.21, 0.15, 0.85, 0); plume(rx + ww * 0.21, 0.15, 0.85, 2); plume(rx, 0.19, 1.1, 4);
      const R = ww * 1.4 * Math.min(power, 1.6), glow = g.createRadialGradient(rx, tailY, 0, rx, tailY, R);
      glow.addColorStop(0, `rgba(255,170,60,${0.4 * flick})`); glow.addColorStop(1, 'rgba(255,100,20,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(rx, tailY, R, 0, 6.283); g.fill(); // circle, so no visible square edge
      g.globalCompositeOperation = 'source-over';
    }

    // rocket
    if (!this.gone && this.img.complete && this.img.naturalWidth) {
      g.save(); g.translate(rx, ry); g.rotate(this.mode === 'flying' ? Math.cos(t * 3.1) * 0.04 : 0);
      if (this.mode === 'won') { g.shadowColor = '#22c55e'; g.shadowBlur = 22; }
      g.drawImage(this.img, -ww / 2, -hh * 0.45, ww, hh);
      g.restore();
    }
    g.restore();

    // flash overlay
    if (this.flash > 0) { g.fillStyle = `rgba(${this.flashColor},${this.flash * 0.5})`; g.fillRect(0, 0, w, h); this.flash = Math.max(0, this.flash - dt * 2.5); }
  }
}
window.RocketScene = RocketScene;
