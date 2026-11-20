export type Side = -1 | 1;
export type Slot = 'A' | 'B' | 'C';
export type Direction = 'up' | 'down' | 'forward' | 'back';
export type ActionKey = Slot | 'jump' | 'dash';
export type Duo<T> = [T, T];
export type Axis = -1 | 0 | 1;

export interface Stick {
  x: Axis;
  y: Axis;
}

export interface InputFrame extends Stick {
  pressed: ActionKey[];
  sampled?: Partial<Record<ActionKey, Stick>>;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ActionDefinition {
  id: string;
  name?: string;
  slot: Slot;
  direction?: Direction;
  posture: 'ground' | 'air' | 'any';
  startup: number;
  active: number;
  recovery: number;
  hitbox: Box;
  damage: number;
  hitstun: number;
  blockstun: number;
  guardCost: number;
  push: number;
  lift: number;
  knockdown?: boolean;
  stop: number;
  advance: number;
  // Action IDs or slot names, plus 'jump' for a grounded chase after a hit.
  cancelOnHit?: string[];
  linkOnly?: boolean;
  airControl?: number;
  pose: 'strike' | 'sweep' | 'finish' | 'rise' | 'air';
}

export interface FighterDefinition {
  id: string;
  name: string;
  maxHp: number;
  run: number;
  airSpeed: number;
  jump: number;
  dash: number;
  airDash?: boolean;
  airJump?: number;
  // Boxes use the character's feet as origin, expressed in facing-right coordinates.
  hurtbox: Box;
  bodyWidth: number;
  actions: ActionDefinition[];
}

export interface Platform {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4;
  left: number;
  right: number;
  y: number;
  prop?: 'container' | 'trailer' | 'catwalk' | 'ferry' | 'pallet' | 'office' | 'bridge' | 'gallery' |
    'planter' | 'sunroom' | 'skywalk' | 'penthouse' | 'water-tank' | 'laundry' |
    'bench-seat' | 'shelter' | 'bleachers' | 'press-box' | 'scoreboard' | 'camera-deck' |
    'transformer' | 'control-room' | 'conduit' | 'inductor' | 'elevator' | 'stair';
  travel?: { axis?: 'x' | 'y'; distance: number; period: number; dwell: number; phase: number };
}

export interface ArenaDefinition {
  id: string;
  name: string;
  description: string;
  terrain: string;
  // A ground-to-top route from each side of the opening.
  routes: Duo<string[]>;
  theme: 'dorm' | 'court' | 'harbor' | 'station';
  artFrame: { sourceY: number; worldY: number }[];
  width: number;
  height: number;
  left: number;
  right: number;
  floor: number;
  spawn: Duo<number>;
  platforms: Platform[];
}

export interface Ruleset {
  ticksPerSecond: number;
  roundSeconds: number;
  winsToFinish: number;
  guardMax: number;
  guardDelay: number;
  guardBreak: number;
  inputBuffer: number;
  comboControlLimit: number;
}

export interface MatchConfig {
  rules: Ruleset;
  arena: ArenaDefinition;
  fighters: Duo<FighterDefinition>;
  training?: boolean;
}

export interface Command {
  key: ActionKey;
  x: Axis;
  directions: Direction[];
  down: boolean;
  sampledAt: number;
  remaining: number;
}

export interface Attack {
  id: string;
  frame: number;
  connected: boolean;
  landed: boolean;
}

export type Recovery = { phase: 'fall' } | { phase: 'down' | 'rise'; remaining: number };

export interface FighterState {
  x: number;
  y: number;
  vy: number;
  facing: Side;
  ground: string | null;
  ignorePlatform: string | null;
  hp: number;
  guard: number;
  guardWait: number;
  guardBreak: number;
  hitstun: number;
  blockstun: number;
  push: number;
  dash: number;
  airActionUsed: boolean;
  guarding: boolean;
  attack: Attack | null;
  buffer: Command[];
  combo: number;
  controlled: number;
  recovery: Recovery | null;
  moving: boolean;
}

export type EventKind = 'swing' | 'hit' | 'block' | 'break' | 'whiff' | 'dash' | 'jump' | 'air-jump' |
  'drop' | 'land' | 'knockdown' | 'rise' | 'ko';
export interface CombatEvent {
  kind: EventKind;
  source: 0 | 1;
  x: number;
  y: number;
  amount?: number;
  chain?: number;
  direction?: Side;
  heavy?: boolean;
}

export interface RoundResult {
  winner: 0 | 1 | null;
  reason: 'ko' | 'double-ko' | 'time' | 'tie';
}

export interface MatchState {
  frame: number;
  arenaFrame: number;
  remaining: number;
  freeze: number;
  comboFreeze: number;
  phase: 'ready' | 'fight' | 'round-over' | 'match-over';
  phaseTicks: number;
  round: number;
  wins: Duo<number>;
  draws: number;
  fighters: Duo<FighterState>;
  result: RoundResult | null;
  winner: 0 | 1 | null;
}

export const TICK_RATE = 60;
export const NEUTRAL: InputFrame = { x: 0, y: 0, pressed: [] };
