// Monte-Carlo of the skill Tower: RTP for players of different timing precision and cash-out targets.
// Usage: npm run build && node scripts/tower-rtp.mjs
import { createRequire } from 'node:module';
const { TOWER, periodAt, tolAt, swingX, towerMultiplier } = createRequire(import.meta.url)('../dist/games/engines/tower.js');
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
// a player aims at the centre crossing (x = 0) but is off by N(0, sigma) ms; sigma = Infinity means a random tap
function play(sigma, target) {
  for (let step = 0; step < TOWER.maxSteps; step++) {
    const P = periodAt(step); let t;
    if (sigma === Infinity) t = Math.random() * P; else t = P / 2 + gauss() * sigma;          // swingStart = 0, x(P/2) = 0
    if (Math.abs(swingX(t, 0, step)) > tolAt(step)) return 0;
    if (step + 1 >= target) return towerMultiplier(step + 1);
  }
  return towerMultiplier(TOWER.maxSteps);
}
const N = 200000, sigmas = [Infinity, 300, 150, 80, 40, 15, 0], targets = [1, 3, 5, 10];
console.log('RTP (payout / bet) by timing error (rows) and cash-out floor (columns).  House edge in the ladder: 3%.');
console.log('timing error'.padEnd(16) + targets.map((t) => ('cash@' + t).padStart(10)).join(''));
for (const s of sigmas) {
  const row = targets.map((t) => { let sum = 0; for (let i = 0; i < N; i++) sum += play(s, t); return ((sum / N) * 100).toFixed(0) + '%'; });
  console.log((s === Infinity ? 'random tap' : s === 0 ? 'perfect (bot)' : '±' + s + ' ms').padEnd(16) + row.map((r) => r.padStart(10)).join(''));
}
console.log('\nsuccess chance per floor for a ±80 ms player:', [0, 1, 2, 4, 6, 8, 9].map((k) => { let ok = 0; for (let i = 0; i < 20000; i++) if (Math.abs(swingX(periodAt(k) / 2 + gauss() * 80, 0, k)) <= tolAt(k)) ok++; return `#${k + 1}:${((ok / 20000) * 100).toFixed(0)}%`; }).join(' '));
