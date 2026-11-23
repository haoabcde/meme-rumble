import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const help = `Usage:
  node scripts/unified-fighter-art.mjs prepare SOURCE OUTPUT_DIR --prefix whale [--cell 216 --columns 4 --grid 4x2 --tile 320]
  node scripts/unified-fighter-art.mjs assemble MANIFEST GENERATED_DIR OUTPUT.webp [--scale 2 --fit box|anchor|height --fallback SOURCE]

Assemble expects PNG files matching the batch names in the manifest. By default all prepared batches are required.
--fallback SOURCE fills missing frames from the original sheet for a partial preview.
Box fit keeps the source bounding box. Anchor fit keeps its size and matches the visible contact point.
Height fit matches that contact point while preserving the new pose's proportions.
--layout FILE replaces the regular source grid with { "sourceRects": [[x,y,width,height], null, ...] } in frame order.
Both commands require ffmpeg and ffprobe. WebP input requires dwebp, and WebP export requires cwebp.
--threshold sets the minimum alpha for detection (default 32).`;

const options = Object.fromEntries([
  'prefix', 'cell', 'columns', 'grid', 'tile', 'start', 'end', 'threshold', 'scale', 'fit', 'fallback', 'layout'
].map(name => [name, { type: 'string' }]));

function call(program, args, input, maxBuffer = 16 * 1024 * 1024) {
  const result = spawnSync(program, args, { input, maxBuffer });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(program + ': ' + result.stderr.toString().trim());
  return result.stdout;
}

