import { createHmac } from 'node:crypto';
import { HOUSE_EDGE, floor2 } from './types';
import { GROWTH, MAX_CRASH } from './rocket';

/**
 * Rocket runs as one shared, endless sequence of rounds that every player sees at the same time:
 *   [ BET_MS betting window ] [ flight until the crash ] [ PAUSE_MS after the crash ] -> next round
 * The crash point of round k is derived from a server secret (HMAC of k), so it is the same for everybody and cannot be guessed
 * before it happens. The timeline is a pure function of the clock, so every server process agrees on it.
 */
export const BET_MS = 5000;
export const PAUSE_MS = 3500;
const EPOCH = Date.UTC(2026, 9, 1);

export const crashOfRound = (k: number, secret: string): number => {
  const h = createHmac('sha256', secret).update(`rocket:${k}`).digest();
  const u = (h.readUInt32BE(0) * 2 ** 21 + (h.readUInt32BE(4) >>> 11)) / 2 ** 53;      // 53 uniform bits
  return Math.min(MAX_CRASH, Math.max(1, floor2((1 - HOUSE_EDGE) / (1 - u))));
};
export const flightMs = (crash: number) => Math.ceil(Math.log(crash) / GROWTH);

export interface RocketRound { k: number; betStart: number; flightStart: number; crashAt: number; nextStart: number; crash: number }

const cache: { secret: string; k: number; start: number } = { secret: '', k: 0, start: EPOCH };
const build = (k: number, start: number, secret: string): RocketRound => {
  const crash = crashOfRound(k, secret), flightStart = start + BET_MS, crashAt = flightStart + flightMs(crash);
  return { k, betStart: start, flightStart, crashAt, nextStart: crashAt + PAUSE_MS, crash };
};

/** The round that is running at `now` (betting, flying or in the pause after its crash). */
export function roundAt(now: number, secret: string): RocketRound {
  if (cache.secret !== secret) { cache.secret = secret; cache.k = 0; cache.start = EPOCH; }
  if (now < cache.start) { cache.k = 0; cache.start = EPOCH; }                      // asked about the past: rewind and scan forward again
  let r = build(cache.k, cache.start, secret);
  while (r.nextStart <= now) { r = build(r.k + 1, r.nextStart, secret); cache.k = r.k; cache.start = r.betStart; }
  return r;
}

/** Crash points of the last `n` finished rounds before round k (newest first). */
export const historyBefore = (k: number, n: number, secret: string) =>
  Array.from({ length: Math.min(n, k) }, (_, i) => crashOfRound(k - 1 - i, secret));

/** What every client may know about the current round: the crash point only once it has happened. */
export function publicRound(now: number, secret: string) {
  const r = roundAt(now, secret), crashed = now >= r.crashAt;
  return {
    k: r.k, serverNow: now, betStart: r.betStart, flightStart: r.flightStart, nextStart: r.nextStart, growth: GROWTH,
    phase: now < r.flightStart ? 'bet' : crashed ? 'crash' : 'fly',
    ...(crashed ? { crash: r.crash, crashAt: r.crashAt } : {}),
    history: historyBefore(r.k + (crashed ? 1 : 0), 14, secret),
  };
}
