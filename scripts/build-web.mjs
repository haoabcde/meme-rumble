import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { roster } from '../dist/content/roster.js';
import { embedFighterImages } from './fighter-art.mjs';

const root = new URL('../', import.meta.url);
const fighterImages = await embedFighterImages(roster, fileURLToPath(new URL('assets/fighters/', root)));
const [template, css, bundle] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('styles.css', root), 'utf8'),
  build({
    entryPoints: [fileURLToPath(new URL('src/web/game.ts', root))],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    loader: { '.webp': 'dataurl' },
    define: { __FIGHTER_IMAGES__: JSON.stringify(fighterImages) },
    write: false
  })
]);

const script = bundle.outputFiles[0].text;
const html = template
  .replace('<link rel="stylesheet" href="./styles.css">', () => '<style>\n' + css + '</style>')
  .replace('<script src="./dist/game.bundle.js"></script>', () =>
    '<script>\n' + script.replace(/<\/script/gi, '<\\/script') + '</script>');
async function publish(file, content) {
  const pending = new URL('dist/.' + file + '.' + process.pid, root);
  await writeFile(pending, content);
  await rename(pending, new URL('dist/' + file, root));
}
await Promise.all([publish('index.html', html), publish('game.bundle.js', script)]);
