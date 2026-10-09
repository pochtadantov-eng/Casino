import { Engine, GameError, HOUSE_EDGE, floor2 } from './types';

/**
 * Tower (skill): the hook swings on a rope, the player taps to release the house.
 * The swing is a pure function of SERVER time, so the phone only draws what the server computes:
 *   x(t) = AMP * sin(2π (t - swingStart) / period(step))
 * A tap succeeds when the house is released within `tol(step)` of the tower axis. Windows shrink and the swing speeds up
 * with every floor. There is no hidden randomness: the outcome is decided by timing alone (and verified here, never on the phone).
 */
export const TOWER = {
  maxSteps: 10,
  amp: 1.6,                 // swing amplitude, world units (a house is 2 wide)
  period0: 3000, periodStep: 150, periodMin: 1500,   // ms
  tol0: 0.30, tolStep: 0.016, tolMin: 0.13,            // accepted release distance from the axis
  firstDelay: 3400,         // ms from round start until the first swing is live (intro + crane arrival)
  nextDelay: 2500,          // ms from a landing until the next swing is live
  maxLat: 250,              // ms of network latency the server compensates for
  ladderP: 0.8,             // success rate the payout ladder is priced for (see scripts/tower-rtp.mjs)
};

export const periodAt = (step: number) => Math.max(TOWER.periodMin, TOWER.period0 - TOWER.periodStep * step);
export const tolAt = (step: number) => Math.max(TOWER.tolMin, TOWER.tol0 - TOWER.tolStep * step);
export const swingX = (t: number, swingStart: number, step: number) => TOWER.amp * Math.sin((2 * Math.PI * (t - swingStart)) / periodAt(step));
export const towerMultiplier = (picks: number) => (picks === 0 ? 1 : floor2((1 - HOUSE_EDGE) * Math.pow(1 / TOWER.ladderP, picks)));

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
