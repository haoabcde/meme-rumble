import { readFile, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';

export const mimeTypes = {
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

/**
 * Serves static files from siteDir with traversal guards and optional HTML fallback.
 */
export function createSiteHandler(siteDir, fallbackFile) {
  const root = resolve(siteDir);
  return async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method ?? '')) {
      response.writeHead(405).end();
      return;
    }
    let rawPath = '/';
    try {
      rawPath = decodeURIComponent((request.url ?? '/').split('?')[0]);
    } catch {
      response.writeHead(400).end();
      return;
    }
    const targetRel = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
    const fullPath = resolve(root, targetRel);
    const rel = relative(root, fullPath);
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
      return;
    } catch {
      if (fallbackFile && (rawPath === '/' || rawPath === '/index.html')) {
        try {
          const body = await readFile(fallbackFile);
          response.writeHead(200, { 'Content-Type': mimeTypes['.html'], 'Cache-Control': 'no-store' });
          response.end(request.method === 'HEAD' ? undefined : body);
          return;
        } catch {
          // Neither site/ nor fallback dist/index.html is built yet.
        }
      }
      response.writeHead(404).end();
    }
  };
}

/**
 * Validates WebSocket Upgrade origins against explicit allowlist, loopback, or same host.
 */
export function isAllowedOrigin(origin, hostHeader, acceptedOrigins) {
  if (acceptedOrigins.size > 0) return acceptedOrigins.has(origin);
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return true;
    if (!hostHeader) return false;
    if (parsed.host === hostHeader) return true;
    const reqHostname = hostHeader.includes(']')
      ? hostHeader.replace(/:\d+$/, '')
      : hostHeader.split(':')[0];
    return parsed.hostname === reqHostname && (parsed.port === '4182' || parsed.port === '4183');
  } catch {
    return false;
  }
}
