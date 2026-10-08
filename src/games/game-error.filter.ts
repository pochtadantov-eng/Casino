import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { GameError } from './engines/types';

@Catch(GameError)
export class GameErrorFilter implements ExceptionFilter {
  catch(e: GameError, host: ArgumentsHost) {
    host.switchToHttp().getResponse().status(400).json({ error: e.message });
  }
}
