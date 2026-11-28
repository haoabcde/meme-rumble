import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { once } from 'node:events';
import test from 'node:test';
import WebSocket from 'ws';

const waitFor = async predicate => {
  for (let i = 0; i < 500; i++) {
    const result = predicate();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw Error('Timed out waiting for online server');
};

test('compressed and uncompressed clients receive identical playable snapshots', { timeout: 15000 }, async t => {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const server = spawn(process.execPath, ['scripts/serve-online.mjs'], {
    env: { ...process.env, ONLINE_PORT: String(port), ONLINE_HOST: '127.0.0.1', ONLINE_ORIGINS: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(async () => {
    server.kill();
    if (server.exitCode === null && server.signalCode === null) await once(server, 'exit');
  });
  let output = '';
  server.stdout.on('data', chunk => output += chunk);
  await waitFor(() => output.includes('联机服务'));
  const peers = [];
  t.after(() => peers.forEach(peer => peer.socket.terminate()));
  const connect = async compression => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/match`, {
      origin: 'http://localhost', perMessageDeflate: compression
    });
    const peer = { socket, messages: [], frames: new Map(), send: message => socket.send(JSON.stringify(message)) };
    peers.push(peer);
    socket.on('message', bytes => {
      const message = JSON.parse(bytes);
      peer.messages.push(message);
      if (message.type === 'frame') peer.frames.set(message.state.frame, message.state);
    });
    await once(socket, 'open');
    return peer;
  };
  const host = await connect(false), guest = await connect(true);
  assert.equal(host.socket.extensions, '');
  assert.match(guest.socket.extensions, /permessage-deflate/);
  const build = (await readFile(new URL('../dist/online-version.txt', import.meta.url), 'utf8')).trim();
  host.send({ type: 'create', build });
  const { code } = await waitFor(() => host.messages.find(message => message.type === 'waiting'));
  guest.send({ type: 'join', code, build });
  await waitFor(() => guest.messages.some(message => message.type === 'lobby'));
  for (const [index, peer] of peers.entries()) {
    peer.send({ type: 'select', lineup: [index ? 'gaga' : 'whale', null], ready: true, revision: 1 });
  }
  await waitFor(() => host.messages.some(message => message.type === 'lobby' && message.ready.every(Boolean)));
  host.send({ type: 'rules', roundSeconds: 180, winsToFinish: 2 });
  await waitFor(() => guest.messages.some(message => message.type === 'lobby' && message.roundSeconds === 180));
  host.send({ type: 'start' });
  const start = await waitFor(() => guest.messages.find(message => message.type === 'start'));
  assert.equal(start.roundSeconds, 180);
  await waitFor(() => [...host.frames.values()].some(state => state.phase === 'fight'));
  const frame = await waitFor(() => [...host.frames.keys()].find(frame =>
    guest.frames.has(frame) && host.frames.get(frame).phase === 'fight'));
  assert.deepEqual(guest.frames.get(frame), host.frames.get(frame));
});
