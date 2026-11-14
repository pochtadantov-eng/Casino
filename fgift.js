/* Real Fragment gifts (Lol Pop / Desk Calendar / Chill Flame) with random model, backdrop and symbol. Data: gift-catalog.js */
window.FG = (function () {
  const C = window.FG_CATALOG || {};
  const W = [['lolpop', 5], ['deskcalendar', 3], ['chillflame', 3]];
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  const slugOk = (s) => C[s] && C[s].items.length;
  function pick(slug) {
    if (!slug || !slugOk(slug)) { const pool = W.filter(([s]) => slugOk(s)).flatMap(([s, w]) => Array(w).fill(s)); slug = rnd(pool.length ? pool : Object.keys(C)); }
    if (!slug || !C[slug]) return null;
    const it = rnd(C[slug].items); return { slug, n: it.n };
  }
  function get(ref) {
    if (!ref || !C[ref.slug]) return null;
    const c = C[ref.slug], it = c.items.find((x) => x.n === ref.n) || c.items[0];
    return { slug: ref.slug, name: c.name, n: it.n, model: it.m, backdrop: it.b, symbol: it.s, rgb: it.c, img: it.img, ton: it.p };
  }
  const html = (ref, cls) => { const g = get(ref); return g ? `<span class="fg ${cls || ''}" style="--fgc:${g.rgb.join(',')}"><img src="${g.img}" alt="${g.name}" draggable="false"></span>` : ''; };
  const stars = (ref) => { const g = get(ref); if (!g) return 0; return Math.max(1, window.Market && window.Market.tonToStars ? window.Market.tonToStars(g.ton) : Math.round(g.ton / 0.01092)); };
  // upgrade <span class="fg" data-slug data-n>: full-size picture from Fragment, then the real Lottie animation while the row is on screen
  const BASE = 'https://nft.fragment.com/gift/', live = [], MAXLIVE = 10; let io = null;
  const stop = (el) => { if (el._an) { try { el._an.destroy(); } catch {} el._an = null; } const l = el.querySelector('.lot'); if (l) l.remove(); const i = el.querySelector('img'); if (i) i.style.visibility = ''; const k = live.indexOf(el); if (k >= 0) live.splice(k, 1); };
  const start = async (el) => {
    if (el._an || el._busy || el._dead || live.length >= MAXLIVE) return; el._busy = 1;
    try {
      const L = await window.Market.loadLottie(); const r = await fetch(BASE + el.dataset.slug + '-' + el.dataset.n + '.lottie.json'); if (!r.ok) throw 0; const data = await r.json();
      if (!el.isConnected || !el._vis) return;
      const box = document.createElement('span'); box.className = 'lot'; el.append(box);
      el._an = L.loadAnimation({ container: box, renderer: 'svg', loop: true, autoplay: true, animationData: data });
      const i = el.querySelector('img'); if (i) i.style.visibility = 'hidden'; live.push(el);
    } catch { el._dead = 1; } finally { el._busy = 0; }
  };
  function upgrade(root) {
    if (!io && 'IntersectionObserver' in window) io = new IntersectionObserver((es) => es.forEach((e) => { e.target._vis = e.isIntersecting; e.isIntersecting ? start(e.target) : stop(e.target); }), { threshold: 0.4 });
    (root || document).querySelectorAll('.fg[data-slug]:not([data-up])').forEach((el) => {
      el.dataset.up = 1; const im = new Image(), t = el.querySelector('img'); im.onload = () => { if (t) t.src = im.src; }; im.src = BASE + el.dataset.slug + '-' + el.dataset.n + '.webp';
      if (io) io.observe(el);
    });
  }
  return { upgrade, pick, get, html, stars, has: () => Object.keys(C).length > 0 };
})();
