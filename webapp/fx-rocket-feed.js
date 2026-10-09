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

  // nicknames: lowercase handles that look like real Telegram usernames — a chaotic mix
  function makeNick(r) {
    const letters = 'abcdefghijklmnopqrstuvwxyz', vowels = 'aeiouy', cons = 'bcdfghklmnprstvwxz';
    const randChars = (len) => { let s = ''; for (let i = 0; i < len; i++) s += (i % 2 ? vowels : cons)[Math.floor(r() * (i % 2 ? vowels.length : cons.length))]; return s; };
    const chunk = (len) => { let s = ''; for (let i = 0; i < len; i++) s += letters[Math.floor(r() * letters.length)]; return s; };
    const n = pick(FIRST, r), form = r();
    if (form < 0.14) return n;                                    // bare name
    if (form < 0.3)  return n + Math.floor(10 + r() * 989);       // ivan23
    if (form < 0.42) return n + '_' + Math.floor(70 + r() * 40);  // sasha_94
    if (form < 0.52) return n + '_' + pick(CITIES, r);            // misha_spb
    if (form < 0.6)  return n + '.' + 'rkmvbtlpdg'[Math.floor(r() * 10)];  // kate.m
    if (form < 0.72) {                                            // fredy_mayerttown45 — name + fake-word + number
      const parts = ['town', 'kov', 'off', 'mayer', 'kin', 'enko', 'shin', 'ich', 'oglu', 'yan', 'eck'];
      return n + '_' + randChars(3) + pick(parts, r) + Math.floor(10 + r() * 90);
    }
    if (form < 0.85) {                                            // eqorkhikk38 — random letter soup + number
      return chunk(6 + Math.floor(r() * 3)) + Math.floor(10 + r() * 90);
    }
    if (form < 0.93) {                                            // mmuuuuur — repeated letters
      const base = chunk(2), rep = letters[Math.floor(r() * letters.length)].repeat(3 + Math.floor(r() * 4));
      return base + rep + chunk(2);
    }
    return 'e' + Math.floor(r() * 10) + chunk(5);                 // e1dnejx — digit sandwiched
  }

  // generic "no profile picture" silhouette, with the background colour tinted per user id
  const AV_PALETTE = ['#5b9bd5', '#e8768f', '#f0b35a', '#4fbfa8', '#9b7bd4', '#e67e5a', '#5a9d6a', '#d44a7b', '#4a8ac4', '#c9815e', '#7fa847', '#b964c6', '#4bb5c9', '#dc9a3c', '#7e78d1', '#da5a5a', '#3faa88', '#c15d9a', '#6a8fd1', '#d6823a', '#5fa14e', '#a86cd1', '#5aa9b8', '#e8a04a', '#8e86dc', '#d26868', '#4ba893', '#be6ba5', '#5a94c7', '#c89148', '#71aa5a', '#b57ad1', '#4fb0b8', '#e2984a', '#8b85d1', '#d87070', '#4ea890', '#c278a0', '#5a97c2', '#cb8c54'];
  const avCache = new Map();
  function makeAvatar(seed) {
    if (avCache.has(seed)) return avCache.get(seed);
    const size = 128, dpr = 2, c = document.createElement('canvas');
    c.width = c.height = size * dpr; const g = c.getContext('2d'); g.scale(dpr, dpr);
    g.fillStyle = AV_PALETTE[seed % AV_PALETTE.length];
    g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, 6.283); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(size / 2, size * 0.4, size * 0.19, 0, 6.283); g.fill();                // head
    g.beginPath(); g.ellipse(size / 2, size * 1.0, size * 0.38, size * 0.42, 0, Math.PI, 2 * Math.PI); g.fill();   // shoulders
    const url = c.toDataURL(); avCache.set(seed, url); return url;
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

  // varied stakes: a mix of round numbers (50, 100, 500...) and odd ones (1378, 938, 294...)
  function sampleBet(r) {
    if (r() < 0.35) return pick([10, 20, 25, 50, 50, 100, 100, 200, 250, 300, 500, 500, 1000, 1500, 2000], r);
    let v = 12 * Math.pow(300, Math.pow(r(), 1.15));                 // ~12..3600, log-spread
    const k = r(); if (k < 0.3) v = Math.round(v / 10) * 10; else if (k < 0.45) v = Math.round(v / 5) * 5; else v = Math.round(v);
    return Math.max(10, v);
  }
  // cash-out target: some bail out immediately, some in the middle, some hold high, some chase moon (and usually lose)
  function sampleTarget(r) {
    const u = r();
    if (u < 0.30) return 1.05 + r() * 0.45;
    if (u < 0.58) return 1.5 + r() * 1.0;
    if (u < 0.80) return 2.5 + r() * 2.5;
    if (u < 0.93) return 5 + r() * 10;
    return 15 + Math.abs(gaussian(r)) * 40;
  }

  class RocketFeed {
    constructor(root) {
      this.root = root; this.entries = []; this.queue = []; this.t0 = 0; this.seedBase = Date.now(); this.liveM = 1; this.me = null;
    }
    reset() { for (const e of this.entries) e.el.remove(); this.entries = []; this.queue = []; this.me = null; this.liveM = 1; }
    // user = { name, photo, bet, auto } — the player is always the first row; other players join after
    start(user) {
      this.t0 = performance.now();
      if (user) this.addMe(user);
      const n = 8 + Math.floor(Math.pow(Math.random(), 1.2) * 43);   // 8..50 people this round
      const spread = 3000 + Math.random() * 7000;
      this.queue = Array.from({ length: n }, () => Math.pow(Math.random(), 1.6) * spread).sort((a, b) => a - b);
    }
    makeRow(entry, nick, avatarCss) {
      const el = document.createElement('div'); el.className = 'rrow enter' + (entry.me ? ' me' : '');
      el.innerHTML = `<div class="rav" style="background-image:url('${avatarCss}')"></div><div class="rmid"><div class="rnick"></div><div class="rbet"><span>${entry.bet} ⭐</span>${entry.target ? `<span class="rtarget">цель x${entry.target.toFixed(2)}</span>` : ''}</div></div><div class="rst"></div>`;
      el.querySelector('.rnick').textContent = nick;
      entry.el = el; entry.stEl = el.querySelector('.rst');
      requestAnimationFrame(() => el.classList.remove('enter'));
    }
    addMe(u) {
      const e = { id: 0, me: true, bet: u.bet, target: u.auto || 0, state: 'in', atX: null };
      const av = u.photo || makeAvatar(7);
      this.makeRow(e, u.name || 'Вы', av);
      this.me = e; this.setStatus(e, 1); this.entries.unshift(e); this.root.prepend(e.el);
    }
    userWon(m) { const e = this.me; if (e && e.state === 'in') { e.state = 'won'; e.atX = m; this.setStatus(e, m); } }
    spawn(mNow = 1) {
      const id = ++this.seedBase, r = rng(id);
      const target = sampleTarget(r); let bet = sampleBet(r);
      if (target > 4) bet = Math.max(10, Math.round(bet / 2));
      const won = target <= mNow;                                  // joined late and already out
      const entry = { id, bet, target, state: won ? 'won' : 'in', atX: won ? target : null };
      this.makeRow(entry, makeNick(r), makeAvatar(id));
      this.setStatus(entry, mNow);
      this.entries.push(entry);
      const first = this.root.children[this.me ? 1 : 0];            // newest right after the player's own row
      this.root.insertBefore(entry.el, first || null);
      const idx = this.entries.indexOf(this.me); if (idx > -1) { this.entries.splice(idx, 1); this.entries.unshift(this.me); }
    }
    setStatus(e, m) {
      if (e.state === 'in') e.stEl.innerHTML = `<span class="r-in">x${m.toFixed(2)}</span>`;
      else if (e.state === 'won') e.stEl.innerHTML = `<span class="r-win">+${Math.floor(e.bet * e.atX - e.bet)} ⭐<em>x${e.atX.toFixed(2)}</em></span>`;
      else e.stEl.innerHTML = `<span class="r-lose">−${e.bet} ⭐</span>`;
    }
    tick(m, flying) {
      if (flying) {
        const dt = performance.now() - this.t0;
        while (this.queue.length && this.queue[0] <= dt) { this.queue.shift(); this.spawn(m); }
        for (const e of this.entries) {
          if (e.state === 'in' && e.target && m >= e.target) { e.state = 'won'; e.atX = e.target; this.setStatus(e, m); }
          else if (e.state === 'in') this.setStatus(e, m);
        }
      }
      this.liveM = m;
    }
    crash(cp) {
      this.queue = [];
      for (const e of this.entries) if (e.state === 'in') { e.state = 'lost'; e.atX = cp; this.setStatus(e, cp); }
      this.liveM = cp;
    }
  }
  window.RocketFeed = RocketFeed;
})();
