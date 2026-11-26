import assert from 'node:assert/strict';
import test from 'node:test';
import { fitPresentationArt } from '../dist/web/fighter-presentation.js';

test('presentation art defaults to centered, unscaled artwork', () => {
  assert.deepEqual(fitPresentationArt({ src: 'embedded' }, 'right'),
    { x: .5, y: .5, scale: 1, scaleX: 1 });
});

test('configured scale stops before the vertical safe area exits the art frame', () => {
  assert.deepEqual(fitPresentationArt({
    src: 'embedded',
    anchor: { x: .5, y: .5 },
    scale: 2,
    safeArea: { x: .25, y: .1, width: .5, height: .8 },
  }, 'right'), { x: .5, y: .5, scale: 1.25, scaleX: 1.25 });
});

test('an asymmetric safe area stays inside the frame when mirrored by the receiver', () => {
  const fitted = fitPresentationArt({
    src: 'embedded',
    anchor: { x: .25, y: .5 },
    facing: 'left',
    scale: 1.4,
    safeArea: { x: .125, y: .125, width: .375, height: .75 },
  }, 'right');
  assert.deepEqual(fitted, { x: .25, y: .5, scale: 1, scaleX: -1 });
});
