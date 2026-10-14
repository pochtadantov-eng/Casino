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
    return { slug: ref.slug, name: c.name, n: it.n, model: it.m, backdrop: it.b, symbol: it.s, rgb: it.c, img: it.img };
  }
  const html = (ref, cls) => { const g = get(ref); return g ? `<span class="fg ${cls || ''}" style="--fgc:${g.rgb.join(',')}"><img src="${g.img}" alt="${g.name}" draggable="false"></span>` : ''; };
  return { pick, get, html, has: () => Object.keys(C).length > 0 };
})();
