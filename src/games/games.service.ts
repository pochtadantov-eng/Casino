import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PoolClient } from 'pg';
import { config } from '../config';
import { DbService } from '../db/db.service';
import { Rng, hashSeed, newServerSeed } from '../fair/fair';
import { WalletService } from '../wallet/wallet.service';
import { engines } from './engines';
import { Engine, GameError, RoundStatus, StepResult } from './engines/types';

@Injectable()
export class GamesService {
  constructor(
    private readonly db: DbService,
    private readonly wallet: WalletService,
  ) {}

  private engine(game: string): Engine {
    const e = engines[game];
    if (!e) throw new GameError('Unknown game');
    return e;
  }

  private present(r: any, now = Date.now()) {
    const e = this.engine(r.game);
    return {
      id: Number(r.id),
      game: r.game,
      bet: Number(r.bet),
      status: r.status as RoundStatus,
      multiplier: Number(r.multiplier),
      payout: Number(r.payout),
      serverSeedHash: r.server_seed_hash,
      clientSeed: r.client_seed,
      nonce: r.nonce,
      // server seed is revealed only after the round is over
      serverSeed: r.status === 'active' ? null : r.server_seed,
      view: e.view(r.state, r.status, now),
    };
  }

  /** Active round for resume after reopening the app (also settles a crashed rocket). */
  async current(userId: number, game: string) {
    this.engine(game);
    return this.db.tx(async (c) => {
      const r = await this.lockActive(c, userId, game);
      if (!r) return null;
      const settled = await this.advance(c, r, (e, s, now) => e.act(s, {}, now));
      return this.present(settled);
    });
  }

  async start(userId: number, game: string, params: any) {
    const engine = this.engine(game);
    const bet = Number(params?.bet);
    if (!Number.isInteger(bet) || bet < config.minBet || bet > config.maxBet) {
      throw new GameError(`Bet must be ${config.minBet}..${config.maxBet} Stars`);
    }
    const clientSeed = String(params?.clientSeed ?? randomBytes(8).toString('hex')).slice(0, 64);

    return this.db.tx(async (c) => {
      const u = await c.query('update users set round_count = round_count + 1 where id = $1 and not banned returning round_count', [userId]);
      if (!u.rows[0]) throw new GameError('User not available');
      if (await this.lockActive(c, userId, game)) throw new GameError('Finish your current round first');

      const nonce = u.rows[0].round_count as number;
      const serverSeed = newServerSeed();
      const now = Date.now();
      const { state, multiplier } = engine.init(params, new Rng(serverSeed, clientSeed, nonce), now);

      await this.wallet.apply(c, userId, -bet, 'bet');
      const ins = await c.query(
        `insert into rounds (user_id, game, bet, multiplier, state, server_seed, server_seed_hash, client_seed, nonce)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
        [userId, game, bet, multiplier, state, serverSeed, hashSeed(serverSeed), clientSeed, nonce],
      );
      return this.present(ins.rows[0], now);
    });
  }

  async act(userId: number, game: string, input: any) {
    return this.db.tx(async (c) => {
      const r = await this.lockActive(c, userId, game);
      if (!r) throw new GameError('No active round');
      return this.present(await this.advance(c, r, (e, s, now) => e.act(s, input, now)));
    });
  }

  async cashout(userId: number, game: string) {
    return this.db.tx(async (c) => {
      const r = await this.lockActive(c, userId, game);
      if (!r) throw new GameError('No active round');
      return this.present(await this.advance(c, r, (e, s, now) => e.cashout(s, now)));
    });
  }

  async history(userId: number, limit = 20) {
    const { rows } = await this.db.pool.query(
      'select * from rounds where user_id = $1 and status <> $2 order by id desc limit $3',
      [userId, 'active', limit],
    );
    return rows.map((r) => this.present(r));
  }

  private async lockActive(c: PoolClient, userId: number, game: string) {
    const { rows } = await c.query(
      "select * from rounds where user_id = $1 and game = $2 and status = 'active' for update",
      [userId, game],
    );
    return rows[0] ?? null;
  }

  /** Runs an engine step, enforces the max-payout cap, persists and pays out. */
  private async advance(
    c: PoolClient,
    row: any,
    step: (e: Engine, state: any, now: number) => StepResult,
  ) {
    const engine = this.engine(row.game);
    const now = Date.now();
    let res = step(engine, row.state, now);
    const bet = Number(row.bet);

    // liability cap: if the next payout would reach the cap, cash out automatically
    if (res.status === 'active' && Math.floor(bet * res.multiplier) >= config.maxPayout) {
      res = engine.cashout(res.state, now);
    }
    let payout = res.status === 'won' ? Math.min(Math.floor(bet * res.multiplier), config.maxPayout) : 0;

    if (res.status === 'active') {
      const { rows } = await c.query('update rounds set state = $2, multiplier = $3 where id = $1 returning *', [
        row.id,
        res.state,
        res.multiplier,
      ]);
      return rows[0];
    }
    if (payout > 0) await this.wallet.apply(c, Number(row.user_id), payout, 'payout', String(row.id));
    const { rows } = await c.query(
      `update rounds set state = $2, multiplier = $3, status = $4, payout = $5, finished_at = now()
       where id = $1 returning *`,
      [row.id, res.state, res.multiplier, res.status, payout],
    );
    return rows[0];
  }
}
