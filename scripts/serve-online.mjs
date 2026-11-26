import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { WebSocket, WebSocketServer } from 'ws';
import { arenas } from '../dist/content/arenas.js';
import { rules } from '../dist/content/demo.js';
import { roster } from '../dist/content/roster.js';
import { createMatch, step } from '../dist/core/match.js';
import { NEUTRAL } from '../dist/core/types.js';

const build = (await readFile(new URL('../dist/online-version.txt', import.meta.url), 'utf8')).trim();
const fighters = new Map(roster.map(entry => [entry.fighter.id, entry.fighter]));
const stages = new Map(arenas.map(arena => [arena.id, arena]));
const acceptedOrigins = new Set((process.env.ONLINE_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean));
const rooms = new Map();
const controls = new Set(['A', 'B', 'C', 'ULT', 'jump', 'dash']);
const axis = value => value === -1 || value === 1 ? value : 0;
const commands = list => Array.isArray(list) ? [...new Set(list.filter(key => controls.has(key)))] : [];
const send = (socket, message) => {
  if (socket?.readyState !== WebSocket.OPEN) return;
  if (socket.bufferedAmount > 128 * 1024) return socket.close(1008, 'Slow connection');
  socket.send(JSON.stringify(message));
};

function packetInput(packet) {
  const pressed = commands(packet.pressed);
  const sampled = Object.fromEntries(pressed.map(key => {
    const stick = packet.sampled?.[key];
    return [key, { x: axis(stick?.x), y: axis(stick?.y) }];
  }));
  return { x: axis(packet.x), y: axis(packet.y), pressed, held: commands(packet.held), sampled };
}

function endRoom(room, notice) {
  if (!rooms.delete(room.code)) return;
  for (const peer of room.players) {
    send(peer.socket, { type: 'closed', notice });
    peer.socket.close();
  }
}

function start(room) {
  const selections = room.players.map(peer => peer.fighter);
  const arena = stages.get(room.arena);
  const selected = selections.map(id => fighters.get(id));
  const config = { arena, fighters: selected, rules, randomSeed: randomBytes(4).readUInt32LE() || 1 };
  const state = createMatch(config);
  if (selections.some(id => id === 'gaga' || id === 'banana')) state.phaseTicks = 192;
  room.match = { config, state };
  for (const [seat, peer] of room.players.entries()) {
    send(peer.socket, { type: 'start', seat, selections, arena: arena.id, state });
  }
}

const http = createServer((request, response) => {
  if (request.url === '/healthz') return response.writeHead(200).end('ok');
  response.writeHead(404).end();
});
const sockets = new WebSocketServer({ noServer: true, maxPayload: 2048 });
http.on('upgrade', (request, socket, head) => {
  const origin = request.headers.origin ?? '';
  const allowed = acceptedOrigins.has(origin) ||
    (acceptedOrigins.size === 0 && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  if (request.url !== '/match' || !allowed) return socket.destroy();
  sockets.handleUpgrade(request, socket, head, ws => sockets.emit('connection', ws));
});

sockets.on('connection', socket => {
  if (sockets.clients.size > 80) return socket.close(1013, 'Service busy');
  const peer = { socket, fighter: null, input: NEUTRAL, room: null, alive: true };
  let windowStart = Date.now(), received = 0;
  const joinDeadline = setTimeout(() => { if (!peer.room) socket.close(); }, 12_000);
  socket.on('pong', () => { peer.alive = true; });
  socket.on('error', () => {});
  socket.on('close', () => {
    clearTimeout(joinDeadline);
    if (peer.room) endRoom(peer.room, '对手已离开房间');
  });
  socket.on('message', (raw, binary) => {
    const now = Date.now();
    if (now - windowStart >= 1000) {
      windowStart = now;
      received = 0;
    }
    if (++received > 180 || binary) return socket.close(1008, 'Invalid input rate');
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return socket.close(1007, 'Invalid JSON'); }
    if (!message || typeof message !== 'object') return;
    if (message.type === 'input' && peer.room?.match && message.input && typeof message.input === 'object') {
      const next = packetInput(message.input);
      peer.input = { ...next, pressed: [...new Set([...peer.input.pressed, ...next.pressed])],
        sampled: { ...peer.input.sampled, ...next.sampled } };
      peer.inputAt = now;
      return;
    }
    if (peer.room || (message.type !== 'create' && message.type !== 'join')) return;
    const error = notice => send(socket, { type: 'error', notice });
    if (message.build !== build) return error('联机版本不一致，请更新网页后重试');
    if (!fighters.has(message.fighter)) return error('请选择角色');
    peer.fighter = message.fighter;
    if (message.type === 'create') {
      if (rooms.size >= 32) return error('房间已满，请稍后重试');
      if (!stages.has(message.arena)) return error('请选择地图');
      let code;
      do { code = randomBytes(4).toString('hex').toUpperCase(); } while (rooms.has(code));
      const room = { code, arena: message.arena, players: [peer], created: now };
      rooms.set(code, room);
      peer.room = room;
      send(socket, { type: 'waiting', code });
      return;
    }
    const room = rooms.get(message.code);
    if (!room || room.players.length !== 1) return error('房间不存在或已开始');
    peer.room = room;
    room.players.push(peer);
    start(room);
  });
  const heartbeat = setInterval(() => {
    if (!peer.alive) return socket.terminate();
    peer.alive = false;
    socket.ping();
  }, 15_000);
  socket.once('close', () => clearInterval(heartbeat));
});

const tickMs = 1000 / rules.ticksPerSecond;
let nextTick = performance.now() + tickMs;
function tickRooms() {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (!room.match) {
      if (now - room.created > 5 * 60_000) endRoom(room, '等候超时，请重新创建房间');
      continue;
    }
    const { config, state } = room.match;
    const input = room.players.map(peer => now - (peer.inputAt ?? 0) <= 300 ? peer.input : NEUTRAL);
    const phase = state.phase;
    const events = step(state, input, config);
    for (const peer of room.players) {
      peer.input = { ...peer.input, pressed: [], sampled: {} };
    }
    if (phase !== 'ready' && state.phase === 'ready' && config.fighters.some(fighter => fighter.id === 'gaga' || fighter.id === 'banana')) {
      state.phaseTicks = 192;
    }
    const packet = { type: 'frame', state, events };
    for (const peer of room.players) send(peer.socket, packet);
    if (state.phase === 'match-over') {
      rooms.delete(room.code);
      for (const peer of room.players) peer.socket.close();
    }
  }
}

const clock = setInterval(() => {
  const now = performance.now();
  if (now < nextTick) return;
  nextTick += tickMs;
  if (now - nextTick > 4 * tickMs) nextTick = now + tickMs;
  tickRooms();
}, 4);
http.on('close', () => clearInterval(clock));
const port = Number(process.env.ONLINE_PORT ?? 4184);
http.listen(port, process.env.ONLINE_HOST ?? '127.0.0.1', () => console.log('Meme 乱斗联机服务 · ' + port));
