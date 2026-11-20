import type { RosterEntry } from './fighter-kit.js';
import { whale } from './fighters/whale.js';
import { frog } from './fighters/frog.js';
import { banana } from './fighters/banana.js';
import { gaga } from './fighters/gaga.js';

export { basicAttack, type RosterEntry } from './fighter-kit.js';
export const roster: RosterEntry[] = [whale, frog, banana, gaga];
