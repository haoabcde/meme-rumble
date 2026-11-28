import { gagaActionIds } from '../content/fighters/gaga.js';
import { bananaActionIds } from '../content/fighters/banana.js';
import type { FighterAudioBank } from '../content/fighter-kit.js';
import { actionFor } from '../core/match.js';
import { frogPowered } from '../core/frog-kit.js';
import { WHALE_RULES } from '../core/whale-kit.js';
import type { ActionAudioCue, Attack, CombatEvent, Duo, EventKind, FighterAction, HitFeedback, MatchConfig, MatchState } from '../core/types.js';
import { sampleLevel, soundTarget, calibratedGain } from './audio-levels.js';
import { gagaContact, type GagaContact } from './gaga-contact.js';
import { poleSwingFor, type PoleSwing } from './gaga-pole-fx.js';

type Tone = [number, number, number, OscillatorType, number];
type Noise = [frequency: number, duration: number, volume: number];
type Wind = [start: number, peak: number, end: number, duration: number, volume: number];
const sampleVolumes = {
  jab: .45,
  backhand: .48,
  'pole-sweep': .42,
  'pole-reverse': .42,
  'pole-launch': .51,
  'pole-hit': .38,
  'pole-heavy-hit': .52,
  'pole-ground': .42,
  'feet-land': .24,
  'body-land': .48,
  guard: .38,
  'slide-call': .62,
  'turret-land': .35,
  'turret-ready': .34,
  'turret-bolt': .34,
  'grenade-impact': .42,
  'dijiang-impact': .55,
  'victory-lalala': .8
};
export type GagaSample = keyof typeof sampleVolumes;

const bananaSampleVolumes = {
  'ora-1': .66,
  'ora-rush': .68,
  'ora-finish': .76,
  'kq-summon': .66,
  'kq-click': .62,
  'the-world': .88
};
export type BananaSample = keyof typeof bananaSampleVolumes;

const joOraActions = new Set<string>([
  bananaActionIds.joJab,
  bananaActionIds.joCross,
  bananaActionIds.joPounce,
  bananaActionIds.joUppercut,
  bananaActionIds.joOra,
  bananaActionIds.joLift,
  bananaActionIds.joSlide,
  bananaActionIds.joAntiAir,
  bananaActionIds.joAirDive
]);

/** A sample playing to the end while a character shot runs. */
export interface SampleVoice {
  /** Length of the sample in seconds. */
  duration: number;
  /** Peak loudness heard this frame, from 0 to 1. */
  level(): number;
  /** Fades out quickly instead of playing to the end. */
  stop(): void;
}
declare const __GAGA_SOUNDS__: Partial<Record<GagaSample, string>>;
declare const __BANANA_SOUNDS__: Partial<Record<BananaSample, string>>;
declare const __BGM_SOUNDS__: Partial<Record<'main' | 'menu', string>>;

type HitSound = NonNullable<HitFeedback['sound']> | 'medium';
type Seat = CombatEvent['source'];
type EmbeddedAudio = Readonly<Record<string, string>>;
type Playback = {
  source: AudioScheduledSourceNode;
  gain: GainNode;
  voiceSeat?: Seat;
  musicSeat?: Seat;
  interruptibleAttack?: Attack;
};
type ContactSample = { buffer: AudioBuffer; volume: number };
type TrackedAction = { attack: Attack; action: FighterAction };

const seats = [0, 1] as const;

function level(value: number | undefined, fallback = 1) {
  return value === undefined || !Number.isFinite(value) ? fallback : Math.max(0, Math.min(1, value));
}

const hitTones: Record<HitSound, Tone> = {
  light: [213, 87, .063, 'triangle', .115],
  medium: [164, 58, .098, 'triangle', .16],
  heavy: [126, 42, .133, 'triangle', .21],
  sharp: [440, 138, .075, 'sawtooth', .09]
};

const hitTransients: Record<HitSound, Noise> = {
  light: [1850, .031, .12], medium: [1200, .046, .14],
  heavy: [620, .067, .17], sharp: [3350, .035, .12]
};
const hitToneRanks: Record<HitSound, number> = { light: 0, medium: 1, sharp: 2, heavy: 3 };

function hitSound(event: CombatEvent): HitSound | undefined {
  if (event.kind !== 'hit') return;
  if (event.feedback?.sound) return event.feedback.sound;
  const tier = event.impactTier ?? event.impact ?? (event.heavy ? 'heavy' : 'light');
  if (tier === 'ultimate' || tier === 'launch' || tier === 'heavy') return 'heavy';
  return tier === 'medium' ? 'medium' : 'light';
}

const tones: Partial<Record<EventKind, Tone>> = {
  swing: [316, 168, .06, 'triangle', .042],
  ultimate: [260, 540, .17, 'triangle', .12],
  block: [870, 430, .085, 'sine', .14],
  parry: [740, 1480, .12, 'sine', .16],
  break: [191, 52, .22, 'square', .11],
  dash: [210, 79, .085, 'triangle', .054],
  jump: [183, 340, .09, 'triangle', .038],
  'air-jump': [298, 562, .09, 'triangle', .052],
  drop: [226, 123, .07, 'triangle', .029],
  land: [104, 53, .075, 'triangle', .026],
  knockdown: [128, 42, .114, 'triangle', .14],
  rise: [192, 310, .071, 'sine', .044],
  'pole-impact': [113, 38, .23, 'triangle', .32],
  'crystal-plant': [880, 1320, .09, 'sine', .14],
  'crystal-shatter': [190, 58, .26, 'triangle', .34],
  'crystal-spire': [240, 82, .20, 'triangle', .28],
  'xiranite-burst': [260, 88, .22, 'triangle', .28],
  'pylon-plant': [175, 62, .22, 'triangle', .28],
  'pylon-expire': [520, 210, .16, 'sine', .14],
  'turret-land': [145, 65, .14, 'triangle', .18],
  'turret-ready': [235, 92, .18, 'triangle', .19],
  'turret-fire': [1020, 285, .085, 'triangle', .105],
  'turret-burst': [123, 39, .26, 'sawtooth', .14],
  'grenade-impact': [105, 38, .29, 'triangle', .34],
  'summon-start': [128, 205, .20, 'triangle', .15],
  'summon-confirm': [912, 457, .13, 'square', .10],
  'summon-drop': [238, 62, .59, 'sawtooth', .14],
  'summon-catch': [270, 89, .12, 'triangle', .28],
  'summon-impact': [104, 36, .64, 'triangle', .53],
  ko: [121, 44, .42, 'triangle', .14]
};
const poleSamples: Record<PoleSwing, GagaSample> = {
  sweep: 'pole-sweep', reverse: 'pole-reverse', launch: 'pole-launch'
};
const gagaHitSamples: Partial<Record<string, GagaSample>> = {
  [gagaActionIds.jab]: 'jab',
  [gagaActionIds.backhand]: 'backhand',
  [gagaActionIds.poleSweep]: 'pole-hit',
  [gagaActionIds.poleBacksweep]: 'pole-hit',
  [gagaActionIds.poleLaunch]: 'pole-heavy-hit',
  [gagaActionIds.airThrow]: 'pole-heavy-hit'
};
const turretSamples: Partial<Record<EventKind, GagaSample>> = {
  'turret-land': 'turret-land', 'turret-ready': 'turret-ready', 'grenade-impact': 'grenade-impact'
};

