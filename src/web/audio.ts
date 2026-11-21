import type { CombatEvent, EventKind, HitFeedback } from '../core/types.js';

type Tone = [number, number, number, OscillatorType, number];
type HitSound = NonNullable<HitFeedback['sound']>;

const hitTones: Record<HitSound, Tone> = {
  light: [202, 76, .085, 'triangle', .16],
  heavy: [133, 39, .18, 'triangle', .27],
  sharp: [440, 138, .075, 'sawtooth', .11]
};

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
  ko: [121, 44, .42, 'triangle', .14]
};

export class FightAudio {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private soundEnabled = true;
  private soundVolume = .7;

  get enabled() { return this.soundEnabled; }
  set enabled(value: boolean) {
    this.soundEnabled = value;
    this.updateVolume();
  }

  get volume() { return this.soundVolume; }
  set volume(value: number) {
    this.soundVolume = value;
    this.updateVolume();
  }

  private updateVolume() {
    if (this.output) this.output.gain.value = this.enabled ? this.volume : 0;
  }

  enableFromGesture() {
    if (!this.enabled || !globalThis.AudioContext) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.output = this.context.createGain();
      this.output.connect(this.context.destination);
      this.updateVolume();
    }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  }

  play(events: CombatEvent[]) {
    const ctx = this.context;
    const output = this.output;
    if (!this.enabled || this.volume <= 0 || !ctx || !output || ctx.state !== 'running') return;
    const sounds = new Map<string, CombatEvent>();
    for (const event of events) {
      const preset = event.kind === 'hit' ? event.feedback?.sound ?? (event.heavy ? 'heavy' : 'light') : undefined;
      const key = preset ? 'hit-' + preset : event.kind;
      if (event.heavy || !sounds.has(key)) sounds.set(key, event);
    }
    for (const event of sounds.values()) {
      const { kind } = event;
      const sound = kind === 'hit' ? event.feedback?.sound ?? (event.heavy ? 'heavy' : 'light') : undefined;
      const tone = sound ? hitTones[sound] : tones[kind];
      if (!tone) continue;
      const [head, tail, duration, wave, volume] = tone;
      const now = ctx.currentTime;
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
      if (kind === 'hit' || kind === 'block' || kind === 'break') {
        const heavy = sound === 'heavy' || kind === 'break';
        this.impact(ctx, output, now, kind === 'block', heavy, sound === 'sharp');
      }
    }
  }

  private impact(ctx: AudioContext, output: GainNode, now: number, blocked: boolean, heavy: boolean, sharp: boolean) {
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * .095), ctx.sampleRate);
      const samples = this.noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = sharp ? 3250 : blocked ? 2300 : heavy ? 490 : 1450;
    filter.Q.value = .8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(heavy ? .33 : .22, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + (heavy ? .09 : .04));
    source.connect(filter).connect(gain).connect(output);
    source.start(now);
  }
}
