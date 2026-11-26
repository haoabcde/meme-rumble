import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT ?? 4183);
const siteDir = resolve(fileURLToPath(new URL('../site', import.meta.url)));

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
  '.json': 'application/json; charset=utf-8'
};

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method ?? '')) {
    response.writeHead(405).end();
    return;
  }
  const rawPath = decodeURIComponent((request.url ?? '/').split('?')[0]);
  const targetRel = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
  const fullPath = resolve(siteDir, targetRel);
  const rel = relative(siteDir, fullPath);
  if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const info = await stat(fullPath);
    const fileToRead = info.isDirectory() ? resolve(fullPath, 'index.html') : fullPath;
    const body = await readFile(fileToRead);
    const type = mimeTypes[extname(fileToRead).toLowerCase()] ?? 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404).end();
  }
});

server.listen(port, '127.0.0.1', () => console.log('Meme 乱斗静态网站  http://127.0.0.1:' + port + '/'));
