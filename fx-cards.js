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
  const SRC = (n) => (window.CARD_IMG && window.CARD_IMG[n]) || (n === 'rocket.svg' && window.ROCKET_SRC) || (n === 'rocket.svg' ? 'rocket.svg' : 'img/' + n) + (window.BUILD ? '?v=' + window.BUILD : '');
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
      const fl = o.gem || 0, back = fl >= 0.5, sx = fl > 0 && fl < 1 ? Math.max(0.04, Math.abs(Math.cos(fl * Math.PI))) : 1;
      const top = rgb(mixa(mixa(hex(back ? '#5a4510' : '#39393d'), hex('#37e6ff'), glow), hex('#1c1c1f'), burnt)), bot = rgb(mixa(mixa(hex(back ? '#241a07' : '#17171a'), hex('#0a8fd0'), glow), hex('#09090b'), burnt));
      g.save(); g.globalAlpha = o.alpha ?? 1; g.translate(cx, cy); const sc = 1 - (o.press || 0) * 0.08 + glow * 0.04; g.scale(sc * sx, sc);
      if (glow > 0.02) { g.shadowColor = `rgba(60,225,255,${0.9 * glow})`; g.shadowBlur = 22 * glow; } else { g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 8; g.shadowOffsetY = 3 - (o.press || 0) * 2; }
      const gr = g.createLinearGradient(0, -s / 2, 0, s / 2); gr.addColorStop(0, top); gr.addColorStop(1, bot);
      rr(g, -s / 2, -s / 2, s, s, r); g.fillStyle = gr; g.fill(); g.shadowColor = 'transparent'; g.shadowBlur = 0;
      rr(g, -s / 2 + 1, -s / 2 + 1, s - 2, s - 2, r - 1); g.strokeStyle = `rgba(255,255,255,${0.26 - burnt * 0.17})`; g.lineWidth = 1; g.stroke();
      const gl = g.createLinearGradient(0, -s / 2, 0, 0); gl.addColorStop(0, `rgba(255,255,255,${0.22 - burnt * 0.16})`); gl.addColorStop(1, 'rgba(255,255,255,0)');
      rr(g, -s / 2 + 2, -s / 2 + 2, s - 4, s / 2 - 2, r - 2); g.fillStyle = gl; g.fill();
      if (burnt > 0) { const cr = g.createRadialGradient(0, 0, 1, 0, 0, s * 0.62); cr.addColorStop(0, `rgba(0,0,0,${0.65 * burnt})`); cr.addColorStop(1, 'rgba(0,0,0,0)'); rr(g, -s / 2, -s / 2, s, s, r); g.fillStyle = cr; g.fill(); }
      if (o.shimmer) { g.save(); rr(g, -s / 2, -s / 2, s, s, r); g.clip(); const sh = g.createLinearGradient(-s, -s, s, s); const p = o.shimmer; sh.addColorStop(clamp(p - 0.12), 'rgba(255,255,255,0)'); sh.addColorStop(clamp(p), 'rgba(255,255,255,.35)'); sh.addColorStop(clamp(p + 0.12), 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(-s, -s, s * 2, s * 2); g.restore(); }
      if (!back && !(o.x > 0)) this.idleStar(g, s, 1 - burnt);
      if (back) this.gem(g, s, clamp((fl - 0.5) * 2));
      if (o.x > 0) this.cross(g, s, o.x);
      g.restore();
    }
    starPath(g, R, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R; i ? g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); } g.closePath(); }
    idleStar(g, s, alpha) {            // closed tile: plain grey emblem (circle with a small gem mark)
      const R = s * 0.27; g.save(); g.globalAlpha *= alpha; g.translate(0, s * 0.01);
      g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 3; g.shadowOffsetY = 1.5;
      const gr = g.createLinearGradient(0, -R, 0, R); gr.addColorStop(0, '#6d7078'); gr.addColorStop(1, '#46484f'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, 6.283); g.fill();
      g.shadowColor = 'transparent'; g.strokeStyle = '#212328'; g.lineWidth = s * 0.05; g.lineJoin = 'round'; g.lineCap = 'round';
      const k = R * 0.62; g.beginPath(); g.moveTo(0, -k); g.lineTo(k * 0.95, -k * 0.1); g.lineTo(0, k); g.lineTo(-k * 0.95, -k * 0.1); g.closePath(); g.moveTo(-k * 0.95, -k * 0.1); g.lineTo(k * 0.95, -k * 0.1); g.stroke();
      g.restore();
    }
    gem(g, s, p) {                     // revealed safe tile: golden star pops out and sparkles
      const k = E.back(clamp(p)), R = s * 0.38 * k;
      g.save(); g.globalAlpha *= clamp(p * 2); g.lineJoin = 'round'; g.lineWidth = s * 0.07; g.shadowColor = '#ffc933'; g.shadowBlur = 14 + 8 * Math.sin((this.clock || 0) * 6);
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
      const SPEED = 1.3; now *= SPEED; dt *= SPEED; this.clock = now;
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
          if (tap.kind === 'gem') { o.gem = clamp((u - 0.12) / 0.55) * fade; }
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
      super(c); this.label = label; this.img = load('rocket.svg'); this.parts = []; this.pieces = []; this.T = 7.6; this.climb = 4.6; this.loop = -1; this.tc = 0; this.M = 40; this.queue = [];
      this.stars = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random() * 0.7, p: Math.random() * 6 }));
    }
    layout() { this.px0 = 16; this.pw = this.w - 32; this.base = this.h - 72; this.top = 46; this.ph = this.base - this.top; }
    // illustration only (the card is labelled so): a fixed showcase of explosions, not game statistics
    nextShow() {
      if (!this.queue.length) { this.queue = [3.4, 8.1, 14.6, 2.1, 27.3, 6.7, 11.9, 4.9, 19.4, 1.9, 9.2, 35.5, 5.6, 15.8].sort(() => Math.random() - 0.5); }
      return this.queue.pop();
    }
    f(p) { const k = 3.2; return (Math.exp(k * p) - 1) / (Math.exp(k) - 1); }
    pt(p) { const f = this.f(p); return [this.px0 + this.pw * (0.1 * p + 0.9 * p * p), this.base - this.ph * (0.4 * Math.pow(p, 0.7) + 0.6 * f), 1 + (this.M - 1) * f]; }
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
      if (this.newCycle) { this.newCycle = false; const li = this.loop; this.parts = []; this.pieces = []; this.exploded = false; this.crashM = this.nextShow(); const f = (this.crashM - 1) / (this.M - 1); this.pc = Math.log(1 + f * (Math.exp(3.2) - 1)) / 3.2; this.tc = this.pc * this.climb; }
      const crashed = tt >= this.tc, p = crashed ? this.pc : clamp(tt / this.climb), [hx, hy, m] = this.pt(p);
      const [xa, ya] = this.pt(Math.max(0, p - 0.012)), [x2, y2] = this.pt(Math.min(1, p + 0.012)), ang = Math.atan2(x2 - xa, -(y2 - ya)), rh = 46, rw = 23;
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
      this.houses = [0, 1, 2, 3, 4].map((i) => load(`house_${i}.webp`)); this.hook = load('hook.webp');
      this.colors = ['#ffbe0b', '#9d4dff', '#12d67a', '#ff3d4f', '#1fb6ff'];
      this.tinted = {}; this.start();
    }
    start() {
      this.ci = 0; this.floors = []; for (let i = 0; i < 9; i++) this.floors.push({ ci: this.ci++ });   // newest first
      this.phase = 'enter'; this.u = 0; this.scroll = 0; this.scrollFrom = 0; this.scrollT = 1; this.wob = 0; this.wv = 0; this.puffs = []; this.fall = null;
      this.th = 0; this.thv = 0; this.hookL = null; this.trolleyX = null; this.hand = this.ci++;
    }
    layout() {
      this.hw = Math.min(66, this.h * 0.36); this.s = this.hw / 337; this.hh = 317 * this.s; this.inc = this.hw * 0.46;
      this.cx = this.w - this.hw * 1.25; this.yTop = this.h * 0.77; this.yLand = this.yTop - this.inc; this.x0 = Math.max(this.w * 0.5, this.cx - this.hw * 2.6);
      this.tinted = {};
    }
    tint(i) {                           // pre-painted sprite (walls colour, blue windows, wooden door) scaled to card size
      if (this.tinted[i]) return this.tinted[i];
      const src = this.houses[i % this.houses.length], sc = DPR, w = Math.round(337 * this.s * sc), h = Math.round(317 * this.s * sc), c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, w, h);
      return (this.tinted[i] = c);
    }
    drawHouse(g, i, ax, ay) { const c = this.tint(i); g.drawImage(c, ax - 183 * this.s, ay - 315 * this.s, c.width / DPR, c.height / DPR); }
    posX(t) { const k = clamp(t / 1.25); return lerp(this.x0, this.cx, E.sm(k)); }
    draw(g, now, dt) {
      if (!this.houses.every((h) => h.complete && h.naturalWidth) || !this.hook.complete || !this.hook.naturalWidth) return;
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

  // ======================================================================= PLINKO
  // pyramid of pegs, balls drop and bounce down, land in a slot and a fountain of coins bursts out
  class PlinkoScene extends Scene {
    constructor(c) { super(c); this.balls = []; this.coins = []; this.pops = []; this.next = 0.3; this.glow = {}; this.R = 6; this.layout(); }
    layout() {
      const R = this.R || 6, top = 14, bottom = this.h - 84; this.top = top;
      this.sx = Math.min((this.w - 18) / (R + 2), 26); this.sy = Math.max(8, (bottom - top - 26) / R); this.cx = this.w / 2; this.slotY = top + R * this.sy + 18;
    }
    peg(r, k) { return [this.cx + (k - (r + 2) / 2) * this.sx + this.sx / 2 * 0, this.top + 12 + r * this.sy]; }
    spawn(t) {
      const edge = Math.random() < 0.65, dirs = []; let n = 0;
      for (let i = 0; i < this.R; i++) { const d = edge ? (Math.random() < 0.82 ? (this.edgeSide ? 1 : -1) : (Math.random() < 0.5 ? -1 : 1)) : (Math.random() < 0.5 ? -1 : 1); dirs.push(d); n += d; }
      this.edgeSide = !this.edgeSide;
      this.balls.push({ t0: t, dirs, n });
    }
    mult(n) { const a = Math.abs(n); return a >= 6 ? ['x100', 100] : a >= 4 ? ['x10', 10] : a >= 2 ? ['x3', 3] : ['x0.5', 0.5]; }
    draw(g, t, dt) {
      const R = this.R, sx = this.sx, sy = this.sy;
      if (t > this.next) { this.spawn(t); this.next = t + 1.5 + Math.random() * 0.5; }
      // glow behind the pyramid
      const bg = g.createRadialGradient(this.cx, this.slotY, 4, this.cx, this.slotY, this.w * 0.7); bg.addColorStop(0, 'rgba(255,61,129,.22)'); bg.addColorStop(1, 'rgba(255,61,129,0)'); g.fillStyle = bg; g.fillRect(0, 0, this.w, this.h);
      // pegs
      for (let r = 0; r < R; r++) for (let k = 0; k < r + 3; k++) {
        const x = this.cx + (k - (r + 2) / 2) * sx, y = this.top + 12 + r * sy;
        g.beginPath(); g.arc(x, y, 3, 0, 7); g.fillStyle = 'rgba(200,214,255,.85)'; g.shadowColor = 'rgba(160,190,255,.8)'; g.shadowBlur = 6; g.fill(); g.shadowBlur = 0;
      }
      // slots with multipliers
      const nb = R + 1, labs = ['x100', 'x10', 'x3', 'x0.5', 'x3', 'x10', 'x100'], cols = ['#ffcf3a', '#ff7a3a', '#ff3d81', '#6e6a90', '#ff3d81', '#ff7a3a', '#ffcf3a'];
      for (let i = 0; i < nb; i++) {
        const x = this.cx + (i - (nb - 1) / 2) * sx, w = sx - 3, h = 15, y = this.slotY, gl = this.glow[i] || 0;
        rr(g, x - w / 2, y, w, h, 4); g.fillStyle = cols[i]; g.globalAlpha = 0.28 + gl * 0.7; g.shadowColor = cols[i]; g.shadowBlur = 4 + gl * 18; g.fill(); g.globalAlpha = 1; g.shadowBlur = 0;
        g.fillStyle = '#fff'; g.font = '800 7.5px system-ui'; g.textAlign = 'center'; g.fillText(labs[i], x, y + 10.4);
        if (gl > 0) this.glow[i] = Math.max(0, gl - dt * 1.4);
      }
      // balls
      this.balls = this.balls.filter((b) => {
        const T = 0.34, e = t - b.t0, r = Math.min(R, Math.floor(e / T)), f = clamp((e - r * T) / T);
        // position index at row r (before row r's peg) -> x offset in half steps
        let off = 0; for (let i = 0; i < Math.min(r, R); i++) off += b.dirs[i];
        const pos = (rr_, o) => [this.cx + o * sx / 2, rr_ === 0 ? this.top - 4 : this.top + 12 + (rr_ - 1) * sy + sy * 0.5];
        let x, y;
        if (r >= R) {
          // landed
          if (!b.hit) { b.hit = true; const i = Math.round((b.n + R) / 2); this.glow[i] = 1; const m = this.mult(b.n); this.pops.push({ x: this.cx + b.n * sx / 2, y: this.slotY - 2, txt: m[0], t: 0, big: m[1] >= 10 }); const cnt = m[1] >= 100 ? 46 : m[1] >= 10 ? 30 : m[1] >= 3 ? 16 : 6; for (let k = 0; k < cnt; k++) this.coins.push({ x: this.cx + b.n * sx / 2 + rand(-6, 6), y: this.slotY, vx: rand(-70, 70) * (m[1] >= 10 ? 1.5 : 1), vy: -rand(90, 210) * (m[1] >= 10 ? 1.3 : 1), ph: rand(0, 6), t: 0 }); }
          return t - b.t0 < R * T + 0.25;
        }
        const x0 = this.cx + off * sx / 2, x1 = this.cx + (off + b.dirs[r]) * sx / 2, y0 = r === 0 ? this.top - 6 : this.top + 12 + (r - 1) * sy + 3, y1 = this.top + 12 + r * sy - 4;
        x = lerp(x0, x1, E.io(f)); y = lerp(y0, y1, f * f) - Math.sin(f * Math.PI) * 5;
        g.beginPath(); g.arc(x, y, 4.6, 0, 7); const gr = g.createRadialGradient(x - 1.4, y - 1.6, 0.5, x, y, 5); gr.addColorStop(0, '#fff6c2'); gr.addColorStop(1, '#ffb703'); g.fillStyle = gr; g.shadowColor = 'rgba(255,200,60,.9)'; g.shadowBlur = 10; g.fill(); g.shadowBlur = 0;
        return true;
      });
      // coins fountain
      this.coins = this.coins.filter((c) => {
        c.t += dt; c.vy += 420 * dt; c.x += c.vx * dt; c.y += c.vy * dt; const k = Math.abs(Math.cos(c.ph + c.t * 9));
        if (c.y > this.h - 52 || c.t > 1.6) return false;
        g.save(); g.translate(c.x, c.y); g.scale(Math.max(0.15, k), 1); g.beginPath(); g.arc(0, 0, 4.2, 0, 7); g.fillStyle = '#ffd23a'; g.shadowColor = 'rgba(255,190,40,.8)'; g.shadowBlur = 6; g.fill(); g.shadowBlur = 0; g.lineWidth = 1; g.strokeStyle = '#c98a00'; g.stroke(); g.restore(); return true;
      });
      this.pops = this.pops.filter((p) => { p.t += dt; if (p.t > 1.1) return false; const a = 1 - p.t / 1.1, sc = (p.big ? 1.6 : 1.2) * (1 + 0.25 * Math.sin(Math.min(1, p.t * 5) * Math.PI)); g.save(); g.globalAlpha = a; g.translate(p.x, p.y - 8 - p.t * 26); g.scale(sc, sc); g.font = '900 13px system-ui'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(60,10,30,.9)'; g.strokeText(p.txt, 0, 0); g.fillStyle = p.big ? '#ffe45a' : '#fff'; g.fillText(p.txt, 0, 0); g.restore(); return true; });
    }
  }

  // ======================================================================= SLOT 777
  // neon slot machine: lever is pulled, three reels spin and stop one by one on 7-7-7, the machine flashes
  class SlotScene extends Scene {
    constructor(c) { super(c); this.T = 6.6; this.coins = []; this.fired = -1; }
    sym(g, id, x, y, s) {
      g.save(); g.translate(x, y);
      if (id === 0) { // cherries
        g.strokeStyle = '#2f9e44'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-s * .22, s * .1); g.quadraticCurveTo(-s * .05, -s * .35, s * .18, -s * .4); g.moveTo(s * .2, s * .14); g.quadraticCurveTo(s * .2, -s * .25, s * .18, -s * .4); g.stroke();
        g.fillStyle = '#3fbf5a'; g.beginPath(); g.ellipse(s * .3, -s * .38, s * .16, s * .08, -0.4, 0, 7); g.fill();
        for (const [cx, cy] of [[-s * .22, s * .18], [s * .2, s * .22]]) { const gr = g.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, s * .24); gr.addColorStop(0, '#ff8a8a'); gr.addColorStop(1, '#c0102a'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, s * .22, 0, 7); g.fill(); }
      } else if (id === 1) { // lemon
        const gr = g.createLinearGradient(0, -s * .3, 0, s * .3); gr.addColorStop(0, '#fff06a'); gr.addColorStop(1, '#f0b400'); g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, s * .42, s * .3, -0.3, 0, 7); g.fill(); g.fillStyle = '#f0b400'; g.beginPath(); g.arc(s * .4, -s * .08, s * .06, 0, 7); g.fill();
      } else if (id === 2) { // orange slice
        g.fillStyle = '#ff8a1f'; g.beginPath(); g.arc(0, 0, s * .36, 0, 7); g.fill(); g.fillStyle = '#ffd08a'; g.beginPath(); g.arc(0, 0, s * .3, 0, 7); g.fill(); g.strokeStyle = '#ff9d3a'; g.lineWidth = 1.5; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * s * .3, Math.sin(a) * s * .3); g.stroke(); }
      } else if (id === 3) { // seven
        g.font = `900 ${s * 1.05}px Georgia,serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = s * .09; g.strokeStyle = '#7a0a1a'; g.strokeText('7', 0, s * .04); const gr = g.createLinearGradient(0, -s * .5, 0, s * .5); gr.addColorStop(0, '#ff6b6b'); gr.addColorStop(1, '#d10f2f'); g.fillStyle = gr; g.fillText('7', 0, s * .04);
      } else { // lime
        const gr = g.createRadialGradient(-s * .1, -s * .1, 1, 0, 0, s * .36); gr.addColorStop(0, '#d8ff7a'); gr.addColorStop(1, '#3a9d1a'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s * .34, 0, 7); g.fill(); g.fillStyle = '#2f8a2a'; g.beginPath(); g.ellipse(s * .2, -s * .36, s * .16, s * .07, -0.5, 0, 7); g.fill();
      }
      g.restore();
    }
    neon(g, draw, col, blur = 12, w = 2.4) { g.save(); g.shadowColor = col; g.shadowBlur = blur; g.strokeStyle = col; g.lineWidth = w; draw(); g.stroke(); g.restore(); }
    draw(g, t, dt) {
      const T = this.T, ph = t % T, cyc = Math.floor(t / T), W = this.w, H = this.h - 54;
      const u = Math.min(W / 150, H / 190), ox = (W - 150 * u) / 2, oy = 2;
      const win = clamp((ph - 4.3) / 0.3) * (ph < 6.2 ? 1 : clamp((6.6 - ph) / 0.4)), flash = win * (0.55 + 0.45 * Math.sin(ph * 22));
      g.save(); g.translate(ox, oy); g.scale(u, u);
      // aura
      const au = g.createRadialGradient(75, 90, 10, 75, 90, 110); au.addColorStop(0, `rgba(255,61,200,${0.18 + win * 0.2})`); au.addColorStop(1, 'rgba(255,61,200,0)'); g.fillStyle = au; g.fillRect(-30, -10, 210, 210);
      // marquee
      this.neon(g, () => rr(g, 14, 2, 104, 24, 12), '#3ec7ff', 10, 2); this.neon(g, () => rr(g, 18, 5.5, 96, 17, 8.5), '#ff3dd6', 8, 1.6);
      g.font = '900 15px system-ui'; g.textAlign = 'center'; g.fillStyle = '#ffc533'; g.shadowColor = '#ff9a00'; g.shadowBlur = 10 + win * 10; g.fillText('SLOT 777', 66, 20.5); g.shadowBlur = 0;
      // body
      rr(g, 6, 30, 120, 96, 14); const bg = g.createLinearGradient(0, 30, 0, 126); bg.addColorStop(0, '#3a0e4a'); bg.addColorStop(1, '#1b0626'); g.fillStyle = bg; g.fill();
      this.neon(g, () => rr(g, 6, 30, 120, 96, 14), '#ff3dd6', 12 + win * 10, 3);
      // reel window
      rr(g, 14, 38, 104, 66, 9); g.fillStyle = '#10051a'; g.fill();
      const rw = 31, gap = 3, rh = 60, ry = 41; const stops = [2.4, 3.2, 4.0];
      for (let i = 0; i < 3; i++) {
        const x = 17 + i * (rw + gap), spinEnd = stops[i], sp = ph < 0.5 ? 0 : clamp((ph - 0.5) / (spinEnd - 0.5));
        g.save(); rr(g, x, ry, rw, rh, 6); g.clip(); g.fillStyle = '#f6f7ff'; g.fillRect(x, ry, rw, rh); const sh = g.createLinearGradient(0, ry, 0, ry + rh); sh.addColorStop(0, 'rgba(0,0,0,.28)'); sh.addColorStop(0.22, 'rgba(0,0,0,0)'); sh.addColorStop(0.78, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.28)'); 
        const cell = 38, travel = (ph < 0.5 ? 0 : (ph < spinEnd ? E.out(sp) * 1 : 1)) , total = 12 + i * 5; let p = (cyc * 3 + i) * 0.37 + (ph < spinEnd ? (total * (ph < 0.5 ? 0 : E.out(sp))) : total);
        const blur = ph > 0.5 && ph < spinEnd ? 1 - E.out(sp) * 0.8 : 0; const base = Math.floor(p), fr = p - base;
        for (let k = -2; k <= 2; k++) { const id = (((base + k) % 5) + 5) % 5, yy = ry + rh / 2 + (k - fr) * cell; const fin = ph >= spinEnd && k === 0; this.sym(g, fin ? 3 : (ph >= spinEnd ? ((((base + k) % 5) + 5) % 5) : id), x + rw / 2, yy, 30); }
        if (blur > 0.1) { g.fillStyle = `rgba(255,255,255,${blur * 0.35})`; g.fillRect(x, ry, rw, rh); }
        g.fillStyle = sh; g.fillRect(x, ry, rw, rh); g.restore();
      }
      // payline
      g.strokeStyle = `rgba(255,70,90,${0.35 + flash * 0.65})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(14, ry + rh / 2); g.lineTo(118, ry + rh / 2); g.stroke();
      // lower control panel
      this.neon(g, () => rr(g, 2, 126, 128, 30, 9), '#ffb300', 10 + win * 8, 2.4);
      rr(g, 5, 129, 122, 24, 7); g.fillStyle = '#2a0f3a'; g.fill();
      const lc = ['#ff3d9a', '#ffcf3a', '#3ec7ff', '#3df57a'];
      for (let i = 0; i < 4; i++) { const on = win > 0 ? (Math.floor(ph * 10 + i) % 2 === 0) : (Math.floor(ph * 3 + i) % 4 === i); g.fillStyle = lc[i]; g.globalAlpha = on ? 1 : 0.3; g.shadowColor = lc[i]; g.shadowBlur = on ? 8 : 0; rr(g, 12 + i * 24, 134, 20, 8, 4); g.fill(); } g.globalAlpha = 1; g.shadowBlur = 0;
      g.fillStyle = '#ffb300'; rr(g, 98, 144, 24, 6, 3); g.fill();
      // base
      rr(g, 12, 156, 108, 14, 5); g.fillStyle = '#7a1348'; g.fill(); this.neon(g, () => { g.beginPath(); g.moveTo(16, 163); g.lineTo(116, 163); }, '#ff3dd6', 8, 1.6);
      // lever
      const pull = ph < 0.25 ? E.out(ph / 0.25) : ph < 0.6 ? 1 - E.io((ph - 0.25) / 0.35) : 0, ly = 66 + pull * 26;
      g.strokeStyle = '#ffb300'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(126, 100); g.quadraticCurveTo(142, 84, 140, ly); g.stroke();
      const lb = g.createRadialGradient(138, ly - 2, 1, 140, ly, 8); lb.addColorStop(0, '#ff9a9a'); lb.addColorStop(1, '#d10f2f'); g.fillStyle = lb; g.shadowColor = '#ff3040'; g.shadowBlur = 8; g.beginPath(); g.arc(140, ly, 7.5, 0, 7); g.fill(); g.shadowBlur = 0;
      // coins when it hits 777
      if (ph > 4.3 && this.fired !== cyc) { this.fired = cyc; for (let k = 0; k < 34; k++) this.coins.push({ x: 66, y: 70, vx: rand(-110, 110), vy: -rand(120, 260), ph: rand(0, 6), t: 0 }); }
      this.coins = this.coins.filter((c) => { c.t += dt; c.vy += 480 * dt; c.x += c.vx * dt; c.y += c.vy * dt; if (c.t > 1.5 || c.y > 175) return false; const k = Math.abs(Math.cos(c.ph + c.t * 10)); g.save(); g.translate(c.x, c.y); g.scale(Math.max(0.15, k), 1); g.beginPath(); g.arc(0, 0, 4.5, 0, 7); g.fillStyle = '#ffd23a'; g.shadowColor = 'rgba(255,190,40,.9)'; g.shadowBlur = 6; g.fill(); g.shadowBlur = 0; g.strokeStyle = '#c98a00'; g.lineWidth = 1; g.stroke(); g.restore(); return true; });
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
    const pl = document.getElementById('cv-plinko'), sl = document.getElementById('cv-slot');
    if (pl) scenes.push(new PlinkoScene(pl));
    if (sl) scenes.push(new SlotScene(sl));
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
