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

// pass 2: per-model floors (cheapest real listing per model)
const order = colls.sort((a, b) => a.floor - b.floor);
for (const c of order) {
  if (left() < 60e3) { console.log('budget reached before', c.slug); break; }
  const html = c._html || (await get(`https://fragment.com/gifts/${c.slug}`));
  const models = attrs(html || '', 'model').sort((a, b) => a.count - b.count).slice(0, MAXMODELS);
  const rec = { slug: c.slug, name: c.plural, floor: c.floor, models: [] };
  await pool(models, async (m) => {
    if (left() < 30e3) return;
    const h = await get(`https://fragment.com/gifts/${c.slug}?attr%5BModel%5D=${encodeURIComponent(m.name)}&sort=price_asc&filter=sale`);
    const items = grid(h, c.slug).sort((a, b) => a.ton - b.ton).slice(0, 5); if (!items.length) return;
    let pick = null;
    for (const it of items) { const j = await get(`https://nft.fragment.com/gift/${c.slug}-${it.n}.json`, 'json'); if (!j) continue; const at = (t) => (j.attributes || []).find((a) => a.trait_type === t)?.value || ''; const info = { n: it.n, ton: it.ton, model: at('Model'), backdrop: at('Backdrop'), symbol: at('Symbol') }; if (info.model && info.model !== m.name) continue; if (!pick) pick = info; if (!DARK.test(info.backdrop)) { pick = info; break; } }
    if (pick) rec.models.push({ ...pick, model: m.name, count: m.count, minTon: items[0].ton });
  }, 8);
  console.log(c.slug, 'floor', c.floor, 'models', models.length, 'priced', rec.models.length, Math.round((Date.now() - T0) / 1000) + 's');
  result.collections.push(rec);
  writeFileSync(out + '/market.json', JSON.stringify(result));
}
writeFileSync(out + '/market.json', JSON.stringify(result));
console.log('done', result.collections.length, 'collections');
