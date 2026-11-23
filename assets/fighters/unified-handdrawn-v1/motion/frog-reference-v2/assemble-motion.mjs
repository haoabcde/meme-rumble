import { fileURLToPath } from 'node:url';
import { createImage, pasteScaled, readFrames, readImage, writeImage } from '../../../../../scripts/unified-fighter-art.mjs';

const cell = 216;
const footX = 108;
const footY = 184;
const sourceScale = 2;
const sourceCell = cell * sourceScale;
const grids = { moves: [4, 2], basics: [4, 4], travel: [4, 2], 'normal-guard': [1, 1] };
// Generic renderer slots 0–11: run, stride, jump, guard, windup, strike,
// sweep, finish, rise, air, recover, hurt. Heights are in logical pixels.
const poses = [
  ['travel', 0, 144],
  ['travel', 2, 144],
  ['basics', 3, 142],
  ['normal-guard', 0, 144],
  ['basics', 0, 112],
  ['moves', 1, 144],
  ['moves', 2, 144],
  ['moves', 5, 114],
  ['moves', 3, 144],
  ['moves', 5, 127],
  ['basics', 6, 130],
  ['basics', 8, 142]
];

const source = name => fileURLToPath(new URL(name, import.meta.url));
const banks = Object.fromEntries(Object.entries(grids).map(([bank, [columns, rows]]) => {
  const atlas = readImage(source(bank + '.png'));
  const width = Math.floor(atlas.width / columns);
  const height = Math.floor(atlas.height / rows);
  const rectangles = Array.from({ length: columns * rows }, (_, index) =>
    [index % columns * width, Math.floor(index / columns) * height, width, height]);
  return [bank, readFrames(atlas, rectangles, 121)];
}));

const result = createImage(4 * sourceCell, 3 * sourceCell);
for (const [slot, [bank, index, logicalHeight]] of poses.entries()) {
  const frame = banks[bank][index];
  if (!frame) throw Error(`Empty body pose in ${bank}: ${index}`);
  const ratio = Math.min(logicalHeight * sourceScale / frame.image.height, (sourceCell - 12) / frame.image.width);
  const width = Math.round(frame.image.width * ratio);
  const height = Math.round(frame.image.height * ratio);
  const x = slot % 4 * sourceCell + footX * sourceScale - Math.floor(width / 2);
  const y = Math.floor(slot / 4) * sourceCell + footY * sourceScale - height;
  pasteScaled(result, frame.image, x, y, width, height);
}
writeImage(source('motion.webp'), result);
