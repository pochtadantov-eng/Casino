import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { AuthGuard } from './auth/auth.guard';
import { BotService } from './bot/bot.service';
import { DbModule } from './db/db.module';
import { GamesService } from './games/games.service';
import { WalletService } from './wallet/wallet.service';

@Module({
  imports: [DbModule],
  controllers: [ApiController],
  providers: [WalletService, GamesService, BotService, AuthGuard],
})
export class AppModule {}
