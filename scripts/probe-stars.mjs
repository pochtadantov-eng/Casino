// Actions-only: verify how to read the Stars price (TON per N stars) from Fragment.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0' };
const pr = await fetch('https://fragment.com/stars/buy', { headers: UA });
const cookie = (pr.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
const page = await pr.text();
try { const js = await (await fetch('https://fragment.com/js/main-aj.js?76', { headers: UA })).text(); const i = js.indexOf('apiRequest'); writeFileSync((process.argv[2] || 'stars.json').replace('stars.json', 'mainaj.txt'), js.slice(Math.max(0, i - 200), i + 2500)); } catch {}
const hash = /"apiUrl":"\\\/api\?hash=([0-9a-f]+)"/.exec(page)?.[1];
const out = { cookie: cookie.length, hash: hash ? hash.slice(0, 6) + '…' : null, calls: [] };
for (const q of [50, 1000, 10000]) {
  const body = new URLSearchParams({ stars: '', quantity: String(q), method: 'updateStarsPrices' });
  const r = await fetch(`https://fragment.com/api?hash=${hash}`, { method: 'POST', headers: { ...UA, 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest', cookie, origin: 'https://fragment.com', referer: 'https://fragment.com/stars/buy' }, body });
  out.calls.push({ q, status: r.status, text: (await r.text()).slice(0, 1200) });
}
writeFileSync(process.argv[2] || 'stars.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out).slice(0, 600));

const sub = [];
for (const u of ['https://fragment.com/gifts/hexpot?sort=price_asc&filter=sale', 'https://fragment.com/gifts/hexpot?sort=listed&filter=sale', 'https://fragment.com/gift/hexpot-10348']) {
  const t = await (await fetch(u, { headers: { ...UA, cookie } })).text();
  const items = [...t.matchAll(/href="\/gift\/([a-z0-9-]+)" class="tm-grid-item"[\s\S]*?icon-ton">([\d.,]+)<\/div>\s*<div class="tm-grid-item-status[^"]*">([^<]*)</g)].slice(0, 6).map((m) => [m[1], m[2], m[3]]);
  const single = [...t.matchAll(/(tm-section-header-status|tm-section-header-text|icon-ton[^>]*>)([^<]{1,60})</g)].slice(0, 12).map((m) => m[2].trim());
  sub.push({ u, len: t.length, items, single });
}
writeFileSync((process.argv[2] || 'stars.json').replace('stars.json', 'floor.json'), JSON.stringify(sub, null, 1));
