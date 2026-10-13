import { Engine } from './types';
import { rocket } from './rocket';
import { mines } from './mines';
import { seagull } from './steps';
import { tower } from './tower';
import { plinko, slot, luck, dig } from './extra';

export const engines: Record<string, Engine> = { rocket, mines, tower, seagull, plinko, slot, luck, dig };
