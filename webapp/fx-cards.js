// Animated lobby card scenes (canvas): Mines, Rocket, Tower. Everything is drawn inside the card bounds.
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 2.5);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const E = {
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    back: (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mixa = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
  const rgb = (a) => `rgb(${a.map(Math.round).join(',')})`;
  const SRC = (n) => (window.CARD_IMG && window.CARD_IMG[n]) || (n === 'rocket.svg' && (window.ROCKET_SRC || 'rocket.svg')) || 'img/' + n;
  const load = (n) => { const i = new Image(); i.src = SRC(n); return i; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const rand = (a, b) => a + Math.random() * (b - a);

  class Scene {
    constructor(canvas) { this.c = canvas; this.g = canvas.getContext('2d'); this.w = 0; this.h = 0; this.resize(); }
    resize() {
      const r = this.c.getBoundingClientRect(); this.w = r.width; this.h = r.height;
      this.c.width = Math.max(1, Math.round(r.width * DPR)); this.c.height = Math.max(1, Math.round(r.height * DPR));
      this.g.setTransform(DPR, 0, 0, DPR, 0, 0); this.layout?.();
    }
    frame(now) {
      const dt = Math.min(0.05, (now - (this.last || now)) / 1000); this.last = now;
      this.g.clearRect(0, 0, this.w, this.h); this.g.imageSmoothingQuality = 'high';
      this.draw(this.g, now / 1000, dt);
    }
  }

  // ======================================================================= MINES
  // loop: tap -> gem, tap -> gem, tap -> tile glows blue -> explodes -> red X lies on the scorched tile
  class MinesScene extends Scene {
    constructor(c) {
      super(c);
      this.T = 8.2; this.parts = []; this.prevTt = 0;
      this.taps = [{ t: 0.7, i: 5, kind: 'gem' }, { t: 2.2, i: 2, kind: 'gem' }, { t: 3.7, i: 10, kind: 'mine' }];
      this.boom = 4.75;
    }
    layout() {
      const cols = 4, rows = 3, gap = 6, pad = 14;
      this.s = Math.min((this.w - pad * 2 - gap * (cols - 1)) / cols, 36);
      this.gap = gap; this.cols = cols; this.rows = rows;
      this.x0 = (this.w - (cols * this.s + gap * (cols - 1))) / 2; this.y0 = 16;
    }
    pos(i) { const c = i % this.cols, r = Math.floor(i / this.cols); return [this.x0 + c * (this.s + this.gap), this.y0 + r * (this.s + this.gap)]; }
    tile(g, x, y, s, o) {
      const r = s * 0.24, cx = x + s / 2 + (o.dx || 0), cy = y + s / 2 + (o.dy || 0) + (o.press || 0) * 2;
      const glow = o.glow || 0, burnt = o.burnt || 0;
      const top = rgb(mixa(mixa(hex('#6ea8ff'), hex('#37e6ff'), glow), hex('#2a2f45'), burnt)), bot = rgb(mixa(mixa(hex('#2f5db5'), hex('#0a8fd0'), glow), hex('#12151f'), burnt));
      g.save(); g.globalAlpha = o.alpha ?? 1; g.translate(cx, cy); const sc = 1 - (o.press || 0) * 0.08 + glow * 0.04; g.scale(sc, sc);
      if (glow > 0.02) { g.shadowColor = `rgba(60,225,255,${0.9 * glow})`; g.shadowBlur = 22 * glow; } else { g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 8; g.shadowOffsetY = 3 - (o.press || 0) * 2; }
      const gr = g.createLinearGradient(0, -s / 2, 0, s / 2); gr.addColorStop(0, top); gr.addColorStop(1, bot);
      rr(g, -s / 2, -s / 2, s, s, r); g.fillStyle = gr; g.fill(); g.shadowColor = 'transparent'; g.shadowBlur = 0;
      rr(g, -s / 2 + 1, -s / 2 + 1, s - 2, s - 2, r - 1); g.strokeStyle = `rgba(255,255,255,${0.38 - burnt * 0.25})`; g.lineWidth = 1; g.stroke();
      const gl = g.createLinearGradient(0, -s / 2, 0, 0); gl.addColorStop(0, `rgba(255,255,255,${0.34 - burnt * 0.25})`); gl.addColorStop(1, 'rgba(255,255,255,0)');
      rr(g, -s / 2 + 2, -s / 2 + 2, s - 4, s / 2 - 2, r - 2); g.fillStyle = gl; g.fill();
      if (burnt > 0) { const cr = g.createRadialGradient(0, 0, 1, 0, 0, s * 0.62); cr.addColorStop(0, `rgba(0,0,0,${0.65 * burnt})`); cr.addColorStop(1, 'rgba(0,0,0,0)'); rr(g, -s / 2, -s / 2, s, s, r); g.fillStyle = cr; g.fill(); }
      if (o.shimmer) { g.save(); rr(g, -s / 2, -s / 2, s, s, r); g.clip(); const sh = g.createLinearGradient(-s, -s, s, s); const p = o.shimmer; sh.addColorStop(clamp(p - 0.12), 'rgba(255,255,255,0)'); sh.addColorStop(clamp(p), 'rgba(255,255,255,.35)'); sh.addColorStop(clamp(p + 0.12), 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(-s, -s, s * 2, s * 2); g.restore(); }
      if (o.gem > 0) this.gem(g, s, o.gem);
      if (o.x > 0) this.cross(g, s, o.x);
      g.restore();
    }
    gem(g, s, p) {
      const k = s * 0.5 * E.back(clamp(p)), a = clamp(p * 2);
      g.save(); g.globalAlpha *= a; g.shadowColor = '#4fe6ff'; g.shadowBlur = 12; g.translate(0, -k * 0.04);
      const crown = g.createLinearGradient(0, -k * 0.5, 0, 0); crown.addColorStop(0, '#d9fbff'); crown.addColorStop(1, '#5fdcff');
      const pav = g.createLinearGradient(0, -k * 0.1, 0, k * 0.55); pav.addColorStop(0, '#31bdf5'); pav.addColorStop(1, '#0b6fc0');
      g.beginPath(); g.moveTo(-k * 0.5, -k * 0.12); g.lineTo(-k * 0.3, -k * 0.5); g.lineTo(k * 0.3, -k * 0.5); g.lineTo(k * 0.5, -k * 0.12); g.closePath(); g.fillStyle = crown; g.fill();
      g.beginPath(); g.moveTo(-k * 0.5, -k * 0.12); g.lineTo(k * 0.5, -k * 0.12); g.lineTo(0, k * 0.62); g.closePath(); g.fillStyle = pav; g.fill();
      g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(-k * 0.5, -k * 0.12); g.lineTo(-k * 0.12, -k * 0.5); g.moveTo(-k * 0.12, -k * 0.12); g.lineTo(0, k * 0.62); g.moveTo(k * 0.12, -k * 0.5); g.lineTo(k * 0.12, -k * 0.12); g.moveTo(-k * 0.3, -k * 0.5); g.lineTo(-k * 0.12, -k * 0.12); g.stroke();
      const sp = Math.sin(clamp((p - 0.4) * 2.2) * Math.PI); if (sp > 0.01) { g.fillStyle = `rgba(255,255,255,${sp})`; g.beginPath(); const R = s * 0.28 * sp; g.moveTo(k * 0.25, -k * 0.5 - R); g.lineTo(k * 0.25 + R * 0.2, -k * 0.5 - R * 0.2); g.lineTo(k * 0.25 + R, -k * 0.5); g.lineTo(k * 0.25 + R * 0.2, -k * 0.5 + R * 0.2); g.lineTo(k * 0.25, -k * 0.5 + R); g.lineTo(k * 0.25 - R * 0.2, -k * 0.5 + R * 0.2); g.lineTo(k * 0.25 - R, -k * 0.5); g.lineTo(k * 0.25 - R * 0.2, -k * 0.5 - R * 0.2); g.fill(); }
      g.restore();
    }
    cross(g, s, p) {
      const k = s * 0.3 * E.back(clamp(p));
      g.save(); g.globalAlpha *= clamp(p * 3); g.scale(1, 0.86); g.lineCap = 'round'; g.lineWidth = s * 0.16;
      g.shadowColor = '#ff2b4a'; g.shadowBlur = 14; const gr = g.createLinearGradient(-k, -k, k, k); gr.addColorStop(0, '#ff7a86'); gr.addColorStop(1, '#ff1f3d'); g.strokeStyle = gr;
      g.beginPath(); g.moveTo(-k, -k); g.lineTo(k, k); g.moveTo(k, -k); g.lineTo(-k, k); g.stroke(); g.restore();
    }
    spawn(mx, my) {
      this.parts = [];
      for (let i = 0; i < 38; i++) { const a = rand(0, 6.283), sp = rand(30, 170); this.parts.push({ k: 'fire', x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: rand(0.45, 0.95), max: 0.95, size: rand(2.5, 6) }); }
      for (let i = 0; i < 20; i++) { const a = rand(0, 6.283), sp = rand(90, 260); this.parts.push({ k: 'spark', x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.7), max: 0.7 }); }
      for (let i = 0; i < 8; i++) this.parts.push({ k: 'smoke', x: mx + rand(-8, 8), y: my + rand(-6, 6), vx: rand(-14, 14), vy: rand(-26, -8), life: rand(1.1, 1.6), max: 1.6, size: rand(8, 14) });
    }
    draw(g, now, dt) {
      const tt = now % this.T;
      if (tt < this.prevTt) this.parts = [];
      const [mx0, my0] = this.pos(this.taps[2].i), mx = mx0 + this.s / 2, my = my0 + this.s / 2;
      if (this.prevTt < this.boom && tt >= this.boom) this.spawn(mx, my);
      this.prevTt = tt;
      const fade = 1 - clamp((tt - 7.2) / 0.8), tb = tt - this.boom;
      // bluish floor glow
      const fl = g.createRadialGradient(this.w / 2, this.y0 + 50, 4, this.w / 2, this.y0 + 50, this.w * 0.75); fl.addColorStop(0, 'rgba(50,220,255,.20)'); fl.addColorStop(1, 'rgba(50,220,255,0)'); g.fillStyle = fl; g.fillRect(0, 0, this.w, this.h);
      for (let i = 0; i < this.cols * this.rows; i++) {
        const [x, y] = this.pos(i); const o = { shimmer: ((now * 0.5 + i * 0.07) % 3) < 1 ? (now * 0.5 + i * 0.07) % 3 : 0 };
        for (const tap of this.taps) {
          if (tap.i !== i) continue;
          const u = tt - tap.t;
          if (u > 0 && u < 0.2) o.press = Math.sin((u / 0.2) * Math.PI);
          if (tap.kind === 'gem') { o.gem = clamp((u - 0.1) / 0.5) * fade; if (u > 0.1) o.glow = 0.35 * (1 - clamp((u - 0.1) / 1.0)) * fade; }
          else {
            const gu = tt - (tap.t + 0.2);
            if (gu > 0 && tb < 0) { const ramp = clamp(gu / 0.3); o.glow = ramp * (0.65 + 0.35 * Math.sin(gu * 17)); o.press = 0.35; }
            if (tb >= 0) { o.burnt = clamp(tb / 0.4) * fade; o.x = clamp((tb - 0.35) / 0.45) * fade; o.glow = Math.max(0, 1 - tb * 4) * 0.5; }
          }
          // tap ripple
          if (u > 0 && u < 0.6) { const rp = u / 0.6; g.save(); g.strokeStyle = `rgba(255,255,255,${0.7 * (1 - rp)})`; g.lineWidth = 2; g.beginPath(); g.arc(x + this.s / 2, y + this.s / 2, this.s * (0.3 + rp * 0.9), 0, 6.283); g.stroke(); g.restore(); }
        }
        if (tb > 0 && i !== this.taps[2].i) { // neighbours get shoved away from the blast and darken a little
          const dx = x + this.s / 2 - mx, dy = y + this.s / 2 - my, d = Math.hypot(dx, dy) || 1, k = Math.exp(-tb * 5) * Math.sin(tb * 20) * 5 * Math.max(0, 1 - d / 120);
          o.dx = (dx / d) * k; o.dy = (dy / d) * k;
        }
        if (fade < 1) o.alpha = 0.4 + 0.6 * fade;
        this.tile(g, x, y, this.s, o);
      }
      // blue pre-blast halo
      const gu = tt - (this.taps[2].t + 0.2);
      if (gu > 0 && tb < 0) for (let k = 0; k < 2; k++) { const p = ((gu * 1.6 + k * 0.5) % 1); g.strokeStyle = `rgba(80,230,255,${0.7 * (1 - p)})`; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, this.s * (0.6 + p * 1.1), 0, 6.283); g.stroke(); }
      // explosion
      if (tb >= 0 && tb < 1.8) {
        const f = clamp(tb / 0.3); if (f < 1) { const R = 62 * E.out(f), gr = g.createRadialGradient(mx, my, 0, mx, my, R); gr.addColorStop(0, `rgba(255,250,220,${1 - f})`); gr.addColorStop(0.4, `rgba(255,170,60,${0.9 * (1 - f)})`); gr.addColorStop(1, 'rgba(255,80,20,0)'); g.fillStyle = gr; g.beginPath(); g.arc(mx, my, R, 0, 6.283); g.fill(); }
        const sw = clamp(tb / 0.6); if (sw < 1) { g.strokeStyle = `rgba(255,220,160,${0.85 * (1 - sw)})`; g.lineWidth = 5 * (1 - sw) + 1; g.beginPath(); g.arc(mx, my, 70 * E.out(sw), 0, 6.283); g.stroke(); }
      }
      for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.k === 'fire') p.vy += 60 * dt; if (p.k === 'smoke') p.size += dt * 9; }
      this.parts = this.parts.filter((p) => p.life > 0);
      for (const p of this.parts) {
        const a = clamp(p.life / p.max);
        if (p.k === 'smoke') { g.globalCompositeOperation = 'source-over'; const sg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size); sg.addColorStop(0, `rgba(70,76,92,${0.32 * a})`); sg.addColorStop(1, 'rgba(70,76,92,0)'); g.fillStyle = sg; g.beginPath(); g.arc(p.x, p.y, p.size, 0, 6.283); g.fill(); continue; }
        g.globalCompositeOperation = 'lighter';
        if (p.k === 'fire') { const sg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (0.6 + a)); sg.addColorStop(0, `rgba(255,${Math.round(120 + 110 * a)},50,${a})`); sg.addColorStop(1, 'rgba(255,60,20,0)'); g.fillStyle = sg; g.beginPath(); g.arc(p.x, p.y, p.size * (0.6 + a), 0, 6.283); g.fill(); }
        else { g.strokeStyle = `rgba(255,235,170,${a})`; g.lineWidth = 1.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); g.stroke(); }
        g.globalCompositeOperation = 'source-over';
      }
    }
  }

  // ======================================================================= ROCKET
  // the rocket climbs an exponential chart curve while the multiplier counts up to x25, then warps out and restarts
  class RocketCardScene extends Scene {
    constructor(c, label) {
      super(c); this.label = label; this.img = load('rocket.svg'); this.parts = []; this.T = 7; this.climb = 4.8;
      this.stars = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random() * 0.7, p: Math.random() * 6 }));
    }
    layout() { this.px0 = 16; this.pw = this.w - 32; this.base = this.h - 72; this.top = 46; this.ph = this.base - this.top; }
    pt(p) { const k = 3.2, f = (Math.exp(k * p) - 1) / (Math.exp(k) - 1); return [this.px0 + this.pw * p, this.base - this.ph * f, 1 + 24 * f]; }
    draw(g, now, dt) {
      const tt = now % this.T, p = clamp(tt / this.climb), [hx, hy, m] = this.pt(p);
      for (const s of this.stars) { g.fillStyle = `rgba(255,255,255,${0.25 + 0.5 * Math.abs(Math.sin(now * 1.3 + s.p))})`; g.fillRect(s.x * this.w, s.y * this.h, 1.3, 1.3); }
      // grid
      g.strokeStyle = 'rgba(160,200,255,.12)'; g.lineWidth = 1; for (let i = 0; i < 4; i++) { const y = this.top + (this.ph * i) / 3; g.beginPath(); g.moveTo(this.px0, y); g.lineTo(this.w - this.px0, y); g.stroke(); }
      const out = tt > this.climb ? clamp((tt - this.climb - 0.9) / 0.9) : 0, alpha = 1 - out;
      g.save(); g.globalAlpha = alpha;
      // area + curve
      g.beginPath(); g.moveTo(this.px0, this.base); const N = 40; for (let i = 0; i <= N; i++) { const [x, y] = this.pt((p * i) / N); g.lineTo(x, y); } g.lineTo(hx, this.base); g.closePath();
      const ar = g.createLinearGradient(0, this.top, 0, this.base); ar.addColorStop(0, 'rgba(90,170,255,.45)'); ar.addColorStop(1, 'rgba(90,170,255,0)'); g.fillStyle = ar; g.fill();
      g.beginPath(); for (let i = 0; i <= N; i++) { const [x, y] = this.pt((p * i) / N); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.lineWidth = 3; g.lineJoin = 'round'; g.lineCap = 'round'; const ln = g.createLinearGradient(this.px0, 0, hx || 1, 0); ln.addColorStop(0, 'rgba(90,200,255,.3)'); ln.addColorStop(1, '#e8f6ff'); g.strokeStyle = ln; g.shadowColor = '#4cc2ff'; g.shadowBlur = 12; g.stroke(); g.shadowBlur = 0;
      // rocket
      const [x2, y2] = this.pt(Math.min(1, p + 0.01)), dx = x2 - hx, dy = y2 - hy, ang = Math.atan2(dx, -dy) || 0.6;
      const rh = 46, rw = 23, wob = Math.sin(now * 9) * 0.03;
      if (tt < this.climb + 0.35) {
        const tail = [hx - Math.sin(ang) * rh * 0.5, hy + Math.cos(ang) * rh * 0.5];
        for (let i = 0; i < 3; i++) { const sp = rand(40, 90); this.parts.push({ x: tail[0] + rand(-2, 2), y: tail[1] + rand(-2, 2), vx: -Math.sin(ang) * sp + rand(-12, 12), vy: Math.cos(ang) * sp + rand(-12, 12), life: rand(0.25, 0.5), max: 0.5, size: rand(2, 4.5) }); }
      }
      for (const q of this.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; }
      this.parts = this.parts.filter((q) => q.life > 0);
      g.globalCompositeOperation = 'lighter';
      for (const q of this.parts) { const a = clamp(q.life / q.max), sg = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.size * 1.6); sg.addColorStop(0, `rgba(255,${Math.round(150 + 90 * a)},70,${a})`); sg.addColorStop(1, 'rgba(255,80,20,0)'); g.fillStyle = sg; g.beginPath(); g.arc(q.x, q.y, q.size * 1.6, 0, 6.283); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      const warp = tt > this.climb ? clamp((tt - this.climb) / 0.35) : 0;
      if (this.img.complete && this.img.naturalWidth && warp < 1) {
        g.save(); g.translate(hx, hy); g.rotate(ang + wob); const sc = 1 - E.in(warp) * 0.9; g.scale(sc, sc); g.globalAlpha *= 1 - warp * 0.6;
        g.shadowColor = 'rgba(120,200,255,.6)'; g.shadowBlur = 10; g.drawImage(this.img, -rw / 2, -rh / 2, rw, rh); g.restore();
      }
      // head dot
      if (warp < 1) { g.fillStyle = '#fff'; g.shadowColor = '#7fd4ff'; g.shadowBlur = 10; g.beginPath(); g.arc(hx, hy, 2.4, 0, 6.283); g.fill(); g.shadowBlur = 0; }
      g.restore();
      // warp flash at the end
      if (tt > this.climb && tt < this.climb + 0.7) { const f = (tt - this.climb) / 0.7; g.strokeStyle = `rgba(190,230,255,${1 - f})`; g.lineWidth = 3 * (1 - f) + 1; g.beginPath(); g.arc(hx, hy, 6 + 36 * E.out(f), 0, 6.283); g.stroke(); const gr = g.createRadialGradient(hx, hy, 0, hx, hy, 30 * (1 - f)); gr.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - f)})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(hx, hy, 30, 0, 6.283); g.fill(); }
      if (this.label) {
        const shown = tt < this.climb ? m : 25;
        this.label.textContent = 'x' + shown.toFixed(2);
        this.label.className = 'xval' + (shown < 2 ? '' : shown < 5 ? ' t2' : shown < 12 ? ' t3' : ' t4') + (tt > this.climb && tt < this.climb + 1 ? ' pop' : '') + (out > 0 ? ' dim' : '');
      }
    }
  }

  // ======================================================================= TOWER
  // trolley brings a house on a hook, it swings over the tower, drops, the hook climbs out, a new house comes down; the tower sways
  class TowerScene extends Scene {
    constructor(c) {
      super(c);
      this.house = load('house.webp'); this.hook = load('hook.webp');
      this.colors = ['#ffd166', '#b69cff', '#6fe3a0', '#ff8a8a', '#7fd0ff'];
      this.tinted = {}; this.reset(); this.max = 4;
    }
    reset() { this.floors = []; this.phase = 'descend'; this.u = 0; this.ci = 0; this.wob = 0; this.wv = 0; this.fade = 1; this.puffs = []; this.fall = null; this.hookL = null; this.trolleyX = null; }
    layout() {
      this.hw = Math.min(54, this.h * 0.36); this.s = this.hw / 337; this.hh = 317 * this.s;
      this.inc = this.hw * 0.46; this.cx = this.w - this.hw * 1.1; this.baseY = this.h - 14; this.x0 = Math.max(this.w * 0.55, this.cx - this.hw * 2.3);
      this.tinted = {};
    }
    tint(i) {
      if (this.tinted[i]) return this.tinted[i];
      const sc = DPR, w = Math.round(337 * this.s * sc), h = Math.round(317 * this.s * sc), c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
      x.drawImage(this.house, 0, 0, w, h); x.globalCompositeOperation = 'multiply'; x.fillStyle = this.colors[i % this.colors.length]; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'screen'; x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(this.house, 0, 0, w, h);
      return (this.tinted[i] = c);
    }
    landingY(n) { return this.baseY - n * this.inc; }
    hoverBottom(n) { return Math.max(this.landingY(n) - 40, this.hh + 6); }
    drawHouse(g, i, ax, ay, scale = 1) { const c = this.tint(i); g.drawImage(c, ax - 183 * this.s * scale, ay - 315 * this.s * scale, c.width / DPR * scale, c.height / DPR * scale); }
    draw(g, now, dt) {
      if (!this.house.complete || !this.house.naturalWidth || !this.hook.complete) return;
      const n = this.floors.length, s = this.s;
      this.u += dt;
      if (this.trolleyX === null) this.trolleyX = this.x0;
      const ropeGap = 22 * 1, hookH = this.hook.height * s * 1.9, hookW = this.hook.width * s * 1.9;
      const Lhide = -(this.hh + ropeGap + hookH + 20);
      const Lhover = this.hoverBottom(n) - this.hh - ropeGap;
      let L = this.hookL ?? Lhide, th = 0, hasHouse = true;
      // ---- state machine
      if (this.phase === 'descend') {
        const k = E.out(clamp(this.u / 0.9)); L = lerp(Lhide, Lhover, k); this.trolleyX = this.x0; th = 0.16 * Math.sin(this.u * 6) * (1 - k * 0.3);
        if (this.u >= 0.9) { this.phase = 'move'; this.u = 0; }
      } else if (this.phase === 'move') {
        const D = 1.5, k = clamp(this.u / D), e = E.io(k), prev = E.io(clamp((this.u - dt) / D)), vx = (e - prev) / dt * (this.cx - this.x0);
        this.trolleyX = lerp(this.x0, this.cx, e); L = Lhover - Math.sin(k * Math.PI) * 4;
        th = -vx * 0.0045 + 0.07 * Math.sin(this.u * 7) * (1 - k);
        if (this.u >= D) { this.phase = 'fall'; this.u = 0; const bx = this.trolleyX + Math.sin(th) * (L + ropeGap), by = L + ropeGap + this.hh; this.fall = { x: bx, y: Lhover + this.hh + ropeGap + this.hh * 0 + 0, vy: 0, rot: th * 0.6, vr: th * 1.4, ci: this.ci }; this.fall.y = this.hoverBottom(n); this.hookStart = L; }
      } else if (this.phase === 'fall') {
        const f = this.fall;
        if (f) {
          f.vy += 1100 * dt; f.y += f.vy * dt; f.x = lerp(f.x, this.cx, clamp(dt * 9)); f.rot += f.vr * dt; f.vr *= 0.96;
          if (f.y >= this.landingY(n)) {
            this.floors.push({ ci: f.ci }); this.fall = null; this.wv += 38 + n * 10 + f.vy * 0.04;
            for (let i = 0; i < 9; i++) this.puffs.push({ x: this.cx + rand(-this.hw * 0.4, this.hw * 0.4), y: this.landingY(n) + 2, vx: rand(-26, 26), vy: rand(-18, -4), life: rand(0.35, 0.7), max: 0.7, size: rand(3, 6) });
          }
        }
        const k = clamp(this.u / 0.75); L = lerp(this.hookStart, Lhide, E.in(k)); hasHouse = false; th = 0.05 * Math.sin(this.u * 9) * (1 - k);
        if (this.u >= 0.75 && !this.fall) { this.phase = this.floors.length >= this.max ? 'hold' : 'descend'; this.u = 0; this.ci++; this.hookL = null; this.trolleyX = this.x0; }
      } else if (this.phase === 'hold') {
        L = Lhide; hasHouse = false;
        if (this.u > 1.5) { this.fade = 1 - clamp((this.u - 1.5) / 0.6); if (this.u > 2.1) this.reset(); }
      }
      if (this.phase === 'fall') this.hookL = L;
      // ---- tower spring wobble
      const acc = -90 * this.wob - 5.5 * this.wv; this.wv += acc * dt; this.wob += this.wv * dt;
      // ---- draw: ground, tower, assembly
      g.save(); g.globalAlpha = this.fade;
      const sh = g.createRadialGradient(this.cx, this.baseY + 4, 2, this.cx, this.baseY + 4, this.hw * 0.8); sh.addColorStop(0, 'rgba(0,0,0,.4)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.save(); g.translate(this.cx, this.baseY + 4); g.scale(1, 0.25); g.translate(-this.cx, -(this.baseY + 4)); g.beginPath(); g.arc(this.cx, this.baseY + 4, this.hw * 0.8, 0, 6.283); g.fill(); g.restore();
      const squash = clamp(Math.abs(this.wv) / 160) * 0.025;
      this.floors.forEach((fl, i) => {
        const h = (i + 1) / this.max, ox = this.wob * 0.12 * (0.4 + i * 0.9) + Math.sin(now * 1.1 + i * 0.9) * 0.45 * i * 0.6 * h;
        g.save(); g.translate(this.cx + ox, this.landingY(i)); g.scale(1 + squash, 1 - squash * (i + 1) * 0.5); g.translate(-this.cx - ox, -this.landingY(i)); this.drawHouse(g, fl.ci, this.cx + ox, this.landingY(i)); g.restore();
      });
      for (const p of this.puffs) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      this.puffs = this.puffs.filter((p) => p.life > 0);
      for (const p of this.puffs) { const a = clamp(p.life / p.max); g.fillStyle = `rgba(255,240,215,${0.55 * a})`; g.beginPath(); g.arc(p.x, p.y, p.size * (1.4 - a * 0.5), 0, 6.283); g.fill(); }
      if (this.fall) { const f = this.fall; g.save(); g.translate(f.x, f.y - this.hh * 0.5); g.rotate(f.rot); g.translate(-f.x, -(f.y - this.hh * 0.5)); this.drawHouse(g, f.ci, f.x, f.y); g.restore(); }
      // hook assembly (pendulum around the trolley)
      if (this.phase !== 'hold' || L > Lhide + 1) {
        g.save(); g.translate(this.trolleyX, -4); g.rotate(th);
        g.strokeStyle = '#56627e'; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -80); g.lineTo(0, L); g.stroke();
        g.drawImage(this.hook, -hookW * 0.46, L - hookH * 0.9, hookW, hookH);
        if (hasHouse) {
          const yh = L + ropeGap, ax = -163 * s, ay = yh - 1 * s;
          g.strokeStyle = 'rgba(190,200,220,.9)'; g.lineWidth = 1.1;
          for (const [px, py] of [[0, 1], [37 - 163, 63], [309 - 163, 65], [193 - 163, 137]]) { g.beginPath(); g.moveTo(0, L); g.lineTo(px * s, yh + py * s); g.stroke(); }
          g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 8; g.shadowOffsetY = 4;
          const c = this.tint(this.ci); g.drawImage(c, ax, yh - 0.5, c.width / DPR, c.height / DPR);
        }
        g.restore();
      }
      g.restore();
    }
  }

  // ======================================================================= boot
  const scenes = [];
  function init() {
    const m = document.getElementById('cv-mines'), r = document.getElementById('cv-rocket'), t = document.getElementById('cv-tower');
    if (m) scenes.push(new MinesScene(m));
    if (r) scenes.push(new RocketCardScene(r, document.getElementById('x-rocket')));
    if (t) scenes.push(new TowerScene(t));
    new ResizeObserver(() => scenes.forEach((s) => s.resize())).observe(document.body);
  }
  function loop(now) {
    requestAnimationFrame(loop);
    const lobby = document.getElementById('view-play');
    if (!lobby || !lobby.classList.contains('on') || document.hidden) { scenes.forEach((s) => (s.last = 0)); return; }
    for (const s of scenes) { if (!s.w || !s.h) s.resize(); if (s.w && s.h) s.frame(now); }
  }
  init();
  requestAnimationFrame(loop);
  window.__cards = scenes;
})();
