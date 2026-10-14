// Runs in GitHub Actions (full internet). Samples valid gift numbers (model/backdrop/symbol) for chosen Fragment collections.
// Usage: node scripts/gift-catalog.mjs out_dir   (needs `npm i sharp` next to it)
import { writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
const out = process.argv[2] || '_gc'; mkdirSync(out + '/samples', { recursive: true });
const COLL = (process.env.COLLS || 'lolpop,deskcalendar,genielamp,libertyfigure,chillflame,eternalcandle,hangingstar,lightsword,lovecandle,spicedwine').split(',');
const UA = { 'user-agent': 'Mozilla/5.0' };
const getJ = async (slug, n) => { try { const r = await fetch(`https://nft.fragment.com/gift/${slug}-${n}.json`, { headers: UA, signal: AbortSignal.timeout(7000) }); if (!r.ok) return null; return await r.json(); } catch { return null; } };
const attr = (j, t) => (j.attributes || []).find((a) => a.trait_type === t)?.value || '';
const pool = async (items, fn, k = 12) => { const res = []; let i = 0; await Promise.all(Array.from({ length: k }, async () => { while (i < items.length) { const x = items[i++]; res.push(await fn(x)); } })); return res; };
const catalog = {}; const T0 = Date.now(), BUDGET = 8 * 60e3, left = () => BUDGET - (Date.now() - T0);
for (const slug of COLL) {
  console.log('start', slug, Math.round((Date.now() - T0) / 1000) + 's');
  if (left() < 0) break;
  const c = { slug, ok: false, items: [] };
  catalog[slug] = c;
  if (!(await getJ(slug, 1))) { c.err = 'no #1'; continue; }
  let hi = 1; for (const k of [10, 100, 1000, 10000, 100000, 1000000]) { if (await getJ(slug, k)) hi = k; else break; }
  let lo = hi, top = hi * 10; while (top - lo > Math.max(1, hi / 50)) { const mid = Math.floor((lo + top) / 2); if (await getJ(slug, mid)) lo = mid; else top = mid; }
  c.max = lo; c.ok = true;
  const seen = new Set(), picks = [];
  while (picks.length < 45 && seen.size < 200) { const n = 1 + Math.floor(Math.random() * lo); if (!seen.has(n)) { seen.add(n); picks.push(n); } }
  const got = await pool(picks, async (n) => {
    if (left() < 0) return null;
    const j = await getJ(slug, n); if (!j) return null;
    const it = { n, model: attr(j, 'Model'), backdrop: attr(j, 'Backdrop'), symbol: attr(j, 'Symbol') };
    try {
      const r = await fetch(`https://nft.fragment.com/gift/${slug}-${n}.webp`, { headers: UA, signal: AbortSignal.timeout(9000) }); const buf = Buffer.from(await r.arrayBuffer());
      const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const px = (x, y) => { const o = (y * info.width + x) * 4; return [data[o], data[o + 1], data[o + 2], data[o + 3]]; };
      const q = Math.floor(info.width * 0.08), corners = [px(q, q), px(info.width - 1 - q, q), px(q, info.height - 1 - q), px(info.width - 1 - q, info.height - 1 - q)];
      const m = [0, 1, 2, 3].map((i) => Math.round(corners.reduce((s, p) => s + p[i], 0) / 4));
      it.w = info.width; it.h = info.height; it.corner = m; it.lum = Math.round(0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]); it.bytes = buf.length;
      if (c.items.length + 1 <= 3) writeFileSync(`${out}/samples/${slug}-${n}.webp`, buf);
    } catch (e) { it.imgErr = String(e).slice(0, 80); }
    return it;
  });
  c.items = got.filter(Boolean);
  try { const r = await fetch(`https://fragment.com/file/gifts/${slug}/thumb.webp`, { headers: UA }); if (r.ok) writeFileSync(`${out}/samples/thumb-${slug}.webp`, Buffer.from(await r.arrayBuffer())); } catch {}
  console.log(slug, 'max', c.max, 'valid', c.items.length);
  writeFileSync(out + '/catalog.json', JSON.stringify(catalog));
}
writeFileSync(out + '/catalog.json', JSON.stringify(catalog));
