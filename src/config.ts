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
  minDeposit: int('MIN_DEPOSIT', 50),
  maxDeposit: int('MAX_DEPOSIT', 10000),    // per invoice; check Telegram's current Stars invoice limit before raising it
  minWithdraw: int('MIN_WITHDRAW', 100),
  giftFeePct: int('GIFT_FEE_PCT', 10),        // extra share of the gift price the player pays when withdrawing a gift (covers the bot's costs)
  giftDelayMinSec: int('GIFT_DELAY_MIN_SEC', 15),   // a gift withdrawal is "processing" for this long (random between min and max), then the bot really sends it
  giftDelayMaxSec: int('GIFT_DELAY_MAX_SEC', 20),
  giftsPerDay: int('GIFTS_PER_DAY', 5),       // anti-abuse: gifts one player can withdraw per 24 h
  chestUnlimited: int('CHEST_UNLIMITED', 0) === 1,   // testing only: everybody can open the daily chest again and again (admins always can)
  dailyBonus: int('DAILY_BONUS', 10), // 0 disables the daily bonus
  adminIds: (process.env.ADMIN_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean).map(Number),
  // Personal "visual gift" mode: for these Telegram ids the bot sends no real gift, it queues one for the PampGram client (src/visual-gift.controller.ts). Needs VISUAL_GIFT_TOKEN too.
  visualGiftUserIds: (process.env.VISUAL_GIFT_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean).map(Number),
  visualGiftToken: process.env.VISUAL_GIFT_TOKEN ?? '',
  visualGiftDelaySec: int('VISUAL_GIFT_DELAY_SEC', 30),   // the gift shows up in PampGram this long after the withdrawal
  devAuth: process.env.DEV_AUTH === '1',
};
