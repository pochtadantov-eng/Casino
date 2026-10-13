// Actions-only: verify how to read the Stars price (TON per N stars) from Fragment.
import { writeFileSync } from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0' };
const page = await (await fetch('https://fragment.com/stars/buy', { headers: UA })).text();
const hash = /"apiUrl":"\\\/api\?hash=([0-9a-f]+)"/.exec(page)?.[1];
const out = { hash: hash ? hash.slice(0, 6) + '…' : null, calls: [] };
for (const q of [50, 1000, 10000]) {
  const body = new URLSearchParams({ stars: '', quantity: String(q), method: 'updateStarsPrices' });
  const r = await fetch(`https://fragment.com/api?hash=${hash}`, { method: 'POST', headers: { ...UA, 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest', origin: 'https://fragment.com', referer: 'https://fragment.com/stars/buy' }, body });
  out.calls.push({ q, status: r.status, text: (await r.text()).slice(0, 1200) });
}
writeFileSync(process.argv[2] || 'stars.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out).slice(0, 600));
