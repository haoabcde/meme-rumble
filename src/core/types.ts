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
  stop: number;
  advance: number;
  cancelOnHit?: Slot[];
  pose: 'strike' | 'sweep' | 'rise';
}

export interface FighterDefinition {
  id: string;
  name: string;
  maxHp: number;
  run: number;
  airSpeed: number;
  jump: number;
  dash: number;
  // Boxes use the character's feet as origin, expressed in facing-right coordinates.
  hurtbox: Box;
  bodyWidth: number;
  actions: ActionDefinition[];
}

export interface Platform {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  left: number;
  right: number;
  y: number;
}

export interface ArenaDefinition {
  id: string;
  name: string;
  description: string;
  terrain: string;
  route: string[];
  theme: 'dorm' | 'court' | 'harbor' | 'station';
  artFrame: { sourceTop: number; sourceFloor: number; worldTop: number };
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
  expires: number;
}

export interface Attack {
  id: string;
  frame: number;
  connected: boolean;
  landed: boolean;
}

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
  guarding: boolean;
  attack: Attack | null;
  buffer: Command[];
  combo: number;
  controlled: number;
  protection: number;
  moving: boolean;
}

export type EventKind = 'swing' | 'hit' | 'block' | 'break' | 'whiff' | 'dash' | 'jump' | 'drop' | 'land' | 'ko';
export interface CombatEvent {
  kind: EventKind;
  source: 0 | 1;
  x: number;
  y: number;
  amount?: number;
}

export interface RoundResult {
  winner: 0 | 1 | null;
  reason: 'ko' | 'double-ko' | 'time' | 'tie';
}

export interface MatchState {
  frame: number;
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
