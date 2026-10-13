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
