const int = (name: string, def: number) => {
  const v = process.env[name];
  return v !== undefined && v !== '' ? Math.floor(Number(v)) : def;
};

export const config = {
  port: int('PORT', 3000),
  botToken: process.env.BOT_TOKEN ?? '',
  webappUrl: process.env.WEBAPP_URL ?? '',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://casino:casino@localhost:5432/casino',
  minBet: int('MIN_BET', 50),
  maxBet: int('MAX_BET', 100000),
  rocketSecret: process.env.ROCKET_SECRET ?? 'dev-rocket-secret-change-me',   // derives every shared Rocket crash point: keep it private and unique in production
  maxPayout: int('MAX_PAYOUT', 1000000),
  minDeposit: int('MIN_DEPOSIT', 1),
  minWithdraw: int('MIN_WITHDRAW', 100),
  dailyBonus: int('DAILY_BONUS', 10), // 0 disables the daily bonus
  adminIds: (process.env.ADMIN_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean).map(Number),
  devAuth: process.env.DEV_AUTH === '1',
};
