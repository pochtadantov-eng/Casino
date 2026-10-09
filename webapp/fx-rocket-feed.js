// Live feed under the rocket: a list of players with bets, cash-out targets, and live outcomes.
// Realistic-looking Telegram-style nicks + varied painted face avatars (skin, hair, eyes, mouth
// seeded per player). Drop your own PNGs into webapp/img/avatars/ (av0.webp..av39.webp) and they
// replace the painted ones.
(() => {
  const FIRST = ['sasha', 'ivan', 'misha', 'daria', 'kate', 'nikita', 'anya', 'max', 'alex', 'pasha', 'lena', 'oleg', 'roman', 'yana', 'denis', 'kirill', 'nastya', 'vlad', 'sofia', 'arseniy', 'ira', 'valera', 'tanya', 'kolya', 'rita', 'sergey', 'liza', 'artem', 'marina', 'borya', 'olya', 'tim', 'veronika', 'yura', 'andrey', 'ksenia', 'ruslan', 'marta', 'gleb', 'ilya', 'polina', 'zhenya'];
  const CITIES = ['msk', 'spb', 'nsk', 'ekb', 'kzn', 'rnd', 'krd', 'ufa', 'smr', 'vlg', 'tmn', 'ktb'];
  const SKIN = ['#f3cfa5', '#efc5a0', '#e4b088', '#d49571', '#c07e5a', '#a06240', '#7a4a2e', '#f7d4b4'];
  const HAIR = ['#2a1d13', '#3b2a1a', '#59371f', '#8a4b1f', '#c57c2f', '#d9a24a', '#f0d26b', '#b0b5bc', '#1b1b1e', '#4c2a16', '#e8c591', '#5f3620'];
  const EYES = ['#273040', '#3f2c1a', '#1e5b7a', '#2f6a44', '#4a3524', '#1a2a3a', '#2b1a0f'];
  const SHIRT = ['#2a63d9', '#d94444', '#39a166', '#c58b1f', '#8641c7', '#1e8aa6', '#d14a84', '#4a5461'];

  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a, r) => a[Math.floor(r() * a.length)];
  const gaussian = (r) => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  // nicknames: lowercase handles that look like real Telegram usernames
  function makeNick(r) {
    const n = pick(FIRST, r), form = r();
    if (form < 0.18) return n;                                    // bare name
    if (form < 0.4)  return n + '_' + Math.floor(70 + r() * 40);  // sasha_94
    if (form < 0.55) return n + Math.floor(1 + r() * 999);        // ivan23
    if (form < 0.7)  return n + '.' + 'rkmvbtlpdg'[Math.floor(r() * 10)];  // kate.m
    if (form < 0.85) return n + '_' + pick(CITIES, r);            // misha_spb
    let n2 = pick(FIRST, r); if (n2 === n) n2 = FIRST[(FIRST.indexOf(n2) + 1) % FIRST.length]; return n2 + '_' + n;
  }

  // avatars: real portrait SVGs bundled with the app (webapp/img/avatars/av0.svg..av39.svg).
  // When they haven't finished loading we fall back to a painted cartoon face so nothing is empty.
  const avCache = new Map();
  const avUrl = (i) => (window.AV_SRC && window.AV_SRC['av' + i]) || `img/avatars/av${i}.svg` + (window.BUILD ? '?v=' + window.BUILD : '');

  function makeAvatar(seed) {
    if (avCache.has(seed)) return avCache.get(seed);
    const real = avUrl(seed % 40); avCache.set(seed, real); return real;
  }
  function paintedAvatar(seed) {                                   // fallback when SVGs are missing — not normally reached
    if (avCache.has('p' + seed)) return avCache.get('p' + seed);
    const r = rng(seed + 1), size = 72, c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    const bgA = pick(['#8b9bb4', '#c2a080', '#8ab09a', '#b89aa5', '#8aa0c2'], r), bgB = pick(['#5c6b85', '#8f7360', '#5c8878', '#916e7d', '#5c7290'], r);
    const bg = g.createLinearGradient(0, 0, 0, size); bg.addColorStop(0, bgA); bg.addColorStop(1, bgB); g.fillStyle = bg; g.fillRect(0, 0, size, size);
    const skin = pick(SKIN, r), hair = pick(HAIR, r), eye = pick(EYES, r), shirt = pick(SHIRT, r);
    // shoulders / shirt
    g.fillStyle = shirt; g.beginPath(); g.ellipse(size / 2, size * 1.02, size * 0.62, size * 0.42, 0, 0, Math.PI, true); g.fill();
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, size * 0.78, size, 1);
    // neck
    g.fillStyle = skin; g.fillRect(size * 0.42, size * 0.6, size * 0.16, size * 0.18);
    // head
    g.beginPath(); g.ellipse(size / 2, size * 0.47, size * 0.28, size * 0.33, 0, 0, 6.283); g.fill();
    // soft chin shadow
    g.fillStyle = 'rgba(0,0,0,.08)'; g.beginPath(); g.ellipse(size / 2, size * 0.68, size * 0.18, size * 0.06, 0, 0, 6.283); g.fill();
    // hair: pick one of several shapes
    g.fillStyle = hair;
    const style = Math.floor(r() * 6);
    const cx = size / 2, cy = size * 0.47, rx = size * 0.28, ry = size * 0.33;
    g.save();
    if (style === 0) {                                             // short cap
      g.beginPath(); g.ellipse(cx, cy - ry * 0.1, rx * 1.02, ry * 0.8, 0, Math.PI, 2 * Math.PI); g.fill();
    } else if (style === 1) {                                      // side-swept bangs
      g.beginPath(); g.moveTo(cx - rx, cy); g.quadraticCurveTo(cx - rx * 1.2, cy - ry, cx, cy - ry * 1.05); g.quadraticCurveTo(cx + rx * 1.3, cy - ry * 0.8, cx + rx * 1.1, cy - ry * 0.1); g.quadraticCurveTo(cx + rx * 0.4, cy - ry * 0.3, cx, cy - ry * 0.5); g.quadraticCurveTo(cx - rx * 0.6, cy - ry * 0.3, cx - rx, cy); g.closePath(); g.fill();
    } else if (style === 2) {                                      // long hair past shoulders
      g.beginPath(); g.ellipse(cx, cy, rx * 1.15, ry * 1.1, 0, 0, 6.283); g.fill();
      g.beginPath(); g.ellipse(cx - rx * 0.9, cy + ry * 0.5, rx * 0.4, ry * 0.6, -0.3, 0, 6.283); g.fill();
      g.beginPath(); g.ellipse(cx + rx * 0.9, cy + ry * 0.5, rx * 0.4, ry * 0.6, 0.3, 0, 6.283); g.fill();
      g.fillStyle = skin; g.beginPath(); g.ellipse(cx, cy + ry * 0.1, rx * 0.9, ry * 0.9, 0, 0, 6.283); g.fill(); g.fillStyle = hair;
    } else if (style === 3) {                                      // buzz cut
      g.beginPath(); g.ellipse(cx, cy - ry * 0.05, rx * 0.98, ry * 0.65, 0, Math.PI, 2 * Math.PI); g.fill();
    } else if (style === 4) {                                      // bun on top
      g.beginPath(); g.ellipse(cx, cy - ry * 0.1, rx * 1.0, ry * 0.75, 0, Math.PI, 2 * Math.PI); g.fill();
      g.beginPath(); g.arc(cx, cy - ry * 0.95, size * 0.08, 0, 6.283); g.fill();
    } else {                                                        // bald with brow line
      g.beginPath(); g.ellipse(cx, cy - ry * 0.3, rx * 0.6, ry * 0.14, 0, Math.PI, 2 * Math.PI); g.fill();
    }
    g.restore();
    // eyes
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx - rx * 0.35, cy + ry * 0.05, size * 0.055, size * 0.045, 0, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(cx + rx * 0.35, cy + ry * 0.05, size * 0.055, size * 0.045, 0, 0, 6.283); g.fill();
    g.fillStyle = eye; g.beginPath(); g.arc(cx - rx * 0.33, cy + ry * 0.08, size * 0.03, 0, 6.283); g.fill();
    g.beginPath(); g.arc(cx + rx * 0.37, cy + ry * 0.08, size * 0.03, 0, 6.283); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - rx * 0.3, cy + ry * 0.05, size * 0.012, 0, 6.283); g.fill();
    g.beginPath(); g.arc(cx + rx * 0.4, cy + ry * 0.05, size * 0.012, 0, 6.283); g.fill();
    // brows
    g.strokeStyle = hair; g.lineWidth = Math.max(1.5, size * 0.03); g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - rx * 0.55, cy - ry * 0.08); g.lineTo(cx - rx * 0.15, cy - ry * 0.12); g.stroke();
    g.beginPath(); g.moveTo(cx + rx * 0.15, cy - ry * 0.12); g.lineTo(cx + rx * 0.55, cy - ry * 0.08); g.stroke();
    // mouth
    g.strokeStyle = '#9c4a44'; g.lineWidth = Math.max(1.5, size * 0.025);
    const smile = 0.1 + r() * 0.25; g.beginPath(); g.arc(cx, cy + ry * 0.38, size * smile, 0.25, Math.PI - 0.25); g.stroke();
    // optional accessory: glasses
    if (r() < 0.2) {
      g.strokeStyle = '#2a2a2e'; g.lineWidth = Math.max(1.3, size * 0.022);
      g.beginPath(); g.arc(cx - rx * 0.35, cy + ry * 0.05, size * 0.085, 0, 6.283); g.stroke();
      g.beginPath(); g.arc(cx + rx * 0.35, cy + ry * 0.05, size * 0.085, 0, 6.283); g.stroke();
      g.beginPath(); g.moveTo(cx - rx * 0.26, cy + ry * 0.05); g.lineTo(cx + rx * 0.26, cy + ry * 0.05); g.stroke();
    }
    const url = c.toDataURL(); avCache.set('p' + seed, url); return url;
  }

  // target + bet together: most play safe and take 1.2-2x, a few hold for 2-4x, very few go higher
  // (losers tend to have small bets, as the user asked — small amounts, few people)
  function samplePlayer(r) {
    const u = r();
    if (u < 0.5)  return { target: 1.15 + r() * 0.25, bet: pick([50, 75, 100, 150, 200, 300, 500, 750], r) };  // ~out at 1.2-1.4 (nearly always wins, bigger bets)
    if (u < 0.75) return { target: 1.4  + r() * 0.5,  bet: pick([30, 50, 75, 100, 150, 250], r) };             // ~out at 1.5-1.9
    if (u < 0.9)  return { target: 1.9  + r() * 1.3,  bet: pick([25, 50, 75, 100, 150], r) };                  // ~out at 2-3.2
    if (u < 0.97) return { target: 3.2  + r() * 2.8,  bet: pick([20, 30, 50, 75], r) };                        // reach 3-6
    return { target: 6 + Math.abs(gaussian(r)) * 8, bet: pick([10, 15, 20, 25, 40], r) };                     // moon shot, tiny bets
  }

  class RocketFeed {
    constructor(root) {
      this.root = root; this.entries = []; this.lastSpawn = 0; this.seedBase = Date.now(); this.liveM = 1;
    }
    reset() { for (const e of this.entries) e.el.remove(); this.entries = []; this.lastSpawn = 0; this.liveM = 1; }
    start() { this.lastSpawn = performance.now() - 500; for (let i = 0; i < 4; i++) this.spawn(); }
    spawn() {
      const id = ++this.seedBase, r = rng(id), { bet, target } = samplePlayer(r), nick = makeNick(r), avatar = makeAvatar(id);
      const el = document.createElement('div'); el.className = 'rrow enter';
      el.innerHTML = `<img class="rav" src="${avatar}" alt=""><div class="rmid"><div class="rnick">${nick}</div><div class="rbet"><span>${bet} ⭐</span><span class="rtarget">цель x${target.toFixed(2)}</span></div></div><div class="rst"><span class="r-in">x1.00</span></div>`;
      const entry = { id, bet, target, state: 'in', atX: null, el, stEl: el.querySelector('.rst') };
      this.entries.unshift(entry); this.root.prepend(el);
      requestAnimationFrame(() => el.classList.remove('enter'));
      while (this.entries.length > 6) { const old = this.entries.pop(); old.el.remove(); }
    }
    setStatus(e, m) {
      if (e.state === 'in') e.stEl.innerHTML = `<span class="r-in">x${m.toFixed(2)}</span>`;
      else if (e.state === 'won') e.stEl.innerHTML = `<span class="r-win">+${Math.floor(e.bet * e.atX - e.bet)} ⭐<em>x${e.atX.toFixed(2)}</em></span>`;
      else e.stEl.innerHTML = `<span class="r-lose">−${e.bet} ⭐</span>`;
    }
    tick(m, flying) {
      if (flying) {
        const now = performance.now();
        if (now - this.lastSpawn > 600 + Math.random() * 900) { this.lastSpawn = now; this.spawn(); }
        for (const e of this.entries) {
          if (e.state === 'in' && m >= e.target) { e.state = 'won'; e.atX = e.target; this.setStatus(e, m); }
          else if (e.state === 'in') this.setStatus(e, m);
        }
      }
      this.liveM = m;
    }
    crash(cp) {
      for (const e of this.entries) if (e.state === 'in') { e.state = 'lost'; e.atX = cp; this.setStatus(e, cp); }
      this.liveM = cp;
    }
  }
  window.RocketFeed = RocketFeed;
})();
