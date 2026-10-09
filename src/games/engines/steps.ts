import { Rng } from '../../fair/fair';
import { Engine, GameError, HOUSE_EDGE, floor2 } from './types';

/**
 * Generic "pick one of N each step, `bad` of them are deadly" game.
 * Tower and Seagull are both skins of this engine.
 * Survival chance per step = (N - bad) / N, multiplier after k steps = 0.97 * (N / (N - bad))^k.
 */
export interface StepsConfig {
  id: string;
  /** Allowed variants: name -> {choices, bad}. */
  variants: Record<string, { choices: number; bad: number }>;
  defaultVariant: string;
  maxSteps: number;
}

export const stepsMultiplier = (choices: number, bad: number, steps: number) =>
  steps === 0 ? 1 : floor2((1 - HOUSE_EDGE) * Math.pow(choices / (choices - bad), steps));

interface State {
  variant: string;
  choices: number;
  bad: number;
  maxSteps: number;
  /** deadly choices per step, decided up-front from the seed */
  deadly: number[][];
  picks: number[];
}

export function makeStepsEngine(cfg: StepsConfig): Engine<State> {
  const mult = (s: State, steps: number) => stepsMultiplier(s.choices, s.bad, steps);
  return {
    id: cfg.id,
    init(params, rng: Rng) {
      const variant = String(params?.variant ?? cfg.defaultVariant);
      const v = cfg.variants[variant];
      if (!v) throw new GameError('Unknown variant');
      const deadly: number[][] = [];
      for (let step = 0; step < cfg.maxSteps; step++) {
        const pool = Array.from({ length: v.choices }, (_, i) => i);
        const chosen: number[] = [];
        for (let i = 0; i < v.bad; i++) {
          const j = i + rng.int(v.choices - i);
          [pool[i], pool[j]] = [pool[j], pool[i]];
          chosen.push(pool[i]);
        }
        deadly.push(chosen.sort((a, b) => a - b));
      }
      return { state: { variant, ...v, maxSteps: cfg.maxSteps, deadly, picks: [] }, multiplier: 1 };
    },
    act(state, input) {
      const choice = Number(input?.choice);
      if (!Number.isInteger(choice) || choice < 0 || choice >= state.choices) throw new GameError('Bad choice');
      const step = state.picks.length;
      const next = { ...state, picks: [...state.picks, choice] };
      if (state.deadly[step].includes(choice)) return { status: 'lost', multiplier: 0, state: next };
      const done = next.picks.length === state.maxSteps;
      return { status: done ? 'won' : 'active', multiplier: mult(state, next.picks.length), state: next };
    },
    cashout(state) {
      if (state.picks.length < 1) throw new GameError('Make at least one move');
      return { status: 'won', multiplier: mult(state, state.picks.length), state };
    },
    view(state, status) {
      const base = {
        variant: state.variant,
        choices: state.choices,
        bad: state.bad,
        maxSteps: state.maxSteps,
        picks: state.picks,
        multipliers: Array.from({ length: state.maxSteps }, (_, i) => mult(state, i + 1)),
      };
      return status === 'active' ? base : { ...base, deadly: state.deadly };
    },
    debug(state) { return { deadly: state.deadly, picks: state.picks, variant: state.variant }; },
  };
}

/** Seagull: it flies over 3 kids and snatches one. Guess a kid it will NOT take. The further, the bigger the x. */
export const seagull = makeStepsEngine({
  id: 'seagull',
  variants: { classic: { choices: 3, bad: 1 } },
  defaultVariant: 'classic',
  maxSteps: 12,
});
