import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { config } from '../config';
import { WalletService } from '../wallet/wallet.service';
import { verifyInitData } from './telegram-auth';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly wallet: WalletService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    let tg = null;
    const header: string = req.headers.authorization ?? '';
    if (header.startsWith('tma ')) tg = verifyInitData(header.slice(4), config.botToken);
    else if (config.devAuth && req.headers['x-dev-user']) {
      tg = { id: Number(req.headers['x-dev-user']), username: 'dev', first_name: 'Dev' };
    }
    if (!tg) throw new UnauthorizedException();
    const user = await this.wallet.upsertUser(tg);
    if (user.banned) throw new UnauthorizedException('banned');
    req.user = { id: Number(user.id) };
    return true;
  }
}
