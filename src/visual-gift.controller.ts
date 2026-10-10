import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { config } from './config';
import { WalletService } from './wallet/wallet.service';

const sameToken = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Personal visual gifts. The PampGram client of the owner polls this; it is not behind the Mini App
 * auth (the client has no initData) but needs the shared VISUAL_GIFT_TOKEN and a user id from
 * VISUAL_GIFT_USER_IDS, so for everybody else it answers 403 and never hands anything out.
 */
@Controller('visual')
export class VisualGiftController {
  constructor(private readonly wallet: WalletService) {}

  @Get('pending')
  async pending(@Query('uid') uid: string, @Query('token') token: string) {
    const id = Number(uid);
    if (!config.visualGiftToken || !sameToken(String(token ?? ''), config.visualGiftToken) || !config.visualGiftUserIds.includes(id)) throw new ForbiddenException();
    return { botId: Number(config.botToken.split(':')[0]), gifts: await this.wallet.takeVisualGifts(id) };
  }
}
