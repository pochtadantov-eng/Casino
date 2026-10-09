import { Engine, GameError, floor2 } from './types';

/**
 * Tower (skill): the hook swings on a rope, the player taps to release the house.
 * The swing is a pure function of SERVER time, so the phone only draws what the server computes:
 *   x(t) = AMP * sin(2π (t - swingStart) / period(step))
 * The house lands exactly where it was released (x), so the tower can lean and zigzag. After every landing the stack must still balance:
 * for each level j, the centre of mass of all houses above it has to stay within `levelLim(j)` of that level's own centre, otherwise
 * everything above the weakest level collapses. Higher levels have tighter limits and the swing speeds up with every floor.
 * There is no hidden randomness: the outcome is decided by timing alone (and verified here, never on the phone).
 */
export const TOWER = {
  maxSteps: 20,             // floors 1-10 are the sky ladder; 11-20 climb into space: tiny windows, slowly growing payouts
  easyFloors: 5,            // the pink-and-white house (floor 5) pays exactly x2
  easyMult: 2,
  hw: 1.9,                  // house width, world units (must match the client scene)
  amp: 1.6,                 // swing amplitude, world units (a house is 2 wide)
  spaceFrom: 10,            // floors from this index on are 'space'
  spaceGrowth: 1.1,         // payout multiplies by this per floor in space
  ladderGrowth: 1.2,        // per floor between the pink house (x2) and floor 10
  firstDelay: 2700,         // ms from round start until the first swing is live (intro + crane arrival)
  nextDelay: 2500,          // ms from a landing until the next swing is live
  maxLat: 250,              // ms of network latency the server compensates for
};

// swing period (ms) and accepted release distance from the axis (world units). Floor 1 is easy, floors 2-3 already need care, tiny windows in space.
export const periodAt = (step: number) => step === 0 ? 3000 : step === 1 ? 2400 : step === 2 ? 2100 : step < TOWER.spaceFrom ? Math.max(1250, 2000 - 90 * (step - 3)) : Math.max(1050, 1400 - 35 * (step - TOWER.spaceFrom));
// how far (fraction of half a house width) the centre of mass above level j may sit from that level's centre; tightens with every level
const LIM = [0.5, 0.4, 0.3, 0.24, 0.19, 0.15, 0.12, 0.1, 0.085, 0.07];
export const levelLim = (j: number) => Math.max(0.05, LIM[j] ?? 0.07 * Math.pow(0.93, j - 9));
export const tolAt = (step: number) => levelLim(step) * TOWER.hw / 2;
/** per level j (0 = the base house): the interval the NEXT house's x has to fall in so that level j still holds */
export function levelRanges(full: number[]): [number, number][] {
  const m = full.length - 1, out: [number, number][] = [];
  for (let j = 0; j <= m; j++) {
    const cnt = m + 1 - j, d = levelLim(j) * TOWER.hw / 2; let sum = 0;
    for (let i = j + 1; i <= m; i++) sum += full[i];
    out.push([(full[j] - d) * cnt - sum, (full[j] + d) * cnt - sum]);
  }
  return out;
}
export const swingX = (t: number, swingStart: number, step: number) => TOWER.amp * Math.sin((2 * Math.PI * (t - swingStart)) / periodAt(step));
export const towerMultiplier = (picks: number) =>
  picks === 0 ? 1
  : picks <= TOWER.easyFloors ? floor2(Math.pow(TOWER.easyMult, picks / TOWER.easyFloors))
  : picks <= TOWER.spaceFrom ? floor2(TOWER.easyMult * Math.pow(TOWER.ladderGrowth, picks - TOWER.easyFloors))
  : floor2(TOWER.easyMult * Math.pow(TOWER.ladderGrowth, TOWER.spaceFrom - TOWER.easyFloors) * Math.pow(TOWER.spaceGrowth, picks - TOWER.spaceFrom));

interface State {
  picks: number;
  swingStart: number;
  offsets: number[];        // x of every landed house above the base (the base sits at 0)
  last: { x: number; ok: boolean; miss: boolean; collapse: number | null; tol: number } | null;
}
const ranges = (offsets: number[] = []) => {
  const lv = levelRanges([0, ...offsets]);
  return { lv, lo: Math.max(...lv.map((r) => r[0])), hi: Math.min(...lv.map((r) => r[1])) };
};

export const tower: Engine<State> = {
  id: 'tower',
  init(_params, _rng, now) {
    return { state: { picks: 0, swingStart: now + TOWER.firstDelay, offsets: [], last: null }, multiplier: 1 };
  },
  act(state, input, now) {
    if (!input?.tap) return { status: 'active', multiplier: towerMultiplier(state.picks), state };   // plain poll
    if (now < state.swingStart) throw new GameError('Too early');
    const lat = Math.min(TOWER.maxLat, Math.max(0, Number(input.lat) || 0));
    const t = Math.max(state.swingStart, now - lat);
    const x = swingX(t, state.swingStart, state.picks), top = (state.offsets ?? [])[(state.offsets ?? []).length - 1] ?? 0;
    const { lv, lo, hi } = ranges(state.offsets), xr = Math.round(x * 1000) / 1000;
    const miss = Math.abs(x - top) > TOWER.hw * 0.9;                    // no overlap with the house below: it just falls beside the tower
    const j = miss ? -1 : lv.findIndex((r) => x < r[0] || x > r[1]);   // lowest level that cannot carry the new weight: everything above it falls
    const ok = !miss && j === -1;
    const last = { x: xr, ok, miss, collapse: j >= 0 ? j : null, tol: Math.round(((hi - lo) / 2) * 1000) / 1000 };
    if (!ok) return { status: 'lost', multiplier: 0, state: { ...state, last } };
    const picks = state.picks + 1;
    return { status: picks >= TOWER.maxSteps ? 'won' : 'active', multiplier: towerMultiplier(picks), state: { picks, swingStart: now + TOWER.nextDelay, offsets: [...(state.offsets ?? []), xr], last } };
  },
  cashout(state) {
    if (state.picks < 1) throw new GameError('Make at least one move');
    return { status: 'won', multiplier: towerMultiplier(state.picks), state };
  },
  view(state, _status, now) {
    const { lv, lo, hi } = ranges(state.offsets);
    return {
      picks: state.picks, maxSteps: TOWER.maxSteps, last: state.last, serverNow: now, offsets: state.offsets ?? [], hw: TOWER.hw,
      limits: lv, range: [lo, hi],
      multipliers: Array.from({ length: TOWER.maxSteps }, (_, i) => towerMultiplier(i + 1)),
      swing: { start: state.swingStart, period: periodAt(state.picks), amp: TOWER.amp, tol: Math.max(0, (hi - lo) / 2) },
    };
  },
  debug(state) { return { picks: state.picks, swingStart: state.swingStart, period: periodAt(state.picks), offsets: state.offsets, range: ranges(state.offsets) }; },
};
