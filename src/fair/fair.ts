import { createHash, createHmac, randomBytes } from 'node:crypto';

/**
 * Provably fair RNG. Before a round the player sees sha256(serverSeed);
 * after the round the serverSeed is revealed so anyone can replay every outcome:
 *   float_i = HMAC_SHA256(serverSeed, `${clientSeed}:${nonce}:${i}`)[0..6] / 2^48
 */
export const newServerSeed = () => randomBytes(32).toString('hex');
export const hashSeed = (seed: string) => createHash('sha256').update(seed).digest('hex');

export class Rng {
  private cursor = 0;
  constructor(
    readonly serverSeed: string,
    readonly clientSeed: string,
    readonly nonce: number,
  ) {}

  /** Uniform float in [0, 1). */
  float(): number {
    const h = createHmac('sha256', this.serverSeed)
      .update(`${this.clientSeed}:${this.nonce}:${this.cursor++}`)
      .digest();
    return h.readUIntBE(0, 6) / 2 ** 48;
  }

  /** Uniform integer in [0, max). */
  int(max: number): number {
    return Math.floor(this.float() * max);
  }
}
