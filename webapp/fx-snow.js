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
})();
