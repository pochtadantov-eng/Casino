import { Engine, GameError, floor2 } from './types';

/**
 * Tower (skill): the hook swings on a rope, the player taps to release the house.
 * The swing is a pure function of SERVER time, so the phone only draws what the server computes:
 *   x(t) = AMP * sin(2π (t - swingStart) / period(step))
 * A tap succeeds when the house is released within `tol(step)` of the top house (a green zone drawn on the roof). The swing speeds up and
 * the zone narrows slowly with every floor. A landed house is pulled most of the way to the zone centre, so the tower stays tidy.
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
  grace: 40,                // ms of forgiveness around a tap (timing jitter between phone, network and server)
  maxLat: 250,              // ms of network latency the server compensates for
};

// swing period (ms) and accepted release distance from the axis (world units). Floor 1 is easy, floors 2-3 already need care, tiny windows in space.
export const periodAt = (step: number) => step === 0 ? 3000 : step === 1 ? 2400 : step === 2 ? 2100 : step < TOWER.spaceFrom ? Math.max(1250, 2000 - 90 * (step - 3)) : Math.max(1050, 1400 - 35 * (step - TOWER.spaceFrom));
// half-width of the green zone around the top house (world units; a house is 1.9 wide): wide at first, narrowing slowly, then tiny in space
export const tolAt = (step: number) => step < TOWER.spaceFrom ? Math.max(0.1, 0.42 - 0.055 * step) : Math.max(0.06, 0.1 - 0.004 * (step - TOWER.spaceFrom));
export const SNAP = 0.3;      // a released house keeps only this share of its distance from the zone centre
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
const topOf = (offsets: number[] = []) => offsets[offsets.length - 1] ?? 0;

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
    const top = topOf(state.offsets), tol = tolAt(state.picks);
    const judge = (tt: number) => { const x = swingX(Math.max(state.swingStart, tt), state.swingStart, state.picks); return { x, ok: Math.abs(x - top) <= tol }; };
    // a tap is judged at its estimated moment and at +-GRACE ms around it (network jitter must never decide a round): the best of the three counts
    const cands = [t, t - TOWER.grace, t + TOWER.grace].map(judge), pick = cands.find((c) => c.ok) ?? cands[0];
    const ok = pick.ok, x = ok ? top + (pick.x - top) * SNAP : pick.x, xr = Math.round(x * 1000) / 1000;
    const last = { x: xr, ok, miss: !ok, collapse: null, tol };
    if (!ok) return { status: 'lost', multiplier: 0, state: { ...state, last } };
    const picks = state.picks + 1;
    return { status: picks >= TOWER.maxSteps ? 'won' : 'active', multiplier: towerMultiplier(picks), state: { picks, swingStart: now + TOWER.nextDelay, offsets: [...(state.offsets ?? []), xr], last } };
  },
  cashout(state) {
    if (state.picks < 1) throw new GameError('Make at least one move');
    return { status: 'won', multiplier: towerMultiplier(state.picks), state };
  },
  view(state, _status, now) {
    const top = topOf(state.offsets), tol = tolAt(state.picks);
    return {
      picks: state.picks, maxSteps: TOWER.maxSteps, last: state.last, serverNow: now, offsets: state.offsets ?? [], hw: TOWER.hw,
      range: [top - tol, top + tol], stress: 0,
      multipliers: Array.from({ length: TOWER.maxSteps }, (_, i) => towerMultiplier(i + 1)),
      swing: { start: state.swingStart, period: periodAt(state.picks), amp: TOWER.amp, tol },
    };
  },
  debug(state) { return { picks: state.picks, swingStart: state.swingStart, period: periodAt(state.picks), offsets: state.offsets, tol: tolAt(state.picks) }; },
};
