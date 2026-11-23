import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { imageSize } from 'image-size';
import { motionGrid } from '../dist/content/fighter-kit.js';

export async function embedFighterImages(roster, directory) {
  const images = new Map();
  const ids = new Set();
  for (const { fighter, art } of roster) {
    if (ids.has(fighter.id)) throw Error('角色 ID 重复：' + fighter.id);
    ids.add(fighter.id);
    for (const name of [art.portrait, art.motion]) {
      if (images.has(name)) continue;
      const path = resolve(directory, name);
      const local = relative(directory, path);
      if (isAbsolute(name) || isAbsolute(local) || local === '..' || local.startsWith('..' + sep) || extname(name).toLowerCase() !== '.webp') {
        throw Error(fighter.id + ' 的素材应在 assets/fighters 内使用相对 WebP 路径：' + name);
      }
      try {
        const bytes = await readFile(path);
        const { type, width, height } = imageSize(bytes);
        if (type !== 'webp') throw Error('需要 WebP 图像');
        images.set(name, { width, height, src: 'data:image/webp;base64,' + bytes.toString('base64') });
      } catch (error) {
        throw Error(fighter.id + ' / ' + name + '：' + error.message, { cause: error });
      }
    }
    const { width, height } = images.get(art.motion);
    const { columns, defaultRows } = motionGrid;
    const scale = art.motionScale ?? 1;
    if (![1, 2, 3, 4].includes(scale)) throw Error(fighter.id + ' 的 motionScale 应为1至4的整数');
    const cell = motionGrid.cell * scale;
    if (width !== columns * cell || height < defaultRows * cell || height % cell !== 0) {
      throw Error(fighter.id + ' / ' + art.motion + '：动作图集应为 ' + columns + ' 列，至少 ' + defaultRows + ' 行，每格 ' + cell + '×' + cell);
    }
    const cells = columns * (height / cell);
    for (const action of fighter.actions) {
      for (const key of action.animation ?? []) {
        if (key.cell >= cells) throw Error(fighter.id + ' / ' + action.id + ' 在 ' + art.motion + ' 中找不到画格 ' + key.cell);
      }
    }
  }
  return Object.fromEntries(Array.from(images, ([name, image]) => [name, image.src]));
}
