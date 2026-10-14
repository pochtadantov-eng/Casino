import { Rng } from '../../fair/fair';
import { Engine, GameError, floor2 } from './types';

/* Plinko / Slot / Luck cases are one-shot games (instant engines); Dig is a crash-style descent. Pure maths, no node imports: the same file is bundled into the demo. */

/** Owner-only test setting (users.luck, -100..100): deal several states from the same seed and keep the best (luck > 0) or the worst (luck < 0) one. 0 = the normal fair game. */
export const LUCK_MAX_DRAWS = 400;
export function luckyInit<S>(engine: Engine<S>, params: any, rng: Rng, now: number, luckLevel: number) {
  const level = Math.max(-100, Math.min(100, Math.round(Number(luckLevel) || 0)));
  let best = engine.init(params, rng, now);
  if (!level || !engine.value) return best;
  const n = 1 + Math.round((Math.abs(level) / 100) * (LUCK_MAX_DRAWS - 1));
  for (let i = 1; i < n; i++) {
    const c = engine.init(params, rng, now);
    if (level > 0 ? engine.value(c.state) > engine.value(best.state) : engine.value(c.state) < engine.value(best.state)) best = c;
  }
  return best;
}

// ---------------- Plinko: 12 rows, 13 slots, the slot is the number of right bounces ----------------
export const PLINKO_ROWS = 12;
const half = (t: number[]) => [...t, ...t.slice(0, 6).reverse()];
export const PLINKO_TABLES: Record<string, number[]> = {
  low: half([13, 4, 1.8, 1.3, 1.1, 0.8, 0.5]),
  med: half([120, 14, 3.5, 1.6, 0.95, 0.5, 0.3]),
  high: half([300, 30, 5.5, 1.6, 0.5, 0.2, 0.2]),
};
interface PlinkoState { risk: string; path: number[]; slot: number; mult: number }
export const plinko: Engine<PlinkoState> = {
  id: 'plinko',
  instant: true,
  value: (st) => st.mult,
  init(params, rng) {
    const risk = String(params?.risk ?? 'med'); const table = PLINKO_TABLES[risk];
    if (!table) throw new GameError('Unknown variant');
    const path = Array.from({ length: PLINKO_ROWS }, () => rng.int(2));
    const slot = path.reduce((a, b) => a + b, 0);
    return { state: { risk, path, slot, mult: table[slot] }, multiplier: 1 };
  },
  act(state) { return { status: 'won', multiplier: state.mult, state }; },
  cashout() { throw new GameError('No active round'); },
  view(state, status) {
    const base = { risk: state.risk, rows: PLINKO_ROWS, table: PLINKO_TABLES[state.risk] };
    return status === 'active' ? base : { ...base, path: state.path, slot: state.slot };
  },
};

// ---------------- Slot 777: three reels, three of a kind pays, two cherries pay a little ----------------
export const SLOT_SYMBOLS = [
  { id: 'cherry', w: 30, pay: 5 }, { id: 'grape', w: 24, pay: 11 }, { id: 'bell', w: 18, pay: 22 }, { id: 'star', w: 14, pay: 44 },
  { id: 'diamond', w: 9, pay: 125 }, { id: 'bar', w: 5, pay: 380 }, { id: 'seven', w: 3, pay: 1400 },
];
export const SLOT_TWO_CHERRIES = 1.5;
const SLOT_W = SLOT_SYMBOLS.reduce((a, s) => a + s.w, 0);
export const slotPay = (reels: number[]) => {
  if (reels[0] === reels[1] && reels[1] === reels[2]) return SLOT_SYMBOLS[reels[0]].pay;
  return reels.filter((r) => r === 0).length === 2 ? SLOT_TWO_CHERRIES : 0;
};
const spin = (rng: Rng) => { let x = rng.int(SLOT_W); for (let i = 0; i < SLOT_SYMBOLS.length; i++) { if (x < SLOT_SYMBOLS[i].w) return i; x -= SLOT_SYMBOLS[i].w; } return 0; };
interface SlotState { reels: number[]; mult: number }
export const slot: Engine<SlotState> = {
  id: 'slot',
  instant: true,
  value: (st) => st.mult,
  init(_p, rng) { const reels = [spin(rng), spin(rng), spin(rng)]; return { state: { reels, mult: slotPay(reels) }, multiplier: 1 }; },
  act(state) { return state.mult > 0 ? { status: 'won', multiplier: state.mult, state } : { status: 'lost', multiplier: 0, state }; },
  cashout() { throw new GameError('No active round'); },
  view(state, status) {
    const base = { symbols: SLOT_SYMBOLS.map((s) => s.id), pays: SLOT_SYMBOLS.map((s) => s.pay), twoCherries: SLOT_TWO_CHERRIES };
    return status === 'active' ? base : { ...base, reels: state.reels };
  },
};

