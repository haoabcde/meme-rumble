import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { onlineServiceUrl } from '../dist/web/online-room.js';
import { createSiteHandler, isAllowedOrigin } from '../scripts/static-site.mjs';

test('onlineServiceUrl adapts across local preview ports, single-port public IP, HTTPS, and explicit URLs', () => {
  assert.equal(
    onlineServiceUrl({ protocol: 'https:', hostname: 'x.example', host: 'x.example', port: '' }, 'wss://rooms.example/match'),
    'wss://rooms.example/match'
  );
  assert.equal(onlineServiceUrl({ protocol: 'file:', hostname: '', host: '', port: '' }, ''), undefined);
  assert.equal(
    onlineServiceUrl({ protocol: 'http:', hostname: '127.0.0.1', host: '127.0.0.1:4182', port: '4182' }, ''),
    'ws://127.0.0.1:4184/match'
  );
  assert.equal(
    onlineServiceUrl({ protocol: 'http:', hostname: '47.114.45.241', host: '47.114.45.241:4183', port: '4183' }, ''),
    'ws://47.114.45.241:4184/match'
  );
  assert.equal(
    onlineServiceUrl({ protocol: 'http:', hostname: '47.114.45.241', host: '47.114.45.241:4184', port: '4184' }, ''),
    'ws://47.114.45.241:4184/match'
  );
  assert.equal(
    onlineServiceUrl({ protocol: 'http:', hostname: '47.114.45.241', host: '47.114.45.241', port: '' }, ''),
    'ws://47.114.45.241/match'
  );
  assert.equal(
    onlineServiceUrl({ protocol: 'https:', hostname: 'game.example', host: 'game.example', port: '' }, ''),
    'wss://game.example/match'
  );
});

test('isAllowedOrigin permits loopback, same-host public IP, and companion preview ports while rejecting foreign origins', () => {
  const none = new Set();
  assert.equal(isAllowedOrigin('', '47.114.45.241:4184', none), false);
  assert.equal(isAllowedOrigin('http://127.0.0.1:4182', '127.0.0.1:4184', none), true);
  assert.equal(isAllowedOrigin('http://localhost:4183', '47.114.45.241:4184', none), true);
  assert.equal(isAllowedOrigin('http://47.114.45.241:4184', '47.114.45.241:4184', none), true);
  assert.equal(isAllowedOrigin('http://47.114.45.241:4183', '47.114.45.241:4184', none), true);
  assert.equal(isAllowedOrigin('http://evil.example', '47.114.45.241:4184', none), false);
  assert.equal(isAllowedOrigin('https://game.example', 'game.example', new Set(['https://game.example'])), true);
  assert.equal(isAllowedOrigin('http://47.114.45.241:4184', '47.114.45.241:4184', new Set(['https://game.example'])), false);
});

test('createSiteHandler serves static site files, blocks traversal, and supports single-file HTML fallback', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'meme-site-'));
  const fallback = join(dir, 'fallback.html');
  const site = join(dir, 'site');
  await writeFile(fallback, '<!doctype html><title>Fallback</title>');
  t.after(() => rm(dir, { recursive: true, force: true }));

  const run = async (handler, method, url) => {
    const res = { status: 0, headers: {}, body: undefined,
      writeHead(status, headers = {}) { this.status = status; this.headers = headers; return this; },
      end(body) { this.body = body; } };
    await handler({ method, url }, res);
    return res;
  };

  const fallbackHandler = createSiteHandler(site, fallback);
  const rootRes = await run(fallbackHandler, 'GET', '/');
  assert.equal(rootRes.status, 200);
  assert.match(String(rootRes.body), /Fallback/);

  const traversalRes = await run(fallbackHandler, 'GET', '/../package.json');
  assert.equal(traversalRes.status, 403);
});