function gagaSampleFor(event: CombatEvent, fighters: MatchConfig['fighters'], swing?: PoleSwing): GagaSample | undefined {
  const fromGaga = fighters[event.source].id === 'gaga';
  if (event.kind === 'block' && (fromGaga || fighters[1 - event.source].id === 'gaga')) return 'guard';
  if (!fromGaga) return;
  if (event.kind === 'land') return 'feet-land';
  if (event.kind === 'knockdown') return 'body-land';
  if (event.kind === 'pole-impact') return 'pole-ground';
  if (swing) return poleSamples[swing];
  if (event.kind === 'swing' && event.actionId === gagaActionIds.airThrow) return 'pole-reverse';
  if (event.kind === 'swing' && event.actionId === gagaActionIds.slide) return 'slide-call';
  if (event.kind === 'hit' && event.actionId) return gagaHitSamples[event.actionId];
  if (event.kind === 'turret-fire' && event.turretKind === 'bolt') return 'turret-bolt';
  return turretSamples[event.kind];
}

const poleWind: Record<PoleSwing, Wind> = {
  sweep: [320, 1080, 190, .27, .58],
  reverse: [280, 890, 158, .29, .62],
  launch: [210, 1320, 360, .32, .64]
};
const actionWinds: Partial<Record<string, Wind>> = {
  [gagaActionIds.jab]: [920, 2520, 680, .086, .55],
  [gagaActionIds.backhand]: [590, 1840, 360, .125, .64],
  [gagaActionIds.airThrow]: [360, 1480, 210, .23, .66],
  [gagaActionIds.swordSlash]: [640, 2180, 320, .13, .42],
  [gagaActionIds.swordRise]: [320, 2740, 490, .20, .48],
  [gagaActionIds.xiraniteBurst]: [240, 1960, 280, .21, .46],
  [gagaActionIds.airDive]: [440, 2400, 310, .24, .46],
  [gagaActionIds.overclock]: [220, 960, 380, .15, .42],
  [gagaActionIds.turret]: [410, 1320, 230, .135, .45],
  [gagaActionIds.howitzer]: [340, 1250, 190, .155, .49],
  [bananaActionIds.jab]: [1700, 4200, 940, .065, .24],
  [bananaActionIds.backhand]: [1400, 3700, 710, .08, .27],
  [bananaActionIds.headbutt]: [340, 1460, 190, .13, .34],
  [bananaActionIds.cry]: [620, 2180, 310, .24, .32],
  [bananaActionIds.lift]: [390, 3100, 860, .17, .30],
  [bananaActionIds.slide]: [960, 1920, 230, .30, .32],
  [bananaActionIds.tear]: [1800, 3600, 520, .105, .22],
  [bananaActionIds.pressure]: [340, 2360, 205, .24, .37],
  [bananaActionIds.uppercut]: [290, 2860, 165, .34, .43],
  [bananaActionIds.recharge]: [420, 2460, 180, .48, .38],
  [bananaActionIds.wave]: [220, 1520, 103, .58, .52],
  [bananaActionIds.joAwaken]: [180, 1800, 110, .62, .55],
  [bananaActionIds.joJab]: [1400, 3800, 720, .09, .30],
  [bananaActionIds.joCross]: [1100, 3200, 520, .12, .35],
  [bananaActionIds.joPounce]: [380, 1900, 210, .18, .38],
  [bananaActionIds.joUppercut]: [320, 2900, 480, .20, .40],
  [bananaActionIds.joOra]: [900, 3600, 420, .28, .44],
  [bananaActionIds.joLift]: [340, 3200, 620, .22, .42],
  [bananaActionIds.joSlide]: [820, 2200, 260, .30, .38],
  [bananaActionIds.joSheerHeart]: [540, 2000, 290, .18, .28],
  [bananaActionIds.joAntiAir]: [240, 3100, 440, .32, .46],
  [bananaActionIds.kqBomb]: [620, 2200, 340, .16, .28],
  [bananaActionIds.kqDetonate]: [1800, 4200, 900, .06, .16],
  [bananaActionIds.joAirDive]: [480, 2600, 320, .28, .44],
  [bananaActionIds.theWorld]: [240, 1100, 95, .65, .58]
};
const earthTransient: Noise = [730, .16, .44];
const dijiangDiveRoar: Wind = [105, 1450, 210, .60, .66];
const dijiangImpactCrack: Noise = [1220, .13, .51];
const dijiangImpactRumble: Noise = [155, .61, .61];

const gagaSounds: Record<GagaContact, { tone: Tone; transient: Noise }> = {
  light: { tone: [240, 105, .07, 'triangle', .17], transient: [2350, .041, .27] },
  medium: { tone: [175, 61, .105, 'triangle', .22], transient: [1750, .06, .32] },
  heavy: { tone: [133, 40, .19, 'triangle', .32], transient: [1280, .1, .36] },
  pole: { tone: [410, 144, .12, 'triangle', .20], transient: [2930, .059, .31] },
  lift: { tone: [160, 540, .13, 'triangle', .16], transient: [3150, .068, .29] },
  slide: { tone: [161, 48, .16, 'sawtooth', .14], transient: [950, .13, .35] },
  guard: { tone: [870, 435, .09, 'triangle', .13], transient: [4600, .041, .23] }
};

type BananaSound = { tone: Tone; transient?: Noise; cry?: [duration: number, volume: number] };
type BananaActionId = typeof bananaActionIds[keyof typeof bananaActionIds];

