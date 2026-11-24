import type { EntityDefinition, EntityState } from './entities.js';

export type Impact = 'light' | 'medium' | 'heavy';
export const turretKinds = ['bolt', 'howitzer'] as const;
export type TurretKind = typeof turretKinds[number];

export type Side = -1 | 1;
export type Slot = 'A' | 'B' | 'C' | 'ULT';
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
  held?: ActionKey[];
  sampled?: Partial<Record<ActionKey, Stick>> | readonly Stick[];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A half-open range of zero-based action frames. */
export interface BoxWindow {
  from: number;
  to: number;
  boxes: Box[];
}

export interface HitWindow extends BoxWindow {
  group: string;
  damage?: number;
  hitstun?: number;
  blockstun?: number;
  guardCost?: number;
  push?: number;
  lift?: number;
  stop?: number;
  knockdown?: boolean;
}

export interface AudioClipRef {
  clip: string;
  volume?: number;
}

export interface HitFeedback {
  shape?: 'ring';
  color?: string;
  shake?: number;
  flash?: number;
  sound?: 'light' | 'heavy' | 'sharp';
  /** Optional impact clip from the attacking fighter's audio bank. */
  audio?: AudioClipRef;
}

export interface ActionAudioCue extends AudioClipRef {
  frame: number;
  /** Presentation-only random choice, including clip as the first candidate. */
  variants?: string[];
  channel?: 'sfx' | 'voice';
  stopOnInterrupt?: boolean;
}

interface ActionTiming {
  id: string;
  name?: string;
  slot: Slot;
  /** Other action slots required when this action's slot is pressed. */
  comboKeys?: Slot[];
  direction?: Direction;
  posture: 'ground' | 'air' | 'any';
  startup: number;
  active: number;
  recovery: number;
  linkOnly?: boolean;
  /** Hold each sprite cell from its zero-based action frame until the next key. */
  animation?: { frame: number; cell: number }[];
  /** Play clips once at their zero-based action frames. */
  audioTimeline?: ActionAudioCue[];
  /** Gaps and empty boxes leave the fighter without a hurt region. */
  hurtTimeline?: BoxWindow[];
}

export interface ProjectileDefinition {
  kind?: 'crate' | 'bolt' | 'grenade' | 'tear' | 'wave';
  life?: number;
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

export interface ActionDefinition extends ActionTiming {
  /** Authored whale kit hooks; serialized state, no renderer-side combat logic. */
  whale?: 'rice' | 'rice-up' | 'spin' | 'spin-up' | 'counter' | 'eat' | 'open-source';
  frog?: 'laugh' | 'global' | 'ascend' | 'crouch' | 'burrow' | 'evade';
  radial?: boolean;
  chainAfter?: number;
  guardHitsToBreak?: number;
  fixedDamage?: boolean;
  hitbox: Box;
  summon?: true;
  cutIn?: { at: number; duration: number };
  unblockable?: boolean;
  tearCost?: number;
  channel?: 'spray' | 'cry';
  slow?: number;
  advanceFrom?: number;
  advanceUntil?: number;
  activeAdvance?: number;
  chain?: { actionId: string; open: number; close: number };
  swingOnActive?: boolean;
  swingLead?: number;
  projectile?: ProjectileDefinition;
  impact?: Impact;
  /** Skill energy paid once when the action starts. */
  energyCost?: number;
  /** The first overlapping unconsumed group connects on each active frame. */
  hitTimeline?: HitWindow[];
  feedback?: HitFeedback;
  entities?: EntityDefinition[];
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
  airControl?: number;
  pose: 'strike' | 'sweep' | 'finish' | 'rise' | 'air';
}

/** A defensive B/C action. Its active frames catch a frontal hit on the ground. */
export interface CounterStance extends ActionTiming {
  slot: 'B' | 'C';
  posture: 'ground';
  counterTo: string;
  cancelOnHit?: never;
}

export type FighterAction = ActionDefinition | CounterStance;

export function isAttack(action: FighterAction | undefined): action is ActionDefinition {
  return Boolean(action && !('counterTo' in action));
}

export interface UltimateGain {
  onHit?: number;
  onHurt?: number;
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
  actions: FighterAction[];
  /** Frontal ground guard counter. whileGuarding opts into held guard instead of a fresh-press window. */
  guardCounter?: { windowFrames: number; actionId: string; whileGuarding?: boolean };
  ultimateCost?: number;
  ultimateGain?: UltimateGain;
  usesTears?: boolean;
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
    'transformer' | 'control-room' | 'conduit' | 'inductor' | 'elevator' | 'stair' |
    'audience-step' | 'audience-deck' | 'broadcast-booth' | 'lighting-bridge' | 'led-screen' | 'show-lift';
  travel?: { axis?: 'x' | 'y'; distance: number; period: number; dwell: number; phase: number };
}

export interface ArenaDefinition {
  id: string;
  name: string;
  description: string;
  terrain: string;
  // A ground-to-top route from each side of the opening.
  routes: Duo<string[]>;
  theme: 'dorm' | 'court' | 'harbor' | 'station' | 'broadcast';
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
  /** Consecutive draws that end the match. Defaults to two. */
  drawsToFinish?: number;
  guardMax: number;
  guardDelay: number;
  guardBreak: number;
  dashGuardCost?: { ground: number; air: number };
  dashInvulnerable?: boolean;
  dashPassThrough?: boolean;
  airDashPauseGravity?: boolean;
  inputBuffer: number;
  comboControlLimit: number;
  /** Positive number of playable ticks spent down before starting to rise. */
  knockdownFrames?: number;
  /** Positive number of playable ticks spent rising before control returns. */
  riseFrames?: number;
}

export interface MatchConfig {
  rules: Ruleset;
  arena: ArenaDefinition;
  fighters: Duo<FighterDefinition>;
  training?: boolean;
  /** Serialized deterministic rice chance; peers must share the seed. */
  randomSeed?: number;
}

export interface Command {
  key: ActionKey;
  keys?: ActionKey[];
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
  connectedGroups?: string[];
  queuedChain?: string[];
  released?: boolean;
  sustainedFrames?: number;
  hitTurrets?: TurretKind[];
  projectileSpawned?: boolean;
  spawnedEntities?: string[];
}

export type Recovery = { facing?: Side } &
  ({ phase: 'fall' } | { phase: 'down' | 'rise'; remaining: number });

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
  ascendUntil?: number;
  /** Presentation clocks use arena time, independent of interruptible hit poses. */
  ascendVisual?: { tick: number; x: number; y: number };
  ascendEndVisual?: { tick: number; x: number; y: number };
  frogCasts?: { id: string; tick: number; x: number; y: number; facing: Side; powered: boolean; startup: number; anchors?: {frame:number;x:number;y:number}[] }[];
  frogWarps?: {tick:number;fromX:number;fromY:number;toX:number;toY:number;powered:boolean;kind:'behind'|'burrow'}[];
  /** Empowered dodge presentation follows the real dash endpoint, including walls and platforms. */
  frogDodge?: {tick:number;fromX:number;fromY:number;toX:number;toY:number;arrivedAt?:number};
  frogFollowup?: boolean;

