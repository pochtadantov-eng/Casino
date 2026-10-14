// Market helper: live TON / Stars rates, "≈ TON · $ · ₽" lines next to Star amounts, and NFT-gift cards with the real Fragment animation.
// Talks to the server routes /market/*; in demo mode (no server) it falls back to a public TON price and the standard Stars price.
(() => {
  const FALLBACK = { tonUsd: 1.37, tonRub: 115, starTon: 0.01092, starUsd: 0.015, stale: true };
  let rates = { ...FALLBACK }, loaded = false;
  const nf = (n, d) => n.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
  const tonStr = (t) => nf(t, t < 1 ? 3 : t < 100 ? 2 : 0);

  async function load() {
    try {
      const r = await fetch('market/rates', { cache: 'no-store' });
      if (!r.ok) throw 0;
      const j = await r.json(); if (!(j.tonUsd > 0)) throw 0;
      rates = j;
    } catch {
      try {                                                    // demo / offline server: public TON price only
        const j = await (await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd,rub')).json();
        const p = j['the-open-network']; if (p?.usd > 0) rates = { ...FALLBACK, tonUsd: p.usd, tonRub: p.rub, starTon: FALLBACK.starUsd / p.usd };
      } catch {}
    }
    loaded = true; refresh();
  }
  const conv = (stars) => ({ ton: stars * rates.starTon, usd: stars * rates.starUsd, rub: stars * rates.starUsd * (rates.tonRub / rates.tonUsd) });
  const tonToStars = (ton) => Math.round(ton / rates.starTon);
  const line = (stars) => { const c = conv(stars); return `≈ ${tonStr(c.ton)} TON · $${nf(c.usd, c.usd < 10 ? 2 : 0)} · ₽${nf(c.rub, 0)}`; };
  const num = (el) => parseInt((el?.textContent || '').replace(/[^\d]/g, ''), 10) || 0;

  // ---- places that show Stars amounts ----
  function refresh() {
    const pb = document.getElementById('pbal');
    if (pb) { let x = document.getElementById('pbalx'); if (!x) { x = document.createElement('div'); x.id = 'pbalx'; x.className = 'mx-line'; pb.closest('.row')?.after(x); } x.textContent = line(num(pb)); }
    document.querySelectorAll('.resban.win span').forEach((s) => {
      const m = /\+\s*([\d\s]+)/.exec(s.textContent || ''); if (!m) return;
      const stars = parseInt(m[1].replace(/\s/g, ''), 10);
      let x = s.querySelector('small.mx'); if (!x) { x = document.createElement('small'); x.className = 'mx'; s.append(x); }
      const t = line(stars); if (x.textContent !== t) x.textContent = t;
    });
  }
  let raf = 0;
  new MutationObserver(() => { if (!loaded || raf) return; raf = requestAnimationFrame(() => { raf = 0; refresh(); }); })
    .observe(document.body, { childList: true, subtree: true, characterData: true });

  // ---- NFT gift card: real animation (lottie) + attributes + approximate price ----
  let lottiePromise;
  const loadLottie = () => lottiePromise ??= new Promise((ok, no) => {
    if (window.lottie) return ok(window.lottie);
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
    s.onload = () => ok(window.lottie); s.onerror = no; document.head.append(s);
  });
  async function giftCard(slug, host) {
    host.innerHTML = '<div class="nftc"><div class="nftc-anim"></div><div class="nftc-info"><b>Загрузка…</b></div></div>';
    const box = host.querySelector('.nftc-anim'), info = host.querySelector('.nftc-info');
    try {
      const g = await (await fetch('market/gift/' + encodeURIComponent(slug))).json();
      if (!g.slug) throw 0;
      const price = g.floor || g.lastSold;
      info.innerHTML = `<b>${g.name}</b><span>${[g.model, g.backdrop, g.symbol].filter(Boolean).join(' · ')}</span>`
        + (price ? `<em>≈ ${tonStr(price.ton)} TON · $${nf(price.usd, 2)} · ${nf(price.stars, 0)} ⭐</em><small>${g.floor ? 'минимум на Fragment' : 'по последним продажам'}, цена ориентировочная</small>` : '<small>цена не найдена</small>');
      try { const L = await loadLottie(); L.loadAnimation({ container: box, renderer: 'svg', loop: true, autoplay: true, path: g.lottie }); }
      catch { box.innerHTML = `<img src="${g.image}" alt="">`; }
    } catch { info.innerHTML = '<b>Подарок не найден</b>'; }
  }
  window.Market = { load, rates: () => rates, conv, line, giftCard, tonToStars };
  load(); setInterval(load, 5 * 60_000);
  const q = new URLSearchParams(location.search).get('gift');           // ?gift=hexpot-10348 shows a gift card (handy for checks)
  if (q) { const d = document.createElement('div'); d.className = 'nftc-demo'; d.onclick = () => d.remove(); document.body.append(d); giftCard(q, d); }
})();
