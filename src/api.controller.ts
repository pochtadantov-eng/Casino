import { Body, Controller, Get, Param, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth/auth.guard';
import { BotService } from './bot/bot.service';
import { config } from './config';
import { GameError } from './games/engines/types';
import { GameErrorFilter } from './games/game-error.filter';
import { GamesService } from './games/games.service';
import { WalletService } from './wallet/wallet.service';

@Controller('api')
@UseGuards(AuthGuard)
@UseFilters(GameErrorFilter)
export class ApiController {
  constructor(
    private readonly games: GamesService,
    private readonly wallet: WalletService,
    private readonly bot: BotService,
  ) {}

  @Get('me')
  async me(@Req() req: any) {
    return {
      id: req.user.id,
      balance: await this.wallet.balance(req.user.id),
      limits: { minBet: config.minBet, maxBet: config.maxBet, maxPayout: config.maxPayout, minWithdraw: config.minWithdraw, minDeposit: config.minDeposit, maxDeposit: config.maxDeposit },
    };
  }

  @Get('bonus')
  bonus(@Req() req: any) {
    return this.wallet.dailyStatus(req.user.id);
  }

  @Post('bonus/daily')
  async claimBonus(@Req() req: any) {
    const { prize } = await this.wallet.openChest(req.user.id);
    let gift: { emoji: string; stars: number; inventory: boolean } | null = null;
    if (prize.giftStars) {
      // a gift prize goes to the player's inventory (sell it for Stars or withdraw it into the chat from there)
      let pick: { id: string; emoji: string; stars: number } | null = null;
      try {
        const all = await this.bot.availableGifts(), best = Math.min(...all.map((g) => Math.abs(g.stars - prize.giftStars!)));
        const pool = all.filter((g) => Math.abs(g.stars - prize.giftStars!) === best); pick = pool[Math.floor(Math.random() * pool.length)];
      } catch { /* bot offline: store a generic gift, the closest real one is picked when it is withdrawn */ }
      await this.wallet.addInventory(req.user.id, pick?.id ?? null, pick?.emoji ?? '🎁', pick?.stars ?? prize.giftStars, 'chest');
      gift = { emoji: pick?.emoji ?? '🎁', stars: pick?.stars ?? prize.giftStars, inventory: true };
    }
    return { prize: { id: prize.id, stars: prize.stars, giftStars: prize.giftStars, label: prize.label, gift }, balance: await this.wallet.balance(req.user.id) };
  }

  /** Deposits / withdrawals / bonuses for the profile screen. */
  @Get('cash')
  cash(@Req() req: any) {
    return this.wallet.cashHistory(req.user.id);
  }

  @Get('history')
  history(@Req() req: any) {
    return this.games.history(req.user.id);
  }

  @Get('games/rocket/round')
  rocketRound() {
    return this.games.rocketRound();
  }

  @Get('games/:game')
  async current(@Req() req: any, @Param('game') game: string) {
    const [round, balance] = [await this.games.current(req.user.id, game), await this.wallet.balance(req.user.id)];
    return { round, balance };
  }

  @Post('games/:game/start')
  async start(@Req() req: any, @Param('game') game: string, @Body() body: any) {
    const round = await this.games.start(req.user.id, game, body);
    return { round, balance: await this.wallet.balance(req.user.id) };
  }

  /** reveal a tile / pick a block / pick a kid / poll rocket */
  @Post('games/:game/act')
  async act(@Req() req: any, @Param('game') game: string, @Body() body: any) {
    const round = await this.games.act(req.user.id, game, body);
    return { round, balance: await this.wallet.balance(req.user.id) };
  }

  @Post('games/:game/cashout')
  async cashout(@Req() req: any, @Param('game') game: string) {
    const round = await this.games.cashout(req.user.id, game);
    return { round, balance: await this.wallet.balance(req.user.id) };
  }

  /** Admin-only peek at the hidden state of the caller's current round (crash point, mine positions, etc). */
  @Get('admin/peek/:game')
  async adminPeek(@Req() req: any, @Param('game') game: string) {
    if (!config.adminIds.includes(req.user.id)) throw new GameError('Admin only');
    const debug = await this.games.peek(req.user.id, game);
    return { debug };
  }

  /** Returns a Stars invoice link; the Mini App opens it with Telegram.WebApp.openInvoice. */
  @Post('deposit')
  async deposit(@Req() req: any, @Body() body: any) {
    const amount = Number(body?.amount);
    if (!Number.isInteger(amount) || amount < config.minDeposit || amount > config.maxDeposit) {
      throw new GameError(`Deposit must be ${config.minDeposit}..${config.maxDeposit} Stars`);
    }
    return { link: await this.bot.createDepositLink(req.user.id, amount) };
  }

  /** Gifts the player can withdraw into the chat; the price is what the player pays (gift price + fee). */
  @Get('gifts')
  async gifts() {
    const list = await this.bot.availableGifts();
    return { perDay: config.giftsPerDay, gifts: list.map((g) => ({ id: g.id, emoji: g.emoji, stars: g.stars, price: this.giftPrice(g.stars), limited: g.limited })) };
  }

  /** Withdraw as a Telegram gift: pay from the balance, the bot sends the gift to the chat (refund if Telegram refuses). */
  @Post('gifts/send')
  async sendGift(@Req() req: any, @Body() body: any) {
    const g = (await this.bot.availableGifts()).find((x) => x.id === String(body?.giftId));
    if (!g) throw new GameError('Подарок недоступен');
    const price = this.giftPrice(g.stars);
    const order = await this.wallet.createGiftOrder(req.user.id, price, g.id);      // Stars are taken now, the bot really sends the gift when the order is due (15-20 s)
    return { price, etaSec: order.etaSec, balance: await this.wallet.balance(req.user.id) };
  }

  /** Inventory: gifts the player has won. */
  @Get('inventory')
  async inventory(@Req() req: any) {
    return { sellPct: config.giftSellPct, items: await this.wallet.listInventory(req.user.id) };
  }

  @Post('inventory/sell')
  async sellItem(@Req() req: any, @Body() body: any) {
    const pay = await this.wallet.sellInventory(req.user.id, Number(body?.id));
    return { pay, balance: await this.wallet.balance(req.user.id) };
  }

  @Post('inventory/withdraw')
  async withdrawItem(@Req() req: any, @Body() body: any) {
    const r = await this.wallet.withdrawInventory(req.user.id, Number(body?.id), async (stars, current) => {
      if (current) return current;
      const all = await this.bot.availableGifts(), best = Math.min(...all.map((g) => Math.abs(g.stars - stars)));
      const pool = all.filter((g) => Math.abs(g.stars - stars) === best);
      if (!pool.length) throw new GameError('Подарки сейчас недоступны');
      return pool[Math.floor(Math.random() * pool.length)].id;
    });
    return r;
  }

  private giftPrice(stars: number) { return Math.ceil(stars * (1 + config.giftFeePct / 100)); }

  @Post('withdraw')
  async withdraw(@Req() req: any, @Body() body: any) {
    const amount = Number(body?.amount);
    if (!Number.isInteger(amount) || amount < config.minWithdraw) {
      throw new GameError(`Minimum withdrawal is ${config.minWithdraw} Stars`);
    }
    const id = await this.wallet.requestWithdraw(req.user.id, amount);
    await this.bot.notifyAdmins(`Withdrawal #${id}: user ${req.user.id} wants ${amount} ⭐\n/approve ${id}  /reject ${id}`);
    return { id, balance: await this.wallet.balance(req.user.id) };
  }
}
