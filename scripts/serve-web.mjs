import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.PORT ?? 4182);
const game = new URL('../dist/index.html', import.meta.url);
const pages = new Map([
  ['/', game], ['/index.html', game], ['/guard-counter-demo.html', new URL('guard-counter-demo.html', game)],
  ['/ultimate-demo.html', new URL('ultimate-demo.html', game)],
  ['/combat-demo.html', new URL('combat-demo.html', game)],
  ['/whale-review.html',new URL('whale-review.html',game)],
  ['/frog-review.html',new URL('frog-review.html',game)],
  ['/audio-demo.html', new URL('audio-demo.html', game)]
]);
// A small source document avoids sending the large inline bundle through browser inspection bridges.
const previewAssets = new Map([
  ['/dev.html', { file: new URL('../index.html', import.meta.url), type: 'text/html' }],
  ['/frog-review-dev.html', { file: new URL('../dist/frog-review-dev.html', import.meta.url), type: 'text/html' }],
  ['/styles.css', { file: new URL('../styles.css', import.meta.url), type: 'text/css' }],
  ['/dist/game.bundle.js', { file: new URL('../dist/game.bundle.js', import.meta.url), type: 'text/javascript' }],
  ['/dist/frog-review.bundle.js', { file: new URL('../dist/frog-review.bundle.js', import.meta.url), type: 'text/javascript' }]
]);
const server = createServer(async (request, response) => {
  const path = request.url?.split('?')[0];
  const preview = previewAssets.get(path);
  const page = preview?.file ?? pages.get(path);
  if (!['GET', 'HEAD'].includes(request.method ?? '') || !page) {
    response.writeHead(404).end();
    return;
  }
  try {
    const html = await readFile(page);
    response.writeHead(200, { 'Content-Type': (preview?.type ?? 'text/html') + '; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : html);
  } catch {
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }).end('请先运行 npm run build。');
  }
});
server.listen(port, '127.0.0.1', () => console.log('Meme 乱斗  http://127.0.0.1:' + port + '/'));
