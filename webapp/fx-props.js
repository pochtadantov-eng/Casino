// Realistic scenery for the Tower scene: painted once per size into offscreen canvases (and cached).
// Any of these can be replaced by a real photo: drop a PNG with a transparent background into webapp/img/props/
// (lamp.png, cone.png, pallet.png, birch.png, linden.png, fence.png) and the game uses it instead of the painting.
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return [c, c.getContext('2d')]; };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const sh = (h, t) => { const a = hex(h), to = t < 0 ? 0 : 255, k = Math.abs(t); return `rgb(${a.map((v) => Math.round(lerp(v, to, k))).join(',')})`; };
  const cache = new Map();
  const once = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

  // optional photo overrides
  const photos = {};
  const loadPhoto = (name) => { if (name in photos) return photos[name]; const img = new Image(); photos[name] = null; img.onload = () => { photos[name] = img; cache.clear(); }; img.onerror = () => { photos[name] = null; }; img.src = 'img/props/' + name + '.png' + (window.BUILD ? '?v=' + window.BUILD : ''); return null; };
  ['lamp', 'cone', 'pallet', 'birch', 'linden', 'fence'].forEach(loadPhoto);
  const fromPhoto = (name, wU, ppu) => { const im = photos[name]; if (!im) return null; const w = wU * ppu * DPR, h = w * im.naturalHeight / im.naturalWidth, [c, g] = mk(w, h); g.drawImage(im, 0, 0, w, h); return { cv: c, w: w / DPR, h: h / DPR }; };

  // ------------------------------------------------------------------ modern park lamp (graphite pole, flat LED head)
  function lamp(ppu) {
    return once('lamp@' + ppu, () => fromPhoto('lamp', 1.1, ppu) || (() => {
      const Hu = 2.7, k = ppu * DPR, W = 1.2 * k, Ht = Hu * k, [c, g] = mk(W, Ht + 6), px = 0.28 * k, base = Ht;
      // soft ground shadow
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(px + 0.1 * k, base + 2, 0.34 * k, 0.05 * k, 0, 0, 6.283); g.fill();
      // base flange + service hatch
      let gr = g.createLinearGradient(px - 0.1 * k, 0, px + 0.1 * k, 0); gr.addColorStop(0, '#15181c'); gr.addColorStop(0.35, '#59616b'); gr.addColorStop(1, '#101317'); g.fillStyle = gr; g.fillRect(px - 0.085 * k, base - 0.34 * k, 0.17 * k, 0.34 * k); g.fillStyle = '#0d1013'; g.fillRect(px - 0.13 * k, base - 0.05 * k, 0.26 * k, 0.05 * k);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(px - 0.04 * k, base - 0.26 * k, 0.08 * k, 0.16 * k); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1; g.strokeRect(px - 0.04 * k, base - 0.26 * k, 0.08 * k, 0.16 * k);
      // tapered pole with satin metal gradient
      gr = g.createLinearGradient(px - 0.05 * k, 0, px + 0.05 * k, 0); gr.addColorStop(0, '#171a1e'); gr.addColorStop(0.3, '#6a727c'); gr.addColorStop(0.55, '#2b3036'); gr.addColorStop(1, '#0f1215');
      g.fillStyle = gr; g.beginPath(); g.moveTo(px - 0.052 * k, base - 0.34 * k); g.lineTo(px + 0.052 * k, base - 0.34 * k); g.lineTo(px + 0.034 * k, 0.16 * k); g.lineTo(px - 0.034 * k, 0.16 * k); g.fill();
      // curved arm and flat luminaire
      g.strokeStyle = '#1a1d21'; g.lineWidth = 0.062 * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(px, 0.2 * k); g.quadraticCurveTo(px, 0.05 * k, px + 0.2 * k, 0.05 * k); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 0.014 * k; g.beginPath(); g.moveTo(px - 0.014 * k, 0.2 * k); g.quadraticCurveTo(px - 0.014 * k, 0.062 * k, px + 0.2 * k, 0.062 * k); g.stroke();
      const hx = px + 0.1 * k, hy = 0.03 * k, hw = 0.78 * k, hh = 0.075 * k;
      gr = g.createLinearGradient(0, hy, 0, hy + hh); gr.addColorStop(0, '#444b53'); gr.addColorStop(0.5, '#1d2126'); gr.addColorStop(1, '#0f1215'); g.fillStyle = gr; g.beginPath(); g.moveTo(hx, hy + 0.012 * k); g.lineTo(hx + hw, hy); g.lineTo(hx + hw - 0.02 * k, hy + hh); g.lineTo(hx + 0.02 * k, hy + hh + 0.012 * k); g.fill();
      g.fillStyle = '#f4fbff'; g.fillRect(hx + 0.05 * k, hy + hh - 0.004 * k, hw - 0.12 * k, 0.018 * k);             // LED diffuser
      const gl = g.createRadialGradient(hx + hw / 2, hy + hh + 0.04 * k, 0, hx + hw / 2, hy + hh + 0.04 * k, 0.5 * k); gl.addColorStop(0, 'rgba(255,248,215,.55)'); gl.addColorStop(1, 'rgba(255,248,215,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, Ht * 0.5);
      return { cv: c, w: W / DPR, h: (Ht + 6) / DPR, anchorX: px / DPR };
    })());
  }

  // ------------------------------------------------------------------ traffic cone
  function cone(ppu) {
    return once('cone@' + ppu, () => fromPhoto('cone', 0.4, ppu) || (() => {
      const k = ppu * DPR, W = 0.44 * k, Ht = 0.62 * k, [c, g] = mk(W, Ht), cx = W / 2, by = Ht - 0.07 * k;
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx + 0.02 * k, Ht - 0.012 * k, 0.24 * k, 0.03 * k, 0, 0, 6.283); g.fill();
      // black rubber base
      let gr = g.createLinearGradient(0, by - 0.02 * k, 0, Ht); gr.addColorStop(0, '#2a2d31'); gr.addColorStop(1, '#0c0d0f'); g.fillStyle = gr; g.beginPath(); g.moveTo(cx - 0.21 * k, Ht - 0.05 * k); g.lineTo(cx + 0.21 * k, Ht - 0.05 * k); g.lineTo(cx + 0.235 * k, Ht - 0.012 * k); g.lineTo(cx - 0.235 * k, Ht - 0.012 * k); g.fill(); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(cx - 0.21 * k, Ht - 0.052 * k, 0.42 * k, 0.012 * k);
      // body
      const body = (y1, y2, wTop, wBot) => { const gg = g.createLinearGradient(cx - wBot, 0, cx + wBot, 0); return [gg, y1, y2, wTop, wBot]; };
      const topY = 0.02 * k, botY = by, wTopB = 0.045 * k, wBotB = 0.185 * k;
      gr = g.createLinearGradient(cx - wBotB, 0, cx + wBotB, 0); gr.addColorStop(0, '#d94a00'); gr.addColorStop(0.28, '#ff8f33'); gr.addColorStop(0.55, '#ff6a0a'); gr.addColorStop(1, '#b33a00');
      g.fillStyle = gr; g.beginPath(); g.moveTo(cx - wTopB, topY); g.lineTo(cx + wTopB, topY); g.lineTo(cx + wBotB, botY); g.lineTo(cx - wBotB, botY); g.closePath(); g.fill();
      const wAt = (y) => lerp(wTopB, wBotB, (y - topY) / (botY - topY));
      // retro-reflective white bands
      for (const [y1, y2] of [[0.15 * k, 0.24 * k], [0.31 * k, 0.4 * k]]) {
        const a = wAt(y1), b = wAt(y2), g2 = g.createLinearGradient(cx - b, 0, cx + b, 0); g2.addColorStop(0, '#d7d9db'); g2.addColorStop(0.3, '#ffffff'); g2.addColorStop(0.6, '#eceeef'); g2.addColorStop(1, '#a9adb1');
        g.fillStyle = g2; g.beginPath(); g.moveTo(cx - a, y1); g.lineTo(cx + a, y1); g.lineTo(cx + b, y2); g.lineTo(cx - b, y2); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,.07)'; for (let i = 0; i < 40; i++) g.fillRect(cx - b + Math.random() * 2 * b, y1 + Math.random() * (y2 - y1), 1, 1);
      }
      g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(cx - wTopB * 0.5, topY); g.lineTo(cx - wTopB * 0.1, topY); g.lineTo(cx - wBotB * 0.5, botY); g.lineTo(cx - wBotB * 0.75, botY); g.fill();
      g.fillStyle = '#ff9a45'; g.beginPath(); g.ellipse(cx, topY, wTopB, 0.014 * k, 0, 0, 6.283); g.fill();
      return { cv: c, w: W / DPR, h: Ht / DPR, anchorX: cx / DPR };
    })());
  }

  // ------------------------------------------------------------------ pallet of red bricks on a wooden pallet
  function pallet(ppu) {
    return once('pallet@' + ppu, () => fromPhoto('pallet', 1.0, ppu) || (() => {
      const k = ppu * DPR, W = 1.0 * k, Ht = 0.62 * k, [c, g] = mk(W, Ht), r = rng(7);
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(W / 2, Ht - 1, W * 0.52, 0.03 * k, 0, 0, 6.283); g.fill();
      // wooden pallet: boards with grain, blocks and gaps
      const board = (x, y, w, h) => { const gg = g.createLinearGradient(0, y, 0, y + h); gg.addColorStop(0, '#d9b27a'); gg.addColorStop(1, '#a87d48'); g.fillStyle = gg; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(90,55,20,.35)'; g.lineWidth = 1; for (let i = 0; i < 5; i++) { const yy = y + (i + 1) * h / 6; g.beginPath(); g.moveTo(x, yy + (r() - 0.5) * 2); g.lineTo(x + w, yy + (r() - 0.5) * 2); g.stroke(); } g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + h - 1.5, w, 1.5); };
      const py = Ht - 0.16 * k; board(0, py, W, 0.045 * k); for (const bx of [0.03, 0.46, 0.91]) { g.fillStyle = '#9a6f3d'; g.fillRect(bx * k, py + 0.045 * k, 0.07 * k, 0.07 * k); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(bx * k + 0.055 * k, py + 0.045 * k, 0.015 * k, 0.07 * k); } board(0, py + 0.115 * k, W, 0.04 * k);
      // bricks: staggered, colour-jittered, with mortar gaps
      const bw = 0.155 * k, bh = 0.075 * k; let y = py;
      for (let row = 0; row < 6; row++) { y -= bh; for (let x = (row % 2 ? -bw / 2 : 0) + 0.02 * k; x < W - 0.02 * k; x += bw + 1.5) { const w2 = Math.min(bw, W - x - 0.02 * k); if (w2 < 4) continue; const t = r(); const col = [Math.round(176 + t * 36), Math.round(72 + t * 28), Math.round(46 + t * 18)]; const gg = g.createLinearGradient(0, y, 0, y + bh); gg.addColorStop(0, `rgb(${col[0] + 18},${col[1] + 12},${col[2] + 8})`); gg.addColorStop(1, `rgb(${col[0] - 22},${col[1] - 14},${col[2] - 10})`); g.fillStyle = gg; g.fillRect(Math.max(0, x), y, w2, bh - 1.5); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(Math.max(0, x), y, w2, 1.5); } }
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0.02 * k, py - 6 * bh + 2); g.lineTo(0.98 * k, py - 6 * bh + 2); g.stroke(); g.strokeStyle = 'rgba(60,60,60,.5)'; g.lineWidth = 2; for (const fx of [0.3, 0.7]) { g.beginPath(); g.moveTo(fx * k, py - 6 * bh); g.lineTo(fx * k, py); g.stroke(); }    // strapping band
      return { cv: c, w: W / DPR, h: Ht / DPR, anchorX: W / 2 / DPR };
    })());
  }

  // ------------------------------------------------------------------ site fence made of profiled steel sheet (profnastil)
  function fence(ppu) {
    return once('fence@' + ppu, () => fromPhoto('fence', 3.2, ppu) || (() => {
      const k = ppu * DPR, W = 3.2 * k, Ht = 1.15 * k, [c, g] = mk(W, Ht), n = 36, rib = W / n;
      for (let i = 0; i < n; i++) { const gg = g.createLinearGradient(i * rib, 0, (i + 1) * rib, 0); gg.addColorStop(0, '#4d6e86'); gg.addColorStop(0.35, '#86a8c0'); gg.addColorStop(0.7, '#5d7f98'); gg.addColorStop(1, '#3f5f77'); g.fillStyle = gg; g.fillRect(i * rib, 0.04 * k, rib + 0.5, Ht - 0.04 * k); }
      g.fillStyle = '#2b3a47'; g.fillRect(0, 0, W, 0.05 * k); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(0, 0, W, 1.5);
      const sg = g.createLinearGradient(0, 0.04 * k, 0, Ht); sg.addColorStop(0, 'rgba(0,0,0,.22)'); sg.addColorStop(0.2, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = sg; g.fillRect(0, 0, W, Ht);
      g.fillStyle = '#273540'; for (const px of [0.02, 1.58, 3.14]) g.fillRect(px * k, 0, 0.05 * k, Ht);
      return { cv: c, w: W / DPR, h: Ht / DPR };
    })());
  }

  // ------------------------------------------------------------------ trees: silver birch and linden
  function tree(kind, ppu) {
    return once('tree' + kind + '@' + ppu, () => fromPhoto(kind, 2.4, ppu) || (() => {
      const k = ppu * DPR, W = 2.6 * k, Ht = 4.6 * k, [c, g] = mk(W, Ht), r = rng(kind === 'birch' ? 11 : 29), cx = W / 2, birch = kind === 'birch';
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(cx + 0.1 * k, Ht - 2, 0.7 * k, 0.07 * k, 0, 0, 6.283); g.fill();
      // trunk
      const tw = (birch ? 0.11 : 0.17) * k, ty = Ht - 0.02 * k, tt = Ht * (birch ? 0.3 : 0.4);
      let gr = g.createLinearGradient(cx - tw, 0, cx + tw, 0); if (birch) { gr.addColorStop(0, '#cfcfc8'); gr.addColorStop(0.4, '#f6f5ef'); gr.addColorStop(1, '#a9a99f'); } else { gr.addColorStop(0, '#4a3a2a'); gr.addColorStop(0.4, '#7a634a'); gr.addColorStop(1, '#33281c'); }
      g.fillStyle = gr; g.beginPath(); g.moveTo(cx - tw, ty); g.quadraticCurveTo(cx - tw * 0.7, (ty + tt) / 2, cx - tw * 0.55, tt); g.lineTo(cx + tw * 0.55, tt); g.quadraticCurveTo(cx + tw * 0.7, (ty + tt) / 2, cx + tw, ty); g.fill();
      if (birch) { g.fillStyle = '#2a2a2a'; for (let i = 0; i < 18; i++) { const y = tt + r() * (ty - tt), w = tw * (0.5 + r() * 1.1), x = cx - tw * 0.9 + r() * tw * 1.2; g.fillRect(x, y, w, 0.014 * k + r() * 0.012 * k); } }
      else { g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1; for (let i = 0; i < 26; i++) { const x = cx - tw * 0.85 + r() * tw * 1.7; g.beginPath(); g.moveTo(x, ty); g.lineTo(x + (r() - 0.5) * 6, tt + r() * 60); g.stroke(); } }
      // branches
      g.strokeStyle = birch ? '#8d8d82' : '#4a3a2a'; g.lineCap = 'round'; for (let i = 0; i < 7; i++) { const y = tt + i * (Ht * 0.06), s = i % 2 ? 1 : -1; g.lineWidth = tw * 0.4; g.beginPath(); g.moveTo(cx, y + 20); g.quadraticCurveTo(cx + s * 0.3 * k, y - 0.1 * k, cx + s * (0.6 + r() * 0.3) * k, y - 0.55 * k); g.stroke(); }
      // foliage: thousands of small leaves in clusters, shaded by height and by cluster depth
      const base = birch ? ['#4f8f2e', '#6bb23a', '#92d24f', '#b6e56a'] : ['#2f6f2a', '#3f8a35', '#5aa845', '#7fc65a'];
      const clusters = birch ? [[0, -0.5, 0.62], [-0.55, -0.2, 0.5], [0.55, -0.1, 0.52], [-0.3, -1.2, 0.5], [0.35, -1.3, 0.5], [0, -1.75, 0.42], [-0.7, -0.9, 0.38], [0.75, -0.8, 0.4]] : [[0, -0.6, 0.85], [-0.75, -0.2, 0.62], [0.75, -0.25, 0.64], [-0.45, -1.35, 0.62], [0.45, -1.4, 0.62], [0, -1.9, 0.5]];
      const fy0 = tt - 0.2 * k, drawLeaves = (x, y, rad, depth) => { for (let i = 0; i < 160; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * rad, lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d * 0.88, light = clamp01((-(ly - (y - rad)) / (2 * rad)) * 0.9 + 0.2 + (r() - 0.5) * 0.4 - depth * 0.25), ci = Math.min(3, Math.floor(light * 4)); g.fillStyle = base[ci]; g.beginPath(); g.ellipse(lx, ly, (birch ? 0.04 : 0.055) * k, (birch ? 0.028 : 0.04) * k, r() * 3, 0, 6.283); g.fill(); } };
      const clamp01 = (v) => Math.max(0, Math.min(0.999, v));
      for (const [dx, dy, rr] of clusters) { g.fillStyle = 'rgba(20,50,15,.35)'; g.beginPath(); g.ellipse(cx + dx * k + 0.03 * k, fy0 + dy * k + 0.05 * k, rr * k, rr * k * 0.9, 0, 0, 6.283); g.fill(); drawLeaves(cx + dx * k, fy0 + dy * k, rr * k, 0.5); }
      for (const [dx, dy, rr] of clusters) drawLeaves(cx + dx * k, fy0 + dy * k - 0.04 * k, rr * k * 0.72, 0);
      return { cv: c, w: W / DPR, h: Ht / DPR, anchorX: cx / DPR };
    })());
  }

  // ------------------------------------------------------------------ distant Moscow skyline (panel blocks, brick stalinka with spire, glass towers)
  function city(layer, ppu, wUnits) {
    return once('city' + layer + '@' + ppu + '@' + wUnits, () => {
      const far = layer === 0, kk = Math.min(DPR, 1.5), k = ppu * kk, W = wUnits * k, floorH = (far ? 0.2 : 0.36) * k, maxFloors = far ? 22 : 16, Hc = (far ? 7.2 : 8.6) * k + 20, [c, g] = mk(W, Hc), r = rng(far ? 5 : 17), base = Hc - 2;
      const kinds = ['panel', 'panel', 'brick', 'glass', 'panel', 'stalin'];
      for (let x = r() * 0.3 * k, i = 0; x < W; i++) {
        const kind = kinds[Math.floor(r() * kinds.length)], floors = kind === 'stalin' ? 17 : kind === 'glass' ? 12 + Math.floor(r() * 10) : 5 + Math.floor(r() * (maxFloors - 4)), bw = (kind === 'stalin' ? 1.9 : kind === 'glass' ? 1.5 : 1.7 + r() * 1.4) * (far ? 0.62 : 1) * k * 0.78, bh = Math.min(floors * floorH, Hc - 16);
        const y0 = base - bh; let gr;
        if (kind === 'panel') {
          const wall = ['#d8d1c4', '#cfc8bb', '#dfdbd0', '#c9c4ba'][Math.floor(r() * 4)]; gr = g.createLinearGradient(x, 0, x + bw, 0); gr.addColorStop(0, sh(wall, 0.08)); gr.addColorStop(1, sh(wall, -0.12)); g.fillStyle = gr; g.fillRect(x, y0, bw, bh);
          g.strokeStyle = 'rgba(0,0,0,.09)'; g.lineWidth = 1; for (let yy = y0; yy < base; yy += floorH) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + bw, yy); g.stroke(); }
          const cols = Math.max(3, Math.round(bw / (0.2 * k * (far ? 0.7 : 1)))), cw = bw / cols; g.strokeStyle = 'rgba(0,0,0,.07)'; for (let cI = 0; cI <= cols; cI += 2) { g.beginPath(); g.moveTo(x + cI * cw, y0); g.lineTo(x + cI * cw, base); g.stroke(); }
          for (let f = 0; f < floors - 1; f++) for (let cI = 0; cI < cols; cI++) { const wx = x + cI * cw + cw * 0.2, wy = y0 + f * floorH + floorH * 0.22; const lit = r() < 0.12; g.fillStyle = lit ? '#ffe9a8' : '#4c7599'; g.fillRect(wx, wy, cw * 0.6, floorH * 0.5); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(wx, wy, cw * 0.6, 1); if (cI % 3 === 1 && !far) { g.fillStyle = 'rgba(80,90,100,.55)'; g.fillRect(x + cI * cw + cw * 0.05, wy + floorH * 0.36, cw * 0.9, floorH * 0.18); } }
          g.fillStyle = sh(wall, -0.2); g.fillRect(x - 1, y0 - 3, bw + 2, 4); g.fillStyle = ['#c0603a', '#5a8fc0', '#8fb06a'][i % 3]; g.fillRect(x + bw * 0.45, y0, bw * 0.1, bh);
        } else if (kind === 'brick') {
          gr = g.createLinearGradient(x, 0, x + bw, 0); gr.addColorStop(0, '#a85a3c'); gr.addColorStop(1, '#7c3f29'); g.fillStyle = gr; g.fillRect(x, y0, bw, bh); g.strokeStyle = 'rgba(0,0,0,.12)'; for (let yy = y0; yy < base; yy += 5) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + bw, yy); g.stroke(); }
          const cols = Math.max(3, Math.round(bw / (0.22 * k))), cw = bw / cols; for (let f = 0; f < floors - 1; f++) for (let cI = 0; cI < cols; cI++) { const wx = x + cI * cw + cw * 0.22, wy = y0 + f * floorH + floorH * 0.2; g.fillStyle = '#f2ede2'; g.fillRect(wx - 1, wy - 1, cw * 0.56 + 2, floorH * 0.55 + 2); g.fillStyle = r() < 0.1 ? '#ffe9a8' : '#35607f'; g.fillRect(wx, wy, cw * 0.56, floorH * 0.55); }
          g.fillStyle = '#e8dfcc'; g.fillRect(x - 2, y0 - 4, bw + 4, 5);
        } else if (kind === 'glass') {
          gr = g.createLinearGradient(x, y0, x + bw, base); gr.addColorStop(0, '#7fb4e6'); gr.addColorStop(0.5, '#4f86bd'); gr.addColorStop(1, '#2e5d8e'); g.fillStyle = gr; g.fillRect(x, y0, bw, bh);
          g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(x, base); g.lineTo(x + bw * 0.55, y0); g.lineTo(x + bw * 0.8, y0); g.lineTo(x + bw * 0.25, base); g.fill(); g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1; for (let yy = y0; yy < base; yy += floorH) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + bw, yy); g.stroke(); } for (let xx = x; xx <= x + bw; xx += bw / 4) { g.beginPath(); g.moveTo(xx, y0); g.lineTo(xx, base); g.stroke(); }
          g.fillStyle = '#2a3f55'; g.fillRect(x + bw * 0.4, y0 - 12, 2, 12);
        } else {   // stalinka: stepped body, spire with star
          gr = g.createLinearGradient(x, 0, x + bw, 0); gr.addColorStop(0, '#e2cfa2'); gr.addColorStop(1, '#b49a68'); g.fillStyle = gr; g.fillRect(x, y0 + bh * 0.35, bw, bh * 0.65); g.fillRect(x + bw * 0.14, y0 + bh * 0.15, bw * 0.72, bh * 0.25); g.fillRect(x + bw * 0.3, y0 + bh * 0.05, bw * 0.4, bh * 0.14);
          g.fillStyle = '#7fa98f'; g.beginPath(); g.moveTo(x + bw * 0.34, y0 + bh * 0.06); g.lineTo(x + bw * 0.5, y0 - bh * 0.18); g.lineTo(x + bw * 0.66, y0 + bh * 0.06); g.fill(); g.fillStyle = '#d9b84a'; g.fillRect(x + bw * 0.495, y0 - bh * 0.28, 2, bh * 0.12); g.beginPath(); g.arc(x + bw * 0.5, y0 - bh * 0.29, 3, 0, 6.283); g.fill();
          g.fillStyle = '#4a6c88'; const cols = Math.max(4, Math.round(bw / (0.2 * k))), cw = bw / cols; for (let f = 0; f < floors - 1; f++) for (let cI = 0; cI < cols; cI++) { const wy = y0 + bh * 0.4 + f * floorH * 0.6; if (wy < base - floorH) g.fillRect(x + cI * cw + cw * 0.25, wy, cw * 0.5, floorH * 0.38); }
        }
        x += bw + (0.1 + r() * 0.5) * k * (far ? 0.4 : 0.6);
      }
      // atmospheric haze: far layer is washed into the sky
      const hz = g.createLinearGradient(0, 0, 0, Hc); hz.addColorStop(0, `rgba(220,238,250,${far ? 0.55 : 0.28})`); hz.addColorStop(1, `rgba(220,238,250,${far ? 0.75 : 0.45})`); g.globalCompositeOperation = 'source-atop'; g.fillStyle = hz; g.fillRect(0, 0, W, Hc);
      return { cv: c, w: W / kk, h: Hc / kk, base: base / kk };
    });
  }

  window.TowerProps = { lamp, cone, pallet, fence, tree, city, clear: () => cache.clear() };
})();
