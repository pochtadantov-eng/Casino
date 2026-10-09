import { Engine, GameError, floor2 } from './types';

/**
 * Tower (skill): the hook swings on a rope, the player taps to release the house.
 * The swing is a pure function of SERVER time, so the phone only draws what the server computes:
 *   x(t) = AMP * sin(2π (t - swingStart) / period(step))
 * A tap succeeds when the house is released within `tol(step)` of the tower axis. Windows shrink and the swing speeds up
 * with every floor. There is no hidden randomness: the outcome is decided by timing alone (and verified here, never on the phone).
 */
export const TOWER = {
  maxSteps: 20,             // floors 1-10 are the sky ladder; 11-20 climb into space: tiny windows, slowly growing payouts
  easyFloors: 5,            // the pink-and-white house (floor 5) pays exactly x2
  easyMult: 2,
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
export const tolAt = (step: number) => step === 0 ? 0.3 : step === 1 ? 0.2 : step === 2 ? 0.15 : step < TOWER.spaceFrom ? Math.max(0.07, 0.13 - 0.01 * (step - 3)) : Math.max(0.04, 0.065 - 0.003 * (step - TOWER.spaceFrom));
export const swingX = (t: number, swingStart: number, step: number) => TOWER.amp * Math.sin((2 * Math.PI * (t - swingStart)) / periodAt(step));
export const towerMultiplier = (picks: number) =>
  picks === 0 ? 1
  : picks <= TOWER.easyFloors ? floor2(Math.pow(TOWER.easyMult, picks / TOWER.easyFloors))
  : picks <= TOWER.spaceFrom ? floor2(TOWER.easyMult * Math.pow(TOWER.ladderGrowth, picks - TOWER.easyFloors))
  : floor2(TOWER.easyMult * Math.pow(TOWER.ladderGrowth, TOWER.spaceFrom - TOWER.easyFloors) * Math.pow(TOWER.spaceGrowth, picks - TOWER.spaceFrom));

interface State {
  picks: number;
  swingStart: number;
  last: { x: number; ok: boolean; tol: number } | null;
}

export const tower: Engine<State> = {
  id: 'tower',
  init(_params, _rng, now) {
    return { state: { picks: 0, swingStart: now + TOWER.firstDelay, last: null }, multiplier: 1 };
  },
  act(state, input, now) {
    if (!input?.tap) return { status: 'active', multiplier: towerMultiplier(state.picks), state };   // plain poll
    if (now < state.swingStart) throw new GameError('Too early');
    const lat = Math.min(TOWER.maxLat, Math.max(0, Number(input.lat) || 0));
    const t = Math.max(state.swingStart, now - lat);
    const x = swingX(t, state.swingStart, state.picks), tol = tolAt(state.picks), ok = Math.abs(x) <= tol;
    const last = { x: Math.round(x * 1000) / 1000, ok, tol };
    if (!ok) return { status: 'lost', multiplier: 0, state: { ...state, last } };
    const picks = state.picks + 1;
    return { status: picks >= TOWER.maxSteps ? 'won' : 'active', multiplier: towerMultiplier(picks), state: { picks, swingStart: now + TOWER.nextDelay, last } };
  },
  cashout(state) {
    if (state.picks < 1) throw new GameError('Make at least one move');
    return { status: 'won', multiplier: towerMultiplier(state.picks), state };
  },
  view(state, _status, now) {
    return {
      picks: state.picks, maxSteps: TOWER.maxSteps, last: state.last, serverNow: now,
      multipliers: Array.from({ length: TOWER.maxSteps }, (_, i) => towerMultiplier(i + 1)),
      swing: { start: state.swingStart, period: periodAt(state.picks), amp: TOWER.amp, tol: tolAt(state.picks) },
    };
  },
  debug(state) { return { picks: state.picks, swingStart: state.swingStart, period: periodAt(state.picks), tol: tolAt(state.picks) }; },
};