function withTemporaryPng(operation) {
  const directory = mkdtempSync(join(tmpdir(), 'fighter-art-'));
  try {
    return operation(join(directory, 'sheet.png'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function readImage(path) {
  if (extname(path).toLowerCase() !== '.webp') return readRgba(path);
  // Decode with libwebp before FFmpeg converts to RGBA so transparent areas stay clean.
  return withTemporaryPng(pngPath => {
    call('dwebp', ['-quiet', path, '-o', pngPath]);
    return readRgba(pngPath);
  });
}

function readRgba(path) {
  const info = call('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=width,height', '-of', 'json', path]);
  const { width, height } = JSON.parse(info).streams[0];
  const bytes = width * height * 4;
  const data = call('ffmpeg', ['-v', 'error', '-i', path, '-frames:v', '1', '-f', 'rawvideo',
    '-pix_fmt', 'rgba', '-'], undefined, bytes + 4096);
  if (data.length !== bytes) throw Error('Unexpected RGBA size: ' + path);
  return { width, height, data };
}

function createImage(width, height) {
  return { width, height, data: Buffer.alloc(width * height * 4) };
}

function writeImage(path, image) {
  const format = extname(path).toLowerCase();
  if (format !== '.webp' && format !== '.png') throw Error('Output must be .png or .webp: ' + path);
  mkdirSync(dirname(path), { recursive: true });
  const png = output => call('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-video_size',
    `${image.width}x${image.height}`, '-i', '-', '-frames:v', '1', '-update', '1', output], image.data);
  if (format === '.png') {
    png(path);
    return;
  }
  withTemporaryPng(pngPath => {
    png(pngPath);
    call('cwebp', ['-quiet', '-z', '6', pngPath, '-o', path]);
  });
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

function crop(image, x, y, width, height) {
  const result = createImage(width, height);
  for (let row = 0; row < height; row++) {
    const start = ((y + row) * image.width + x) * 4;
    image.data.copy(result.data, row * width * 4, start, start + width * 4);
  }
  return result;
}

function union(bounds, part) {
  bounds.left = Math.min(bounds.left, part.left);
  bounds.top = Math.min(bounds.top, part.top);
  bounds.right = Math.max(bounds.right, part.right);
  bounds.bottom = Math.max(bounds.bottom, part.bottom);
}

function alphaComponents(image, threshold) {
  const { width, height, data } = image;
  const count = width * height;
  const ink = new Uint8Array(count);
  for (let i = 0; i < count; i++) ink[i] = data[i * 4 + 3] >= threshold ? 1 : 0;
  if (ink.every(pixel => pixel === 1)) throw Error('Image must contain transparent separation between poses');
  const labels = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    if (!ink[i]) continue;
    const x = i % width;
    const horizontal = (x > 0 && ink[i - 1]) || (x + 1 < width && ink[i + 1]);
    const vertical = (i >= width && ink[i - width]) || (i + width < count && ink[i + width]);
    // Thin stray raster lines should not join two otherwise separate poses.
    if (horizontal && vertical) labels[i] = -1;
  }
  const parts = [];
  const queue = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    if (labels[i] !== -1) continue;
    const id = parts.length + 1;
    const x = i % width;
    const y = Math.floor(i / width);
    const part = { id, area: 0, left: x, top: y, right: x + 1, bottom: y + 1 };
    labels[i] = id;
    queue[0] = i;
    let end = 1;
    for (let j = 0; j < end; j++) {
      const pixel = queue[j];
      const px = pixel % width;
      const py = Math.floor(pixel / width);
      part.left = Math.min(part.left, px);
      part.top = Math.min(part.top, py);
      part.right = Math.max(part.right, px + 1);
      part.bottom = Math.max(part.bottom, py + 1);
      for (let ny = Math.max(0, py - 1); ny <= Math.min(height - 1, py + 1); ny++) {
        for (let nx = Math.max(0, px - 1); nx <= Math.min(width - 1, px + 1); nx++) {
          const neighbor = ny * width + nx;
          if (labels[neighbor] !== -1) continue;
          labels[neighbor] = id;
          queue[end++] = neighbor;
        }
      }
    }
    part.area = end;
    parts.push(part);
  }
  return { labels, parts: parts.sort((a, b) => b.area - a.area) };
}

function extract(image, labels, parts, reach) {
  const [main] = parts;
  if (!main || main.area < 10) return null;
  const nearby = candidate => {
    const dx = Math.max(0, candidate.left - main.right, main.left - candidate.right);
    const dy = Math.max(0, candidate.top - main.bottom, main.top - candidate.bottom);
    return Math.hypot(dx, dy) <= reach;
  };
  const kept = parts.filter(part => part === main || (part.area >= Math.max(12, main.area * .004) && nearby(part)));
  const ids = new Set(kept.map(part => part.id));
  const area = { ...main };
  for (const part of kept) union(area, part);
  const { width, height, data } = image;
  const x0 = Math.max(0, area.left - 1);
  const y0 = Math.max(0, area.top - 1);
  const x1 = Math.min(width, area.right + 1);
  const y1 = Math.min(height, area.bottom + 1);
  const region = createImage(x1 - x0, y1 - y0);
  const bounds = { left: width, top: height, right: 0, bottom: 0 };
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const index = y * width + x;
      if (data[index * 4 + 3] === 0) continue;
      let belongs = ids.has(labels[index]);
      for (let row = Math.max(0, y - 1); !belongs && row <= Math.min(height - 1, y + 1); row++) {
        for (let col = Math.max(0, x - 1); !belongs && col <= Math.min(width - 1, x + 1); col++) {
          belongs = ids.has(labels[row * width + col]);
        }
      }
      if (!belongs) continue;
      const to = ((y - y0) * region.width + x - x0) * 4;
      data.copy(region.data, to, index * 4, index * 4 + 4);
      union(bounds, { left: x, top: y, right: x + 1, bottom: y + 1 });
    }
  }
  const bbox = [bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top];
  // Use the lower part of the main silhouette for the horizontal contact point.
  let left = width;
  let right = 0;
  const lower = Math.max(main.top, main.bottom - Math.max(3, Math.round((main.bottom - main.top) * .08)));
  for (let y = lower; y < main.bottom; y++) {
    for (let x = main.left; x < main.right; x++) {
      if (labels[y * width + x] !== main.id) continue;
      left = Math.min(left, x);
      right = Math.max(right, x + 1);
    }
  }
  return { bbox, anchor: [(left + right) / 2, main.bottom], image: crop(region,
    bounds.left - x0, bounds.top - y0, bbox[2], bbox[3]), kept: kept.length, removed: parts.length - kept.length };
}

