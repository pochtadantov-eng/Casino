import { describe, expect, it } from 'vitest';
import { Rng, hashSeed } from '../src/fair/fair';
import { crashPoint, multiplierAt, rocket } from '../src/games/engines/rocket';
import { mines, minePositions, minesMultiplier } from '../src/games/engines/mines';
import { seagull, stepsMultiplier, tower } from '../src/games/engines/steps';
import { verifyInitData } from '../src/auth/telegram-auth';
import { createHmac } from 'node:crypto';

const rng = (i: number) => new Rng('seed' + i, 'client', i);

describe('provably fair rng', () => {
  it('is deterministic and in [0,1)', () => {
    const a = new Rng('s', 'c', 1), b = new Rng('s', 'c', 1);
    for (let i = 0; i < 100; i++) {
      const x = a.float();
      expect(x).toBe(b.float());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(hashSeed('s')).toHaveLength(64);
  });
});

describe('rocket', () => {
  it('RTP of fixed cashout is ~97%', () => {
    const N = 200_000, target = 2;
    let ret = 0;
    for (let i = 0; i < N; i++) if (crashPoint(rng(i)) >= target) ret += target;
    expect(ret / N).toBeGreaterThan(0.94);
    expect(ret / N).toBeLessThan(1.0);
  });
  it('cashout wins before crash and loses after', () => {
    const state = { crash: 2, startedAt: 0, auto: null };
    const t = Math.log(1.5) / 0.0001;
    expect(rocket.cashout(state, t).status).toBe('won');
    expect(rocket.cashout(state, Math.log(2.5) / 0.0001).status).toBe('lost');
    expect(multiplierAt(0)).toBe(1);
  });
  it('auto cashout is honoured even if the player is offline', () => {
    const state = { crash: 5, startedAt: 0, auto: 2 };
    const r = rocket.act(state, {}, Math.log(10) / 0.0001);
    expect(r.status).toBe('won');
    expect(r.multiplier).toBe(2);
  });
  it('hides crash point while active', () => {
    const s = { crash: 3, startedAt: 0, auto: null };
    expect(rocket.view(s, 'active', 0).crash).toBeUndefined();
    expect(rocket.view(s, 'lost', 0).crash).toBe(3);
  });
});

describe('mines', () => {
  it('places distinct mines', () => {
    const m = minePositions(rng(1), 10);
    expect(new Set(m).size).toBe(10);
  });
  it('RTP of "open 3 tiles then cash out" is ~97%', () => {
    const N = 100_000;
    let ret = 0;
    for (let i = 0; i < N; i++) {
      const eng = mines.init({ mines: 5 }, rng(i), 0);
      let s = eng.state, ok = true;
      for (const tile of [0, 1, 2]) {
        const r = mines.act(s, { tile }, 0);
        s = r.state;
        if (r.status === 'lost') { ok = false; break; }
      }
      if (ok) ret += mines.cashout(s, 0).multiplier;
    }
    expect(ret / N).toBeGreaterThan(0.93);
    expect(ret / N).toBeLessThan(1.0);
  });
  it('multiplier grows, cashout needs a safe tile, mines are hidden', () => {
    expect(minesMultiplier(3, 2)).toBeGreaterThan(minesMultiplier(3, 1));
    const { state } = mines.init({ mines: 3 }, rng(2), 0);
    expect(() => mines.cashout(state, 0)).toThrow();
    expect((mines.view(state, 'active', 0) as any).mines).toBeUndefined();
    expect(() => mines.init({ mines: 25 }, rng(2), 0)).toThrow();
  });
});

describe.each([
  ['tower', tower, { variant: 'medium' }],
  ['seagull', seagull, {}],
])('%s', (_name, eng, params) => {
  it('RTP of "go 2 steps then cash out" is ~97%', () => {
    const N = 30_000;
    let ret = 0;
    for (let i = 0; i < N; i++) {
      let { state } = eng.init(params, rng(i), 0);
      let ok = true;
      for (let k = 0; k < 2 && ok; k++) {
        const r = eng.act(state, { choice: 0 }, 0);
        state = r.state;
        ok = r.status === 'active';
      }
      if (ok) ret += eng.cashout(state, 0).multiplier;
    }
    expect(ret / N).toBeGreaterThan(0.92);
    expect(ret / N).toBeLessThan(1.02);
  }, 30_000);
  it('rejects bad choice and early cashout', () => {
    const { state } = eng.init(params, rng(3), 0);
    expect(() => eng.act(state, { choice: 9 }, 0)).toThrow();
    expect(() => eng.cashout(state, 0)).toThrow();
  });
});

it('steps multiplier math', () => {
  expect(stepsMultiplier(3, 1, 1)).toBe(1.45);
  expect(stepsMultiplier(2, 1, 3)).toBe(7.76);
});

describe('telegram initData', () => {
  it('accepts valid signature and rejects tampering', () => {
    const token = '123:ABC';
    const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 42, first_name: 'A' }) });
    const check = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(token).digest();
    params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
    expect(verifyInitData(params.toString(), token)?.id).toBe(42);
    expect(verifyInitData(params.toString(), 'other')).toBeNull();
    params.set('user', JSON.stringify({ id: 43 }));
    expect(verifyInitData(params.toString(), token)).toBeNull();
  });
});
