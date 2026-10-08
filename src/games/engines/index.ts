import { Engine } from './types';
import { rocket } from './rocket';
import { mines } from './mines';
import { tower, seagull } from './steps';

export const engines: Record<string, Engine> = { rocket, mines, tower, seagull };
