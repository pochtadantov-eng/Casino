// "Snow continent" backdrop: night sky with aurora, mountain ridges and gentle snowfall behind the whole app. Pure decoration (pointer-events: none).
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bg = document.createElement('div'); bg.className = 'snowbg';
  bg.innerHTML = `<i class="aur a1"></i><i class="aur a2"></i><i class="stars"></i>
  <svg class="ridge" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 160V96l38-34 30 26 44-52 46 62 34-30 52 56 40-38 50 44 36-28 30 24V160z" fill="#16384f" opacity=".7"/>
    <path d="M0 160v-44l30-22 36 30 38-36 46 44 40-26 44 34 46-30 40 28 40-20 40 22V160z" fill="#1c4a66" opacity=".85"/>
    <path d="M0 160v-20l46-18 52 20 60-22 70 20 60-16 112 18V160z" fill="#e9f7ff" opacity=".9"/>
  </svg><canvas class="flakes"></canvas>`;
  document.body.prepend(bg);
  const cv = bg.querySelector('canvas'), g = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, flakes = [];
  const fit = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const make = () => ({ x: Math.random() * W, y: Math.random() * H, r: 0.8 + Math.random() * 2.2, v: 14 + Math.random() * 26, d: Math.random() * 6.28, s: 0.3 + Math.random() * 0.8 });
  fit(); addEventListener('resize', () => { fit(); flakes = flakes.map(make); });
  flakes = Array.from({ length: reduce ? 0 : 60 }, make);
  let last = performance.now();
  const frame = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    const n = document.body.classList.contains('ingame') ? 22 : flakes.length;       // fewer flakes inside games: the scenes need the CPU
    g.clearRect(0, 0, W, H); g.fillStyle = '#fff';
    for (let i = 0; i < n; i++) {
      const f = flakes[i]; f.y += f.v * dt; f.d += dt * f.s; f.x += Math.sin(f.d) * 12 * dt;
      if (f.y > H + 4) { f.y = -4; f.x = Math.random() * W; }
      g.globalAlpha = 0.35 + f.r / 4; g.beginPath(); g.arc(f.x, f.y, f.r, 0, 6.283); g.fill();
    }
    requestAnimationFrame(frame);
  };
  if (!reduce) requestAnimationFrame(frame);

  // ---- icicles hanging from the top edge of cards and panels (snow cap + ice), edge frost and twinkling glints ----
  const strip = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="42" viewBox="0 0 120 42"><defs><linearGradient id="i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#bff1ff"/><stop offset="1" stop-color="#5fb8f2" stop-opacity=".75"/></linearGradient></defs>`
    + ['M5 6L13 6L9 31Z', 'M21 7L30 7L25.5 19Z', 'M39 7L48 7L43.5 38Z', 'M57 6L65 6L61 15Z', 'M71 7L80 7L75.5 27Z', 'M91 6L99 6L95 22Z', 'M105 7L114 7L109.5 34Z'].map((d) => `<path d="${d}" fill="url(#i)" stroke="#e8fbff" stroke-width=".6" stroke-linejoin="round"/>`).join('')
    + `<path d="M9 9L10 26M43.5 10L44.5 33" stroke="#fff" stroke-width="1" opacity=".8"/><path d="M0 0H120V7Q110 11.5 100 7.5T80 8.5T60 6.5T40 8.5T20 7.5T0 8.5Z" fill="#fff"/><path d="M0 8.5Q10 12 20 7.5T40 8.5T60 6.5" fill="none" stroke="#cfeeff" stroke-width="1" opacity=".7"/></svg>`;
  document.documentElement.style.setProperty('--ice', `url("data:image/svg+xml,${encodeURIComponent(strip)}")`);
  const SEL = '.card, .panel, .inv';
  const decorate = (root) => root.querySelectorAll?.(SEL).forEach((el) => { if (!el.querySelector(':scope > i.ice')) { const i = document.createElement('i'); i.className = 'ice'; el.prepend(i); } });
  decorate(document);
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches?.(SEL) && !n.querySelector(':scope > i.ice')) { const i = document.createElement('i'); i.className = 'ice'; n.prepend(i); } decorate(n); } }))).observe(document.body, { childList: true, subtree: true });
  const glints = Array.from({ length: 12 }, () => { const e = document.createElement('i'); e.className = 'glint'; e.style.cssText = `left:${Math.random() * 96}%;top:${Math.random() * 70}%;animation-delay:${(Math.random() * 5).toFixed(2)}s;animation-duration:${(2.5 + Math.random() * 3).toFixed(1)}s;--s:${(0.6 + Math.random() * 0.9).toFixed(2)}`; return e; });
  bg.append(...glints, Object.assign(document.createElement('i'), { className: 'frost' }));
})();
