import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { disassemble, readFrames, readImage, targetBox, writeImage } from '../scripts/unified-fighter-art.mjs';

const body = [196, 53, 42, 255];
const tail = [55, 187, 219, 255];
const debris = [239, 36, 190, 255];
const transparentColor = [239, 36, 190, 0];

function fixture(width, height, rects) {
  const data = Buffer.alloc(width * height * 4);
  for (const [x, y, w, h, color] of rects) {
    for (let dy = y; dy < y + h; dy++) {
      for (let dx = x; dx < x + w; dx++) data.set(color, (dy * width + dx) * 4);
    }
  }
  return { width, height, data };
}

const source = fixture(120, 60, [[16, 15, 28, 34, body], [60, 0, 60, 60, transparentColor]]);
const generated = fixture(116, 57, [[17, 9, 12, 34, body], [31, 20, 5, 5, tail], [46, 5, 8, 8, debris]]);
const sourceRects = [[0, 0, 60, 60], [60, 0, 60, 60]];
const batch = { name: 'fixture-00-01.png', columns: 2, rows: 1, slots: [0, null] };
const threshold = 32;

function hasColor(image, color) {
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === color[0] && data[i + 1] === color[1] && data[i + 2] === color[2] && data[i + 3] === color[3]) {
      return true;
    }
  }
  return false;
}

test('sprite extraction retains a nearby detached tail tip, removes a distant color block, and leaves an empty slot', () => {
  const frames = readFrames(source, sourceRects, threshold);
  assert.equal(frames[1], null);
  const { poses: [pose, empty], warnings } = disassemble(generated, batch, threshold);
  assert.equal(empty, null);
  assert.deepEqual(warnings, []);
  assert.deepEqual(pose.bbox, [17, 9, 19, 34]);
  assert.equal(pose.kept, 2);
  assert.equal(pose.removed, 1);
  assert.ok(hasColor(pose.image, body));
  assert.ok(hasColor(pose.image, tail));
  assert.equal(hasColor(pose.image, debris), false);
});

test('2x anchor fit preserves the source size and contact point while height fit keeps the narrower silhouette', () => {
  const [frame] = readFrames(source, sourceRects, threshold);
  const { poses: [pose] } = disassemble(generated, batch, threshold);
  for (const fit of ['anchor', 'height']) {
    const [x, y, w, h] = targetBox(frame, pose, 2, fit);
    assert.equal(w, fit === 'anchor' ? 56 : 38);
    assert.equal(h, 68);
    const [poseX, poseY] = pose.anchor;
    const [bboxX, bboxY, bboxW, bboxH] = pose.bbox;
    const contact = [x + (poseX - bboxX) * w / bboxW, y + (poseY - bboxY) * h / bboxH];
    assert.deepEqual(contact.map(Math.round), frame.anchor.map(value => value * 2));
  }
});

const missingTools = ['ffmpeg', 'ffprobe', 'dwebp', 'cwebp'].filter(tool =>
  spawnSync(tool, ['-version'], { stdio: 'ignore' }).error?.code === 'ENOENT');

test('sprite CLI reads and writes lossless WebP with the blank cell transparent', {
  skip: missingTools.length ? 'Optional image CLI tools unavailable: ' + missingTools.join(', ') : false
}, () => {
  const directory = mkdtempSync(join(tmpdir(), 'fighter-art-test-'));
  try {
    const sourcePath = join(directory, 'source.webp');
    const preparedDir = join(directory, 'prepared');
    const generatedDir = join(directory, 'generated');
    const output = join(directory, 'assembled.webp');
    mkdirSync(generatedDir);
    writeImage(sourcePath, source);
    const decodedSource = readImage(sourcePath);
    assert.deepEqual([decodedSource.width, decodedSource.height], [120, 60]);
    for (let i = 3; i < source.data.length; i += 4) assert.equal(decodedSource.data[i], source.data[i]);
    writeImage(join(generatedDir, batch.name), generated);

    const script = fileURLToPath(new URL('../scripts/unified-fighter-art.mjs', import.meta.url));
    const run = (...args) => execFileSync(process.execPath, [script, ...args]);
    run('prepare', sourcePath, preparedDir, '--prefix', 'fixture', '--cell', '60', '--columns', '2', '--grid', '2x1');
    run('assemble', join(preparedDir, 'fixture.json'), generatedDir, output, '--fit', 'anchor');
    const atlas = readImage(output);
    const metadata = JSON.parse(readFileSync(join(directory, 'assembled.json'), 'utf8'));
    assert.deepEqual([atlas.width, atlas.height, metadata.cell, metadata.sourceScale], [240, 120, 120, 2]);
    assert.equal(metadata.frames[1], null);
    assert.deepEqual(metadata.frames[0].anchorOffset, [0, 0]);
    assert.ok(hasColor(atlas, body));
    assert.ok(hasColor(atlas, tail));
    assert.equal(hasColor(atlas, debris), false);
    for (let y = 0; y < atlas.height; y++) {
      for (let x = 120; x < atlas.width; x++) assert.equal(atlas.data[(y * atlas.width + x) * 4 + 3], 0);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
