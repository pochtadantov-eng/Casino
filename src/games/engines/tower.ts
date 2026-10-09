import { Engine, GameError, HOUSE_EDGE, floor2 } from './types';

/**
 * Tower (skill): the hook swings on a rope, the player taps to release the house.
 * The swing is a pure function of SERVER time, so the phone only draws what the server computes:
 *   x(t) = AMP * sin(2π (t - swingStart) / period(step))
 * A tap succeeds when the house is released within `tol(step)` of the tower axis. Windows shrink and the swing speeds up
 * with every floor. There is no hidden randomness: the outcome is decided by timing alone (and verified here, never on the phone).
 */
export const TOWER = {
  maxSteps: 20,             // floors 1-10 are the sky ladder; 11-20 climb into space: tiny windows, slowly growing payouts
  amp: 1.6,                 // swing amplitude, world units (a house is 2 wide)
  spaceFrom: 10,            // floors from this index on are 'space'
  spaceGrowth: 1.15,        // payout multiplies by this per floor in space (the skyward ladder is x1.25 per floor)
  firstDelay: 3400,         // ms from round start until the first swing is live (intro + crane arrival)
  nextDelay: 2500,          // ms from a landing until the next swing is live
  maxLat: 250,              // ms of network latency the server compensates for
  ladderP: 0.8,             // success rate the payout ladder is priced for (see scripts/tower-rtp.mjs)
};

// swing period (ms) and accepted release distance from the axis (world units). Easy for floors 1-3, clearly harder from floor 4, tiny in space.
export const periodAt = (step: number) => (step < 3 ? 3000 - 150 * step : step < TOWER.spaceFrom ? 2550 - 130 * (step - 3) : Math.max(1050, 1700 - 70 * (step - TOWER.spaceFrom)));
export const tolAt = (step: number) => (step < 3 ? 0.3 - 0.016 * step : step < TOWER.spaceFrom ? 0.252 - 0.02 * (step - 3) : Math.max(0.05, 0.12 - 0.0075 * (step - TOWER.spaceFrom)));
export const swingX = (t: number, swingStart: number, step: number) => TOWER.amp * Math.sin((2 * Math.PI * (t - swingStart)) / periodAt(step));
export const towerMultiplier = (picks: number) =>
  picks === 0 ? 1
  : picks <= TOWER.spaceFrom ? floor2((1 - HOUSE_EDGE) * Math.pow(1 / TOWER.ladderP, picks))
  : floor2((1 - HOUSE_EDGE) * Math.pow(1 / TOWER.ladderP, TOWER.spaceFrom) * Math.pow(TOWER.spaceGrowth, picks - TOWER.spaceFrom));

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
};