const bananaHits: Record<BananaActionId, BananaSound> = {
  [bananaActionIds.jab]: { tone: [980, 420, .055, 'sine', .10], transient: [4100, .038, .20] },
  [bananaActionIds.backhand]: { tone: [870, 330, .075, 'sine', .12], transient: [3500, .053, .23] },
  [bananaActionIds.headbutt]: { tone: [220, 68, .14, 'triangle', .19], transient: [1250, .085, .24] },
  [bananaActionIds.cry]: { tone: [510, 155, .20, 'sine', .18], transient: [2250, .19, .29], cry: [.25, .07] },
  [bananaActionIds.lift]: { tone: [250, 790, .15, 'sine', .16], transient: [2600, .10, .24] },
  [bananaActionIds.slide]: { tone: [620, 125, .20, 'sine', .15], transient: [1650, .22, .28] },
  [bananaActionIds.tear]: { tone: [1220, 330, .11, 'sine', .14], transient: [2800, .09, .20] },
  [bananaActionIds.pressure]: { tone: [390, 118, .115, 'triangle', .15], transient: [2350, .11, .28] },
  [bananaActionIds.uppercut]: { tone: [210, 57, .21, 'triangle', .23], transient: [1980, .17, .31] },
  [bananaActionIds.recharge]: { tone: [280, 65, .28, 'triangle', .24], transient: [1950, .30, .32], cry: [.32, .07] },
  [bananaActionIds.wave]: { tone: [140, 41, .28, 'triangle', .31], transient: [1350, .31, .35] },
  [bananaActionIds.joAwaken]: { tone: [160, 44, .32, 'triangle', .34], transient: [1450, .28, .36] },
  [bananaActionIds.joJab]: { tone: [620, 180, .09, 'triangle', .22], transient: [2800, .05, .26] },
  [bananaActionIds.joCross]: { tone: [520, 140, .11, 'triangle', .24], transient: [2400, .07, .28] },
  [bananaActionIds.joPounce]: { tone: [260, 78, .15, 'triangle', .22], transient: [1400, .09, .26] },
  [bananaActionIds.joUppercut]: { tone: [220, 620, .18, 'triangle', .26], transient: [2200, .12, .30] },
  [bananaActionIds.joOra]: { tone: [420, 95, .14, 'triangle', .28], transient: [2600, .08, .32] },
  [bananaActionIds.joLift]: { tone: [240, 740, .19, 'triangle', .28], transient: [2500, .12, .30] },
  [bananaActionIds.joSlide]: { tone: [520, 110, .18, 'triangle', .24], transient: [1850, .16, .30] },
  [bananaActionIds.joSheerHeart]: { tone: [145, 42, .26, 'triangle', .32], transient: [1900, .14, .34] },
  [bananaActionIds.joAntiAir]: { tone: [220, 780, .18, 'triangle', .26], transient: [2500, .11, .30] },
  [bananaActionIds.kqBomb]: { tone: [440, 190, .11, 'sine', .16], transient: [2400, .06, .22] },
  [bananaActionIds.kqDetonate]: { tone: [145, 48, .12, 'triangle', .22] },
  [bananaActionIds.joAirDive]: { tone: [200, 58, .18, 'triangle', .28], transient: [2200, .11, .32] },
  [bananaActionIds.theWorld]: { tone: [145, 36, .42, 'triangle', .36], transient: [1500, .28, .42] }
};
const bananaEvents: Partial<Record<EventKind, BananaSound>> = {
  'tear-splash': { tone: [750, 105, .24, 'sine', .18], transient: [2000, .19, .28] },
  'kq-plant': { tone: [920, 480, .12, 'sine', .16], transient: [3200, .05, .20] },
  'time-stop-start': { tone: [280, 36, .72, 'sawtooth', .28], transient: [1100, .28, .36] },
  'time-stop-flick': { tone: [240, 62, .12, 'triangle', .28], transient: [2600, .06, .30] },
  'time-stop-hit': { tone: [210, 56, .10, 'triangle', .26], transient: [2400, .05, .28] },
  'time-stop-release': { tone: [145, 30, .55, 'triangle', .42], transient: [1700, .35, .45] },
  'wave-windup': { tone: [78, 187, .24, 'sine', .12], transient: [550, .19, .14] },
  'wave-cut-in': { tone: [300, 64, .62, 'triangle', .21], transient: [820, .51, .23], cry: [.64, .13] },
  'jo-shatter': { tone: [210, 34, .46, 'triangle', .38], transient: [3400, .20, .38] },
  'kq-lock': { tone: [880, 1320, .09, 'square', .16], transient: [3800, .04, .18] }
};

export class FightAudio {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private sfx: GainNode | null = null;
  private voice: GainNode | null = null;
  private bgm: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private samples = new Map<GagaSample, AudioBuffer>();
  private bananaSamples = new Map<BananaSample, AudioBuffer>();
  private bgmSamples = new Map<'main' | 'menu', AudioBuffer>();
  private bgmLoading = new Set<'main' | 'menu'>();
  private samplesStarted = false;
  private bgmGains: Record<'main' | 'menu', number> = { main: .24, menu: .24 };
  private bgmActive = false;
  private bgmTrack: 'main' | 'menu' = 'main';
  private bgmPlayback: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private bgmDucked = false;
  private oraVoices = new Map<number, { source: AudioBufferSourceNode; gain: GainNode }>();
  private activeRushUntil = new Map<number, number>();
  private banks: Duo<FighterAudioBank | undefined> = [undefined, undefined];
  private sources: EmbeddedAudio = {};
  private buffers = new Map<string, AudioBuffer | undefined>();
  private levels = new Map<string, { peak: number; rms: number }>();
  private reported = new Set<string>();
  private playing = new Set<Playback>();
  private actions: Duo<TrackedAction | undefined> = [undefined, undefined];
  private round: number | undefined;
  private paused = false;
  private activated = false;
  private soundEnabled = true;
  private soundVolume = .7;
  private effectVolume = 1;
  private dialogueVolume = 1;
  private musicVolume = 1;
  private entityAges = new Map<number, number>();

  get enabled() { return this.soundEnabled; }
  set enabled(value: boolean) {
    this.soundEnabled = value;
    this.updateVolume();
    this.syncBgm();
  }

  get volume() { return this.soundVolume; }
  set volume(value: number) {
    this.soundVolume = level(value, .7);
    this.updateVolume();
  }

