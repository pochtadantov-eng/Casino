import { randomInt } from 'node:crypto';

/**
 * Daily chest: one opening per 24 h, the prize is drawn on the server (crypto-random) and shown by a roulette on the phone.
 * Tune `weight` (relative chance) and `stars` to change the economy. Expected value is printed by `chestEv()`.
 */
export interface ChestPrize { id: string; stars?: number; giftStars?: number; label: string; weight: number }

export const CHEST_PRIZES: ChestPrize[] = [
  { id: 's15', stars: 15, label: '15 ⭐', weight: 55 },
  { id: 's25', stars: 25, label: '25 ⭐', weight: 25 },
  { id: 's50', stars: 50, label: '50 ⭐', weight: 12 },
  { id: 's100', stars: 100, label: '100 ⭐', weight: 5 },
  { id: 's150', stars: 150, label: '150 ⭐', weight: 1.8 },
  { id: 's500', stars: 500, label: '500 ⭐', weight: 0.8 },
  { id: 's1000', stars: 1000, label: '1000 ⭐', weight: 0.3 },
  // a real Telegram gift of about this many Stars: the bot drops it into the player's chat the moment the roulette stops
  { id: 'g25', giftStars: 25, label: 'Подарок ≈25 ⭐', weight: 0.5 },
  { id: 'g50', giftStars: 50, label: 'Подарок ≈50 ⭐', weight: 0.25 },
  { id: 'g100', giftStars: 100, label: 'Подарок ≈100 ⭐', weight: 0.1 },
];

export function drawPrize(prizes = CHEST_PRIZES): ChestPrize {
  const total = prizes.reduce((s, p) => s + p.weight, 0), scale = 1_000_000;
  let r = randomInt(0, Math.round(total * scale));
  for (const p of prizes) { r -= Math.round(p.weight * scale); if (r < 0) return p; }
  return prizes[0];
}

/** Expected value per opening in Stars; gifts count at their face value (the bot pays for them). */
export const chestEv = (prizes = CHEST_PRIZES) => prizes.reduce((s, p) => s + (p.stars ?? p.giftStars ?? 0) * p.weight, 0) / prizes.reduce((s, p) => s + p.weight, 0);

/** What the phone may know: the list of possible prizes for the roulette (no weights). */
export const publicPrizes = () => CHEST_PRIZES.map(({ id, stars, giftStars, label }) => ({ id, stars, giftStars, label }));
