import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { config } from '../config';
import { GameError } from '../games/engines/types';

export interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
}

@Injectable()
export class WalletService {
  constructor(private readonly db: DbService) {}

  async upsertUser(u: TgUser) {
    const { rows } = await this.db.pool.query(
      `insert into users (id, username, first_name) values ($1, $2, $3)
       on conflict (id) do update set username = excluded.username, first_name = excluded.first_name
       returning id, username, first_name, balance, banned`,
      [u.id, u.username ?? null, u.first_name ?? null],
    );
    return rows[0] as { id: string; username: string; first_name: string; balance: string; banned: boolean };
  }

  async balance(userId: number): Promise<number> {
    const { rows } = await this.db.pool.query('select balance from users where id = $1', [userId]);
    return rows[0] ? Number(rows[0].balance) : 0;
  }

  /** Atomic balance change inside an existing transaction. Throws if it would go negative. */
  async apply(c: PoolClient, userId: number, delta: number, kind: string, ref?: string): Promise<number> {
    if (!Number.isInteger(delta)) throw new Error('Non-integer amount');
    const { rows } = await c.query(
      'update users set balance = balance + $2 where id = $1 and balance + $2 >= 0 returning balance',
      [userId, delta],
    );
    if (!rows[0]) throw new GameError('Insufficient balance');
    const after = Number(rows[0].balance);
    await c.query(
      'insert into transactions (user_id, kind, amount, balance_after, ref) values ($1, $2, $3, $4, $5)',
      [userId, kind, delta, after, ref ?? null],
    );
    return after;
  }

  /** Credit a Stars deposit. Returns false if this payment was already credited (Telegram may deliver the same update twice). */
  async creditDeposit(userId: number, amount: number, chargeId: string): Promise<boolean> {
    try {
      return await this.db.tx(async (c) => {
        const dup = await c.query("select 1 from transactions where kind = 'deposit' and ref = $1", [chargeId]);
        if (dup.rowCount) return false;
        await this.apply(c, userId, amount, 'deposit', chargeId);      // the unique index (kind, ref) makes a concurrent duplicate fail instead of double-credit
        return true;
      });
    } catch (e: any) {
      if (e?.code === '23505') return false;
      throw e;
    }
  }

  /** Takes a refunded deposit back from the balance (Telegram refunded the Stars to the payer). Returns the amount, or null if unknown / already refunded. */
  async reverseDeposit(chargeId: string): Promise<{ userId: number; amount: number } | null> {
    try {
      return await this.db.tx(async (c) => {
        const { rows } = await c.query("select user_id, amount from transactions where kind = 'deposit' and ref = $1", [chargeId]);
        if (!rows[0]) return null;
        const userId = Number(rows[0].user_id), amount = Number(rows[0].amount);
        const bal = await c.query('select balance from users where id = $1 for update', [userId]);
        const take = Math.min(amount, Number(bal.rows[0]?.balance ?? 0));       // never below zero: if the Stars were already played, only the remainder is taken
        if (take > 0) await this.apply(c, userId, -take, 'deposit_refund', chargeId);
        else await c.query("insert into transactions (user_id, kind, amount, balance_after, ref) values ($1, 'deposit_refund', 0, $2, $3)", [userId, Number(bal.rows[0]?.balance ?? 0), chargeId]);
        return { userId, amount: take };
      });
    } catch (e: any) {
      if (e?.code === '23505') return null;
      throw e;
    }
  }

  /** Does this charge id belong to a deposit of this user that is still refundable? */
  async findDeposit(chargeId: string) {
    const { rows } = await this.db.pool.query(
      "select user_id, amount, (select count(*) from transactions r where r.kind = 'deposit_refund' and r.ref = t.ref) as refunded from transactions t where kind = 'deposit' and ref = $1",
      [chargeId],
    );
    return rows[0] ? { userId: Number(rows[0].user_id), amount: Number(rows[0].amount), refunded: Number(rows[0].refunded) > 0 } : null;
  }

  /** Deposits, withdrawals and bonuses of one user (not bets), newest first. */
  async cashHistory(userId: number, limit = 20) {
    const { rows } = await this.db.pool.query(
      "select kind, amount, balance_after, created_at from transactions where user_id = $1 and kind in ('deposit', 'deposit_refund', 'withdraw', 'withdraw_refund', 'bonus') order by id desc limit $2",
      [userId, limit],
    );
    return rows.map((r) => ({ kind: r.kind as string, amount: Number(r.amount), balance: Number(r.balance_after), at: r.created_at as Date }));
  }

  async requestWithdraw(userId: number, amount: number) {
    return this.db.tx(async (c) => {
      const { rows } = await c.query(
        'insert into withdrawals (user_id, amount) values ($1, $2) returning id',
        [userId, amount],
      );
      await this.apply(c, userId, -amount, 'withdraw', String(rows[0].id));
      return Number(rows[0].id);
    });
  }

  async decideWithdraw(id: number, approve: boolean): Promise<{ userId: number; amount: number } | null> {
    return this.db.tx(async (c) => {
      const { rows } = await c.query(
        "update withdrawals set status = $2, decided_at = now() where id = $1 and status = 'pending' returning user_id, amount",
        [id, approve ? 'approved' : 'rejected'],
      );
      if (!rows[0]) return null;
      const userId = Number(rows[0].user_id);
      const amount = Number(rows[0].amount);
      if (!approve) await this.apply(c, userId, amount, 'withdraw_refund', String(id));
      return { userId, amount };
    });
  }

  async pendingWithdrawals() {
    const { rows } = await this.db.pool.query(
      "select id, user_id, amount, created_at from withdrawals where status = 'pending' order by id limit 20",
    );
    return rows;
  }

  async dailyStatus(userId: number) {
    const { rows } = await this.db.pool.query('select last_daily from users where id = $1', [userId]);
    const next = rows[0]?.last_daily ? new Date(rows[0].last_daily.getTime() + 86_400_000) : null;
    return { reward: config.dailyBonus, availableAt: next && next.getTime() > Date.now() ? next.toISOString() : null };
  }

  /** Once per 24h. The UPDATE is the lock: a concurrent second claim matches no row. */
  async claimDaily(userId: number): Promise<number> {
    if (config.dailyBonus <= 0) throw new GameError('Бонус сейчас недоступен');
    return this.db.tx(async (c) => {
      const r = await c.query(
        "update users set last_daily = now() where id = $1 and (last_daily is null or last_daily < now() - interval '24 hours') returning id",
        [userId],
      );
      if (!r.rowCount) throw new GameError('Бонус уже получен, приходите позже');
      await this.apply(c, userId, config.dailyBonus, 'bonus', `daily:${userId}:${Date.now()}`);
      return config.dailyBonus;
    });
  }
}
