import type { CombatEvent, EventKind, MatchConfig } from '../core/types.js';
import { gagaActionIds } from '../content/gaga.js';
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
  [gagaActionIds.howitzer]: [340, 1250, 190, .155, .49]
};
const earthTransient: Noise = [730, .16, .44];

const gagaSounds: Record<GagaContact, { tone: Tone; transient: Noise }> = {
  light: { tone: [240, 105, .07, 'triangle', .17], transient: [2350, .041, .27] },
  medium: { tone: [175, 61, .105, 'triangle', .22], transient: [1750, .06, .32] },
  heavy: { tone: [133, 40, .19, 'triangle', .32], transient: [1280, .1, .36] },
  pole: { tone: [410, 144, .12, 'triangle', .20], transient: [2930, .059, .31] },
  lift: { tone: [160, 540, .13, 'triangle', .16], transient: [3150, .068, .29] },
  slide: { tone: [161, 48, .16, 'sawtooth', .14], transient: [950, .13, .35] },
  guard: { tone: [870, 435, .09, 'triangle', .13], transient: [4600, .041, .23] }
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
    for (const event of events) {
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
      const [head, tail, duration, wave, volume] = tone;
      const now = ctx.currentTime;
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
      if (special) this.playTransient(ctx, special.transient, now);
      if (kind === 'pole-impact' || kind === 'grenade-impact') this.playTransient(ctx, earthTransient, now);
    }
  }

  private filteredNoise(ctx: AudioContext, now: number, duration: number) {
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .34), ctx.sampleRate);
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

  private playWind(ctx: AudioContext, [start, peak, end, duration, volume]: Wind, now: number) {
    const { filter, gain } = this.filteredNoise(ctx, now, duration);
    const crest = now + duration * .26;
    filter.Q.value = .42;
    filter.frequency.setValueAtTime(start, now);
    filter.frequency.exponentialRampToValueAtTime(peak, crest);
    filter.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.linearRampToValueAtTime(volume * this.volume, crest);
    gain.exponentialRampToValueAtTime(.001, now + duration);
  }
}
