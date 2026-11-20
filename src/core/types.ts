export type Side = -1 | 1;
export type Slot = 'A' | 'B' | 'C';
export type Direction = 'up' | 'down' | 'forward' | 'back';
export type ActionKey = Slot | 'jump' | 'dash';
export type Duo<T> = [T, T];
export type Axis = -1 | 0 | 1;
export type Impact = 'light' | 'medium' | 'heavy';
export const turretKinds = ['bolt', 'howitzer'] as const;
export type TurretKind = typeof turretKinds[number];

export interface Stick {
  x: Axis;
  y: Axis;
}

export interface InputFrame extends Stick {
  pressed: ActionKey[];
  sampled?: Partial<Record<ActionKey, Stick>> | Stick[];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProjectileDefinition {
  kind?: 'crate' | 'bolt' | 'grenade';
  turret?: TurretKind;
  blastRadius?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  reach: number;
  radius: number;
  halfWidth?: number;
}

export interface ActionDefinition {
  id: string;
  slot: Slot;
  energyCost?: 1 | 3;
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
  advanceFrom?: number;
  advanceUntil?: number;
  activeAdvance?: number;
  cancelOnHit?: Slot[];
  chain?: { actionId: string; open: number; close: number };
  followUpOnly?: boolean;
  swingOnActive?: boolean;
  swingLead?: number;
  projectile?: ProjectileDefinition;
  impact?: Impact;
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
  expires: number;
}

export interface Attack {
  id: string;
  frame: number;
  connected: boolean;
  landed: boolean;
  hitTurrets?: TurretKind[];
  queuedChain?: string[];
}

export interface WalkState {
  direction: 'forward' | 'back';
  distance: number;
}

export interface HitReaction {
  kind: 'light' | 'heavy' | 'air';
  elapsed: number;
  facing: Side;
  landedAt?: number;
}

export interface FighterState {
  x: number;
  y: number;
  vy: number;
  facing: Side;
  ground: string | null;
  ignorePlatform: string | null;
  hp: number;
  energy: number;
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
  walk?: WalkState;
  reaction?: HitReaction;
}

export interface Projectile {
  actionId: string;
  source: 0 | 1;
  facing: Side;
  // Position of the leading tip in world space.
  x: number;
  y: number;
  vx: number;
  vy: number;
  connected: boolean;
  hitTurrets?: TurretKind[];
}

export interface Turret {
  kind: TurretKind;
  owner: 0 | 1;
  x: number;
  y: number;
  age: number;
  hp: number;
  facing: Side;
}

export type EventKind = 'swing' | 'hit' | 'block' | 'break' | 'whiff' | 'dash' | 'jump' | 'drop' | 'land' |
  'pole-impact' | 'energy-short' | 'turret-land' | 'turret-ready' | 'turret-fire' | 'turret-burst' | 'grenade-impact' | 'ko';
export interface CombatEvent {
  kind: EventKind;
  source: 0 | 1;
  x: number;
  y: number;
  amount?: number;
  impact?: Impact;
  actionId?: string;
  facing?: Side;
  radius?: number;
  turretKind?: TurretKind;
  surface?: { left: number; right: number };
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
  projectiles: Projectile[];
  turrets: Record<TurretKind, Turret | null>;
  result: RoundResult | null;
  winner: 0 | 1 | null;
}

export const TICK_RATE = 60;
export const ENERGY_PER_BAR = 100;
export const MAX_ENERGY = 3 * ENERGY_PER_BAR;
export const NEUTRAL: InputFrame = { x: 0, y: 0, pressed: [] };
