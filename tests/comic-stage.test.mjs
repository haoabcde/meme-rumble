import assert from 'node:assert/strict';
import test from 'node:test';
import { comicBeat } from '../dist/web/comic-stage.js';

const hit = { kind: 'hit', source: 0, x: 0, y: 0, direction: -1, hitstop: 5 };

test('comic panels respect impact tiers and expire on the presentation clock', () => {
  const medium = comicBeat(hit, 'medium', 0, false);
  const heavy = comicBeat(hit, 'heavy', 0, false);
  const ultimate = comicBeat({ ...hit, kind: 'ultimate' }, 'ultimate', 0, false);
  assert.ok(medium.strength < heavy.strength && heavy.strength < ultimate.strength);
  assert.equal(heavy.direction, -1);
  assert.ok(comicBeat(hit, 'heavy', 4, false).strength < heavy.strength);
  assert.equal(comicBeat(hit, 'heavy', -1, false), undefined);
  assert.equal(comicBeat(hit, 'heavy', 8, false), undefined);
});

test('the panel avoids rapid-contact strobing, balances trades, and respects reduced motion', () => {
  assert.equal(comicBeat({ ...hit, hitstop: 1 }, 'heavy', 0, false), undefined);
  assert.equal(comicBeat(hit, 'light', 0, false), undefined);
  assert.equal(comicBeat(hit, 'ultimate', 0, true), undefined);
  const traded = comicBeat({ ...hit, trade: true }, 'heavy', 0, false);
  assert.equal(traded.direction, 0);
  assert.ok(traded.strength < comicBeat(hit, 'heavy', 0, false).strength);
});
