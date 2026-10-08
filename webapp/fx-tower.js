// Tower game scene: a construction site (flat style). A tower crane brings a house on a hook, it swings over the
// tower; "Поставить" drops it (the SERVER decides if it sits properly: success -> the tower grows, failure -> the
// house misses, tumbles to the ground). Rendering only: all outcomes come from the round state passed to sync().
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const rand = (a, b) => a + Math.random() * (b - a);
  const SRC = (n) => (window.CARD_IMG && window.CARD_IMG[n]) || 'img/' + n + (window.BUILD ? '?v=' + window.BUILD : '');
  const load = (n) => { const i = new Image(); i.src = SRC(n); return i; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };

  const ORANGE = '#f2a33a', ORANGE_D = '#d98a22', STEEL = '#9db3c4', CITY1 = '#dbe9f3', CITY2 = '#cadff0';

  class TowerGame {
    constructor(canvas) {
      this.c = canvas; this.g = canvas.getContext('2d');
      this.houses = [0, 1, 2, 3, 4].map((i) => load(`house_${i}.webp`)); this.tinted = {};
      this.ci = 0; this.roundId = null; this.onReady = null; this._ready = null;
      this.reset(); this.resize();
      this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas);
      this._loop = this._loop.bind(this); this.last = performance.now(); requestAnimationFrame(this._loop);
    }
    reset() {
      this.state = 'idle'; this.u = 0; this.floors = []; this.landed = 0; this.targetSucc = 0; this.queue = []; this.failQueued = false;
      this.cam = 0; this.wob = 0; this.wv = 0; this.th = 0; this.thv = 0; this.sw = 0; this.trolleyX = null; this.hookL = null; this.hand = 0;
      this.fall = null; this.tumble = null; this.rest = null; this.puffs = []; this.badge = 0; this.roundStatus = 'idle'; this.maxSteps = 10; this.mults = [];
    }
    resize() {
      const r = this.c.getBoundingClientRect(); this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.c.width = Math.round(this.w * DPR); this.c.height = Math.round(this.h * DPR); this.g.setTransform(DPR, 0, 0, DPR, 0, 0);
      const { w, h } = this;
      this.groundY = h - 56; this.hw = clamp(w * 0.165, 50, 66); this.s = this.hw / 337; this.hh = 317 * this.s; this.inc = this.hw * 0.46;
      this.xt = w * 0.34; this.mastX = w * 0.72; this.jibY = 66; this.pivotY = this.jibY + 8; this.tinted = {};
      this.skyline = null;
    }
    tint(i) {
      if (this.tinted[i]) return this.tinted[i];
      const src = this.houses[i % 5], w = Math.round(337 * this.s * DPR), h = Math.round(317 * this.s * DPR), c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, w, h); return (this.tinted[i] = c);
    }
    drawHouse(g, i, ax, ay, rot = 0) {   // (ax, ay) = bottom vertex of the house
      const c = this.tint(i), w = c.width / DPR, h = c.height / DPR;
      g.save(); g.translate(ax, ay - h * 0.5); g.rotate(rot); g.drawImage(c, -183 * this.s, h * 0.5 - 315 * this.s, w, h); g.restore();
    }

    // ---------------------------------------------------------------- state from the round
    sync(round) {
      if (!round) { if (this.roundId !== null) { this.reset(); this.roundId = null; } this._setReady(false); return; }
      if (round.id !== this.roundId) {                      // a different round: rebuild the tower from its state without animation
        this.reset(); this.roundId = round.id;
        const v = round.view, succ = round.status === 'lost' ? v.picks.length - 1 : v.picks.length;
        for (let i = 0; i < succ; i++) this.floors.push({ ci: this.ci++ });
        this.landed = this.targetSucc = succ; this.failQueued = false;
        if (round.status === 'active') { this.state = 'arrive'; this.hand = this.ci++; }
        else if (round.status === 'lost') { this.state = 'done'; this.rest = { x: this.xt + this.hw * 1.3, rot: 1.1 }; this.failQueued = true; }
        else this.state = 'done';
        this.cam = this.camTarget();
      }
      const v = round.view, succ = round.status === 'lost' ? v.picks.length - 1 : v.picks.length;
      this.maxSteps = v.maxSteps; this.mults = v.multipliers; this.roundStatus = round.status;
      while (this.targetSucc < succ) { this.queue.push({ ok: true }); this.targetSucc++; }
      if (round.status === 'lost' && !this.failQueued) { this.queue.push({ ok: false, side: Math.random() < 0.5 ? -1 : 1 }); this.failQueued = true; }
      if (round.status === 'won' && !this.queue.length && (this.state === 'sway' || this.state === 'arrive')) { this.state = 'leave'; this.u = 0; this.hookStart = this.L ?? 0; }
    }
    _setReady(v) { if (v !== this._ready) { this._ready = v; this.onReady?.(v); } }
    camTarget() { return Math.max(0, this.h * 0.6 - (this.groundY - this.landed * this.inc)); }

    // ---------------------------------------------------------------- update + draw
    _loop(now) {
      if (!this.c.isConnected) { this._ro.disconnect(); return; }
      requestAnimationFrame(this._loop);
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      if (!this.w || !this.houses.every((h) => h.complete && h.naturalWidth)) return;
      this.update(dt, now / 1000); this.draw(this.g, now / 1000);
    }
    update(dt, t) {
      const { s, hh, hw } = this, ropeGap = 22, hookH = 22, ROPE = 70, om2 = 24, damp = 1.9, A = this.w * 0.2, OM = (Math.PI * 2) / 3.6;
      const landWorld = this.groundY - this.landed * this.inc;
      const hoverBottom = landWorld + this.cam - 40;                           // screen y of the hanging house's bottom vertex
      const Lhover = hoverBottom - 315 * s - ropeGap - hookH - this.pivotY, Lhide = -(this.pivotY + hh + ropeGap + hookH + 50);
      this.Lhide = Lhide; this.Lhover = Lhover;
      let L = this.hookL ?? Lhide, ax = 0, hasHouse = true;
      this.u += dt; this.sw += dt;
      const swayPos = (time, amp) => this.xt + A * amp * Math.sin(OM * time);

      if (this.state === 'arrive') {
        const k = sm(clamp(this.u / 1.0)); L = lerp(Lhide, Lhover, k); const amp = sm(clamp(this.u / 1.0));
        this.trolleyX = swayPos(this.sw, amp); ax = -A * amp * OM * OM * Math.sin(OM * this.sw);
        if (this.u >= 1.0) { this.state = 'sway'; this.u = 0; }
      } else if (this.state === 'sway') {
        L = Lhover; this.trolleyX = swayPos(this.sw, 1); ax = -A * OM * OM * Math.sin(OM * this.sw);
        if (this.queue.length) { this.cur = this.queue.shift(); this.state = 'align'; this.u = 0; this.x0 = this.trolleyX; this.target = this.xt + (this.cur.ok ? 0 : this.cur.side * hw * 0.8); }
      } else if (this.state === 'align') {
        L = Lhover; const D = 0.4, pos = (uu) => lerp(this.x0, this.target, sm(clamp(uu / D))), hh_ = 0.03;
        this.trolleyX = pos(this.u); ax = (pos(this.u + hh_) - 2 * pos(this.u) + pos(this.u - hh_)) / (hh_ * hh_);
        if (this.u >= D + 0.25) {                                                       // steady for a moment, then release
          const bx = this.trolleyX + Math.sin(this.th) * (L + hookH + ropeGap), by = hoverBottom - this.cam;
          this.fall = { x: bx, y: by, vy: 0, rot: this.th, vr: this.thv * 0.6, ci: this.hand, ok: this.cur.ok, side: this.cur.side };
          this.hookStart = L; this.state = 'drop'; this.u = 0;
        }
      } else if (this.state === 'drop' || this.state === 'land' || this.state === 'tumble') {
        hasHouse = false; L = lerp(this.hookStart, Lhide, sm(clamp((this.u - 0.05) / 0.85)));
        const f = this.fall;
        if (f) {
          f.vy += 1500 * dt; f.y += f.vy * dt; f.rot += f.vr * dt; f.vr *= 0.95;
          if (f.ok) f.x = lerp(f.x, this.xt, clamp(dt * 12));
          if (f.y >= landWorld) {
            if (f.ok) {
              this.floors.push({ ci: f.ci }); this.landed++; this.fall = null; this.wv += 18 + this.landed * 2; this.badge = 1;
              for (let i = 0; i < 9; i++) this.puffs.push({ x: this.xt + rand(-hw * 0.45, hw * 0.45), y: landWorld + 2, vx: rand(-30, 30), vy: rand(-22, -5), life: rand(0.35, 0.7), max: 0.7, size: rand(3, 6) });
              this.state = 'land';
            } else {                                                                      // the house misses: it teeters and slides off
              this.tumble = { x: f.x, y: landWorld, vx: f.side * 150, vy: -90, rot: f.rot, vr: f.side * 3.4, hit: 0 }; this.fall = null; this.wv += f.side * 55; this.state = 'tumble';
              for (let i = 0; i < 6; i++) this.puffs.push({ x: f.x, y: landWorld, vx: rand(-40, 40), vy: rand(-30, -8), life: rand(0.3, 0.6), max: 0.6, size: rand(3, 6) });
            }
          }
        }
        const q = this.tumble;
        if (q) {
          q.vy += 1500 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
          if (q.y >= this.groundY) {
            q.y = this.groundY; q.hit++; for (let i = 0; i < 10; i++) this.puffs.push({ x: q.x, y: this.groundY, vx: rand(-60, 60), vy: rand(-40, -8), life: rand(0.35, 0.8), max: 0.8, size: rand(3, 7) });
            if (q.hit >= 2 || Math.abs(q.vy) < 120) { this.rest = { x: q.x, rot: q.rot }; this.tumble = null; this.state = 'done'; this.u = 0; }
            else { q.vy *= -0.28; q.vx *= 0.55; q.vr *= 0.5; }
          }
        }
        if (this.state === 'land' && this.u > 1.0) {
          if (this.roundStatus === 'active' && this.landed < this.maxSteps) { this.state = 'arrive'; this.u = 0; this.hand = this.ci++; this.hookL = null; }
          else this.state = 'done';
        }
      } else if (this.state === 'leave') {
        L = lerp(this.hookStart, Lhide, sm(clamp(this.u / 0.9))); if (this.u >= 0.9) { this.state = 'done'; this.u = 0; }
      } else { L = Lhide; hasHouse = false; if (this.trolleyX === null) this.trolleyX = this.xt; }
      if (this.state !== 'arrive' && this.state !== 'sway') this.hookL = this.state === 'idle' ? null : L; else this.hookL = null;
      if (this.trolleyX === null) this.trolleyX = this.xt;
      this.L = L; this.hasHouse = hasHouse && (this.state === 'arrive' || this.state === 'sway' || this.state === 'align' || this.state === 'leave');

      // physics: pendulum driven by the trolley, soft spring for the tower, smooth camera
      if (this.hasHouse) { const acc = -om2 * Math.sin(this.th) - 0.22 * (ax / ROPE) * Math.cos(this.th) - damp * this.thv; this.thv += acc * dt; this.th = clamp(this.th + this.thv * dt, -0.25, 0.25); }
      else { this.thv *= 0.9; this.th *= 0.92; }
      this.wv += (-70 * this.wob - 6.5 * this.wv) * dt; this.wob += this.wv * dt;
      this.cam += (this.camTarget() - this.cam) * Math.min(1, dt * 2.6);
      this.badge = Math.max(0, this.badge - dt * 0.6);
      this._setReady(this.state === 'sway' && this.roundStatus === 'active' && !this.queue.length);
    }

    draw(g, t) {
      const { w, h, cam } = this;
      // sky
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#fbfdff'); sky.addColorStop(1, '#e3eff8'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      // city silhouettes (parallax: they sink slower than the tower)
      if (!this.skyline) { this.skyline = [0, 1].map((layer) => { const b = []; let x = -10; while (x < w + 10) { const bw = rand(34, 70), bh = rand(60, 190) * (layer ? 0.8 : 1); b.push({ x, bw, bh, step: Math.random() < 0.4 }); x += bw - 4; } return b; }); }
      this.skyline.forEach((layer, li) => {
        g.fillStyle = li ? CITY2 : CITY1; const base = this.groundY + cam * (li ? 0.16 : 0.09) + 6;
        for (const b of layer) { g.fillRect(b.x, base - b.bh, b.bw, b.bh + 20); if (b.step) g.fillRect(b.x + b.bw * 0.2, base - b.bh - 16, b.bw * 0.6, 18); }
      });
      g.fillStyle = CITY1; const sx = w * 0.84, sb = this.groundY + cam * 0.09 + 6; g.beginPath(); g.moveTo(sx - 18, sb); g.lineTo(sx - 18, sb - 150); g.lineTo(sx - 6, sb - 160); g.lineTo(sx, sb - 215); g.lineTo(sx + 6, sb - 160); g.lineTo(sx + 18, sb - 150); g.lineTo(sx + 18, sb); g.fill();
      // ground + props (world -> screen: + cam)
      const gy = this.groundY + cam;
      if (gy < h + 10) this.drawGround(g, gy);
      // foundation + tower
      const hw = this.hw, xt = this.xt;
      if (gy < h + 20) { g.fillStyle = '#c3ccd5'; rr(g, xt - hw * 0.62, gy - 4, hw * 1.24, 12, 4); g.fill(); g.fillStyle = '#aeb9c4'; g.fillRect(xt - hw * 0.62, gy + 4, hw * 1.24, 4); }
      const n = this.floors.length;
      this.floors.forEach((fl, i) => {
        const y = this.groundY - i * this.inc + cam; if (y - this.hh > h) return;
        const k = n > 1 ? i / (n - 1) : 1, ox = this.wob * (0.12 + 0.88 * k);
        this.drawHouse(g, fl.ci, xt + ox, y);
      });
      // dust
      for (const p of this.puffs) { p.life -= 1 / 60; p.x += p.vx / 60; p.y += p.vy / 60; }
      this.puffs = this.puffs.filter((p) => p.life > 0);
      for (const p of this.puffs) { const a = clamp(p.life / p.max); g.fillStyle = `rgba(255,248,235,${0.7 * a})`; g.beginPath(); g.arc(p.x, p.y + cam, p.size * (1.5 - a * 0.5), 0, 6.283); g.fill(); }
      // falling / tumbling / resting house
      if (this.fall) this.drawHouse(g, this.fall.ci, this.fall.x, this.fall.y + cam, this.fall.rot);
      if (this.tumble) this.drawHouse(g, this.hand, this.tumble.x, this.tumble.y + cam, this.tumble.rot);
      if (this.rest) this.drawHouse(g, this.hand, this.rest.x, this.groundY + cam, this.rest.rot);
      // multiplier badge next to the top floor
      if (n && this.mults[n - 1] != null) {
        const top = this.groundY - (n - 1) * this.inc - this.hh * 0.55 + cam, bx = xt + hw * 0.72, pop = 1 + this.badge * 0.25;
        g.save(); g.translate(bx, top); g.scale(pop, pop); g.font = "800 13px 'Unbounded',system-ui,sans-serif"; const txt = 'x' + this.mults[n - 1].toFixed(2), tw = g.measureText(txt).width + 16;
        g.fillStyle = '#22c55e'; rr(g, 0, -12, tw, 24, 12); g.fill(); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(txt, 8, 1); g.restore();
      }
      this.drawCrane(g);
    }
    drawGround(g, gy) {
      const { w, h } = this;
      g.fillStyle = '#a6917c'; g.fillRect(0, gy, w, h - gy + 4); g.fillStyle = '#8f7b68'; g.fillRect(0, gy + 18, w, h);
      g.fillStyle = '#b3a08b'; g.fillRect(0, gy, w, 4);
      const mound = (x, r) => { g.fillStyle = '#f0c44f'; g.beginPath(); g.ellipse(x, gy + 2, r, r * 0.55, 0, Math.PI, 0); g.fill(); g.fillStyle = '#f6d77a'; g.beginPath(); g.ellipse(x - r * 0.25, gy, r * 0.55, r * 0.3, 0, Math.PI, 0); g.fill(); };
      mound(w * 0.08, 30); mound(w * 0.5, 26); mound(w * 0.86, 24);
      // pipes
      for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#7f97ad' : '#92a9bd'; rr(g, w * 0.12, gy + 8 + i * 5, w * 0.24, 5, 2.5); g.fill(); }
      // barrier
      const bx = w * 0.62, by = gy - 8; g.fillStyle = '#5b6b7a'; g.fillRect(bx + 4, by + 4, 3, 14); g.fillRect(bx + 36, by + 4, 3, 14);
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#fff' : '#e5453d'; g.beginPath(); g.moveTo(bx + i * 7.5, by - 4); g.lineTo(bx + i * 7.5 + 7.5, by - 4); g.lineTo(bx + i * 7.5 + 4, by + 10); g.lineTo(bx + i * 7.5 - 3.5, by + 10); g.fill(); }
      // wheelbarrow
      const wx = w * 0.47, wy = gy + 4; g.fillStyle = '#6aa84f'; g.beginPath(); g.moveTo(wx, wy - 10); g.lineTo(wx + 24, wy - 10); g.lineTo(wx + 19, wy); g.lineTo(wx + 5, wy); g.fill(); g.strokeStyle = '#56606a'; g.lineWidth = 2; g.beginPath(); g.moveTo(wx + 24, wy - 8); g.lineTo(wx + 34, wy - 14); g.stroke(); g.fillStyle = '#56606a'; g.beginPath(); g.arc(wx + 8, wy + 2, 4, 0, 6.283); g.fill();
      // trees
      const tree = (x, sc) => { g.fillStyle = '#8b6a4a'; g.fillRect(x - 3 * sc, gy - 30 * sc, 6 * sc, 32 * sc); g.fillStyle = '#7aa84b'; g.beginPath(); g.ellipse(x, gy - 40 * sc, 20 * sc, 17 * sc, 0, 0, 6.283); g.fill(); g.fillStyle = '#8fbd5c'; g.beginPath(); g.ellipse(x - 5 * sc, gy - 44 * sc, 11 * sc, 9 * sc, 0, 0, 6.283); g.fill(); };
      tree(w * 0.96, 0.95); tree(w * 0.02 + 8, 0.7);
    }
    drawCrane(g) {
      const { w, mastX, jibY } = this, topY = 24, bottom = Math.min(this.groundY + this.cam, this.h + 6);
      g.lineCap = 'round'; g.lineJoin = 'round';
      // guy lines
      g.strokeStyle = STEEL; g.lineWidth = 1.3; g.beginPath(); g.moveTo(mastX, topY - 6); g.lineTo(w * 0.07, jibY - 8); g.moveTo(mastX, topY - 6); g.lineTo(w * 0.93, jibY - 8); g.stroke();
      // mast: two columns + zig-zag
      g.strokeStyle = ORANGE; g.lineWidth = 3; g.beginPath(); g.moveTo(mastX - 7, topY); g.lineTo(mastX - 7, bottom); g.moveTo(mastX + 7, topY); g.lineTo(mastX + 7, bottom); g.stroke();
      g.strokeStyle = ORANGE_D; g.lineWidth = 1.8; g.beginPath(); let up = true; for (let y = topY; y < bottom; y += 16) { g.moveTo(up ? mastX - 7 : mastX + 7, y); g.lineTo(up ? mastX + 7 : mastX - 7, Math.min(y + 16, bottom)); up = !up; } g.stroke();
      // jib: top and bottom chord with triangles
      const x1 = w * 0.04, x2 = w * 0.97;
      g.strokeStyle = ORANGE; g.lineWidth = 3; g.beginPath(); g.moveTo(x1, jibY + 4); g.lineTo(x2, jibY + 4); g.moveTo(x1, jibY - 8); g.lineTo(mastX - 7, jibY - 8); g.moveTo(mastX + 7, jibY - 8); g.lineTo(x2, jibY - 8); g.stroke();
      g.strokeStyle = ORANGE_D; g.lineWidth = 1.8; g.beginPath(); let flip = true; for (let x = x1; x < x2; x += 14) { g.moveTo(x, flip ? jibY + 4 : jibY - 8); g.lineTo(Math.min(x + 14, x2), flip ? jibY - 8 : jibY + 4); flip = !flip; } g.stroke();
      // peak, cabin, counterweight
      g.fillStyle = ORANGE; g.beginPath(); g.moveTo(mastX - 6, jibY - 8); g.lineTo(mastX, topY - 8); g.lineTo(mastX + 6, jibY - 8); g.fill();
      g.fillStyle = ORANGE; rr(g, mastX - 30, jibY + 6, 28, 26, 3); g.fill(); g.fillStyle = '#5b7fa3'; rr(g, mastX - 26, jibY + 10, 12, 12, 2); g.fill(); g.fillStyle = '#7fa3c7'; rr(g, mastX - 12, jibY + 10, 8, 12, 2); g.fill();
      g.fillStyle = '#a9c1d9'; rr(g, w * 0.88, jibY + 6, w * 0.07, 16, 2); g.fill(); g.fillStyle = '#93b0cc'; g.fillRect(w * 0.88, jibY + 14, w * 0.07, 2);
      // trolley + hook assembly
      const tx = this.trolleyX ?? this.xt, py = this.pivotY - 2, s = this.s;
      g.fillStyle = ORANGE_D; rr(g, tx - 9, jibY + 3, 18, 8, 2); g.fill();
      const L = this.L ?? this.Lhide; if (L <= this.Lhide + 1 && !this.hasHouse && !this.fall) return;
      g.save(); g.translate(tx, py); g.rotate(this.th);
      g.strokeStyle = '#6f8294'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, L); g.stroke();
      g.fillStyle = ORANGE; rr(g, -6, L - 2, 12, 12, 3); g.fill(); g.fillStyle = '#f7c06a'; g.fillRect(-4, L, 4, 8);
      g.strokeStyle = '#5d6e7e'; g.lineWidth = 2.6; g.beginPath(); g.arc(0, L + 17, 5, -1.2, 2.6); g.stroke();
      if (this.hasHouse) {
        const yh = L + 22 + 22, ax = -163 * s;
        g.strokeStyle = 'rgba(95,111,128,.95)'; g.lineWidth = 1.1;
        for (const [px, py2] of [[0, 1], [37 - 163, 63], [309 - 163, 65], [193 - 163, 137]]) { g.beginPath(); g.moveTo(0, L + 22); g.lineTo(px * s, yh + py2 * s); g.stroke(); }
        const c = this.tint(this.hand); g.shadowColor = 'rgba(40,60,80,.28)'; g.shadowBlur = 8; g.shadowOffsetY = 4; g.drawImage(c, ax, yh - 0.5, c.width / DPR, c.height / DPR);
      }
      g.restore();
    }
  }
  window.TowerGame = TowerGame;
})();
