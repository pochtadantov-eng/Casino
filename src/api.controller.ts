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
    const reward = await this.wallet.claimDaily(req.user.id);
    return { reward, balance: await this.wallet.balance(req.user.id) };
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
