import { Controller, Get, Param, Res } from '@nestjs/common';
import { BotService } from './bot/bot.service';

/** Public pictures of Telegram gifts (the same sticker thumbnails everyone sees in the gift shop). The <img> tag cannot send the auth header, so this route is open. */
@Controller('gift-img')
export class GiftImageController {
  constructor(private readonly bot: BotService) {}

  @Get(':id')
  async image(@Param('id') id: string, @Res() res: any) {
    if (!/^\d{1,24}$/.test(id)) return res.status(404).end();
    const img = await this.bot.giftImage(id).catch(() => null);
    if (!img) return res.status(404).end();
    res.set({ 'Content-Type': img.type, 'Cache-Control': 'public, max-age=86400' }).send(img.buf);
  }
}
