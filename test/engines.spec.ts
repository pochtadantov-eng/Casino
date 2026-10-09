import { describe, expect, it } from 'vitest';
import { Rng, hashSeed } from '../src/fair/fair';
import { crashPoint, multiplierAt, rocket } from '../src/games/engines/rocket';
import { mines, minePositions, minesMultiplier } from '../src/games/engines/mines';
import { seagull, stepsMultiplier } from '../src/games/engines/steps';
import { roundAt, publicRound, crashOfRound, BET_MS, PAUSE_MS } from '../src/games/engines/rocket-schedule';
import { tower, swingX, tolAt, periodAt, towerMultiplier, levelRanges, TOWER } from '../src/games/engines/tower';
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
  it('RTP of fixed cashout is ~92%', () => {
    const N = 200_000, target = 2;
    let ret = 0;
    for (let i = 0; i < N; i++) if (crashPoint(rng(i)) >= target) ret += target;
    expect(ret / N).toBeGreaterThan(0.88);
    expect(ret / N).toBeLessThan(0.96);
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
  it('RTP of "open 3 tiles then cash out" is ~85% (Mines has a 15% edge)', () => {
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
    expect(ret / N).toBeGreaterThan(0.81);
    expect(ret / N).toBeLessThan(0.89);
  });
  it('multiplier grows, cashout needs a safe tile, mines are hidden', () => {
    expect(minesMultiplier(3, 2)).toBeGreaterThan(minesMultiplier(3, 1));
    const { state } = mines.init({ mines: 3 }, rng(2), 0);
    expect(() => mines.cashout(state, 0)).toThrow();
    expect((mines.view(state, 'active', 0) as any).mines).toBeUndefined();
    expect(() => mines.init({ mines: 25 }, rng(2), 0)).toThrow();
    expect(() => mines.init({ mines: 2 }, rng(2), 0)).toThrow();
  });
});

describe.each([
  ['seagull', seagull, {}],
])('%s', (_name, eng, params) => {
  it('RTP of "go 2 steps then cash out" is ~92%', () => {
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
    expect(ret / N).toBeGreaterThan(0.86);
    expect(ret / N).toBeLessThan(0.98);
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

describe('tower (skill)', () => {
  const start = () => tower.init({}, rng(1), 1_000_000).state;
  it('rejects a tap before the swing is live', () => {
    expect(() => tower.act(start(), { tap: true }, 1_000_100)).toThrow();
  });
  it('a tap at the centre crossing lands, the window shrinks, the next swing is delayed', () => {
    const s = start(), t = s.swingStart + periodAt(0) / 2;                 // x = 0 exactly
    expect(Math.abs(swingX(t, s.swingStart, 0))).toBeLessThan(1e-9);
    const r = tower.act(s, { tap: true }, t);
    expect(r.status).toBe('active'); expect(r.state.picks).toBe(1); expect(r.state.swingStart).toBe(t + TOWER.nextDelay); expect(r.multiplier).toBe(towerMultiplier(1));
    expect(tolAt(5)).toBeLessThan(tolAt(0));
  });
  it('a tap at the extreme loses and reveals nothing hidden', () => {
    const s = start(), t = s.swingStart + periodAt(0) / 4;                  // x = amp
    const r = tower.act(s, { tap: true }, t);
    expect(r.status).toBe('lost'); expect(r.state.last?.ok).toBe(false); expect(Math.abs(r.state.last!.x)).toBeCloseTo(TOWER.amp, 2);
  });
  it('compensates latency but only up to the cap', () => {
    const s = start(), centre = s.swingStart + periodAt(0) / 2;
    expect(tower.act(s, { tap: true, lat: 100 }, centre + 100).status).toBe('active');   // arrived 100 ms late, claims 100 ms latency
    expect(tower.act(s, { tap: true, lat: 5000 }, centre + 600).status).toBe('lost');    // cannot claim more than maxLat
  });
  it('houses land where they were released and the stack may lean', () => {
    const s = start(), t = s.swingStart + periodAt(0) * 0.45, x = swingX(t, s.swingStart, 0);        // a little off-centre, still inside the first window
    const r = tower.act(s, { tap: true }, t);
    expect(Math.abs(x)).toBeGreaterThan(0.1); expect(r.status).toBe('active'); expect(r.state.offsets).toEqual([Math.round(x * 1000) / 1000]);
  });
  it('an overhang topples the stack: the weak level is reported and the round is lost', () => {
    const s = { ...start(), picks: 3, offsets: [0.4, 0.8, 1.2] }, t = s.swingStart + periodAt(3) * 0.2;      // already leaning right, adds more weight on the right
    const r = tower.act(s, { tap: true }, t);
    expect(r.status).toBe('lost'); expect(r.state.last?.collapse).not.toBeNull(); expect(r.state.last?.ok).toBe(false);
  });
  it('level ranges tighten with height and shift with the load above', () => {
    const lv = levelRanges([0, 0.3, -0.3, 0.2]);
    expect(lv).toHaveLength(4);
    const widths = lv.map(([a, b], j) => (b - a) / (4 - j)); expect(widths[3]).toBeLessThan(widths[0]);
  });
  it('cash-out needs a landed house and pays the ladder', () => {
    const s = start(); expect(() => tower.cashout(s, 0)).toThrow();
    expect(tower.cashout({ ...s, picks: 3 }, 0).multiplier).toBe(towerMultiplier(3));
  });
});

describe('rocket shared rounds', () => {
  const secret = 'test-secret', t0 = Date.UTC(2026, 9, 5);
  it('every client sees the same round and the timeline is contiguous', () => {
    const a = roundAt(t0, secret);
    const n = roundAt(a.nextStart, secret);
    expect(n.k).toBe(a.k + 1); expect(n.betStart).toBe(a.nextStart);
    expect(a.flightStart - a.betStart).toBe(BET_MS); expect(a.nextStart - a.crashAt).toBe(PAUSE_MS);
    expect(roundAt(t0, secret)).toEqual(a);                                    // deterministic
  });
  it('the crash point stays hidden until the crash happens', () => {
    const r = roundAt(t0, secret);
    expect((publicRound(r.betStart + 100, secret) as any).crash).toBeUndefined();
    if (r.crashAt > r.flightStart) expect((publicRound(r.crashAt - 1, secret) as any).crash).toBeUndefined();
    expect((publicRound(r.crashAt, secret) as any).crash).toBe(r.crash);
    expect(crashOfRound(r.k, secret)).toBe(r.crash);
  });
  it('RTP of cashing out at 2x is ~92%', () => {
    let ret = 0; const N = 100_000;
    for (let k = 0; k < N; k++) if (crashOfRound(k, secret) >= 2) ret += 2;
    expect(ret / N).toBeGreaterThan(0.88); expect(ret / N).toBeLessThan(0.96);
  });
});
