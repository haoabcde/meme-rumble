import type { CombatEvent, EventKind, HitFeedback, MatchConfig } from '../core/types.js';
import { gagaActionIds } from '../content/fighters/gaga.js';
import { bananaActionIds } from '../content/fighters/banana.js';
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
  [gagaActionIds.overclock]: [520, 1680, 420, .12, .38],
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

const hitTones: Record<NonNullable<HitFeedback['sound']>, Tone> = {
  light: [202, 76, .085, 'triangle', .16],
  heavy: [133, 39, .18, 'triangle', .27],
  sharp: [440, 138, .075, 'sawtooth', .11]
};

const tones: Partial<Record<EventKind, Tone>> = {
  swing: [340, 130, .065, 'triangle', .045],
  hit: [144, 42, .15, 'sawtooth', .16],
  block: [520, 195, .085, 'square', .065],
  break: [191, 52, .22, 'square', .11],
  dash: [210, 79, .085, 'triangle', .054],
  jump: [183, 340, .09, 'triangle', .038],
  drop: [226, 123, .07, 'triangle', .029],
  land: [104, 53, .075, 'triangle', .026],
  'pole-impact': [113, 38, .23, 'triangle', .32],
  'crystal-plant': [880, 1320, .09, 'sine', .14],
  'crystal-shatter': [190, 58, .26, 'triangle', .34],
  'xiranite-burst': [260, 88, .22, 'triangle', .28],
  'turret-overclock': [680, 1420, .14, 'sawtooth', .16],
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
  'air-jump': [298, 562, .09, 'triangle', .052],
  parry: [740, 1480, .12, 'sine', .16],
  knockdown: [128, 42, .114, 'triangle', .14],
  rise: [192, 310, .071, 'sine', .044],
  ultimate: [260, 540, .17, 'triangle', .12],
  ko: [121, 44, .42, 'triangle', .14]
};

export class FightAudio {
  enabled = true;
  volume = .7;
  private context: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private samples = new Map<GagaSample, AudioBuffer>();
  private bananaSamples = new Map<BananaSample, AudioBuffer>();
  private oraVoices = new Map<number, { source: AudioBufferSourceNode; gain: GainNode }>();
  private activeRushUntil = new Map<number, number>();