  get sfxVolume() { return this.effectVolume; }
  set sfxVolume(value: number) {
    this.effectVolume = level(value);
    this.updateVolume();
  }

  get voiceVolume() { return this.dialogueVolume; }
  set voiceVolume(value: number) {
    this.dialogueVolume = level(value);
    this.updateVolume();
  }

  get bgmVolume() { return this.musicVolume; }
  set bgmVolume(value: number) {
    this.musicVolume = level(value);
    this.updateVolume();
  }

  private updateVolume() {
    if (this.output) this.output.gain.value = this.enabled ? this.volume : 0;
    if (this.sfx) this.sfx.gain.value = this.sfxVolume;
    if (this.voice) this.voice.gain.value = this.voiceVolume;
    if (this.bgm) this.bgm.gain.value = this.bgmVolume;
  }

  configure(banks: Duo<FighterAudioBank | undefined>, sources: EmbeddedAudio) {
    this.stopAll(false);
    this.banks = banks;
    if (this.sources !== sources) {
      this.sources = sources;
      this.buffers = new Map();
      this.levels.clear();
      this.reported.clear();
    }
    if (banks.some(bank => bank && Object.keys(bank).length)) this.ensureContext();
    this.preload();
  }

  stopAll(stopBgm = true) {
    for (const playback of this.playing) this.stop(playback);
    const now = this.context?.currentTime ?? 0;
    for (const seat of [...this.oraVoices.keys()]) this.stopOraVoice(seat, now, .03);
    this.activeRushUntil.clear();
    this.actions = [undefined, undefined];
    this.round = undefined;
    this.entityAges.clear();
    if (stopBgm) {
      this.bgmActive = false;
      this.stopBgmPlayback();
      this.bgmSamples.clear();
    } else {
      this.syncBgmDuck(false);
    }
  }

  setBgmActive(active: boolean) {
    if (this.bgmActive === active && (!active || this.bgmPlayback)) return;
    this.bgmActive = active;
    if (!active) this.bgmSamples.clear();
    this.syncBgm();
  }

  /** 切换曲目(主界面 menu / 对局 main), 曲目没变时不做任何事 */
  setBgmTrack(track: 'main' | 'menu') {
    if (this.bgmTrack === track) return;
    this.bgmTrack = track;
    this.stopBgmPlayback();
    this.bgmSamples.clear();
    this.syncBgm();
  }

  setPaused(value: boolean) {
    if (this.paused === value) return;
    this.paused = value;
    this.applyPlaybackState();
  }

  private applyPlaybackState() {
    if (!this.context || !this.activated) return;
    // Issue both requests even when the previous state change has not resolved yet.
    const change = this.paused ? this.context.suspend() : this.context.resume();
    void change.catch(() => {});
  }

  private report(message: string, detail?: unknown) {
    if (this.reported.has(message)) return;
    this.reported.add(message);
    console.warn('[FightAudio] ' + message, detail);
  }

  private preload() {
    const context = this.context;
    if (!context) return;
    if (!this.samplesStarted) this.loadSamples(context);
    for (const bank of this.banks) {
      for (const { src } of Object.values(bank ?? {})) {
        if (this.buffers.has(src)) continue;
        this.buffers.set(src, undefined);
        void this.decode(context, src, this.buffers);
      }
    }
  }

