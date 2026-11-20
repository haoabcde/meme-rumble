import type { CombatEvent, EventKind } from '../core/types.js';

const tones: Partial<Record<EventKind, [number, number, number, OscillatorType, number]>> = {
  swing: [340, 130, .065, 'triangle', .045],
  hit: [144, 42, .15, 'sawtooth', .16],
  block: [520, 195, .085, 'square', .065],
  break: [191, 52, .22, 'square', .11],
  dash: [210, 79, .085, 'triangle', .054],
  jump: [183, 340, .09, 'triangle', .038],
  drop: [226, 123, .07, 'triangle', .029],
  land: [104, 53, .075, 'triangle', .026],
  ko: [121, 44, .42, 'triangle', .14]
};

export class FightAudio {
  enabled = true;
  volume = .7;
  private context: AudioContext | null = null;

  enableFromGesture() {
    if (!this.enabled || !globalThis.AudioContext) return;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  }

  play(events: CombatEvent[]) {
    const ctx = this.context;
    if (!this.enabled || this.volume <= 0 || !ctx || ctx.state !== 'running') return;
    for (const kind of new Set(events.map(event => event.kind))) {
      const tone = tones[kind];
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
    }
  }
}