function pasteScaled(target, source, x, y, width, height) {
  for (let dy = 0; dy < height; dy++) {
    const sy = Math.max(0, Math.min(source.height - 1, (dy + .5) * source.height / height - .5));
    const top = Math.floor(sy);
    const bottom = Math.min(top + 1, source.height - 1);
    const fy = sy - top;
    for (let dx = 0; dx < width; dx++) {
      const sx = Math.max(0, Math.min(source.width - 1, (dx + .5) * source.width / width - .5));
      const left = Math.floor(sx);
      const right = Math.min(left + 1, source.width - 1);
      const fx = sx - left;
      const to = ((y + dy) * target.width + x + dx) * 4;
      const a = (top * source.width + left) * 4;
      const b = (top * source.width + right) * 4;
      const c = (bottom * source.width + left) * 4;
      const d = (bottom * source.width + right) * 4;
      const aw = source.data[a + 3] * (1 - fx) * (1 - fy);
      const bw = source.data[b + 3] * fx * (1 - fy);
      const cw = source.data[c + 3] * (1 - fx) * fy;
      const dw = source.data[d + 3] * fx * fy;
      const alpha = aw + bw + cw + dw;
      if (alpha < .5) continue;
      for (let channel = 0; channel < 3; channel++) {
        target.data[to + channel] = Math.round((source.data[a + channel] * aw + source.data[b + channel] * bw +
          source.data[c + channel] * cw + source.data[d + channel] * dw) / alpha);
      }
      target.data[to + 3] = Math.round(alpha);
    }
  }
}

function integer(value, fallback, low, high, name) {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(n) || n < low || n > high) throw Error(`--${name}: expected integer ${low}–${high}`);
  return n;
}

function sourceRects(image, columns, cell, layout) {
  if (layout) {
    const { sourceRects: rects } = JSON.parse(readFileSync(layout, 'utf8'));
    if (!Array.isArray(rects) || !rects.length) throw Error('Layout must provide a nonempty sourceRects array');
    for (const [index, rect] of rects.entries()) {
      if (rect === null) continue;
      if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isInteger)) {
        throw Error('Expected integer source rectangle for frame ' + index);
      }
      const [x, y, w, h] = rect;
      if (x < 0 || y < 0 || w < 1 || h < 1 || x + w > image.width || y + h > image.height) {
        throw Error('Source rectangle is outside the image for frame ' + index);
      }
    }
    return rects;
  }
  if (image.width !== columns * cell || image.height % cell !== 0) {
    throw Error(`Source ${image.width}×${image.height} does not match ${columns} columns of ${cell}px square cells`);
  }
  return Array.from({ length: columns * image.height / cell }, (_, index) =>
    [index % columns * cell, Math.floor(index / columns) * cell, cell, cell]);
}

function readFrames(image, rects, threshold) {
  return rects.map(rect => {
    if (!rect) return null;
    const input = crop(image, ...rect);
    const { labels, parts } = alphaComponents(input, threshold);
    const frame = extract(input, labels, parts, Math.min(input.width, input.height) * .13);
    return frame && { ...frame, rect };
  });
}

function prepare([sourcePath, outputDir], values) {
  const cell = integer(values.cell, 216, 2, 2048, 'cell');
  const columns = integer(values.columns, 4, 1, 24, 'columns');
  const threshold = integer(values.threshold, 32, 1, 254, 'threshold');
  const tile = integer(values.tile, 320, 48, 2048, 'tile');
  const grid = /^(\d+)x(\d+)$/.exec(values.grid ?? '4x2');
  if (!grid) throw Error('--grid: expected COLSxROWS');
  const batchColumns = integer(grid[1], 4, 1, 8, 'grid');
  const batchRows = integer(grid[2], 2, 1, 8, 'grid');
  const source = readImage(sourcePath);
  const frames = readFrames(source, sourceRects(source, columns, cell, values.layout), threshold);
  const start = integer(values.start, 0, 0, frames.length - 1, 'start');
  const end = integer(values.end, frames.length - 1, start, frames.length - 1, 'end');
  const prefix = values.prefix ?? basename(sourcePath, extname(sourcePath));
  if (!prefix || /[\\/]/.test(prefix)) throw Error('--prefix must be a file name prefix');
  const batchSize = batchRows * batchColumns;
  const digits = Math.max(2, String(frames.length - 1).length);
  const batches = [];
  for (let i = start; i <= end; i += batchSize) {
    const last = Math.min(end, i + batchSize - 1);
    const name = `${prefix}-${String(i).padStart(digits, '0')}-${String(last).padStart(digits, '0')}.png`;
    const input = createImage(tile * batchColumns, tile * batchRows);
    const slots = [];
    for (let index = i; index <= last; index++) {
      const slot = index - i;
      const frame = frames[index];
      slots.push(frame ? index : null);
      if (!frame) continue;
      const scale = tile * .86 / Math.max(frame.rect[2], frame.rect[3]);
      const width = Math.max(1, Math.round(frame.bbox[2] * scale));
      const height = Math.max(1, Math.round(frame.bbox[3] * scale));
      const left = slot % batchColumns * tile + Math.round((tile - width) / 2);
      const top = Math.floor(slot / batchColumns) * tile + Math.round((tile - height) / 2);
      pasteScaled(input, frame.image, left, top, width, height);
    }
    writeImage(join(outputDir, name), input);
    batches.push({ name, columns: batchColumns, rows: batchRows, slots });
  }
  const manifest = { source: basename(sourcePath), width: source.width, height: source.height,
    ...(values.layout ? {} : { columns, cell }), threshold, tile, frames: frames.map(frame => frame && ({
      rect: frame.rect, bbox: frame.bbox, anchor: frame.anchor, keptComponents: frame.kept, removedComponents: frame.removed
    })), batches };
  const manifestPath = join(outputDir, prefix + '.json');
  writeJson(manifestPath, manifest);
  console.log(`${batches.length} batch images, ${frames.filter(Boolean).length}/${frames.length} occupied source cells. ${manifestPath}`);
}

