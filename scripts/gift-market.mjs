// Runs in GitHub Actions (full internet). For many Fragment gift collections: floor price, per-MODEL floor prices
// (real listings, non-black backdrop preferred) and one thumbnail per offer. Output: market.json (+ log).
// Usage: node gift-market.mjs out_dir   env: COLLS=slug,slug (default: all), MAXMODELS, BUDGET_MIN
import { writeFileSync, mkdirSync } from 'node:fs';
let sharp = null; try { sharp = (await import('sharp')).default; } catch (e) { console.log('no sharp'); }
const out = process.argv[2] || '_gm'; mkdirSync(out, { recursive: true });
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' };
const T0 = Date.now(), BUDGET = (+process.env.BUDGET_MIN || 11) * 60e3, left = () => BUDGET - (Date.now() - T0);
const MAXMODELS = +process.env.MAXMODELS || 60;
const get = async (url, kind = 'text', tries = 3) => {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) }); if (r.status === 429) { await new Promise((z) => setTimeout(z, 1500 * (i + 1))); continue; } if (!r.ok) return null; return kind === 'json' ? await r.json() : kind === 'buf' ? Buffer.from(await r.arrayBuffer()) : await r.text(); } catch { await new Promise((z) => setTimeout(z, 500)); }
  }
  return null;
};
const pool = async (items, fn, k = 8) => { const res = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: k }, async () => { while (i < items.length) { const j = i++; res[j] = await fn(items[j], j); } })); return res; };
const PRICE = /icon-ton">\s*([\d,]+)(?:<span class="mini-frac">(\.\d+)<\/span>)?/;
const grid = (html, slug) => (html || '').split('class="tm-grid-item"').slice(1).map((b) => { const m = new RegExp(`/gift/${slug}-(\\d+)`).exec(b), p = PRICE.exec(b); return m && p ? { n: +m[1], ton: parseFloat(p[1].replace(/,/g, '') + (p[2] ?? '')) } : null; }).filter((x) => x && x.ton > 0);
const section = (html, key) => { const marks = ['model', 'backdrop', 'symbol'].map((k) => [k, html.indexOf(`attr-${k} js-main-filters-box`)]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]); const me = marks.findIndex(([k]) => k === key); if (me < 0) return ''; return html.slice(marks[me][1], marks[me + 1] ? marks[me + 1][1] : html.length); };
const attrs = (html, key) => { const sec = section(html, key); return [...sec.matchAll(/js-attribute-item" data-keywords="([^"]*)" data-value="([^"]*)"[\s\S]*?tm-main-filters-count">\s*([\d,]+)/g)].map((m) => ({ name: m[2], count: +m[3].replace(/,/g, '') })); };
const DARK = /black|onyx|carbon|midnight|graphite|jet/i;
const unq = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'");

const index = await get('https://fragment.com/gifts');
let colls = [...(index || '').matchAll(/js-choose-collection-item" data-keywords="([^"]*)" data-value="([a-z0-9]+)"/g)].map((m) => ({ slug: m[2], plural: unq(m[1]) })).filter((c) => c.slug);
if (process.env.COLLS) colls = process.env.COLLS.split(',').map((s) => colls.find((c) => c.slug === s) || { slug: s, plural: s });
console.log('collections', colls.length);
const rates = await get('https://tonapi.io/v2/rates?tokens=ton&currencies=usd,rub', 'json');
const result = { at: new Date().toISOString(), tonUsd: rates?.rates?.TON?.prices?.USD ?? null, tonRub: rates?.rates?.TON?.prices?.RUB ?? null, collections: [] };

// pass 1: floor of every collection
await pool(colls, async (c) => {
  const html = await get(`https://fragment.com/gifts/${c.slug}?sort=price_asc&filter=sale`);
  const g = grid(html, c.slug); c.floor = g.length ? Math.min(...g.map((x) => x.ton)) : null; c.listed = g.length; c._html = html;
}, 6);
colls = colls.filter((c) => c.floor);
console.log('with floor', colls.length, colls.slice(0, 5).map((c) => c.slug + ':' + c.floor).join(' '));

// pass 2: real per-item ask prices (asc + desc + recently listed), then attributes and a thumbnail for a spread of items
const PER = +process.env.PER || 16;
const order = colls.sort((a, b) => a.floor - b.floor);
for (const c of order) {
  if (left() < 45e3) { console.log('budget reached before', c.slug); break; }
  const price = new Map();
  for (const q of ['?sort=price_asc&filter=sale', '?sort=price_desc&filter=sale', '?sort=listed&filter=sale']) {
    const h = q.includes('asc') && c._html ? c._html : await get(`https://fragment.com/gifts/${c.slug}${q}`);
    for (const x of grid(h, c.slug)) if (!price.has(x.n)) price.set(x.n, x.ton);
  }
  const FULL = !!process.env.FULL, all = [...price].map(([n, ton]) => ({ n, ton })).filter((x) => x.ton <= c.floor * (FULL ? 3 : 2.2) + 3).sort((a, b) => a.ton - b.ton);
  const pickI = new Set(); for (let k = 0; k < Math.min(PER, all.length); k++) pickI.add(Math.round(k * (all.length - 1) / Math.max(1, Math.min(PER, all.length) - 1)));
  const chosen = FULL ? all.slice(0, 160) : [...pickI].map((i) => all[i]);
  const rec = { slug: c.slug, name: c.plural, floor: c.floor, listed: all.length, max: all.length ? all[all.length - 1].ton : null, items: [] };
  await pool(chosen, async (it) => {
    if (left() < 20e3) return;
    const j = await get(`https://nft.fragment.com/gift/${c.slug}-${it.n}.json`, 'json'); if (!j) return;
    const at = (t) => (j.attributes || []).find((a) => a.trait_type === t)?.value || '';
    const o = { n: it.n, ton: it.ton, model: at('Model'), backdrop: at('Backdrop'), symbol: at('Symbol') };
    if (FULL) { rec.items.push(o); return; }
    try {
      const buf = await get(`https://nft.fragment.com/gift/${c.slug}-${it.n}.webp`, 'buf'); if (buf && sharp) {
        const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const q = Math.floor(info.width * 0.08), px = (x, y) => { const f = (y * info.width + x) * 4; return [data[f], data[f + 1], data[f + 2]]; };
        const cs = [px(q, q), px(info.width - 1 - q, q), px(q, info.height - 1 - q), px(info.width - 1 - q, info.height - 1 - q)];
        o.c = [0, 1, 2].map((i) => Math.round(cs.reduce((s, p) => s + p[i], 0) / 4)); o.lum = Math.round(0.2126 * o.c[0] + 0.7152 * o.c[1] + 0.0722 * o.c[2]);
        o.img = 'data:image/webp;base64,' + (await sharp(buf).resize(88).webp({ quality: 58 }).toBuffer()).toString('base64');
      }
    } catch (e) { o.imgErr = String(e).slice(0, 60); }
    rec.items.push(o);
  }, FULL ? 16 : 8);
  console.log(c.slug, 'floor', c.floor, 'listed', all.length, 'max', rec.max, 'items', rec.items.length, Math.round((Date.now() - T0) / 1000) + 's');
  result.collections.push(rec);
  writeFileSync(out + '/market.json', JSON.stringify(result));
}
writeFileSync(out + '/market.json', JSON.stringify(result));
console.log('done', result.collections.length, 'collections');
