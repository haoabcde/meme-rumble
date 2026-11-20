import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url);
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
    write: false
  })
]);

const html = template
  .replace('<link rel="stylesheet" href="./styles.css">', () => '<style>\n' + css + '</style>')
  .replace('<script type="module" src="./web/game.js"></script>', () =>
    '<script>\n' + bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>');
await writeFile(new URL('dist/index.html', root), html);
