import type { CombatEvent, EventKind } from '../core/types.js';

const tones: Partial<Record<EventKind, [number, number, number, OscillatorType, number]>> = {
  swing: [316, 168, .06, 'triangle', .042],
  hit: [148, 40, .13, 'triangle', .23],
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
  enabled = true;
  volume = .7;
  private context: AudioContext | null = null;
  private noise: AudioBuffer | null = null;

  enableFromGesture() {
    if (!this.enabled || !globalThis.AudioContext) return;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  }

  play(events: CombatEvent[]) {
    const ctx = this.context;
    if (!this.enabled || this.volume <= 0 || !ctx || ctx.state !== 'running') return;
    const sounds = new Map<EventKind, CombatEvent>();
    for (const event of events) {
      if (event.heavy || !sounds.has(event.kind)) sounds.set(event.kind, event);
    }
    for (const [kind, event] of sounds) {
      const tone = tones[kind];
      if (!tone) continue;
      const [head, tail, duration, wave, volume] = tone;
      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const weight = event.heavy ? .78 : 1;
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(head * weight, now);
      oscillator.frequency.exponentialRampToValueAtTime(tail, now + duration);
      gain.gain.setValueAtTime(.001, now);
      gain.gain.linearRampToValueAtTime(volume * this.volume, now + .007);
      gain.gain.exponentialRampToValueAtTime(.001, now + duration);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
      if (kind === 'hit' || kind === 'block' || kind === 'break') this.impact(ctx, now, kind === 'block', Boolean(event.heavy));
    }
  }

  private impact(ctx: AudioContext, now: number, blocked: boolean, heavy: boolean) {
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * .095), ctx.sampleRate);
      const samples = this.noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = blocked ? 2300 : heavy ? 490 : 940;
    filter.Q.value = .8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime((heavy ? .36 : .25) * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + (heavy ? .09 : .05));
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(now);
  }
}
