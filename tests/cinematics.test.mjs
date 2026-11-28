import assert from 'node:assert/strict';
import test from 'node:test';
import { Tempo, beatFrames, crossedIntroCues, easeOutBack, fadeSince, shotFading, shotOpacity } from '../dist/web/cinematics.js';
import { frameEntrance } from '../dist/web/camera.js';

function sung(tempo, loud, origin) {
  const beats = [];
  for (let frame = origin; frame < origin + loud.length; frame++) {
    if (tempo.hear(loud[frame - origin], frame)) beats.push(frame);
  }
  return beats;
}

test('network snapshots play crossed entrance cues once for the correct fighter', () => {
  const intro = { cues: [{ at: 12, sound: { kind: 'land' } }, { at: 26, sound: { kind: 'swing', actionId: 'gaga-belly-slide' } }] };
  assert.deepEqual(crossedIntroCues(10, 27, [undefined, intro]), [
    { seat: 1, sound: { kind: 'land' } },
    { seat: 1, sound: { kind: 'swing', actionId: 'gaga-belly-slide' } }
  ]);
  assert.deepEqual(crossedIntroCues(27, 27, [undefined, intro]), []);
  assert.deepEqual(crossedIntroCues(27, 29, [undefined, intro]), []);
});

test('without a recording the beat falls on a steady interval from the frame the shot asks for', () => {
  assert.equal(beatFrames, 30);
  const tempo = new Tempo(34);
  const beats = [];
  for (let frame = 0; frame < 200; frame++) if (tempo.hear(undefined, frame)) beats.push(frame);
  assert.deepEqual(beats, [34, 64, 94, 124, 154, 184]);
});

test('with a recording each beat follows the start of a sung syllable', () => {
  // Three syllables of different length and loudness, each opening over two frames after a short rest.
  const loud = [];
  for (const [length, peak] of [[16, .5], [14, .62], [18, .55]]) {
    for (let i = 0; i < 5; i++) loud.push(0);
    for (let i = 0; i < length; i++) loud.push(peak * (i < 2 ? (i + 1) / 2 : 1 - .45 * (i - 1) / length));
  }
  assert.deepEqual(sung(new Tempo(34), loud, 34), [34 + 5, 34 + 26, 34 + 45]);
});

test('a long loud note without syllables keeps the steady beat', () => {
  assert.deepEqual(sung(new Tempo(34), new Array(150).fill(.8), 34), [34, 64, 94, 124, 154]);
});

test('sound too quiet to be a voice never starts a beat', () => {
  assert.deepEqual(sung(new Tempo(0), new Array(120).fill(.04), 0), []);
});

test('the pulse fades out after a beat and the lean changes sides on every beat', () => {
  const tempo = new Tempo(0);
  assert.equal(tempo.sway(0), 0);
  tempo.hear(undefined, 0);
  tempo.hear(undefined, 30);
  assert.equal(tempo.count, 2);
  assert.equal(tempo.pulse(30), 1);
  assert.equal(tempo.pulse(36), .5);
  assert.equal(tempo.pulse(42), 0);
  assert.equal(tempo.pulse(60), 0);
  assert.equal(tempo.sway(30), 1);
  assert.equal(tempo.sway(37), -1);
  assert.deepEqual(tempo.beats, [0, 30]);
});

test('a shot hands back to the frozen match over its last frames', () => {
  const shot = { frames: 100, fade: 12 };
  assert.equal(shotFading({ ...shot, frame: 87 }), false);
  assert.equal(shotOpacity({ ...shot, frame: 87 }), 1);
  // The last frame still covers the match; the next one has faded by one step.
  assert.equal(shotFading({ ...shot, frame: 88 }), true);
  assert.equal(shotOpacity({ ...shot, frame: 88 }), 1);
  assert.ok(shotOpacity({ ...shot, frame: 89 }) > .9 && shotOpacity({ ...shot, frame: 89 }) < 1);
  assert.ok(shotOpacity({ ...shot, frame: 99 }) > 0 && shotOpacity({ ...shot, frame: 99 }) < .1);
});

test('flashes and eased arrivals start and end where they are meant to', () => {
  assert.equal(fadeSince(9, 10, 4), 0);
  assert.equal(fadeSince(10, 10, 4), 1);
  assert.equal(fadeSince(12, 10, 4), .5);
  assert.equal(fadeSince(14, 10, 4), 0);
  assert.ok(Math.abs(easeOutBack(0)) < 1e-9);
  assert.ok(Math.abs(easeOutBack(1) - 1) < 1e-9);
  assert.ok(easeOutBack(.6) > 1);
});

test('the entrance two-shot holds both fighters whole, then hands back to the play camera', () => {
  const arena = { width: 4352, height: 2448 };
  const viewport = { width: 1280, height: 720 };
  const play = { x: 1800, y: 1700, zoom: 1.11 };
  const fighters = [{ x: 2009, y: 2024, height: 139 }, { x: 2355, y: 2024, height: 139 }];
  const close = frameEntrance(arena, viewport, play, fighters, 1);
  assert.ok(close.zoom > play.zoom * 2);
  for (const fighter of fighters) {
    const across = (fighter.x - close.x) * close.zoom;
    const crown = (fighter.y - fighter.height - close.y) * close.zoom;
    const feet = (fighter.y - close.y) * close.zoom;
    assert.ok(across > 80 && across < viewport.width - 80, 'kept clear of both edges');
    assert.ok(crown > viewport.height * .19, 'below the HUD');
    assert.ok(feet < viewport.height * .9, 'above the lower edge');
  }
  // The hand-over is continuous: no move at all, then a straight blend towards the two-shot.
  assert.deepEqual(frameEntrance(arena, viewport, play, fighters, 0), play);
  const half = frameEntrance(arena, viewport, play, fighters, .5);
  assert.ok(half.zoom > play.zoom && half.zoom < close.zoom);
});
