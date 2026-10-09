import { Engine } from './types';
import { rocket } from './rocket';
import { mines } from './mines';
import { seagull } from './steps';
import { tower } from './tower';

export const engines: Record<string, Engine> = { rocket, mines, tower, seagull };
