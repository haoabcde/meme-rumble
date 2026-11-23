import { readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { roster } from '../dist/content/roster.js';
import { embedFighterImages } from './fighter-art.mjs';

const root = new URL('../', import.meta.url);
const pixelfxLicense = await readFile(new URL('assets/fx/pixelfx/LICENSE', root), 'utf8');
const fighterImages = await embedFighterImages(roster, fileURLToPath(new URL('assets/fighters/', root)));
const soundDirectory = new URL('assets/audio/gaga/', root);
const soundFiles = (await readdir(soundDirectory)).filter(file => file.endsWith('.wav'));
const gagaSounds = Object.fromEntries(await Promise.all(soundFiles.map(async file => [
  file.slice(0, -4), (await readFile(new URL(file, soundDirectory))).toString('base64')
])));
async function bundleEntry(entry) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('src/web/' + entry, root))],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    loader: { '.webp': 'dataurl' },
    define: { __FIGHTER_IMAGES__: JSON.stringify(fighterImages), __GAGA_SOUNDS__: JSON.stringify(gagaSounds) },
    write: false
  });
  return result.outputFiles[0].text;
}
const [template, css, game, counterDemo, ultimateDemo, combatDemo] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'), readFile(new URL('styles.css', root), 'utf8'),
  bundleEntry('game.ts'), bundleEntry('counter-demo.ts'), bundleEntry('ultimate-demo.ts'), bundleEntry('combat-demo.ts')
]);

function standalone(script) {
  return template
    .replace('<!doctype html>', () => '<!doctype html>\n<!-- Pixelfx sprite sheets\n' + pixelfxLicense + '-->')
    .replace('<link rel="stylesheet" href="./styles.css">', () => '<style>\n' + css + '</style>')
    .replace('<script src="./dist/game.bundle.js"></script>', () =>
      '<script>\n' + script.replace(/<\/script/gi, '<\\/script') + '</script>');
}
async function publish(file, content) {
  const pending = new URL('dist/.' + file + '.' + process.pid, root);
  await writeFile(pending, content);
  await rename(pending, new URL('dist/' + file, root));
}
await Promise.all([
  publish('game.bundle.js', game), publish('index.html', standalone(game)),
  publish('guard-counter-demo.html', standalone(counterDemo)),
  publish('ultimate-demo.html', standalone(ultimateDemo)),
  publish('combat-demo.html', standalone(combatDemo))
]);
