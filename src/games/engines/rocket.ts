import { Rng } from '../../fair/fair';
import { Engine, GameError, HOUSE_EDGE, floor2 } from './types';

/** Multiplier grows as e^(GROWTH * ms): 2.7x after 10s, 20x after 30s. */
export const GROWTH = 0.0001;
export const MAX_CRASH = 1000;

export const multiplierAt = (ms: number) => floor2(Math.exp(GROWTH * Math.max(0, ms)));

/** P(crash >= m) = (1 - edge) / m, so cashing out at any fixed m has RTP 97%. */
export function crashPoint(rng: Rng): number {
  const u = rng.float();
  const raw = (1 - HOUSE_EDGE) / (1 - u);
  return Math.min(MAX_CRASH, Math.max(1, floor2(raw)));
}

interface State {
  /** shared round this bet belongs to */
  k?: number;
  crash: number;
  startedAt: number;
  auto: number | null;
  /** set once finished */
  cashedAt?: number;
}

/** Settles the round lazily from wall-clock time so a closed app can't dodge a crash. */
function settle(s: State, now: number): { status: 'active' | 'lost' | 'won'; multiplier: number; state: State } {
  const m = multiplierAt(now - s.startedAt);
  if (s.auto !== null && s.crash >= s.auto && m >= s.auto) {
    return { status: 'won', multiplier: s.auto, state: { ...s, cashedAt: s.auto } };
  }
  if (m >= s.crash) return { status: 'lost', multiplier: s.crash, state: s };
  return { status: 'active', multiplier: m, state: s };
}

export const rocket: Engine<State> = {
  id: 'rocket',
  init(params, rng, now) {
    const shared = params?._round as { k: number; crash: number; flightStart: number } | undefined;      // set by GamesService from the shared timeline, never from the client
    let auto: number | null = null;
    if (params?.autoCashout != null) {
      auto = Number(params.autoCashout);
      if (!Number.isFinite(auto) || auto < 1.01 || auto > MAX_CRASH) throw new GameError('Bad auto cashout');
      auto = floor2(auto);
    }
    if (shared) return { state: { k: shared.k, crash: shared.crash, startedAt: shared.flightStart, auto }, multiplier: 1 };
    return { state: { crash: crashPoint(rng), startedAt: now, auto }, multiplier: 1 };
  },
  act(state, _input, now) {
    return settle(state, now);
  },
  cashout(state, now) {
    if (now < state.startedAt) throw new GameError('Wait for the launch');
    const r = settle(state, now);
    if (r.status !== 'active') return r;
    return { status: 'won', multiplier: r.multiplier, state: { ...state, cashedAt: r.multiplier } };
  },
  view(state, status, now) {
    const base = { growth: GROWTH, startedAt: state.startedAt, serverNow: now, auto: state.auto, k: state.k ?? null };
    return status === 'active' ? base : { ...base, crash: state.crash, cashedAt: state.cashedAt ?? null };
  },
  debug(state, now) {
    const msElapsed = now - state.startedAt, msToCrash = Math.max(0, Math.round(Math.log(state.crash) / GROWTH * 1000) - msElapsed);
    return { crash: state.crash, auto: state.auto, cashedAt: state.cashedAt ?? null, msElapsed, msToCrash };
  },
};