function separators(size, groups, parts, axis) {
  const ends = axis === 'x' ? ['left', 'right'] : ['top', 'bottom'];
  const step = size / groups;
  const projection = new Float64Array(size + 1);
  for (const part of parts) {
    if (part.area < 24) continue;
    const width = part[ends[1]] - part[ends[0]];
    projection[part[ends[0]]] += part.area / width;
    projection[part[ends[1]]] -= part.area / width;
  }
  for (let i = 1; i < size; i++) projection[i] += projection[i - 1];
  const splits = [];
  const peak = projection.reduce((value, n) => Math.max(value, n), 0);
  for (let line = 1; line < groups; line++) {
    let best = Infinity;
    let split = Math.round(line * step);
    for (let i = Math.ceil((line - .26) * step); i <= Math.floor((line + .26) * step); i++) {
      const score = projection[i] + Math.abs(i - line * step) / step * peak * .025;
      if (score < best) { best = score; split = i; }
    }
    splits.push(split);
  }
  return splits;
}

function disassemble(image, batch, threshold) {
  const { columns, rows, slots, name } = batch;
  const { labels, parts } = alphaComponents(image, threshold);
  const splitsX = separators(image.width, columns, parts, 'x');
  const splitsY = separators(image.height, rows, parts, 'y');
  const groups = Array.from({ length: columns * rows }, () => []);
  for (const part of parts) {
    const centerX = (part.left + part.right) / 2;
    const centerY = (part.top + part.bottom) / 2;
    const col = splitsX.filter(split => centerX >= split).length;
    const row = splitsY.filter(split => centerY >= split).length;
    groups[row * columns + col].push(part);
  }
  const warnings = [];
  const poses = groups.map((group, slot) => {
    const main = group[0];
    const index = slots[slot];
    const minimumArea = Math.max(24, (parts[0]?.area ?? 0) * .035);
    if (index == null) {
      if (main?.area > minimumArea) warnings.push(`Unexpected foreground in empty slot ${slot}`);
      return null;
    }
    if (!main || main.area < minimumArea) throw Error(`${name} slot ${slot} (cell ${index}) has no distinct pose`);
    if (group[1]?.area > main.area * .35) warnings.push(`Slot ${slot} (cell ${index}) contains another large component`);
    return extract(image, labels, group, Math.min(image.width / columns, image.height / rows) * .14);
  });
  return { poses, warnings, splitsX, splitsY, width: image.width, height: image.height };
}

