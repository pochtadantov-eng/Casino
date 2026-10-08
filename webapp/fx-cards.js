// Animated lobby card scenes (canvas): Mines, Rocket, Tower. Everything is drawn inside the card bounds.
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 2.5);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const E = {
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    sm: (t) => t * t * t * (t * (t * 6 - 15) + 10),
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
      const r = s * 0.27, cx = x + s / 2 + (o.dx || 0), cy = y + s / 2 + (o.dy || 0) + (o.press || 0) * 2;
      const glow = o.glow || 0, burnt = o.burnt || 0;
      const top = rgb(mixa(mixa(hex('#39393d'), hex('#37e6ff'), glow), hex('#1c1c1f'), burnt)), bot = rgb(mixa(mixa(hex('#17171a'), hex('#0a8fd0'), glow), hex('#09090b'), burnt));
      g.save(); g.globalAlpha = o.alpha ?? 1; g.translate(cx, cy); const sc = 1 - (o.press || 0) * 0.08 + glow * 0.04; g.scale(sc, sc);
      if (glow > 0.02) { g.shadowColor = `rgba(60,225,255,${0.9 * glow})`; g.shadowBlur = 22 * glow; } else { g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 8; g.shadowOffsetY = 3 - (o.press || 0) * 2; }
      const gr = g.createLinearGradient(0, -s / 2, 0, s / 2); gr.addColorStop(0, top); gr.addColorStop(1, bot);
      rr(g, -s / 2, -s / 2, s, s, r); g.fillStyle = gr; g.fill(); g.shadowColor = 'transparent'; g.shadowBlur = 0;
      rr(g, -s / 2 + 1, -s / 2 + 1, s - 2, s - 2, r - 1); g.strokeStyle = `rgba(255,255,255,${0.26 - burnt * 0.17})`; g.lineWidth = 1; g.stroke();
      const gl = g.createLinearGradient(0, -s / 2, 0, 0); gl.addColorStop(0, `rgba(255,255,255,${0.22 - burnt * 0.16})`); gl.addColorStop(1, 'rgba(255,255,255,0)');
      rr(g, -s / 2 + 2, -s / 2 + 2, s - 4, s / 2 - 2, r - 2); g.fillStyle = gl; g.fill();
      if (burnt > 0) { const cr = g.createRadialGradient(0, 0, 1, 0, 0, s * 0.62); cr.addColorStop(0, `rgba(0,0,0,${0.65 * burnt})`); cr.addColorStop(1, 'rgba(0,0,0,0)'); rr(g, -s / 2, -s / 2, s, s, r); g.fillStyle = cr; g.fill(); }
      if (o.shimmer) { g.save(); rr(g, -s / 2, -s / 2, s, s, r); g.clip(); const sh = g.createLinearGradient(-s, -s, s, s); const p = o.shimmer; sh.addColorStop(clamp(p - 0.12), 'rgba(255,255,255,0)'); sh.addColorStop(clamp(p), 'rgba(255,255,255,.35)'); sh.addColorStop(clamp(p + 0.12), 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(-s, -s, s * 2, s * 2); g.restore(); }
      if (!(o.gem > 0) && !(o.x > 0)) this.idleStar(g, s, 1 - burnt);
      if (o.gem > 0) this.gem(g, s, o.gem);
      if (o.x > 0) this.cross(g, s, o.x);
      g.restore();
    }
    starPath(g, R, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R; i ? g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); } g.closePath(); }
    idleStar(g, s, alpha) {            // debossed grey star, like on a real "stars" tile
      const R = s * 0.3; g.save(); g.globalAlpha *= alpha; g.lineJoin = 'round'; g.lineWidth = s * 0.07;
      g.translate(0, s * 0.015); this.starPath(g, R, R * 0.48); g.strokeStyle = 'rgba(0,0,0,.55)'; g.fillStyle = 'rgba(0,0,0,.55)'; g.fill(); g.stroke();
      g.translate(0, -s * 0.03); this.starPath(g, R, R * 0.48);
      const gr = g.createLinearGradient(0, -R, 0, R); gr.addColorStop(0, '#74767d'); gr.addColorStop(1, '#46484e'); g.fillStyle = gr; g.strokeStyle = gr; g.fill(); g.stroke();
      g.restore();
    }
    gem(g, s, p) {                     // revealed safe tile: golden star pops out and sparkles
      const k = E.back(clamp(p)), R = s * 0.34 * k;
      g.save(); g.globalAlpha *= clamp(p * 2); g.lineJoin = 'round'; g.lineWidth = s * 0.07; g.shadowColor = '#ffc933'; g.shadowBlur = 14;
      this.starPath(g, R, R * 0.48); const gr = g.createLinearGradient(0, -R, 0, R); gr.addColorStop(0, '#fff3a8'); gr.addColorStop(0.55, '#ffcf3f'); gr.addColorStop(1, '#f29a00'); g.fillStyle = gr; g.strokeStyle = '#ffd84d'; g.fill(); g.stroke();
      g.shadowBlur = 0; this.starPath(g, R * 0.5, R * 0.24); g.fillStyle = 'rgba(255,255,255,.45)'; g.translate(-R * 0.1, -R * 0.12); g.fill();
      g.restore();
      const sp = Math.sin(clamp((p - 0.4) * 2.2) * Math.PI); if (sp > 0.01) { g.save(); g.fillStyle = `rgba(255,255,255,${sp})`; g.beginPath(); const Q = s * 0.26 * sp, cx = s * 0.22, cy = -s * 0.24; g.moveTo(cx, cy - Q); g.lineTo(cx + Q * 0.2, cy - Q * 0.2); g.lineTo(cx + Q, cy); g.lineTo(cx + Q * 0.2, cy + Q * 0.2); g.lineTo(cx, cy + Q); g.lineTo(cx - Q * 0.2, cy + Q * 0.2); g.lineTo(cx - Q, cy); g.lineTo(cx - Q * 0.2, cy - Q * 0.2); g.fill(); g.restore(); }
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
      const fl = g.createRadialGradient(this.w / 2, this.y0 + 50, 4, this.w / 2, this.y0 + 50, this.w * 0.75); fl.addColorStop(0, 'rgba(120,255,210,.10)'); fl.addColorStop(1, 'rgba(120,255,210,0)'); g.fillStyle = fl; g.fillRect(0, 0, this.w, this.h);
      for (let i = 0; i < this.cols * this.rows; i++) {
        const [x, y] = this.pos(i); const o = { shimmer: ((now * 0.5 + i * 0.07) % 3) < 1 ? (now * 0.5 + i * 0.07) % 3 : 0 };
        for (const tap of this.taps) {
          if (tap.i !== i) continue;
          const u = tt - tap.t;
          if (u > 0 && u < 0.2) o.press = Math.sin((u / 0.2) * Math.PI);
          if (tap.kind === 'gem') { o.gem = clamp((u - 0.1) / 0.5) * fade; }
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
  // the rocket climbs an exponential chart curve while x grows, then blows up at a random multiplier,
  // breaks into pieces that tumble down, and the loop restarts
  class RocketCardScene extends Scene {
    constructor(c, label) {
      super(c); this.label = label; this.img = load('rocket.svg'); this.parts = []; this.pieces = []; this.T = 7.6; this.climb = 4.6; this.loop = -1; this.tc = 0;
      this.stars = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random() * 0.7, p: Math.random() * 6 }));
    }
    layout() { this.px0 = 16; this.pw = this.w - 32; this.base = this.h - 72; this.top = 46; this.ph = this.base - this.top; }
    f(p) { const k = 3.2; return (Math.exp(k * p) - 1) / (Math.exp(k) - 1); }
    pt(p) { const f = this.f(p); return [this.px0 + this.pw * p, this.base - this.ph * f, 1 + 24 * f]; }
    explode(hx, hy, ang, rh, rw) {
      this.flash = 0; this.boomAt = null;
      for (let i = 0; i < 46; i++) { const a = rand(0, 6.283), sp = rand(30, 190); this.parts.push({ k: 'fire', x: hx, y: hy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 25, life: rand(0.4, 0.95), max: 0.95, size: rand(2.5, 6.5) }); }
      for (let i = 0; i < 22; i++) { const a = rand(0, 6.283), sp = rand(100, 280); this.parts.push({ k: 'spark', x: hx, y: hy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.8), max: 0.8 }); }
      for (let i = 0; i < 9; i++) this.parts.push({ k: 'smoke', x: hx + rand(-8, 8), y: hy + rand(-8, 8), vx: rand(-16, 16), vy: rand(-22, -4), life: rand(1.2, 1.9), max: 1.9, size: rand(8, 15) });
      // sprite slices (source rects of the 200x400 artwork): nose, two middle halves, two tail halves
      const cuts = [[0, 0, 200, 125], [0, 125, 100, 145], [100, 125, 100, 145], [0, 270, 100, 130], [100, 270, 100, 130]];
      const k = rh / 400, ca = Math.cos(ang), sa = Math.sin(ang);
      this.pieces = cuts.map(([sx, sy, sw, sh], i) => {
        const lx = (sx + sw / 2 - 100) * k, ly = (sy + sh / 2 - 200) * k;           // offset from ship centre, in ship space
        const wx = hx + lx * ca - ly * sa, wy = hy + lx * sa + ly * ca;                // rotated into the card
        const out = Math.atan2(wy - hy, wx - hx);
        return { sx, sy, sw, sh, k: k * 1.4, x: wx, y: wy, vx: Math.cos(out) * rand(40, 110) + rand(-20, 20), vy: Math.sin(out) * rand(30, 90) - rand(40, 90), rot: ang, vr: rand(-6, 6), trail: i };
      });
    }
    draw(g, now, dt) {
      if (this.cs === undefined || now - this.cs > this.tc + 1.45) { this.cs = now; this.loop++; this.newCycle = true; }
      const tt = now - this.cs;
      if (this.newCycle) { this.newCycle = false; const li = this.loop; this.parts = []; this.pieces = []; this.exploded = false; { let m = 0.97 / (1 - Math.random()); if (m < 1.6) m = 1.6 + Math.random() * 1.2; this.crashM = Math.round(Math.min(m, 25) * 100) / 100; } const f = (this.crashM - 1) / 24; this.pc = Math.log(1 + f * (Math.exp(3.2) - 1)) / 3.2; this.tc = this.pc * this.climb; }
      const crashed = tt >= this.tc, p = crashed ? this.pc : clamp(tt / this.climb), [hx, hy, m] = this.pt(p);
      const [x2, y2] = this.pt(Math.min(1, p + 0.01)), ang = Math.atan2(x2 - hx, -(y2 - hy)) || 0.6, rh = 46, rw = 23;
      if (crashed && !this.exploded) { this.exploded = true; this.flash = 1; this.hx = hx; this.hy = hy; this.explode(hx, hy, ang, rh, rw); }
      const since = tt - this.tc, fadeOut = crashed ? clamp((since - 0.8) / 0.55) : 0, alpha = 1 - fadeOut;

      for (const s of this.stars) { g.fillStyle = `rgba(255,255,255,${0.25 + 0.5 * Math.abs(Math.sin(now * 1.3 + s.p))})`; g.fillRect(s.x * this.w, s.y * this.h, 1.3, 1.3); }
      g.strokeStyle = 'rgba(160,200,255,.12)'; g.lineWidth = 1; for (let i = 0; i < 4; i++) { const y = this.top + (this.ph * i) / 3; g.beginPath(); g.moveTo(this.px0, y); g.lineTo(this.w - this.px0, y); g.stroke(); }

      g.save(); g.globalAlpha = alpha;
      // chart area + curve (turns red when the rocket blows up)
      const hot = crashed ? clamp(since / 0.25) : 0;
      g.beginPath(); g.moveTo(this.px0, this.base); const N = 40; for (let i = 0; i <= N; i++) { const [x, y] = this.pt((p * i) / N); g.lineTo(x, y); } g.lineTo(hx, this.base); g.closePath();
      const ar = g.createLinearGradient(0, this.top, 0, this.base); ar.addColorStop(0, hot ? 'rgba(255,90,80,.38)' : 'rgba(90,170,255,.45)'); ar.addColorStop(1, 'rgba(90,170,255,0)'); g.fillStyle = ar; g.fill();
      g.beginPath(); for (let i = 0; i <= N; i++) { const [x, y] = this.pt((p * i) / N); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.lineWidth = 3; g.lineJoin = 'round'; g.lineCap = 'round'; const ln = g.createLinearGradient(this.px0, 0, hx || 1, 0); ln.addColorStop(0, 'rgba(90,200,255,.3)'); ln.addColorStop(1, hot ? '#ff8a7a' : '#e8f6ff'); g.strokeStyle = ln; g.shadowColor = hot ? '#ff4a3a' : '#4cc2ff'; g.shadowBlur = 12; g.stroke(); g.shadowBlur = 0;
      g.restore();

      // exhaust while flying
      if (!crashed) {
        const tail = [hx - Math.sin(ang) * rh * 0.5, hy + Math.cos(ang) * rh * 0.5];
        for (let i = 0; i < 3; i++) { const sp = rand(40, 90); this.parts.push({ k: 'fire', x: tail[0] + rand(-2, 2), y: tail[1] + rand(-2, 2), vx: -Math.sin(ang) * sp + rand(-12, 12), vy: Math.cos(ang) * sp + rand(-12, 12), life: rand(0.25, 0.5), max: 0.5, size: rand(2, 4.5), tail: true }); }
      }
      // the rocket itself
      if (!crashed && this.img.complete && this.img.naturalWidth) {
        g.save(); g.translate(hx, hy); g.rotate(ang + Math.sin(now * 9) * 0.03); g.shadowColor = 'rgba(120,200,255,.6)'; g.shadowBlur = 10; g.drawImage(this.img, -rw / 2, -rh / 2, rw, rh); g.restore();
        g.fillStyle = '#fff'; g.shadowColor = '#7fd4ff'; g.shadowBlur = 10; g.beginPath(); g.arc(hx, hy, 2.4, 0, 6.283); g.fill(); g.shadowBlur = 0;
      }
      // debris: slices of the rocket fall with gravity, spin and leave fire/smoke
      if (this.pieces.length && this.img.complete) {
        g.save(); g.globalAlpha = alpha;
        for (const q of this.pieces) {
          q.vy += 250 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; q.vx *= 0.995;
          if (Math.random() < 0.5 && q.y < this.h) this.parts.push({ k: Math.random() < 0.5 ? 'fire' : 'smoke', x: q.x, y: q.y, vx: rand(-12, 12), vy: rand(-8, 10), life: rand(0.3, 0.7), max: 0.7, size: rand(2, 4) + (Math.random() < 0.5 ? 0 : 4) });
          g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.shadowColor = 'rgba(255,120,40,.7)'; g.shadowBlur = 6;
          g.drawImage(this.img, q.sx, q.sy, q.sw, q.sh, -q.sw * q.k / 2, -q.sh * q.k / 2, q.sw * q.k, q.sh * q.k); g.restore();
        }
        g.restore();
      }
      // particles
      for (const q of this.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.k === 'fire' && !q.tail) q.vy += 70 * dt; if (q.k === 'smoke') q.size += dt * 9; }
      this.parts = this.parts.filter((q) => q.life > 0);
      for (const q of this.parts) {
        const a = clamp(q.life / q.max) * alpha;
        if (q.k === 'smoke') { g.globalCompositeOperation = 'source-over'; const sg = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.size); sg.addColorStop(0, `rgba(80,86,104,${0.32 * a})`); sg.addColorStop(1, 'rgba(80,86,104,0)'); g.fillStyle = sg; g.beginPath(); g.arc(q.x, q.y, q.size, 0, 6.283); g.fill(); continue; }
        g.globalCompositeOperation = 'lighter';
        if (q.k === 'fire') { const r = q.size * (0.6 + a), sg = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 1.6); sg.addColorStop(0, `rgba(255,${Math.round(130 + 100 * a)},60,${a})`); sg.addColorStop(1, 'rgba(255,70,20,0)'); g.fillStyle = sg; g.beginPath(); g.arc(q.x, q.y, r * 1.6, 0, 6.283); g.fill(); }
        else { g.strokeStyle = `rgba(255,235,170,${a})`; g.lineWidth = 1.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - q.vx * 0.04, q.y - q.vy * 0.04); g.stroke(); }
        g.globalCompositeOperation = 'source-over';
      }
      // blast flash + shockwave at the moment of the explosion
      if (crashed && since < 0.7) {
        const f1 = clamp(since / 0.28); if (f1 < 1) { const R = 58 * E.out(f1), gr = g.createRadialGradient(this.hx, this.hy, 0, this.hx, this.hy, R); gr.addColorStop(0, `rgba(255,250,220,${1 - f1})`); gr.addColorStop(0.45, `rgba(255,170,60,${0.9 * (1 - f1)})`); gr.addColorStop(1, 'rgba(255,80,20,0)'); g.fillStyle = gr; g.beginPath(); g.arc(this.hx, this.hy, R, 0, 6.283); g.fill(); }
        const sw = clamp(since / 0.6); g.strokeStyle = `rgba(255,220,170,${0.85 * (1 - sw)})`; g.lineWidth = 4 * (1 - sw) + 1; g.beginPath(); g.arc(this.hx, this.hy, 66 * E.out(sw), 0, 6.283); g.stroke();
      }
      if (this.label) {
        const shown = crashed ? this.crashM : m;
        this.label.textContent = 'x' + shown.toFixed(2);
        this.label.className = 'xval' + (crashed ? ' bust' : shown < 2 ? '' : shown < 5 ? ' t2' : shown < 12 ? ' t3' : ' t4') + (crashed && since < 0.6 ? ' pop' : '') + (fadeOut > 0 ? ' dim' : '');
      }
    }
  }

  // ======================================================================= TOWER
  // endless tower: its foot is below the card. A crane brings a house down from the top, drives to the tower
  // (the house leans back from the acceleration), settles with a small swing, drops the house, the tower sinks one
  // floor and wobbles softly while the hook climbs out of view. Then it repeats.
  class TowerScene extends Scene {
    constructor(c) {
      super(c);
      this.house = load('house.webp'); this.hook = load('hook.webp');
      this.colors = ['#ffd166', '#b69cff', '#6fe3a0', '#ff8a8a', '#7fd0ff'];
      this.tinted = {}; this.start();
    }
    start() {
      this.ci = 0; this.floors = []; for (let i = 0; i < 9; i++) this.floors.push({ ci: this.ci++ });   // newest first
      this.phase = 'enter'; this.u = 0; this.scroll = 0; this.scrollFrom = 0; this.scrollT = 1; this.wob = 0; this.wv = 0; this.puffs = []; this.fall = null;
      this.th = 0; this.thv = 0; this.hookL = null; this.trolleyX = null; this.hand = this.ci++;
    }
    layout() {
      this.hw = Math.min(46, this.h * 0.31); this.s = this.hw / 337; this.hh = 317 * this.s; this.inc = this.hw * 0.46;
      this.cx = this.w - this.hw * 1.25; this.yTop = this.h * 0.77; this.yLand = this.yTop - this.inc; this.x0 = Math.max(this.w * 0.5, this.cx - this.hw * 2.6);
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
    drawHouse(g, i, ax, ay) { const c = this.tint(i); g.drawImage(c, ax - 183 * this.s, ay - 315 * this.s, c.width / DPR, c.height / DPR); }
    posX(t) { const k = clamp(t / 1.25); return lerp(this.x0, this.cx, E.sm(k)); }
    draw(g, now, dt) {
      if (!this.house.complete || !this.house.naturalWidth || !this.hook.complete || !this.hook.naturalWidth) return;
      const s = this.s; this.u += dt;
      if (this.trolleyX === null) this.trolleyX = this.x0;
      const ropeGap = 18, hookH = this.hook.height * s * 1.55, hookW = this.hook.width * s * 1.55, Lhide = -(this.hh + ropeGap + hookH + 24);
      const hoverBottom = this.yLand - 34, Lhover = hoverBottom - this.hh - ropeGap, ropeLen = 66, om2 = 24, damp = 1.9;
      let L = this.hookL ?? Lhide, hasHouse = true, ax = 0;
      // ---------- phases
      if (this.phase === 'enter') {
        const k = E.sm(clamp(this.u / 0.85)); L = lerp(Lhide, Lhover, k); this.trolleyX = this.x0;
        if (this.u >= 0.85) { this.phase = 'move'; this.u = 0; }
      } else if (this.phase === 'move') {
        L = Lhover; const h = 0.03; this.trolleyX = this.posX(this.u); ax = (this.posX(this.u + h) - 2 * this.posX(this.u) + this.posX(this.u - h)) / (h * h);
        if (this.u >= 1.25) { this.phase = 'settle'; this.u = 0; }
      } else if (this.phase === 'settle') {
        L = Lhover; this.trolleyX = this.cx;
        if (this.u >= 0.85) { this.phase = 'fall'; this.u = 0; this.hookStart = L; const bx = this.trolleyX + Math.sin(this.th) * (L + ropeGap); this.fall = { x: bx, y: hoverBottom, vy: 0, rot: this.th, vr: this.thv * 0.6, ci: this.hand }; }
      } else if (this.phase === 'fall') {
        hasHouse = false; const f = this.fall;
        if (f) {
          f.vy += 900 * dt; f.y += f.vy * dt; f.x = lerp(f.x, this.cx, clamp(dt * 10)); f.rot *= 0.94;
          if (f.y >= this.yLand) {
            this.floors.unshift({ ci: f.ci }); if (this.floors.length > 12) this.floors.pop(); this.fall = null; this.scrollT = 0; this.scrollFrom = this.inc; this.scroll = this.inc;
            this.wv += 20; for (let i = 0; i < 8; i++) this.puffs.push({ x: this.cx + rand(-this.hw * 0.4, this.hw * 0.4), y: this.yLand + this.inc * 0.5, vx: rand(-22, 22), vy: rand(-14, -3), life: rand(0.35, 0.65), max: 0.65, size: rand(2.5, 5) });
          }
        }
        const k = clamp((this.u - 0.05) / 0.75); L = lerp(this.hookStart, Lhide, E.sm(k));
        if (this.u >= 0.8 && !this.fall) { this.phase = 'enter'; this.u = 0; this.hookL = null; this.hand = this.ci++; this.trolleyX = this.x0; this.th = 0.05; this.thv = 0; }
      }
      if (this.phase === 'fall') this.hookL = L;
      // ---------- physics: damped pendulum driven by the trolley's acceleration, and a soft spring for the tower
      if (hasHouse) { const acc = -om2 * Math.sin(this.th) - 0.22 * (ax / ropeLen) * Math.cos(this.th) - damp * this.thv; this.thv += acc * dt; this.th += this.thv * dt; this.th = clamp(this.th, -0.22, 0.22); }
      else { this.thv *= 0.9; this.th *= 0.92; }
      const wacc = -70 * this.wob - 6.5 * this.wv; this.wv += wacc * dt; this.wob += this.wv * dt;
      if (this.scrollT < 1) { this.scrollT = Math.min(1, this.scrollT + dt / 0.6); this.scroll = this.scrollFrom * (1 - E.sm(clamp((this.scrollT - 0.08) / 0.92))); }
      // ---------- draw the tower (oldest first so newer houses overlap the roof below)
      const tx = (k) => this.cx + this.wob * Math.max(0.2, 1 - k * 0.2);
      for (let k = this.floors.length - 1; k >= 0; k--) {
        const y = this.yTop + k * this.inc - this.scroll; if (y - this.hh > this.h) continue;
        this.drawHouse(g, this.floors[k].ci, tx(k), y);
      }
      for (const q of this.puffs) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; }
      this.puffs = this.puffs.filter((q) => q.life > 0);
      for (const q of this.puffs) { const a = clamp(q.life / q.max); g.fillStyle = `rgba(255,240,215,${0.5 * a})`; g.beginPath(); g.arc(q.x, q.y, q.size * (1.4 - a * 0.5), 0, 6.283); g.fill(); }
      if (this.fall) { const f = this.fall; g.save(); g.translate(f.x, f.y - this.hh * 0.5); g.rotate(f.rot); g.translate(-f.x, -(f.y - this.hh * 0.5)); this.drawHouse(g, f.ci, f.x, f.y); g.restore(); }
      // ---------- crane: cable, hook, ropes and the hanging house, rotated by the pendulum angle
      if (L > Lhide + 1) {
        g.save(); g.translate(this.trolleyX, -4); g.rotate(this.th);
        g.strokeStyle = '#56627e'; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -90); g.lineTo(0, L); g.stroke();
        g.drawImage(this.hook, -hookW * 0.46, L - hookH * 0.9, hookW, hookH);
        if (hasHouse) {
          const yh = L + ropeGap, axp = -163 * s;
          g.strokeStyle = 'rgba(190,200,220,.9)'; g.lineWidth = 1.1;
          for (const [px, py] of [[0, 1], [37 - 163, 63], [309 - 163, 65], [193 - 163, 137]]) { g.beginPath(); g.moveTo(0, L); g.lineTo(px * s, yh + py * s); g.stroke(); }
          g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 8; g.shadowOffsetY = 4;
          const c = this.tint(this.hand); g.drawImage(c, axp, yh - 0.5, c.width / DPR, c.height / DPR);
        }
        g.restore();
      }
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
