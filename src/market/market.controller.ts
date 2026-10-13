import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { MarketService } from './market.service';

/** Public read-only market data (no auth needed: rates and gift pictures are not private). */
@Controller('market')
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Get('rates')
  rates() { return this.market.getRates(); }

  @Get('gift/:slug')
  async gift(@Param('slug') slug: string) {
    try { return await this.market.getGift(slug); } catch { throw new NotFoundException('gift not found'); }
  }

  @Get('gift/:slug/lottie')
  async lottie(@Param('slug') slug: string, @Res() res: any) {
    try {
      const json = await this.market.getLottie(slug);
      res.set({ 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }).send(json);
    } catch { throw new NotFoundException('animation not found'); }
  }
}