  private async decode(context: AudioContext, src: string, buffers: Map<string, AudioBuffer | undefined>) {
    try {
      const url = Object.hasOwn(this.sources, src) ? this.sources[src] : '';
      if (!url) throw new Error('Missing embedded audio');
      let raw: ArrayBuffer;
      if (url.startsWith('data:')) {
        const payload = /^data:audio\/[^;,]+;base64,(.+)$/.exec(url)?.[1];
        if (!payload) throw new Error('Expected a base64 audio data URL');
        raw = Uint8Array.from(atob(payload), character => character.charCodeAt(0)).buffer;
      } else if (/^(?:\.?\/|https?:\/\/)/i.test(url)) {
        const response = await fetch(url);
        if (buffers !== this.buffers) return;
        if (!response.ok) throw new Error('HTTP ' + response.status);
        raw = await response.arrayBuffer();
        if (buffers !== this.buffers) return;
      } else {
        throw new Error('Expected an audio URL or base64 data URL');
      }
      const buffer = await context.decodeAudioData(raw);
      if (buffers === this.buffers) {
        buffers.set(src, buffer);
        this.levels.set(src, sampleLevel(Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i))));
      }
    } catch (error) {
      if (buffers === this.buffers) this.report('Unable to preload ' + src, error);
    }
  }

  private ensureContext() {
    const AudioContextClass = globalThis.AudioContext ??
      (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (this.context || !AudioContextClass) return;
    try {
      this.context = new AudioContextClass();
    } catch (error) {
      this.report('Unable to open an audio device', error);
      return;
    }
    this.output = this.context.createGain();
    this.sfx = this.context.createGain();
    this.voice = this.context.createGain();
    this.bgm = this.context.createGain();
    this.sfx.connect(this.output);
    this.voice.connect(this.output);
    this.bgm.connect(this.output);
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -6;
    compressor.knee.value = 6;
    compressor.ratio.value = 12;
    compressor.attack.value = .003;
    compressor.release.value = .18;
    this.output.connect(compressor).connect(this.context.destination);
    this.updateVolume();
    this.loadSamples(this.context);
  }

  enableFromGesture() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.context) return;
    this.activated = true;
    this.preload();
    this.applyPlaybackState();
    this.syncBgm();
  }

  private decodeBank<T extends string>(ctx: AudioContext, bank: Partial<Record<T, string>> | undefined,
    target: Map<T, AudioBuffer>, onLoaded?: (name: T, buffer: AudioBuffer) => void) {
    if (!bank) return;
    for (const name of Object.keys(bank) as T[]) {
      const encoded = bank[name];
      if (!encoded) continue;
      if (!encoded.startsWith('data:') && (encoded.includes('/') || encoded.startsWith('http'))) {
        void fetch(encoded)
          .then(response => {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.arrayBuffer();
          })
          .then(bytes => ctx.decodeAudioData(bytes))
          .then(buffer => {
            target.set(name, buffer);
            onLoaded?.(name, buffer);
          })
          .catch(() => {});
        continue;
      }
      const payload = encoded.startsWith('data:')
        ? (/^data:audio\/[^;,]+;base64,(.+)$/.exec(encoded)?.[1] ?? '')
        : encoded;
      if (!payload) continue;
      const bytes = Uint8Array.from(atob(payload), value => value.charCodeAt(0));
      void ctx.decodeAudioData(bytes.buffer)
        .then(buffer => {
          target.set(name, buffer);
          onLoaded?.(name, buffer);
        })
        .catch(() => {});
    }
  }

  private loadSamples(ctx: AudioContext) {
    if (this.samplesStarted) return;
    this.samplesStarted = true;
    if (typeof __GAGA_SOUNDS__ !== 'undefined') this.decodeBank(ctx, __GAGA_SOUNDS__, this.samples);
    if (typeof __BANANA_SOUNDS__ !== 'undefined') this.decodeBank(ctx, __BANANA_SOUNDS__, this.bananaSamples);
  }

  private loadBgm(ctx: AudioContext, track: 'main' | 'menu') {
    if (this.bgmLoading.has(track) || typeof __BGM_SOUNDS__ === 'undefined') return;
    const src = __BGM_SOUNDS__[track];
    if (!src) return;
    this.bgmLoading.add(track);
    const bytes = src.startsWith('data:')
      ? Promise.resolve(Uint8Array.from(atob(src.split(',')[1]), value => value.charCodeAt(0)).buffer)
      : fetch(src).then(response => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.arrayBuffer();
      });
    void bytes.then(data => ctx.decodeAudioData(data)).then(buffer => {
      this.bgmLoading.delete(track);
      if (this.bgmTrack !== track || !this.bgmActive) return;
      this.bgmSamples.clear();
      this.bgmSamples.set(track, buffer);
      if (typeof buffer.getChannelData === 'function' && buffer.numberOfChannels > 0) {
        const stats = sampleLevel(Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i)));
        this.bgmGains[track] = Math.min(.32, calibratedGain(stats, -24));
      }
      this.syncBgm();
    }).catch(error => {
      this.bgmLoading.delete(track);
      this.report('Unable to load background music', error);
    });
  }

  private stopBgmPlayback() {
    const active = this.bgmPlayback;
    if (!active) return;
    this.bgmPlayback = null;
    this.bgmDucked = false;
    active.source.onended = null;
    try { active.source.stop(); } catch { /* Already stopped. */ }
    active.source.disconnect();
    active.gain.disconnect();
  }

  private hasSpecialMusic() {
    for (const playback of this.playing) {
      if (playback.musicSeat !== undefined) return true;
    }
    return false;
  }

  private currentBgmGain() {
    return this.bgmGains[this.bgmTrack];
  }

  private syncBgmDuck(ducked: boolean) {
    if (this.bgmDucked === ducked || !this.context || !this.bgmPlayback) return;
    this.bgmDucked = ducked;
    const now = this.context.currentTime;
    const gain = this.bgmPlayback.gain.gain;
    gain.cancelScheduledValues?.(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(ducked ? 0 : this.currentBgmGain(), now + (ducked ? .2 : .45));
  }

  private syncBgm() {
    const ctx = this.context;
    const bus = this.bgm;
    const buffer = this.bgmSamples.get(this.bgmTrack);
    if (this.bgmActive && this.activated && this.enabled && ctx && !buffer) this.loadBgm(ctx, this.bgmTrack);
    if (!this.bgmActive || !this.activated || !this.enabled || !ctx || !bus || !buffer) {
      this.stopBgmPlayback();
      return;
    }
    const ducked = this.hasSpecialMusic();
    if (this.bgmPlayback) {
      this.syncBgmDuck(ducked);
      return;
    }
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    this.bgmDucked = ducked;
    gain.gain.setValueAtTime(ducked ? 0 : this.currentBgmGain(), now);
    source.connect(gain).connect(bus);
    const playback = { source, gain };
    this.bgmPlayback = playback;
    source.onended = () => { if (this.bgmPlayback === playback) this.stopBgmPlayback(); };
    source.start(now);
  }

  update(config: MatchConfig, state: MatchState, events: readonly CombatEvent[]) {
    if (this.round !== undefined && this.round !== state.round) this.stopAll(false);
    this.round = state.round;
    for (const seat of seats) this.updateAction(config, state, seat);
    const silentVoices = seats.filter(seat => config.fighters[seat]?.id === 'frog' &&
      (frogPowered(state.fighters[seat], state) || state.fighters[seat].attack?.id === 'frog-ascend'));
    for (const playback of this.playing) {
      if (playback.voiceSeat !== undefined && silentVoices.includes(playback.voiceSeat)) this.stop(playback);
      if (playback.musicSeat !== undefined && !silentVoices.includes(playback.musicSeat)) {
        this.fadeMusic(playback);
      }
    }
    const musicStarts = new Set<string>();
    for (const { source, actionAudio } of events) {
      if (!actionAudio) continue;
      const { attack, cue } = actionAudio;
      if (cue.channel === 'voice' && silentVoices.includes(source)) continue;
      const interruptible = cue.stopOnInterrupt !== false;
      if (interruptible && state.fighters[source].attack !== attack) continue;
      if (this.playClip(source, cue, interruptible ? attack : undefined) && cue.clip === 'ultimate-bgm') {
        musicStarts.add(source + ':' + attack.id);
      }
    }
    this.updateEntities(state);
    this.play(events, config.fighters, musicStarts);
    this.syncBgmDuck(this.hasSpecialMusic() || Boolean(state.timeStop));
  }

  private playNamed(seat: Seat, clip: string) {
    if (this.banks[seat]?.[clip]) return this.playClip(seat, { clip, channel: 'sfx' });
    const ctx = this.context;
    const output = this.sfx;
    if (!ctx || !output || !this.canPlay()) return false;
    const gagaClip = Object.hasOwn(sampleVolumes, clip) ? clip as GagaSample : undefined;
    if (!gagaClip) return false;
    return this.playBuffer(ctx, output, this.samples.get(gagaClip), sampleVolumes[gagaClip], ctx.currentTime);
  }

  private updateEntities(state: MatchState) {
    const live = new Set<number>();
    for (const entity of state.entities ?? []) {
      if (entity.definition.behavior !== 'pool') continue;
      live.add(entity.id);
      const previous = this.entityAges.get(entity.id);
      // Repeated render updates and hitstop never replay a splash.
      if (previous !== entity.age) {
        if (previous === undefined && entity.age <= 1) this.playNamed(entity.owner, 'pool-warning');
        const wave = (entity.age - WHALE_RULES.telegraph) / WHALE_RULES.hitGap;
        if (Number.isInteger(wave) && wave >= 0 && wave < WHALE_RULES.ultimateHits) {
          this.playNamed(entity.owner, wave === WHALE_RULES.ultimateHits - 1 ? 'pool-final' : 'pool-breach');
        }
        this.entityAges.set(entity.id, entity.age);
      }
    }
    for (const id of this.entityAges.keys()) if (!live.has(id)) this.entityAges.delete(id);
  }

  private updateAction(config: MatchConfig, state: MatchState, seat: Seat) {
    const attack = state.fighters[seat].attack;
    const previous = this.actions[seat];
    if (previous?.attack === attack) return;
    if (previous) {
      const { startup, active, recovery } = previous.action;
      // Core updates the same attack object through its last frame, even when removing it.
      if (previous.attack.frame < startup + active + recovery) {
        for (const playback of this.playing) {
          if (playback.interruptibleAttack === previous.attack) this.stop(playback);
        }
      }
    }
    const action = attack ? actionFor(config, state, seat) : undefined;
    this.actions[seat] = attack && action ? { attack, action } : undefined;
  }

  private canPlay() {
    return this.activated && !this.paused && this.enabled && this.volume > 0 && this.context?.state === 'running';
  }

  private playClip(seat: Seat, cue: Omit<ActionAudioCue, 'frame'>, interruptibleAttack?: Attack) {
    const context = this.context;
    const voice = cue.channel === 'voice';
    const bus = voice ? this.voice : this.sfx;
    if (!context || !bus || !this.canPlay()) return false;
    const variants = 'variants' in cue ? (cue as ActionAudioCue).variants : undefined;
    const candidates = [cue.clip, ...(variants ?? [])];
    const clipId = candidates[Math.min(candidates.length - 1, Math.floor(Math.random() * candidates.length))];
    const bank = this.banks[seat];
    const clip = bank && Object.hasOwn(bank, clipId) ? bank[clipId] : undefined;
    if (!clip) {
      this.report('Unknown clip on player ' + (seat + 1) + ': ' + cue.clip);
      return false;
    }
    const buffer = this.buffers.get(clip.src);
    // Unready cues expire on their own frame. Decoding never starts playback.
    if (!buffer) return false;
    if (voice) {
      for (const playback of this.playing) {
        if (playback.voiceSeat === seat) this.stop(playback);
      }
    }
    const music=cue.clip==='ultimate-bgm';
    if(music)for(const playback of this.playing){
      if(playback.musicSeat!==undefined)this.fadeMusic(playback);
    }
    const playback = this.playTrackSample(context, bus, buffer, this.clipVolume(clipId, clip, cue.volume));
    this.track({ ...playback, voiceSeat: voice ? seat : undefined, musicSeat: music ? seat : undefined, interruptibleAttack });
    return true;
  }

  private clipVolume(id: string, clip: FighterAudioBank[string], volume?: number) {
    const target = soundTarget(id);
    const stats = this.levels.get(clip.src);
    return level(clip.volume) * level(volume) * (target !== undefined && stats ? calibratedGain(stats, target) : 1) *
      (id === 'ultimate-bgm' ? 10 ** (7 / 20) : 1);
  }

  private playTrackSample(context: AudioContext, bus: GainNode, buffer: AudioBuffer, volume: number) {
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(gain).connect(bus);
    source.start();
    return { source, gain };
  }

  startSample(name: GagaSample, delay = 0): SampleVoice | null {
    const ctx = this.context;
    const bus = this.sfx;
    const buffer = this.samples.get(name);
    if (!ctx || !bus || !this.enabled || this.volume <= 0 || ctx.state !== 'running' || !buffer) return null;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const meter = ctx.createAnalyser();
    const wave = new Float32Array(meter.fftSize);
    source.buffer = buffer;
    gain.gain.value = sampleVolumes[name];
    source.connect(gain);
    gain.connect(meter);
    meter.connect(bus);
    source.start(ctx.currentTime + delay);
    return {
      duration: buffer.duration,
      level: () => {
        meter.getFloatTimeDomainData(wave);
        let total = 0;
        for (const value of wave) total += value * value;
        return Math.min(1, Math.sqrt(total / wave.length) * 6);
      },
      stop: () => {
        gain.gain.setTargetAtTime(0, ctx.currentTime, .03);
        source.stop(ctx.currentTime + .12);
      }
    };
  }

  /** Notes standing in for a victory recording that has not been added to the fighter yet. */
  call(step: number) {
    const ctx = this.context;
    const bus = this.sfx;
    if (!ctx || !bus || !this.enabled || this.volume <= 0 || ctx.state !== 'running') return;
    const pitch = [523, 659, 784, 1047, 784, 1047][step % 6];
    this.playTone(ctx, bus, [pitch, pitch * 1.02, .2, 'triangle', .17], ctx.currentTime);
  }

  private stopOraVoice(seat: number, now: number, fade: number) {
    const active = this.oraVoices.get(seat);
    if (!active) return;
    this.oraVoices.delete(seat);
    active.gain.gain.cancelScheduledValues(now);
    active.gain.gain.setValueAtTime(active.gain.gain.value, now);
    active.gain.gain.linearRampToValueAtTime(0, now + fade);
    try { active.source.stop(now + fade + .02); } catch { /* Already ended. */ }
  }

  private playOraVoice(ctx: AudioContext, bus: GainNode, seat: number, sample: BananaSample, now: number, crossfade: number) {
    const buffer = this.bananaSamples.get(sample);
    if (!buffer) return;
    this.stopOraVoice(seat, now, crossfade);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(bananaSampleVolumes[sample], now);
    source.connect(gain).connect(bus);
    const entry = { source, gain };
    this.oraVoices.set(seat, entry);
    source.onended = () => { if (this.oraVoices.get(seat) === entry) this.oraVoices.delete(seat); };
    source.start(now);
  }

  private playBuffer(ctx: AudioContext, bus: GainNode, buffer: AudioBuffer | undefined, levelValue: number, now: number) {
    if (!buffer) return false;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = levelValue;
    source.connect(gain).connect(bus);
    source.start(now);
    this.track({ source, gain });
    return true;
  }

  private track(playback: Playback) {
    this.playing.add(playback);
    playback.source.onended = () => this.release(playback);
  }

  private release(playback: Playback) {
    this.playing.delete(playback);
    playback.source.onended = null;
    playback.source.disconnect();
    playback.gain.disconnect();
  }

  private stop(playback: Playback) {
    playback.source.stop();
    this.release(playback);
  }

  private fadeMusic(playback: Playback) {
    const now = this.context!.currentTime;
    playback.musicSeat = undefined;
    playback.gain.gain.setValueAtTime(playback.gain.gain.value, now);
    playback.gain.gain.linearRampToValueAtTime(0, now + .3);
    playback.source.stop(now + .3);
  }

  private play(events: readonly CombatEvent[], fighters: MatchConfig['fighters'], musicStarts: ReadonlySet<string>) {
    const ctx = this.context;
    const output = this.sfx;
    if (!ctx || !output || !this.canPlay()) return;
    const sounds = new Map<string, { event: CombatEvent; contact?: GagaContact }>();
    const played = new Set<string>();
    // One event batch represents one simulation tick. Different contact kinds retain their own samples.
    const contactSamples = new Map<string, ContactSample>();
    const now = ctx.currentTime;
    for (const event of events) {
      if (event.kind === 'hit' && this.oraVoices.has(1 - event.source)) {
        this.activeRushUntil.delete(1 - event.source);
        this.stopOraVoice(1 - event.source, now, .06);
      }
      const { kind, source, actionId } = event;
      if (kind === 'action-audio' || (kind === 'ultimate' && musicStarts.has(source + ':' + actionId))) continue;
      const isContact = kind === 'hit' || kind === 'block' || kind === 'break' || kind === 'parry';
      const playContact = (seat: Seat, id: string, volume?: number) => {
        const bank = this.banks[seat];
        const clip = bank && Object.hasOwn(bank, id) ? bank[id] : undefined;
        if (!clip) return false;
        const buffer = this.buffers.get(clip.src);
        if (!buffer) return false;
        const key = kind + ':' + clip.src;
        const gain = this.clipVolume(id, clip, volume);
        const previous = contactSamples.get(key);
        if (!previous || gain > previous.volume) contactSamples.set(key, { buffer, volume: gain });
        return true;
      };
      // Block and break source is the attacker; defensive foley belongs to the other seat.
      if ((kind === 'block' || kind === 'break') && playContact(source === 0 ? 1 : 0, 'event-' + kind)) continue;
      const impact = kind === 'hit' || kind === 'block' ? event.feedback?.audio : undefined;
      if (impact) {
        if (playContact(source, impact.clip, impact.volume)) continue;
        if (!Object.hasOwn(this.banks[source] ?? {}, impact.clip)) {
          this.report('Unknown clip on player ' + (source + 1) + ': ' + impact.clip);
        }
      }
      if (this.playCharacterCue(ctx, output, now, event, fighters, played, events, isContact ? playContact : undefined)) continue;
      if (isContact ? playContact(source, 'event-' + kind) : this.playNamed(source, 'event-' + kind)) continue;
      const preset = hitSound(event);
      const contact = event.kind === 'hit' && event.feedback?.sound ? undefined : gagaContact(event, fighters);
      const key = contact ? 'gaga-' + event.kind : event.kind;
      const previous = sounds.get(key);
      const previousPreset = previous && hitSound(previous.event);
      if (!previous || (preset && previousPreset && hitToneRanks[preset] > hitToneRanks[previousPreset])) {
        sounds.set(key, { event, contact });
      }
    }
    for (const { buffer, volume } of contactSamples.values()) {
      this.track(this.playTrackSample(ctx, output, buffer, volume));
    }
    for (const { event, contact } of sounds.values()) {
      const { kind } = event;
      const sound = hitSound(event);
      const special = contact ? gagaSounds[contact] : undefined;
      const tone = special?.tone ?? (sound ? hitTones[sound] : tones[kind]);
      if (!tone) continue;
      this.playTone(ctx, output, tone, now);
      if (special) this.playTransient(ctx, output, special.transient, now);
      else if (sound) this.playTransient(ctx, output, hitTransients[sound], now);
      else if (kind === 'block') this.playTransient(ctx, output, [2490, .043, .13], now);
      else if (kind === 'break') this.playTransient(ctx, output, [980, .069, .17], now);
      if (kind === 'pole-impact' || kind === 'grenade-impact') this.playTransient(ctx, output, earthTransient, now);
      if (kind === 'summon-drop') this.playWind(ctx, output, dijiangDiveRoar, now, .78);
      if (kind === 'summon-impact') {
        this.playTransient(ctx, output, dijiangImpactCrack, now);
        if (!this.playNamed(event.source, 'dijiang-impact')) this.playTransient(ctx, output, dijiangImpactRumble, now + .03);
      }
    }
  }

  private playCharacterCue(ctx: AudioContext, output: GainNode, now: number, event: CombatEvent,
    fighters: MatchConfig['fighters'], played: Set<string>, events: readonly CombatEvent[],
    playContact?: (seat: Seat, id: string) => boolean) {
    const { actionId, kind, source } = event;
    const bananaId = actionId && Object.hasOwn(bananaHits, actionId) ? actionId as BananaActionId : undefined;
    const bananaSound = kind === 'hit' && bananaId ? bananaHits[bananaId] : bananaEvents[kind];
    const wind = kind === 'swing' && actionId ? actionWinds[actionId] : undefined;
    if (bananaSound || kind === 'kq-lock' || kind === 'kq-detonate' || kind === 'jo-shatter' || (kind === 'swing' && bananaId)) {
      const key = kind + ':banana:' + source + ':' + (bananaId ?? '');
      if (played.has(key)) return true;
      played.add(key);
      if (kind === 'time-stop-start') {
        if (!this.playBuffer(ctx, this.voice ?? output, this.bananaSamples.get('the-world'), bananaSampleVolumes['the-world'], now) && bananaSound) {
          this.playTone(ctx, output, bananaSound.tone, now);
          if (bananaSound.transient) this.playTransient(ctx, output, bananaSound.transient, now);
        }
        return true;
      }
      if (kind === 'swing' && bananaId && joOraActions.has(bananaId)) {
        const voiceBus = this.voice ?? output;
        if (bananaId === bananaActionIds.joOra) {
          if (event.heavy) {
            this.activeRushUntil.delete(source);
            this.playOraVoice(ctx, voiceBus, source, 'ora-finish', now, .05);
          } else if ((this.activeRushUntil.get(source) ?? 0) <= now) {
            this.activeRushUntil.set(source, now + .55);
            this.playOraVoice(ctx, voiceBus, source, 'ora-rush', now, .06);
          }
        } else {
          this.activeRushUntil.delete(source);
          this.playOraVoice(ctx, voiceBus, source, 'ora-1', now, bananaId === bananaActionIds.joAntiAir ? .05 : .12);
        }
        this.playWind(ctx, output, actionWinds[bananaId]!, now);
        return true;
      }
      if (kind === 'swing' && bananaId === bananaActionIds.joSheerHeart) {
        this.playTone(ctx, output, [160, 72, .14, 'sawtooth', .18], now);
        this.playTone(ctx, output, [280, 460, .18, 'triangle', .14], now + .05);
        this.playTransient(ctx, output, [1400, .06, .22], now);
        this.playWind(ctx, output, actionWinds[bananaId]!, now);
        return true;
      }
      if (kind === 'kq-lock') {
        for (const [offset, freq] of [[0, 820], [.20, 980], [.36, 1180], [.49, 1420], [.59, 1740]] as const) {
          this.playTone(ctx, output, [freq, freq * 1.06, .085, 'square', .15], now + offset);
        }
        this.playTransient(ctx, output, [4200, .05, .20], now);
        return true;
      }
      if (kind === 'swing' && (bananaId === bananaActionIds.kqBomb || bananaId === bananaActionIds.kqDetonate)) {
        if (bananaId === bananaActionIds.kqBomb) {
          this.playOraVoice(ctx, this.voice ?? output, source, 'kq-summon', now, .05);
        } else if (!events.some(e => e.kind === 'kq-detonate' && e.source === source)) {
          this.playBuffer(ctx, output, this.bananaSamples.get('kq-click'), bananaSampleVolumes['kq-click'], now);
        }
        this.playWind(ctx, output, actionWinds[bananaId]!, now);
        return true;
      }
      if (kind === 'kq-plant' || kind === 'kq-detonate') {
        this.playBuffer(ctx, output, this.bananaSamples.get('kq-click'), bananaSampleVolumes['kq-click'], now);
        if (kind === 'kq-detonate') return true;
      }
      if (kind === 'jo-shatter') {
        this.playTransient(ctx, output, [460, .40, .38], now);
      }
      if (bananaSound) {
        const heavyPunch = kind === 'time-stop-hit' && event.heavy;
        const tone: Tone = heavyPunch ? [145, 34, .24, 'triangle', .36] : bananaSound.tone;
        const transient: Noise | undefined = heavyPunch ? [1500, .14, .38] : bananaSound.transient;
        this.playTone(ctx, output, tone, now);
        if (transient) this.playTransient(ctx, output, transient, now);
        if (bananaSound.cry) this.playCry(ctx, output, now, ...bananaSound.cry);
      } else if (wind) {
        this.playWind(ctx, output, wind, now);
        if (bananaId === bananaActionIds.cry || bananaId === bananaActionIds.recharge ||
          bananaId === bananaActionIds.pressure || bananaId === bananaActionIds.uppercut) {
          const rising = bananaId === bananaActionIds.uppercut;
          this.playCry(ctx, output, now, rising ? .35 : .22, rising ? .095 : .065);
        }
      }
      return true;
    }
    const poleSwing = poleSwingFor(event);
    const sample = gagaSampleFor(event, fighters, poleSwing);
    if (sample) {
      const seat = fighters[source].id === 'gaga' ? source : source === 0 ? 1 : 0;
      if (playContact) {
        if (playContact(seat, sample)) return true;
      } else {
        const key = kind + ':gaga:' + sample;
        if (played.has(key)) return true;
        if (this.playNamed(seat, sample)) {
          played.add(key);
          return true;
        }
      }
    }
    const swingWind = poleSwing ? poleWind[poleSwing] : wind;
    if (swingWind) {
      this.playWind(ctx, output, swingWind, now);
      return true;
    }
    return kind === 'ultimate' && (actionId === bananaActionIds.wave || actionId === gagaActionIds.dijiang);
  }

  private playTone(ctx: AudioContext, output: GainNode, [head, tail, duration, wave, volume]: Tone, now: number) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(head, now);
    oscillator.frequency.exponentialRampToValueAtTime(tail, now + duration);
    gain.gain.setValueAtTime(.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + .005);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain).connect(output);
    oscillator.start(now);
    oscillator.stop(now + duration);
    this.track({ source: oscillator, gain });
  }

  private playCry(ctx: AudioContext, output: GainNode, now: number, duration: number, volume: number) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(390, now);
    gain.gain.setValueAtTime(.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + .012);
    for (const [index, pitch] of [530, 450, 710, 600, 930].entries()) {
      const time = now + duration * (index + 1) / 6;
      oscillator.frequency.exponentialRampToValueAtTime(pitch, time);
      gain.gain.linearRampToValueAtTime(volume * (index % 2 ? .35 : 1), time);
    }
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain).connect(output);
    oscillator.start(now);
    oscillator.stop(now + duration);
    this.track({ source: oscillator, gain });
  }

  private filteredNoise(ctx: AudioContext, output: GainNode, now: number, duration: number) {
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .64), ctx.sampleRate);
      const samples = this.noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = .72;
    const gain = ctx.createGain();
    source.connect(filter).connect(gain).connect(output);
    source.start(now);
    source.stop(now + duration);
    this.track({ source, gain });
    return { filter, gain: gain.gain };
  }

  private playTransient(ctx: AudioContext, output: GainNode, [frequency, duration, volume]: Noise, now: number) {
    const { filter, gain } = this.filteredNoise(ctx, output, now, duration);
    filter.frequency.setValueAtTime(frequency, now);
    gain.setValueAtTime(.001, now);
    gain.linearRampToValueAtTime(volume, now + .003);
    gain.exponentialRampToValueAtTime(.001, now + duration);
  }

  private playWind(ctx: AudioContext, output: GainNode, [start, peak, end, duration, volume]: Wind, now: number, crestRatio = .26) {
    const { filter, gain } = this.filteredNoise(ctx, output, now, duration);
    const crest = now + duration * crestRatio;
    filter.Q.value = .42;
    filter.frequency.setValueAtTime(start, now);
    filter.frequency.exponentialRampToValueAtTime(peak, crest);
    filter.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.setValueAtTime(.001, now);
    gain.linearRampToValueAtTime(volume, crest);
    gain.exponentialRampToValueAtTime(.001, now + duration);
  }
}