  enableFromGesture() {
    if (!this.enabled || !globalThis.AudioContext) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.loadSamples(this.context);
    }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  }

  private decodeBank<T extends string>(ctx: AudioContext, bank: Partial<Record<T, string>> | undefined, target: Map<T, AudioBuffer>) {
    if (!bank) return;
    for (const name of Object.keys(bank) as T[]) {
      const encoded = bank[name];
      if (!encoded) continue;
      const bytes = Uint8Array.from(atob(encoded), value => value.charCodeAt(0));
      void ctx.decodeAudioData(bytes.buffer).then(buffer => target.set(name, buffer)).catch(() => {});
    }
  }

  private loadSamples(ctx: AudioContext) {
    if (typeof __GAGA_SOUNDS__ !== 'undefined') this.decodeBank(ctx, __GAGA_SOUNDS__, this.samples);
    if (typeof __BANANA_SOUNDS__ !== 'undefined') this.decodeBank(ctx, __BANANA_SOUNDS__, this.bananaSamples);
  }

  play(events: CombatEvent[], fighters: MatchConfig['fighters']) {
    const ctx = this.context;
    if (!events.length || !this.enabled || this.volume <= 0 || !ctx || ctx.state !== 'running') return;
    const cues = new Map<EventKind, GagaContact | undefined>();
    const bananaCues = new Set<string>();
    const samplesPlayed = new Set<string>();
    let hasDijiangImpact = false;
    for (const event of events) {
      if (event.kind === 'hit' && this.oraVoices.has(1 - event.source)) {
        this.activeRushUntil.delete(1 - event.source);
        this.stopOraVoice(1 - event.source, ctx.currentTime, .06);
      }
      const bananaId = event.actionId && Object.hasOwn(bananaHits, event.actionId)
        ? event.actionId as BananaActionId : undefined;
      const bananaSound = event.kind === 'hit' && bananaId ? bananaHits[bananaId] : bananaEvents[event.kind];
      if (bananaSound || event.kind === 'kq-lock' || event.kind === 'kq-detonate' || event.kind === 'jo-shatter' || (event.kind === 'swing' && bananaId)) {
        // Different moves can hit together without masking each other's timbre.
        const key = event.kind + ':' + event.source + ':' + (bananaId ?? '');
        if (bananaCues.has(key)) continue;
        bananaCues.add(key);
        const now = ctx.currentTime;
        if (event.kind === 'time-stop-start') {
          if (!this.playBuffer(ctx, this.bananaSamples.get('the-world'), bananaSampleVolumes['the-world'], now) && bananaSound) {
            this.playTone(ctx, bananaSound.tone, now);
            if (bananaSound.transient) this.playTransient(ctx, bananaSound.transient, now);
          }
          continue;
        }
        if (event.kind === 'swing' && bananaId && joOraActions.has(bananaId)) {
          if (bananaId === bananaActionIds.joOra) {
            if (event.heavy) {
              this.activeRushUntil.delete(event.source);
              this.playOraVoice(ctx, event.source, 'ora-finish', now, .05);
            } else if ((this.activeRushUntil.get(event.source) ?? 0) <= now) {
              this.activeRushUntil.set(event.source, now + .55);
              this.playOraVoice(ctx, event.source, 'ora-rush', now, .06);
            }
          } else {
            this.activeRushUntil.delete(event.source);
            this.playOraVoice(ctx, event.source, 'ora-1', now, bananaId === bananaActionIds.joAntiAir ? .05 : .12);
          }
          this.playWind(ctx, actionWinds[bananaId]!, now);
          continue;
        }
        if (event.kind === 'swing' && bananaId === bananaActionIds.joSheerHeart) {
          // Distinct mechanical deploy hatch + motor spin-up hum (not Killer Queen's coin chime or click!).
          this.playTone(ctx, [160, 72, .14, 'sawtooth', .18], now);
          this.playTone(ctx, [280, 460, .18, 'triangle', .14], now + .05);
          this.playTransient(ctx, [1400, .06, .22], now);
          this.playWind(ctx, actionWinds[bananaId]!, now);
          continue;
        }
        if (event.kind === 'kq-lock') {
          // Escalating radar lock countdown alarm over the 0.70s lock-on sprint!
          for (const [offset, freq] of [[0, 820], [.20, 980], [.36, 1180], [.49, 1420], [.59, 1740]] as const) {
            this.playTone(ctx, [freq, freq * 1.06, .085, 'square', .15], now + offset);
          }
          this.playTransient(ctx, [4200, .05, .20], now);
          continue;
        }
        if (event.kind === 'swing' && (bananaId === bananaActionIds.kqBomb || bananaId === bananaActionIds.kqDetonate)) {
          if (bananaId === bananaActionIds.kqBomb) {
            this.playOraVoice(ctx, event.source, 'kq-summon', now, .05);
          } else if (!events.some(e => e.kind === 'kq-detonate' && e.source === event.source)) {
            this.playBuffer(ctx, this.bananaSamples.get('kq-click'), bananaSampleVolumes['kq-click'], now);
          }
          this.playWind(ctx, actionWinds[bananaId]!, now);
          continue;
        }
        if (event.kind === 'kq-plant' || event.kind === 'kq-detonate') {
          this.playBuffer(ctx, this.bananaSamples.get('kq-click'), bananaSampleVolumes['kq-click'], now);
          if (event.kind === 'kq-detonate') continue;
        }
        if (event.kind === 'jo-shatter') {
          this.playTransient(ctx, [460, .40, .38], now);
        }
        if (bananaSound) {
          const heavyPunch = event.kind === 'time-stop-hit' && event.heavy;
          const tone: Tone = heavyPunch ? [145, 34, .24, 'triangle', .36] : bananaSound.tone;
          const transient: Noise | undefined = heavyPunch ? [1500, .14, .38] : bananaSound.transient;
          this.playTone(ctx, tone, now);
          if (transient) this.playTransient(ctx, transient, now);
          if (bananaSound.cry) this.playCry(ctx, now, ...bananaSound.cry);
        } else if (bananaId) {
          this.playWind(ctx, actionWinds[bananaId]!, now);
          if (bananaId === bananaActionIds.cry || bananaId === bananaActionIds.recharge ||
            bananaId === bananaActionIds.pressure || bananaId === bananaActionIds.uppercut) {
            const rising = bananaId === bananaActionIds.uppercut;
            this.playCry(ctx, now, rising ? .35 : .22, rising ? .095 : .065);
          }
        }
        continue;
      }
      const swing = poleSwingFor(event);
      const sample = gagaSampleFor(event, fighters, swing);
      if (sample) {
        const key = event.kind + ':' + sample;
        if (samplesPlayed.has(key)) continue;
        if (this.playSample(ctx, sample, ctx.currentTime)) {
          samplesPlayed.add(key);
          continue;
        }
      }
      if (event.kind === 'summon-impact' && fighters[event.source].id === 'gaga') hasDijiangImpact = true;
      if (swing) {
        this.playWind(ctx, poleWind[swing], ctx.currentTime);
        continue;
      }
      const wind = event.kind === 'swing' && event.actionId ? actionWinds[event.actionId] : undefined;
      if (wind) {
        this.playWind(ctx, wind, ctx.currentTime);
        continue;
      }
      if (event.kind === 'hit' && event.feedback?.sound) {
        const key = 'hit:' + event.feedback.sound;
        if (!bananaCues.has(key)) {
          bananaCues.add(key);
          this.playTone(ctx, hitTones[event.feedback.sound], ctx.currentTime);
        }
        continue;
      }
      if (event.kind === 'ultimate' && (event.actionId === bananaActionIds.wave || event.actionId === gagaActionIds.dijiang)) continue;
      const cue = gagaContact(event, fighters);
      if (!cues.get(event.kind) || cue === 'heavy') cues.set(event.kind, cue);
    }
    for (const [kind, cue] of cues) {
      const special = cue ? gagaSounds[cue] : undefined;
      const tone = special?.tone ?? tones[kind];
      if (!tone) continue;
      const now = ctx.currentTime;
      this.playTone(ctx, tone, now);
      if (special) this.playTransient(ctx, special.transient, now);
      if (kind === 'pole-impact' || kind === 'grenade-impact') {
        this.playTransient(ctx, earthTransient, now);
      }
      if (kind === 'summon-drop') this.playWind(ctx, dijiangDiveRoar, now, .78);
      if (kind === 'summon-impact') {
        this.playTransient(ctx, dijiangImpactCrack, now);
        if (!hasDijiangImpact || !this.playSample(ctx, 'dijiang-impact', now)) {
          this.playTransient(ctx, dijiangImpactRumble, now + .03);
        }
      }
    }
  }

  /** Runs the checks every sound passes before anything reaches the speakers. */
  private output() {
    const ctx = this.context;
    return ctx && ctx.state === 'running' && this.enabled && this.volume > 0 ? ctx : null;
  }

  /** Plays a sample through, from now or a little later, and reports how loud it sounds while it runs. */
  startSample(name: GagaSample, delay = 0): SampleVoice | null {
    const ctx = this.output();
    const buffer = this.samples.get(name);
    if (!ctx || !buffer) return null;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const meter = ctx.createAnalyser();
    const wave = new Float32Array(meter.fftSize);
    source.buffer = buffer;
    gain.gain.value = sampleVolumes[name] * this.volume;
    source.connect(gain);
    gain.connect(meter);
    meter.connect(ctx.destination);
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
    const ctx = this.output();
    if (!ctx) return;
    const pitch = [523, 659, 784, 1047, 784, 1047][step % 6];
    this.playTone(ctx, [pitch, pitch * 1.02, .2, 'triangle', .17], ctx.currentTime);
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

  private playOraVoice(ctx: AudioContext, seat: number, sample: BananaSample, now: number, crossfade: number) {
    const buffer = this.bananaSamples.get(sample);
    if (!buffer) return;
    this.stopOraVoice(seat, now, crossfade);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(bananaSampleVolumes[sample] * this.volume, now);
    source.connect(gain).connect(ctx.destination);
    const entry = { source, gain };
    this.oraVoices.set(seat, entry);
    source.onended = () => { if (this.oraVoices.get(seat) === entry) this.oraVoices.delete(seat); };
    source.start(now);
  }

  private playBuffer(ctx: AudioContext, buffer: AudioBuffer | undefined, level: number, now: number) {
    if (!buffer) return false;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = level * this.volume;
    source.connect(gain).connect(ctx.destination);
    source.start(now);
    return true;
  }

  private playSample(ctx: AudioContext, name: GagaSample, now: number) {
    return this.playBuffer(ctx, this.samples.get(name), sampleVolumes[name], now);
  }

  private playTone(ctx: AudioContext, [head, tail, duration, wave, volume]: Tone, now: number) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(head, now);
    oscillator.frequency.exponentialRampToValueAtTime(tail, now + duration);
    gain.gain.setValueAtTime(.001, now);
    gain.gain.linearRampToValueAtTime(volume * this.volume, now + .007);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private playCry(ctx: AudioContext, now: number, duration: number, volume: number) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(390, now);
    gain.gain.setValueAtTime(.001, now);
    gain.gain.linearRampToValueAtTime(volume * this.volume, now + .012);
    // Uneven rising syllables suggest a sob, without loading a voice recording.
    for (const [index, pitch] of [530, 450, 710, 600, 930].entries()) {
      const time = now + duration * (index + 1) / 6;
      oscillator.frequency.exponentialRampToValueAtTime(pitch, time);
      gain.gain.linearRampToValueAtTime(volume * this.volume * (index % 2 ? .35 : 1), time);
    }
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private filteredNoise(ctx: AudioContext, now: number, duration: number) {
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .64), ctx.sampleRate);
      const samples = this.noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const envelope = ctx.createGain();
    source.buffer = this.noise;
    filter.type = 'bandpass';
    filter.Q.value = .72;
    envelope.gain.setValueAtTime(.001, now);
    source.connect(filter).connect(envelope).connect(ctx.destination);
    source.start(now);
    source.stop(now + duration);
    return { filter, gain: envelope.gain };
  }

  private playTransient(ctx: AudioContext, [frequency, duration, volume]: Noise, now: number) {
    const { filter, gain } = this.filteredNoise(ctx, now, duration);
    filter.frequency.setValueAtTime(frequency, now);
    gain.linearRampToValueAtTime(volume * this.volume, now + .003);
    gain.exponentialRampToValueAtTime(.001, now + duration);
  }

  private playWind(ctx: AudioContext, [start, peak, end, duration, volume]: Wind, now: number, crestRatio = .26) {
    const { filter, gain } = this.filteredNoise(ctx, now, duration);
    const crest = now + duration * crestRatio;
    filter.Q.value = .42;
    filter.frequency.setValueAtTime(start, now);
    filter.frequency.exponentialRampToValueAtTime(peak, crest);
    filter.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.linearRampToValueAtTime(volume * this.volume, crest);
    gain.exponentialRampToValueAtTime(.001, now + duration);
  }
}
