// Actions-only smoke test: runs the real MarketService against the live internet and writes the result.
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { MarketService } from '../src/market/market.service';
async function main() {
const m = new MarketService();
const out: any = {};
out.rates = await m.getRates();
for (const slug of ['hexpot-10348', 'plushpepe-1', 'bad slug!']) {
  try { const g = await m.getGift(slug); out[slug] = g; } catch (e) { out[slug] = 'ERR ' + e; }
}
try { out.lottieBytes = (await m.getLottie('hexpot-10348')).length; } catch (e) { out.lottieBytes = 'ERR ' + e; }
writeFileSync(process.argv[2] ?? 'market.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out).slice(0, 800));
}
main().catch((e) => { console.error(e); process.exit(1); });
