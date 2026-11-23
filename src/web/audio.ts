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
type HitSound = NonNullable<HitFeedback['sound']>;
type Seat = CombatEvent['source'];
type EmbeddedAudio = Readonly<Record<string, string>>;
type Playback = {
  source: AudioScheduledSourceNode;
  gain: GainNode;
  voiceSeat?: Seat;
  musicSeat?: Seat;
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

type GagaSample = 'jab' | 'backhand' | 'pole-sweep' | 'pole-reverse' | 'pole-launch' | 'pole-hit' |
  'pole-heavy-hit' | 'pole-ground' | 'feet-land' | 'body-land' | 'guard' | 'slide-call' |
  'turret-land' | 'turret-ready' | 'turret-bolt' | 'grenade-impact';

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

export class FightAudio {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private sfx: GainNode | null = null;
  private voice: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private banks: Duo<FighterAudioBank | undefined> = [undefined, undefined];
  private sources: EmbeddedAudio = {};
  private buffers = new Map<string, AudioBuffer | undefined>();
  private levels = new Map<string,{peak:number;rms:number}>();
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
  private entityAges = new Map<number, number>();
  private lastPhase: MatchState['phase'] | undefined;

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
      this.levels.clear();
      this.reported.clear();
    }
    if (banks.some(bank => bank && Object.keys(bank).length)) this.ensureContext();
    this.preload();
  }

  stopAll() {
    for (const playback of this.playing) this.stop(playback);
    this.actions = [undefined, undefined];
    this.round = undefined;
    this.entityAges.clear();
    this.lastPhase = undefined;
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
      if (buffers === this.buffers) {
        buffers.set(src, buffer);
        this.levels.set(src,sampleLevel(Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i))));
      }
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
    const compressor=this.context.createDynamicsCompressor();
    compressor.threshold.value=-6;compressor.knee.value=6;compressor.ratio.value=12;
    compressor.attack.value=.003;compressor.release.value=.18;
    this.output.connect(compressor).connect(this.context.destination);
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
    if (state.phase === 'ready' && this.lastPhase !== 'ready') {
      for (const seat of seats) this.playNamed(seat, 'event-entry');
    }
    this.lastPhase = state.phase;
    for (const seat of seats) this.updateAction(config, state, seat);
    const silentVoices = seats.filter(seat => config.fighters[seat]?.id === 'frog' &&
      (frogPowered(state.fighters[seat], state) || state.fighters[seat].attack?.id === 'frog-ascend'));
    for (const playback of this.playing) {
      if (playback.voiceSeat !== undefined && silentVoices.includes(playback.voiceSeat)) this.stop(playback);
      if (playback.musicSeat !== undefined && !silentVoices.includes(playback.musicSeat)) {
        this.fadeMusic(playback);
      }
    }
    for (const { source, actionAudio } of events) {
      if (!actionAudio) continue;
      const { attack, cue } = actionAudio;
      if (cue.channel === 'voice' && silentVoices.includes(source)) continue;
      if (cue.stopOnInterrupt === false) this.playClip(source, cue);
      else if (state.fighters[source].attack === attack) this.playClip(source, cue, attack);
    }
    this.updateEntities(state);
    this.play(events, config.fighters);
  }

  private playNamed(seat: Seat, clip: string) {
    if (!this.banks[seat]?.[clip]) return false;
    return this.playClip(seat, {clip, channel:'sfx'});
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
        this.entityAges.set(entity.id,entity.age);
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
    const source = context.createBufferSource();
    const gain = context.createGain();
    const target=soundTarget(clipId),stats=this.levels.get(clip.src);
    gain.gain.value = level(clip.volume) * level(cue.volume) *
      (target!==undefined&&stats?calibratedGain(stats,target):1) *
      (clipId==='ultimate-bgm'?10**(7/20):1);
    source.buffer = buffer;
    source.connect(gain).connect(bus);
    source.start();
    this.track({ source, gain, voiceSeat: voice ? seat : undefined, musicSeat: music ? seat : undefined, interruptibleAttack });
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
    const now=this.context!.currentTime;
    playback.musicSeat=undefined;
    playback.gain.gain.setValueAtTime(playback.gain.gain.value,now);
    playback.gain.gain.linearRampToValueAtTime(0,now+.3);
    playback.source.stop(now+.3);
  }

  private play(events: readonly CombatEvent[], fighters: MatchConfig['fighters']) {
    const ctx = this.context;
    const output = this.sfx;
    if (!ctx || !output || !this.canPlay()) return;
    const sounds = new Map<string, { event: CombatEvent; contact?: GagaContact }>();
    const played = new Set<string>();
    const now = ctx.currentTime;
    for (const event of events) {
      if (event.kind === 'action-audio') continue;
      if (event.kind === 'ultimate' && this.banks[event.source]?.['ultimate-bgm']) continue;
      // Block and break source is the attacker; defensive foley belongs to the other seat.
      if ((event.kind === 'block' || event.kind === 'break') &&
        this.playNamed(event.source === 0 ? 1 : 0, 'event-' + event.kind)) continue;
      const impact = event.kind === 'hit' || event.kind === 'block' ? event.feedback?.audio : undefined;
      if (impact && this.playClip(event.source, impact)) continue;
      if (this.playCharacterCue(ctx, output, now, event, fighters, played)) continue;
      if (this.playNamed(event.source, 'event-' + event.kind)) continue;
      const preset = event.kind === 'hit' ? event.feedback?.sound ?? (event.heavy ? 'heavy' : 'light') : undefined;
      const contact = event.kind === 'hit' && event.feedback?.sound ? undefined : gagaContact(event, fighters);
      const key = contact ? 'gaga-' + event.kind : preset ? 'hit-' + preset : event.kind;
      if (event.heavy || contact === 'heavy' || !sounds.has(key)) sounds.set(key, { event, contact });
    }
    for (const { event, contact } of sounds.values()) {
      const { kind } = event;
      const sound = kind === 'hit' ? event.feedback?.sound ?? (event.heavy ? 'heavy' : 'light') : undefined;
      const special = contact ? gagaSounds[contact] : undefined;
      const tone = special?.tone ?? (sound ? hitTones[sound] : tones[kind]);
      if (!tone) continue;
      this.playTone(ctx, output, tone, now);
      if (special) this.playTransient(ctx, output, special.transient, now);
      else if (kind === 'hit' || kind === 'block' || kind === 'break') {
        const heavy = sound === 'heavy' || kind === 'break';
        this.impact(ctx, output, now, kind === 'block', heavy, sound === 'sharp');
      }
      if (kind === 'pole-impact' || kind === 'grenade-impact') this.playTransient(ctx, output, earthTransient, now);
      if (kind === 'summon-drop') this.playWind(ctx, output, dijiangDiveRoar, now, .78);
      if (kind === 'summon-impact') {
        this.playTransient(ctx, output, dijiangImpactCrack, now);
        if (!this.playNamed(event.source, 'dijiang-impact')) this.playTransient(ctx, output, dijiangImpactRumble, now + .03);
      }
    }
  }

  private playCharacterCue(ctx: AudioContext, output: GainNode, now: number, event: CombatEvent,
    fighters: MatchConfig['fighters'], played: Set<string>) {
    const { actionId, kind, source } = event;
    const bananaId = actionId && Object.hasOwn(bananaHits, actionId) ? actionId as BananaActionId : undefined;
    const bananaSound = kind === 'hit' && bananaId ? bananaHits[bananaId] : bananaEvents[kind];
    const wind = kind === 'swing' && actionId ? actionWinds[actionId] : undefined;
    if (bananaSound || (bananaId && wind)) {
      const key = kind + ':banana:' + (bananaId ?? '');
      if (played.has(key)) return true;
      played.add(key);
      if (bananaSound) {
        this.playTone(ctx, output, bananaSound.tone, now);
        if (bananaSound.transient) this.playTransient(ctx, output, bananaSound.transient, now);
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
      const key = kind + ':gaga:' + sample;
      if (played.has(key)) return true;
      const seat = fighters[source].id === 'gaga' ? source : source === 0 ? 1 : 0;
      if (this.playNamed(seat, sample)) {
        played.add(key);
        return true;
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

  private impact(ctx: AudioContext, output: GainNode, now: number, blocked: boolean, heavy: boolean, sharp: boolean) {
    const duration = heavy ? .09 : .04;
    const { filter, gain } = this.filteredNoise(ctx, output, now, duration);
    filter.frequency.value = sharp ? 3250 : blocked ? 2300 : heavy ? 490 : 1450;
    filter.Q.value = .8;
    gain.setValueAtTime(heavy ? .33 : .22, now);
    gain.exponentialRampToValueAtTime(.001, now + duration);
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
