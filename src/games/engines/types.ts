import { Rng } from '../../fair/fair';

export const HOUSE_EDGE = 0.03; // RTP 97%

export class GameError extends Error {}

export type RoundStatus = 'active' | 'lost' | 'won';

export interface StepResult<S = any> {
  state: S;
  status: RoundStatus;
  /** Current (or final, if won) multiplier. Payout = floor(bet * multiplier). */
  multiplier: number;
}

export interface Engine<S = any> {
  id: string;
  init(params: any, rng: Rng, now: number): { state: S; multiplier: number };
  /** Player action (reveal / pick / poll). */
  act(state: S, input: any, now: number): StepResult<S>;
  /** Player tries to take the money. */
  cashout(state: S, now: number): StepResult<S>;
  /** What the client may see. Secrets only when status != active. */
  view(state: S, status: RoundStatus, now: number): any;
  /** Admin-only peek at the full hidden state (crash point, mine positions, etc). */
  debug?(state: S, now: number): any;
}

/** Round multiplier to 2 decimals, always down (house-favourable). */
export const floor2 = (x: number) => Math.floor(x * 100 + 1e-9) / 100;