// ---------------- Luck cases: the higher the luck tier, the bigger (and rarer) the prize. The empty share is solved so every tier returns 92% ----------------
export const LUCK_EDGE = 0.08;
const LUCK_RAW: Record<number, [number, number][]> = {
  1: [[0.5, 40], [1, 30], [1.5, 18], [2, 8], [5, 3], [10, 1]],
  10: [[1, 25], [2, 25], [5, 20], [10, 15], [25, 10], [50, 5]],
  25: [[2, 25], [5, 25], [10, 20], [25, 15], [50, 10], [100, 5]],
  50: [[5, 25], [10, 25], [25, 20], [50, 15], [100, 10], [250, 5]],
  100: [[10, 25], [25, 25], [50, 20], [100, 15], [250, 10], [500, 5]],
};
/** [multiplier, probability] pairs incl. the empty outcome (0x) */
export const LUCK_TABLES: Record<number, [number, number][]> = Object.fromEntries(Object.entries(LUCK_RAW).map(([k, raw]) => {
  const W = raw.reduce((a, [, w]) => a + w, 0), ev = raw.reduce((a, [m, w]) => a + m * w / W, 0), p0 = 1 - (1 - LUCK_EDGE) / ev;
  return [Number(k), [[0, p0], ...raw.map(([m, w]): [number, number] => [m, (1 - p0) * w / W])] as [number, number][]];
}));
interface LuckState { luck: number; idx: number; mult: number }
export const luck: Engine<LuckState> = {
  id: 'luck',
  instant: true,
  value: (st) => st.mult,
  init(params, rng) {
    const luckN = Number(params?.luck ?? 1); const t = LUCK_TABLES[luckN];
    if (!t) throw new GameError('Unknown variant');
    let x = rng.float(), idx = t.length - 1;
    for (let i = 0; i < t.length; i++) { if (x < t[i][1]) { idx = i; break; } x -= t[i][1]; }
    return { state: { luck: luckN, idx, mult: t[idx][0] }, multiplier: 1 };
  },
  act(state) { return state.mult > 0 ? { status: 'won', multiplier: state.mult, state } : { status: 'lost', multiplier: 0, state }; },
  cashout() { throw new GameError('No active round'); },
  view(state, status) {
    const base = { luck: state.luck, prizes: LUCK_TABLES[state.luck].map(([m, p]) => ({ mult: m, p: Math.round(p * 10000) / 10000 })) };
    return status === 'active' ? base : { ...base, idx: state.idx, mult: state.mult };
  },
};

// ---------------- Dig: the pick falls from the sky and bounces around the mine until its health runs out. Every ore it breaks adds money; cash out any time ----------------
export const DIG_INTRO = 1800;          // ms: the fall from the sky before the first block breaks
export const DIG_SEG = 28000;           // ms of pick health: 100 -> 0 (an upgrade block refills it)
const DIG_RATE = 0.295 / 1000;          // ore per ms
const DIG_TIERS: [string, number, number][] = [['coal', 0.55, 0.04], ['iron', 0.25, 0.08], ['gold', 0.12, 0.16], ['red', 0.05, 0.24], ['lapis', 0.02, 0.4], ['dia', 0.008, 0.8], ['em', 0.002, 1.6]];   // [ore, weight, multiplier it adds]; RTP about 94%
interface DigEvent { t: number; k: string; inc: number }
interface DigState { startedAt: number; ups: number[]; ore: DigEvent[]; endAt: number; cashedAt?: number }
const digMultAt = (s: DigState, el: number) => floor2(s.ore.reduce((a, e) => (e.t <= el ? a + e.inc : a), 0));
function digSettle(s: DigState, now: number): { status: 'active' | 'won'; multiplier: number; state: DigState } {
  const el = now - s.startedAt;
  return el >= s.endAt ? { status: 'won', multiplier: digMultAt(s, s.endAt), state: s } : { status: 'active', multiplier: digMultAt(s, el), state: s };
}
export const dig: Engine<DigState> = {
  id: 'dig',
  value: (st) => digMultAt(st, st.endAt),
  init(_p, rng, now) {
    const ups: number[] = [];
    if (rng.float() < 0.5) { ups.push(8000 + rng.float() * 14000); if (rng.float() < 0.25) ups.push(ups[0] + 8000 + rng.float() * 12000); }
    const endAt = (ups.length ? ups[ups.length - 1] : 0) + DIG_SEG;
    const ore: DigEvent[] = []; let t = 1200;
    for (;;) {
      t += -Math.log(1 - rng.float()) / DIG_RATE; if (t >= endAt - 800) break;
      let x = rng.float(), i = 0; while (i < DIG_TIERS.length - 1 && x >= DIG_TIERS[i][1]) { x -= DIG_TIERS[i][1]; i++; }
      ore.push({ t: Math.round(t), k: DIG_TIERS[i][0], inc: DIG_TIERS[i][2] });
    }
    return { state: { startedAt: now + DIG_INTRO, ups: ups.map(Math.round), ore, endAt: Math.round(endAt) }, multiplier: 0 };
  },
  act(state, _i, now) { return digSettle(state, now); },
  cashout(state, now) {
    if (now < state.startedAt) throw new GameError('Wait for the launch');
    const r = digSettle(state, now);
    return r.status !== 'active' ? r : { status: 'won', multiplier: r.multiplier, state: { ...state, cashedAt: r.multiplier } };
  },
  view(state, status, now) {
    const base = { seg: DIG_SEG, startedAt: state.startedAt, serverNow: now }, el = now - state.startedAt;
    return status === 'active'
      ? { ...base, ups: state.ups.filter((u) => u <= el + 3000), ore: state.ore.filter((e) => e.t <= el + 2500) }
      : { ...base, ups: state.ups, ore: state.ore, endAt: state.endAt, cashedAt: state.cashedAt ?? null };
  },
  debug(state, now) { return { endAt: state.endAt, total: digMultAt(state, state.endAt), ore: state.ore.length }; },
};
