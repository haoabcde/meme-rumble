import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { imageSize } from 'image-size';
import { arenas } from '../dist/content/arenas.js';
import { rules } from '../dist/content/demo.js';
import { roster } from '../dist/content/roster.js';
import { createMatch, step } from '../dist/core/match.js';
import { NEUTRAL } from '../dist/core/types.js';
import { frameCamera } from '../dist/web/camera.js';
import { paintTheatre, placeTheatre } from '../dist/web/theatre-layout.js';

const arena = arenas.find(arena => arena.id === 'broadcast-ring');
const art = imageSize(readFileSync(new URL('../assets/arenas/broadcast-long-master.webp', import.meta.url)));
const plate = placeTheatre(arena, art.width, art.height);
const viewport = { width: 1280, height: 720 };
const subject = (x, y = arena.floor) => ({ x, y, height: 145 });

test('the theatre end caps and walking plane register to the collision floor at one uniform scale', () => {
  const scale = plate.width / art.width;
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .01, actual + ' vs ' + expected);
  near(plate.height / art.height, scale);
  near(plate.left + 42 * scale, arena.left);
  near(plate.left + 1630 * scale, arena.right);
  near(plate.top + 812 * scale, arena.floor);
});

test('the painted world covers edge, spread and double-jump cameras without moving its landmarks', () => {
  const fighter = roster[0].fighter;
  const match = { arena, rules, fighters: [fighter, fighter], training: true };
  const state = createMatch(match);
  for (let tick = 0; tick < 120; tick++) step(state, [NEUTRAL, NEUTRAL], match);
  const jump = { ...NEUTRAL, pressed: ['jump'] };
  const reachApex = () => {
    for (let tick = 0; state.fighters[0].vy < 0 && tick < 60; tick++) step(state, [NEUTRAL, NEUTRAL], match);
    assert.ok(state.fighters[0].vy >= 0 && state.fighters[0].ground === null);
  };
  step(state, [jump, jump], match);
  reachApex();
  const events = step(state, [jump, jump], match);
  assert.equal(events.filter(event => event.kind === 'air-jump').length, 2);
  reachApex();
  const pairs = [
    [subject(arena.left), subject(arena.left + 80)],
    arena.spawn.map(x => subject(x)),
    [subject(arena.right - 80), subject(arena.right)],
    [subject(arena.left), subject(arena.right)],
    state.fighters.map(fighter => subject(fighter.x, fighter.y))
  ];
  const cameras = pairs.map(pair => frameCamera(arena, viewport, pair, null, 1, false));
  const shadows = [], paintings = [];
  paintTheatre({
    createLinearGradient: () => ({ addColorStop() {} }),
    fillRect: (...rect) => shadows.push(rect),
    drawImage: (_image, ...rect) => paintings.push(rect)
  }, { naturalWidth: art.width, naturalHeight: art.height }, arena);
  assert.deepEqual(paintings, [[plate.left, plate.top, plate.width, plate.height]]);
  // A small recess beneath the apron is only exposed in the full pullback.
  assert.equal(shadows.length, 1);
  const [x0, y0, width, height] = shadows[0];
  assert.ok(x0 <= 0 && x0 + width >= arena.width && y0 <= plate.bottom);
  assert.ok(height <= arena.height * .04 && y0 + height >= arena.height);
  for (const { x, y, zoom } of cameras) {
    assert.ok(x >= plate.left && x + viewport.width / zoom <= plate.left + plate.width + .01);
    assert.ok(y >= plate.top && y + viewport.height / zoom <= y0 + height + .01);
  }
  for (const i of [0, 1, 2, 4]) assert.ok(cameras[i].y + viewport.height / cameras[i].zoom <= plate.bottom);
  // The two end shots show separate sections; the central chandelier's
  // fixed world position is visible in the middle shot and the full pullback.
  const chandelier = (arena.left + arena.right) / 2;
  const onScreen = ({ x, zoom }) => (chandelier - x) * zoom;
  assert.ok(onScreen(cameras[0]) > viewport.width);
  assert.ok(onScreen(cameras[2]) < 0);
  for (const i of [1, 3]) assert.ok(Math.abs(onScreen(cameras[i]) - viewport.width / 2) < 1);
});
