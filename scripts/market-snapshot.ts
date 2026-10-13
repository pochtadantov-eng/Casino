// Runs in the Pages workflow (full internet): writes static market data next to the demo build, so the demo shows live rates too.
//   <out>/market/rates                       – same JSON as the server route /market/rates
//   <out>/market/gift/<slug>/index.html      – same JSON as /market/gift/<slug>  (served for the URL without .json)
//   <out>/market/gift/<slug>/lottie          – the animation
import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { MarketService } from '../src/market/market.service';

const SHOWCASE = ['hexpot-10348', 'plushpepe-1'];

async function main() {
  const out = process.argv[2] ?? '_site';
  const m = new MarketService();
  mkdirSync(`${out}/market/gift`, { recursive: true });
  const rates = await m.getRates();
  writeFileSync(`${out}/market/rates`, JSON.stringify(rates));
  for (const slug of SHOWCASE) {
    try {
      const g = await m.getGift(slug);
      const lottie = await m.getLottie(slug);
      mkdirSync(`${out}/market/gift/${slug}`, { recursive: true });
      writeFileSync(`${out}/market/gift/${slug}/index.html`, JSON.stringify({ ...g, lottie: `market/gift/${slug}/lottie` }));
      writeFileSync(`${out}/market/gift/${slug}/lottie`, lottie);
    } catch (e) { console.warn('gift skipped', slug, String(e)); }
  }
  console.log('market snapshot:', JSON.stringify(rates));
}
main().catch((e) => { console.error(e); process.exit(0); });   // never fail the deploy because of market data
