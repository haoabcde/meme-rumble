import type { CombatEvent, EventKind, MatchConfig } from '../core/types.js';
import { gagaActionIds } from '../content/gaga.js';
import { bananaActionIds } from '../content/banana.js';
import { gagaContact, type GagaContact } from './gaga-contact.js';
import { poleSwingFor, type PoleSwing } from './gaga-pole-fx.js';

type Tone = [number, number, number, OscillatorType, number];

type Noise = [frequency: number, duration: number, volume: number];
type Wind = [start: number, peak: number, end: number, duration: number, volume: number];

const poleWind: Record<PoleSwing, Wind> = {
  sweep: [320, 1080, 190, .27, .58],
  reverse: [280, 890, 158, .29, .62],
  launch: [210, 1320, 360, .32, .64]
};
const actionWinds: Partial<Record<string, Wind>> = {
  [gagaActionIds.jab]: [920, 2520, 680, .086, .55],
  [gagaActionIds.backhand]: [590, 1840, 360, .125, .64],
  [gagaActionIds.airThrow]: [360, 1480, 210, .23, .66],
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
  [bananaActionIds.wave]: [220, 1520, 103, .58, .52]
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
  [bananaActionIds.wave]: { tone: [140, 41, .28, 'triangle', .31], transient: [1350, .31, .35] }
};
const bananaEvents: Partial<Record<EventKind, BananaSound>> = {
  'tear-splash': { tone: [750, 105, .24, 'sine', .18], transient: [2000, .19, .28] },
  'wave-windup': { tone: [78, 187, .24, 'sine', .12], transient: [550, .19, .14] },
  'wave-cut-in': { tone: [300, 64, .62, 'triangle', .21], transient: [820, .51, .23], cry: [.64, .13] }
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

export class FightAudio {
  enabled = true;
  volume = .7;
  private context: AudioContext | null = null;
  private noise: AudioBuffer | null = null;

  enableFromGesture() {
    if (!this.enabled || !globalThis.AudioContext) return;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  }

  play(events: CombatEvent[], fighters: MatchConfig['fighters']) {
    const ctx = this.context;
    if (!events.length || !this.enabled || this.volume <= 0 || !ctx || ctx.state !== 'running') return;
    const cues = new Map<EventKind, GagaContact | undefined>();
    const bananaCues = new Set<string>();
    for (const event of events) {
      const bananaId = event.actionId && Object.hasOwn(bananaHits, event.actionId)
        ? event.actionId as BananaActionId : undefined;
      const bananaSound = event.kind === 'hit' && bananaId ? bananaHits[bananaId] : bananaEvents[event.kind];
      if (bananaSound || (event.kind === 'swing' && bananaId)) {
        // Different moves can hit together without masking each other's timbre.
        const key = event.kind + ':' + (bananaId ?? '');
        if (bananaCues.has(key)) continue;
        bananaCues.add(key);
        const now = ctx.currentTime;
        if (bananaSound) {
          this.playTone(ctx, bananaSound.tone, now);
          if (bananaSound.transient) this.playTransient(ctx, bananaSound.transient, now);
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
      if (swing) {
        this.playWind(ctx, poleWind[swing], ctx.currentTime);
        continue;
      }
      const wind = event.kind === 'swing' && event.actionId ? actionWinds[event.actionId] : undefined;
      if (wind) {
        this.playWind(ctx, wind, ctx.currentTime);
        continue;
      }
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
        this.playTransient(ctx, dijiangImpactRumble, now + .03);
      }
    }
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
