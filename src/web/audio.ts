import type { FighterAudioBank } from '../content/fighter-kit.js';
import { actionFor } from '../core/match.js';
import type { ActionAudioCue, Attack, CombatEvent, Duo, EventKind, FighterAction, HitFeedback, MatchConfig, MatchState } from '../core/types.js';

type Tone = [number, number, number, OscillatorType, number];
type HitSound = NonNullable<HitFeedback['sound']>;
type Seat = CombatEvent['source'];
type EmbeddedAudio = Readonly<Record<string, string>>;
type Playback = {
  source: AudioScheduledSourceNode;
  gain: GainNode;
  voiceSeat?: Seat;
  interruptibleAttack?: Attack;
};
type TrackedAction = { attack: Attack; action: FighterAction };

const seats = [0, 1] as const;

function level(value: number | undefined, fallback = 1) {
  return value === undefined || !Number.isFinite(value) ? fallback : Math.max(0, Math.min(1, value));
}

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
  private sfx: GainNode | null = null;
  private voice: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private banks: Duo<FighterAudioBank | undefined> = [undefined, undefined];
  private sources: EmbeddedAudio = {};
  private buffers = new Map<string, AudioBuffer | undefined>();
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

  get enabled() { return this.soundEnabled; }
  set enabled(value: boolean) {
    this.soundEnabled = value;
    this.updateVolume();
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

  private updateVolume() {
    if (this.output) this.output.gain.value = this.enabled ? this.volume : 0;
    if (this.sfx) this.sfx.gain.value = this.sfxVolume;
    if (this.voice) this.voice.gain.value = this.voiceVolume;
  }

  configure(banks: Duo<FighterAudioBank | undefined>, sources: EmbeddedAudio) {
    this.stopAll();
    this.banks = banks;
    if (this.sources !== sources) {
      this.sources = sources;
      this.buffers = new Map();
      this.reported.clear();
    }
    if (banks.some(bank => bank && Object.keys(bank).length)) this.ensureContext();
    this.preload();
  }

  stopAll() {
    for (const playback of this.playing) this.stop(playback);
    this.actions = [undefined, undefined];
    this.round = undefined;
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
      const payload = /^data:audio\/[^;,]+;base64,(.+)$/.exec(url)?.[1];
      if (!payload) throw new Error('Expected a base64 audio data URL');
      const bytes = Uint8Array.from(atob(payload), character => character.charCodeAt(0));
      const buffer = await context.decodeAudioData(bytes.buffer);
      if (buffers === this.buffers) buffers.set(src, buffer);
    } catch (error) {
      if (buffers === this.buffers) this.report('Unable to preload ' + src, error);
    }
  }

  private ensureContext() {
    if (this.context || !globalThis.AudioContext) return;
    try {
      this.context = new AudioContext();
    } catch (error) {
      this.report('Unable to open an audio device', error);
      return;
    }
    this.output = this.context.createGain();
    this.sfx = this.context.createGain();
    this.voice = this.context.createGain();
    this.sfx.connect(this.output);
    this.voice.connect(this.output);
    this.output.connect(this.context.destination);
    this.updateVolume();
  }

  enableFromGesture() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.context) return;
    this.activated = true;
    this.preload();
    this.applyPlaybackState();
  }

  update(config: MatchConfig, state: MatchState, events: readonly CombatEvent[]) {
    if (this.round !== undefined && this.round !== state.round) this.stopAll();
    this.round = state.round;
    for (const seat of seats) this.updateAction(config, state, seat);
    for (const { source, actionAudio } of events) {
      if (!actionAudio) continue;
      const { attack, cue } = actionAudio;
      if (cue.stopOnInterrupt === false) this.playClip(source, cue);
      else if (state.fighters[source].attack === attack) this.playClip(source, cue, attack);
    }
    this.play(events);
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
    const bank = this.banks[seat];
    const clip = bank && Object.hasOwn(bank, cue.clip) ? bank[cue.clip] : undefined;
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
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = level(clip.volume) * level(cue.volume);
    source.buffer = buffer;
    source.connect(gain).connect(bus);
    source.start();
    this.track({ source, gain, voiceSeat: voice ? seat : undefined, interruptibleAttack });
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

  private play(events: readonly CombatEvent[]) {
    const ctx = this.context;
    const output = this.sfx;
    if (!ctx || !output || !this.canPlay()) return;
    const sounds = new Map<string, CombatEvent>();
    for (const event of events) {
      if (event.kind === 'action-audio') continue;
      const impact = event.kind === 'hit' || event.kind === 'block' ? event.feedback?.audio : undefined;
      if (impact && this.playClip(event.source, impact)) continue;
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
      this.track({ source: oscillator, gain });
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
    this.track({ source, gain });
  }
}
