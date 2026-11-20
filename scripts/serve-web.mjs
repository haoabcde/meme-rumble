import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.PORT ?? 4182);
const game = new URL('../dist/index.html', import.meta.url);
const server = createServer(async (request, response) => {
  const path = request.url?.split('?')[0];
  if (!['GET', 'HEAD'].includes(request.method ?? '') || (path !== '/' && path !== '/index.html')) {
    response.writeHead(404).end();
    return;
  }
  try {
    const html = await readFile(game);
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : html);
  } catch {
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }).end('请先运行 npm run build。');
  }
});
server.listen(port, '127.0.0.1', () => console.log('Meme 乱斗  http://127.0.0.1:' + port + '/'));
