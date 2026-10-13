// Runs inside GitHub Actions (full internet). Collects TON/Stars rates and a sample NFT gift, writes probe.json.
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || 'probe.json';
const T = async (name, url, opts = {}) => {
  const t = Date.now();
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', accept: '*/*' }, signal: AbortSignal.timeout(15000), ...opts });
    const buf = Buffer.from(await r.arrayBuffer());
    const text = buf.toString('utf8');
    return { name, url, status: r.status, ms: Date.now() - t, bytes: buf.length, type: r.headers.get('content-type'), head: text.slice(0, 1500) };
  } catch (e) { return { name, url, error: String(e), ms: Date.now() - t }; }
};
const res = await Promise.all([
  T('coingecko-ton', 'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd,rub'),
  T('tonapi-rates', 'https://tonapi.io/v2/rates?tokens=ton&currencies=usd,rub'),
  T('toncenter-nothing', 'https://toncenter.com/api/v2/getMasterchainInfo'),
  T('fragment-gift-meta', 'https://nft.fragment.com/gift/hexpot-10348.json'),
  T('fragment-gift-lottie', 'https://nft.fragment.com/gift/hexpot-10348.lottie.json'),
  T('fragment-stars-buy', 'https://fragment.com/stars/buy'),
  T('fragment-gifts', 'https://fragment.com/gifts'),
  T('tme-nft-page', 'https://t.me/nft/hexpot-10348'),
]);
for (const [n, u] of [['stars-buy.html', 'https://fragment.com/stars/buy'], ['gifts.html', 'https://fragment.com/gifts'], ['gifts-hexpot.html', 'https://fragment.com/gifts/hexpot'], ['stars-sell.html', 'https://fragment.com/stars']]) {
  try { const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) }); writeFileSync(out.replace('probe.json', n), await r.text()); } catch (e) { writeFileSync(out.replace('probe.json', n), 'ERR ' + e); }
}
writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), results: res }, null, 1));
console.log(res.map((r) => `${r.name}: ${r.status ?? r.error} ${r.bytes ?? ''}`).join('\n'));
