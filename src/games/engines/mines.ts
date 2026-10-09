import { Rng } from '../../fair/fair';
import { Engine, GameError, floor2 } from './types';

export const SIZE = 25;
export const MINES_EDGE = 0.1;   // Mines pays less than the other games (RTP 90%) and needs at least 3 mines, so stars are harder to collect
export const MIN_MINES = 3;

/** Partial Fisher-Yates: first `count` entries of a shuffled board are the mines. */
export function minePositions(rng: Rng, count: number): number[] {
  const board = Array.from({ length: SIZE }, (_, i) => i);
  for (let i = 0; i < count; i++) {
    const j = i + rng.int(SIZE - i);
    [board[i], board[j]] = [board[j], board[i]];
  }
  return board.slice(0, count).sort((a, b) => a - b);
}

/** 0.90 * C(25, k) / C(25 - mines, k) for k revealed safe tiles. */
export function minesMultiplier(mines: number, revealed: number): number {
  let m = 1 - MINES_EDGE;
  for (let i = 0; i < revealed; i++) m *= (SIZE - i) / (SIZE - mines - i);
  return revealed === 0 ? 1 : floor2(m);
}

interface State {
  mines: number[];
  count: number;
  revealed: number[];
}

export const mines: Engine<State> = {
  id: 'mines',
  init(params, rng) {
    const count = Number(params?.mines);
    if (!Number.isInteger(count) || count < MIN_MINES || count > SIZE - 1) throw new GameError('mines must be 3..24');
    return { state: { mines: minePositions(rng, count), count, revealed: [] }, multiplier: 1 };
  },
  act(state, input) {
    const tile = Number(input?.tile);
    if (!Number.isInteger(tile) || tile < 0 || tile >= SIZE) throw new GameError('Bad tile');
    if (state.revealed.includes(tile)) throw new GameError('Tile already open');
    if (state.mines.includes(tile)) {
      return { status: 'lost', multiplier: 0, state: { ...state, revealed: [...state.revealed, tile] } };
    }
    const next = { ...state, revealed: [...state.revealed, tile] };
    const multiplier = minesMultiplier(state.count, next.revealed.length);
    const done = next.revealed.length === SIZE - state.count;
    return { status: done ? 'won' : 'active', multiplier, state: next };
  },
  cashout(state) {
    const safe = state.revealed.filter((t) => !state.mines.includes(t)).length;
    if (safe < 1) throw new GameError('Open at least one tile');
    return { status: 'won', multiplier: minesMultiplier(state.count, safe), state };
  },
  view(state, status) {
    const base = { count: state.count, revealed: state.revealed, size: SIZE };
    return status === 'active' ? base : { ...base, mines: state.mines };
  },
  debug(state) { return { mines: state.mines, revealed: state.revealed, size: SIZE, bombCount: state.count }; },
};
