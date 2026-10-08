import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
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

  /** Credit a Stars deposit. Returns false if this payment was already credited. */
  async creditDeposit(userId: number, amount: number, chargeId: string): Promise<boolean> {
    return this.db.tx(async (c) => {
      const dup = await c.query("select 1 from transactions where kind = 'deposit' and ref = $1", [chargeId]);
      if (dup.rowCount) return false;
      await this.apply(c, userId, amount, 'deposit', chargeId);
      return true;
    });
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
}