  bindUntil?: number;
  guardChain?: { source: number; count: number; until: number };
  jumpCount?: number;
  secondApex?: boolean;
  jumpOriginY?: number;
  poseEvent?: { kind: string; tick: number };
  x: number;
  y: number;
  vy: number;
  facing: Side;
  ground: string | null;
  ignorePlatform: string | null;
  hp: number;
  energy: number;
  slow: number;
  tearUnits?: number;
  walk?: WalkState;
  reaction?: HitReaction;
  guard: number;
  guardWait: number;
  guardBreak: number;
  hitstun: number;
  /** Airborne hit reaction that locks control until landing and allows follow-up hits. */
  launched?: boolean;
  blockstun: number;
  push: number;
  dash: number;
  /** True through the final tick of dash movement, including hitstop snapshots. */
  dashActive?: boolean;
  airActionUsed: boolean;
  guarding: boolean;
  /** Undefined when released, zero when held past the window, positive while armed. */
  guardCounterLeft?: number;
  attack: Attack | null;
  /** Starts on the next playable tick so even frame zero of a counter can hit. */
  pendingCounter?: string;
  buffer: Command[];
  combo: number;
  controlled: number;
  recovery: Recovery | null;
  moving: boolean;
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
  age?: number;
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
  support?: string;
}

export type EventKind = 'swing' | 'ultimate' | 'ultimate-no-energy' | 'hit' | 'block' | 'parry' | 'break' | 'whiff' | 'dash' | 'dash-no-stamina' | 'jump' | 'air-jump' |
  'pole-impact' | 'turret-land' | 'turret-ready' | 'turret-fire' | 'turret-burst' | 'grenade-impact' |
  'tear-splash' | 'tears-short' | 'wave-windup' | 'wave-cut-in' | 'wave-unavailable' |
  'summon-start' | 'summon-confirm' | 'summon-drop' | 'summon-catch' | 'summon-impact' |
  'drop' | 'land' | 'knockdown' | 'rise' | 'ko' | 'action-audio';
export interface CombatEvent {
  kind: EventKind;
  source: 0 | 1;
  x: number;
  y: number;
  amount?: number;
  impact?: Impact;
  actionId?: string;
  reaction?: HitReaction['kind'];
  facing?: Side;
  radius?: number;
  turretKind?: TurretKind;
  surface?: { left: number; right: number };
  requirement?: 'ground' | 'recovery';
  chain?: number;
  direction?: Side;
  heavy?: boolean;
  feedback?: HitFeedback;
  /** The attack identity survives removal from the fighter during this tick's contact resolution. */
  actionAudio?: { attack: Attack; cue: ActionAudioCue };
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
  projectiles: Projectile[];
  turrets: Record<TurretKind, Turret | null>;
  summon?: Summon;
  cutIn?: CutIn;
  entities?: EntityState[];
  nextEntityId?: number;
  randomState?: number;
}

export interface CutIn {
  source: 0 | 1;
  frame: number;
  duration: number;
}

export interface Summon {
  source: 0 | 1;
  actionId: string;
  facing: Side;
  x: number;
  y: number;
  rise: number;
  phase: 'cut-in' | 'fall' | 'impact';
  frame: number;
  carry?: { x: number; y: number; frame: number };
}

export const TICK_RATE = 60;
export const DEFAULT_KNOCKDOWN_FRAMES = 30;
export const DEFAULT_RISE_FRAMES = 18;
export const ENERGY_PER_STOCK = 100;
export const TEAR_UNITS_PER_POINT = TICK_RATE;
export const MAX_TEARS = 100;
export const MAX_ENERGY = 3 * ENERGY_PER_STOCK;
export const NEUTRAL: InputFrame = { x: 0, y: 0, pressed: [] };