function targetBox(source, pose, scale, fit) {
  if (fit === 'box') return source.bbox.map(value => value * scale);
  const maxWidth = source.rect[2] * scale;
  const maxHeight = source.rect[3] * scale;
  const ratio = Math.min(source.bbox[3] * scale / pose.bbox[3], maxWidth / pose.bbox[2]);
  const width = fit === 'anchor' ? source.bbox[2] * scale : Math.max(1, Math.round(pose.bbox[2] * ratio));
  const height = fit === 'anchor' ? source.bbox[3] * scale : Math.max(1, Math.round(pose.bbox[3] * ratio));
  const x = Math.round(source.anchor[0] * scale - (pose.anchor[0] - pose.bbox[0]) * width / pose.bbox[2]);
  const y = Math.round(source.anchor[1] * scale - (pose.anchor[1] - pose.bbox[1]) * height / pose.bbox[3]);
  return [Math.max(0, Math.min(maxWidth - width, x)), Math.max(0, Math.min(maxHeight - height, y)), width, height];
}

function assemble([manifestPath, generatedDir, outputPath], values) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const { width, height, columns, cell, frames, batches } = manifest;
  const scale = integer(values.scale, 2, 1, 4, 'scale');
  const threshold = integer(values.threshold, manifest.threshold, 1, 254, 'threshold');
  const fit = values.fit ?? 'box';
  if (!['box', 'anchor', 'height'].includes(fit)) throw Error('--fit: expected box, anchor, or height');
  const installed = new Map();
  const diagnostics = [];
  for (const batch of batches) {
    const path = join(generatedDir, batch.name);
    if (!existsSync(path)) {
      if (!values.fallback) throw Error('Missing generated batch: ' + path);
      continue;
    }
    const { poses, ...data } = disassemble(readImage(path), batch, threshold);
    diagnostics.push({ name: batch.name, ...data });
    for (const [slot, index] of batch.slots.entries()) {
      if (index != null) installed.set(index, { pose: poses[slot], name: batch.name, slot });
    }
  }
  if (!installed.size) throw Error('No generated poses found');
  let fallback = [];
  if (values.fallback) {
    const original = readImage(values.fallback);
    if (original.width !== width || original.height !== height) throw Error('Fallback sheet dimensions differ from the manifest');
    fallback = readFrames(original, frames.map(frame => frame?.rect), manifest.threshold);
  }
  const sheet = createImage(width * scale, height * scale);
  const placements = frames.map((source, index) => {
    if (!source) return null;
    const generated = installed.get(index);
    const pose = generated?.pose ?? fallback[index];
    if (!pose) throw Error('No generated or fallback pose for cell ' + index);
    const [x, y, w, h] = targetBox(source, pose, scale, generated ? fit : 'box');
    const left = source.rect[0] * scale + x;
    const top = source.rect[1] * scale + y;
    pasteScaled(sheet, pose.image, left, top, w, h);
    const sourceAnchor = source.anchor.map(coordinate => coordinate * scale);
    const outputAnchor = [x + (pose.anchor[0] - pose.bbox[0]) * w / pose.bbox[2],
      y + (pose.anchor[1] - pose.bbox[1]) * h / pose.bbox[3]];
    return { index, input: generated?.name ?? 'fallback', slot: generated?.slot, sourceRect: source.rect, sourceBBox: source.bbox,
      outputBBox: [x, y, w, h], generatedBBox: generated?.pose.bbox, sourceAnchor,
      outputAnchor, anchorOffset: outputAnchor.map((coordinate, axis) => Math.round(coordinate - sourceAnchor[axis])),
      keptComponents: pose.kept, removedComponents: pose.removed };
  });
  writeImage(outputPath, sheet);
  const metadataPath = outputPath.slice(0, -extname(outputPath).length) + '.json';
  writeJson(metadataPath, { width: sheet.width, height: sheet.height, ...(cell ? { columns, cell: cell * scale } : {}),
    sourceScale: scale, fit, generatedFrames: installed.size, fallbackFrames: placements.filter(pose => pose?.input === 'fallback').length,
    diagnostics, frames: placements });
  console.log(`${installed.size} generated frames installed in ${sheet.width}×${sheet.height}. ${metadataPath}`);
  for (const batch of diagnostics) for (const warning of batch.warnings) console.warn(batch.name + ': ' + warning);
}

export { createImage, disassemble, pasteScaled, readFrames, readImage, targetBox, writeImage };

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const { positionals: [command, ...inputs], values } = parseArgs({ options, allowPositionals: true });
    if (command === 'prepare' && inputs.length === 2) prepare(inputs, values);
    else if (command === 'assemble' && inputs.length === 3) assemble(inputs, values);
    else throw Error(help);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
