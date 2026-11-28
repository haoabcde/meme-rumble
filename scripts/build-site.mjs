import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { roster } from '../dist/content/roster.js';
import { embedFighterImages } from './fighter-art.mjs';
import { embedFighterAudio } from './fighter-audio.mjs';
import { loadOnlineConfig } from './online-config.mjs';
import { listSoundBank } from './sound-bank.mjs';

const root = new URL('../', import.meta.url);
const { onlineBuild, onlineUrl } = await loadOnlineConfig(root);
const siteDir = new URL('site/', root);
const sitePath = fileURLToPath(siteDir);

function toUrlPath(relPath) {
  return './' + relPath.split('/').map(encodeURIComponent).join('/');
}

async function copyAsset(srcUrl, relDest) {
  const dest = new URL(relDest, siteDir);
  await mkdir(dirname(fileURLToPath(dest)), { recursive: true });
  await copyFile(srcUrl, dest);
}

async function publishSoundBank(subpath, extensions) {
  const entries = await listSoundBank(root, subpath, extensions);
  await Promise.all(entries.map(([, file, fileUrl]) => copyAsset(fileUrl, subpath + file)));
  return Object.fromEntries(entries.map(([key, file]) => [key, toUrlPath(subpath + file)]));
}

// Reuse existing validation for portraits, motion atlases, and audio headers/caps.
const [validatedImages, validatedAudio] = await Promise.all([
  embedFighterImages(roster, fileURLToPath(new URL('assets/fighters/', root))),
  embedFighterAudio(roster, fileURLToPath(root))
]);

await rm(sitePath, { recursive: true, force: true });
await mkdir(sitePath, { recursive: true });

const fighterImageNames = Object.keys(validatedImages);
const fighterAudioPaths = Object.keys(validatedAudio);

const [, , gagaSounds, bananaSounds, bgmSounds] = await Promise.all([
  Promise.all(fighterImageNames.map(name => copyAsset(new URL('assets/fighters/' + name, root), 'assets/fighters/' + name))),
  Promise.all(fighterAudioPaths.map(src => copyAsset(new URL(src, root), src))),
  publishSoundBank('assets/audio/gaga/', ['.wav']),
  publishSoundBank('assets/audio/banana/', ['.mp3', '.wav']),
  publishSoundBank('assets/audio/bgm/', ['.mp3', '.wav'])
]);

const fighterImages = Object.fromEntries(fighterImageNames.map(name => [name, toUrlPath('assets/fighters/' + name)]));
const fighterAudio = Object.fromEntries(fighterAudioPaths.map(src => [src, toUrlPath(src)]));

const [pixelfxLicense, template, css] = await Promise.all([
  readFile(new URL('assets/fx/pixelfx/LICENSE', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('styles.css', root), 'utf8')
]);

const result = await build({
  entryPoints: [fileURLToPath(new URL('src/web/game.ts', root))],
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  outdir: sitePath,
  entryNames: 'assets/game-[hash]',
  assetNames: 'assets/media/[name]-[hash]',
  publicPath: './',
  loader: { '.webp': 'file', '.png': 'file', '.jpg': 'file' },
  metafile: true,
  define: {
    __FIGHTER_IMAGES__: JSON.stringify(fighterImages),
    __FIGHTER_AUDIO__: JSON.stringify(fighterAudio),
    __GAGA_SOUNDS__: JSON.stringify(gagaSounds),
    __BANANA_SOUNDS__: JSON.stringify(bananaSounds),
    __BGM_SOUNDS__: JSON.stringify(bgmSounds),
    __ONLINE_BUILD__: JSON.stringify(onlineBuild),
    __ONLINE_URL__: JSON.stringify(onlineUrl)
  }
});
await writeFile(new URL('online-version.txt', siteDir), onlineBuild + '\n');

const entryRel = Object.entries(result.metafile.outputs)
  .find(([, meta]) => meta.entryPoint?.endsWith('game.ts'))?.[0];
if (!entryRel) throw Error('未能定位网站主入口 JS 输出');
const scriptRel = './' + relative(sitePath, entryRel).replaceAll('\\', '/');

const cssHash = createHash('sha256').update(css).digest('hex').slice(0, 8);
const cssFile = `styles-${cssHash}.css`;
await writeFile(new URL(cssFile, siteDir), css);

const html = template
  .replace('<!doctype html>', () => '<!doctype html>\n<!-- Pixelfx sprite sheets\n' + pixelfxLicense + '-->')
  .replace('<link rel="stylesheet" href="./styles.css">', () => `<link rel="stylesheet" href="./${cssFile}">`)
  .replace('<script src="./dist/game.bundle.js"></script>', () => `<script src="${scriptRel}"></script>`);
await writeFile(new URL('index.html', siteDir), html);

const rootFiles = Object.keys(result.metafile.outputs);
let totalBytes = (await stat(new URL('index.html', siteDir))).size + (await stat(new URL(cssFile, siteDir))).size;
let maxFile = { path: 'index.html', bytes: (await stat(new URL('index.html', siteDir))).size };
const measureAsset = async rel => {
  const s = (await stat(new URL(rel, siteDir))).size;
  totalBytes += s;
  if (s > maxFile.bytes) maxFile = { path: rel, bytes: s };
};
await Promise.all([
  ...rootFiles.map(out => measureAsset(relative(sitePath, out).replaceAll('\\', '/'))),
  ...fighterImageNames.map(name => measureAsset('assets/fighters/' + name)),
  ...fighterAudioPaths.map(src => measureAsset(src)),
  ...Object.values(gagaSounds).map(p => measureAsset(decodeURIComponent(p.slice(2)))),
  ...Object.values(bananaSounds).map(p => measureAsset(decodeURIComponent(p.slice(2)))),
  ...Object.values(bgmSounds).map(p => measureAsset(decodeURIComponent(p.slice(2))))
]);

console.log(
  `静态网站已生成于 ${sitePath}：` +
  `总计 ${(totalBytes / 1024 ** 2).toFixed(2)} MiB，最大单文件 ${(maxFile.bytes / 1024 ** 2).toFixed(2)} MiB (${maxFile.path})`
);
