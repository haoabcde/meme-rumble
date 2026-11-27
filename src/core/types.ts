import type { EntityDefinition, EntityState } from './entities.js';

export type Impact = 'light' | 'medium' | 'heavy';
export type ImpactTier = Impact | 'launch' | 'guard' | 'guard-break' | 'parry' | 'ultimate';
export const turretKinds = ['bolt', 'howitzer'] as const;
export type TurretKind = typeof turretKinds[number];
export type TurretSlot = TurretKind | `${TurretKind}-second`;

export type Side = -1 | 1;
export type Slot = 'A' | 'B' | 'C' | 'ULT';
export type Direction = 'up' | 'down' | 'forward' | 'back';
export type ActionKey = Slot | 'jump' | 'dash';
export const maxPendingPresses = 24;
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
  kind?: 'crate' | 'bolt' | 'grenade' | 'tear' | 'wave' | 'kq-orb' | 'sheer-heart' | 'spark' | 'sword-wave';
  life?: number;
  turret?: TurretKind;
  blastRadius?: number;
  homing?: number;
  markFrames?: number;
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
  timeStop?: { teleportAt: number; flickAt: number; releaseAt: number };
  awakenJo?: boolean;
  requiresJo?: boolean;
  joReplacement?: string;
  joDetonateReplacement?: string;
  detonateBomb?: boolean;
  applyCrystalMark?: number;
  shatterCrystal?: { bonusDamage: number; bonusLift?: number; bonusPush?: number };
  detonateCrystal?: boolean;
  plantPylon?: { radius: number; duration: number; offsetX?: number };
  dive?: { vx: number; vy: number; piercePlatforms?: boolean; carryTarget?: boolean };
  rise?: { at: number; vx: number; vy: number };
  passThrough?: boolean;
  liftRequiresPrevHit?: boolean;
  standAttack?: 'jab' | 'hook' | 'uppercut' | 'ora' | 'dive' | 'slide' | 'sheer-heart' | 'upper-ora';
  energyGain?: number;
  /** Advance only this action's entrance until its startup finishes. */
  cinematicFreeze?: true;
  unblockable?: boolean;
  tearCost?: number;
  channel?: 'spray' | 'cry';
  slow?: number;
  advanceFrom?: number;
  advanceUntil?: number;
  activeAdvance?: number;
  chain?: { actionId: string; open: number; close: number; requiresHit?: boolean };
  swingOnActive?: boolean;
  swingLead?: number;
  projectile?: ProjectileDefinition;
  impact?: Impact;
  /** Public energy paid once when an ultimate starts. */
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
  theme: 'dorm' | 'court' | 'harbor' | 'station' | 'ring' | 'broadcast';
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
  cinematicFreezeUntil?: number;
  connected: boolean;
  landed: boolean;
  prevLanded?: boolean;
  guardLinked?: boolean;
  connectedGroups?: string[];
  queuedChain?: string[];
  released?: boolean;
  sustainedFrames?: number;
  hitTurrets?: TurretKind[];
  projectileSpawned?: boolean;
  spawnedEntities?: string[];
  diveCarry?: boolean;
  standX?: number;
  standY?: number;
  standFacing?: Side;
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

export interface MotionStamp {
  mode:string;tick:number;x:number;y:number;facing:Side;phase:number;vy:number;
  ground:boolean;moving:boolean;stun:number;event:string;eventAge:number;attackId?:string;attackFrame?:number;
}
export interface FighterState {
  /** Serialized presentation history; never read by collision or control rules. */
  motionVisual?: {stamp:MotionStamp;from?:MotionStamp;changed:number;turnTick:number;turnFrom:Side};
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
  joAwakened?: boolean;
  bombMark?: { source: 0 | 1; remaining: number };
  crystalMark?: { source: 0 | 1; remaining: number };
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
  /** The next push tick lends or repays part of the following tick's travel. */
  pushAccent?: number;
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
  boosted?: boolean;
  age?: number;
  locked?: number;
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
  charge?: number;
}

export interface PowerPylon {
  owner: 0 | 1;
  x: number;
  y: number;
  facing: Side;
  age: number;
  remaining: number;
  radius: number;
  support?: string;
}

export type UltimateUnavailable = 'unbound' | 'ground' | 'air' | 'recovery' | 'energy' | 'tears' | 'cinematic' | 'contested';

export type EventKind = 'swing' | 'ultimate' | 'ultimate-no-energy' | 'ultimate-unavailable' | 'hit' | 'block' | 'parry' | 'break' | 'whiff' | 'dash' | 'dash-no-stamina' | 'jump' | 'air-jump' |
  'skill-unavailable' |
  'pole-impact' | 'turret-land' | 'turret-ready' | 'turret-fire' | 'turret-burst' | 'grenade-impact' |
  'tear-splash' | 'tears-short' | 'wave-windup' | 'wave-cut-in' | 'wave-unavailable' | 'jo-shatter' |
  'kq-plant' | 'kq-lock' | 'kq-detonate' |
  'crystal-plant' | 'crystal-shatter' | 'crystal-spire' | 'xiranite-burst' | 'pylon-plant' | 'pylon-expire' |
  'time-stop-start' | 'time-stop-warp' | 'time-stop-flick' | 'time-stop-hit' | 'time-stop-release' |
  'summon-start' | 'summon-confirm' | 'summon-drop' | 'summon-catch' | 'summon-impact' |
  'drop' | 'land' | 'knockdown' | 'rise' | 'ko' | 'action-audio';
export interface CombatEvent {
  kind: EventKind;
  source: 0 | 1;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  amount?: number;
  impact?: Impact;
  impactTier?: ImpactTier;
  /** The actual shared stop imposed on the contact frame, after its combo cap. */
  hitstop?: number;
  trade?: true;
  actionId?: string;
  reaction?: HitReaction['kind'];
  facing?: Side;
  radius?: number;
  turretKind?: TurretKind;
  surface?: { left: number; right: number };
  requirement?: 'ground' | 'recovery';
  ultimateReason?: UltimateUnavailable;
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
  turrets: Record<TurretKind, Turret | null> & Partial<Record<TurretSlot, Turret | null>>;
  powerPylons?: Duo<PowerPylon | null>;
  summon?: Summon;
  cutIn?: CutIn;
  timeStop?: TimeStop;
  entities?: EntityState[];
  nextEntityId?: number;
  randomState?: number;
}

export interface TimeStop {
  source: 0 | 1;
  actionId: string;
  frame: number;
  teleportAt: number;
  flickAt: number;
  releaseAt: number;
  originX?: number;
  originY?: number;
  flicked?: boolean;
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
