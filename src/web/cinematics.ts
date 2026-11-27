import type { CombatEvent, EventKind, FighterState } from '../core/types.js';
import type { GagaActionPose } from './art.js';

/** An opening performed on the stage during the first round's countdown. The match is not paused for it and both
 *  fighters stay in view, the way a fighting game walks its cast in. */
export interface FighterIntro {
  /** Length in frames. The countdown runs alongside it, so it has to fit inside the opening. */
  frames: number;
  /** Pose shown from this frame on, in place of the idle stance. */
  pose(frame: number): GagaActionPose | undefined;
  /** How far the fighter stands behind the opening mark, along the facing. */
  shift(frame: number): number;
  /** Ground covered so far, which drives the walk. */
  travelled(frame: number): number;
  /** How much of the closer two-shot the camera takes, from 0 to 1. */
  close(frame: number): number;
  /** Sounds fired on given frames. */
  cues: readonly { at: number; sound: Pick<CombatEvent, 'kind' | 'actionId'> }[];
  /** Marks drawn at the fighter's feet in world units, facing right. */
  effect?(ctx: CanvasRenderingContext2D, frame: number, fighter: FighterState): void;
}

export interface FeatureShot {
  /** Frame on screen, counted from zero. */
  frame: number;
  frames: number;
  /** Frames at the end over which the frozen match shows through again. */
  fade: number;
  name: string;
  /** Whoever is on screen, such as `P1` or `电脑`. */
  seat: string;
  /** Colour marking that seat. */
  color: string;
  /** Hint for skipping the shot. */
  skip: string;
  /** Keeps time for the frames that move to a beat. */
  tempo: Tempo;
  paint(ctx: CanvasRenderingContext2D): void;
}

export interface Cinematic {
  /** Length in frames. A shot with a voice recording lasts as long as the recording. */
  frames: number;
  fade: number;
  /** Sample that plays with the shot, when the fighter ships one. */
  sound?: string;
  /** Frame on which the sample starts, when it follows an opening card. */
  soundAt?: number;
  /** Match sounds fired on given frames. */
  cues?: readonly { at: number; sound: EventKind }[];
  /** Frame on which the beat counter starts. */
  beatFrom?: number;
  paint(ctx: CanvasRenderingContext2D, shot: FeatureShot): void;
}

/** A shot hands back to the frozen match over its last `fade` frames. */
export const shotFading = (shot: FeatureShot) => shot.frame >= shot.frames - shot.fade;
export const shotOpacity = (shot: FeatureShot) =>
  1 - Math.max(0, shot.frame - (shot.frames - shot.fade)) / shot.fade;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export const easeOut = (value: number) => 1 - (1 - clamp01(value)) ** 3;
export const easeIn = (value: number) => clamp01(value) ** 3;
/** Falls linearly from 1 to 0 over `frames` ticks after `at`, and is 0 before. */
export const fadeSince = (frame: number, at: number, frames: number) =>
  frame < at ? 0 : Math.max(0, 1 - (frame - at) / frames);
/** Reaches the target and overshoots it, for poses that snap into place. */
export function easeOutBack(value: number) {
  const left = clamp01(value) - 1;
  return 1 + (2.7 * left + 1.7) * left * left;
}
/** Deterministic 0–1 noise, so a shot looks the same on every playback. */
export const noise = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

export const beatFrames = 30;

/** Keeps time for a shot: with a voice recording it follows each sung syllable, without one it holds a steady beat.
 *  Frame numbers are those of the whole shot. */
export class Tempo {
  /** Beats so far. */
  count = 0;
  /** Frame of each of the last few beats, oldest first. */
  readonly beats: number[] = [];
  private last = -Infinity;
  private heard = 0;
  private average = 0;
  private loud = 0;

  constructor(private readonly origin = 0) {}

  /** Fades from 1 on the beat to 0 twelve frames later. */
  pulse(frame: number) {
    return Math.min(1, Math.max(0, 1 - (frame - this.last) / 12));
  }

  /** Leans to -1 or 1, switching sides on every beat. */
  sway(frame: number) {
    if (!this.count) return 0;
    const side = this.count % 2 ? 1 : -1;
    return side * (2 * easeOut((frame - this.last) / 7) - 1);
  }

  /** Feeds the loudness heard on this frame. Without a recording the beat falls every `beatFrames` from the origin. */
  hear(loudness: number | undefined, frame: number): boolean {
    if (frame < this.origin) return false;
    if (loudness === undefined) {
      if ((frame - this.origin) % beatFrames) return false;
      this.mark(frame);
      return true;
    }
    const rising = loudness - this.heard;
    this.heard = loudness;
    this.loud = loudness > .05 ? this.loud + 1 : 0;
    // A syllable opens with an audible jump above the running level, or as the first sound after a pause.
    const opens = this.loud === 1 || (rising > .03 && loudness > .05 && loudness > this.average * 1.25 + .02);
    this.average += (loudness - this.average) * (loudness > this.average ? .28 : .05);
    if (this.last >= this.origin && frame - this.last < 8) return false;
    // Heavily compressed recordings barely rise and fall, so sound that stays loud keeps the steady beat.
    const sustained = this.loud >= beatFrames && frame - this.last >= beatFrames;
    if (!opens && !sustained) return false;
    this.mark(frame);
    return true;
  }

  private mark(frame: number) {
    this.last = frame;
    this.count++;
    this.beats.push(frame);
    if (this.beats.length > 10) this.beats.shift();
  }
}
