import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { WebSocket, WebSocketServer } from 'ws';
import { arenas } from '../dist/content/arenas.js';
import { rules } from '../dist/content/demo.js';
import { roster } from '../dist/content/roster.js';
import { createRelayMatch, stepRelayMatch } from '../dist/core/relay.js';
import { createMatch, step } from '../dist/core/match.js';
import { maxPendingPresses, NEUTRAL } from '../dist/core/types.js';

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
  const x = axis(packet.x);
  const y = axis(packet.y);
  const pressed = [];
  const sampled = [];
  for (const [index, key] of (Array.isArray(packet.pressed) ? packet.pressed : []).entries()) {
    if (!controls.has(key)) continue;
    const stick = Array.isArray(packet.sampled) ? packet.sampled[index] : packet.sampled?.[key];
    pressed.push(key);
    sampled.push({ x: axis(stick?.x ?? x), y: axis(stick?.y ?? y) });
    if (pressed.length === maxPendingPresses) break;
  }
  return { x, y, pressed, held: commands(packet.held), sampled };
}

function endRoom(room, notice) {
  if (!rooms.delete(room.code)) return;
  for (const peer of room.players) {
    send(peer.socket, { type: 'closed', notice });
    peer.socket.close();
  }
}

function publishLobby(room) {
  const lineups = room.players.map(peer => peer.lineup);
  const ready = room.players.map(peer => peer.ready);
  for (const [seat, peer] of room.players.entries()) {
    send(peer.socket, { type: 'lobby', seat, lineups, ready, arena: room.arena,
      format: room.format, roundSeconds: room.roundSeconds, winsToFinish: room.winsToFinish, revision: peer.revision });
  }
}

function updateLobby(peer, message, now) {
  const room = peer.room;
  if (room.match || room.players.length !== 2) return;
  const host = peer === room.players[0];
  const ready = room.players.every(player => player.ready);
  if (message.type === 'select' && Array.isArray(message.lineup) && message.lineup.length === 2 &&
      fighters.has(message.lineup[0]) && (message.lineup[1] === null || fighters.has(message.lineup[1])) &&
      message.lineup[0] !== message.lineup[1] && typeof message.ready === 'boolean' &&
      Number.isSafeInteger(message.revision) && message.revision > peer.revision) {
    peer.lineup = message.lineup;
    peer.ready = message.ready && (room.format === 'standard' || peer.lineup[1] !== null);
    peer.revision = message.revision;
  } else if (host && !ready && message.type === 'format' && ['standard', 'relay'].includes(message.format)) {
    if (room.format === message.format) return;
    room.format = message.format;
    for (const player of room.players) player.ready = false;
  } else if (host && ready) {
    if (message.type === 'arena' && stages.has(message.arena)) room.arena = message.arena;
    else if (message.type === 'rules' && [30, 45, 60, 90].includes(message.roundSeconds) &&
      [1, 2, 3].includes(message.winsToFinish)) {
      room.roundSeconds = message.roundSeconds;
      room.winsToFinish = message.winsToFinish;
    } else if (message.type === 'start') return start(room);
    else return;
  } else return;
  room.updatedAt = now;
  publishLobby(room);
}

function start(room) {
  const lineups = room.players.map(peer => peer.lineup);
  const selections = lineups.map(lineup => lineup[0]);
  const teams = room.format === 'relay' ? lineups : undefined;
  const arena = stages.get(room.arena);
  const config = {
    arena, fighters: selections.map(id => fighters.get(id)),
    rules: { ...rules, roundSeconds: room.roundSeconds, winsToFinish: room.winsToFinish },
    randomSeed: randomBytes(4).readUInt32LE() || 1
  };
  const relay = teams && createRelayMatch(config, teams.map(team => team.map(id => fighters.get(id))));
  const state = relay?.state ?? createMatch(config);
  if (!relay && selections.some(id => id === 'gaga' || id === 'banana')) state.phaseTicks = 192;
  room.match = { config, state, relay };
  for (const [seat, peer] of room.players.entries()) {
    send(peer.socket, { type: 'start', seat, selections, teams, arena: arena.id,
      roundSeconds: room.roundSeconds, winsToFinish: room.winsToFinish, state });
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
  const peer = { socket, lineup: [], ready: false, revision: 0, input: NEUTRAL, room: null, alive: true };
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
      peer.input = {
        ...next,
        pressed: [...peer.input.pressed, ...next.pressed].slice(-maxPendingPresses),
        sampled: [...(peer.input.sampled ?? []), ...next.sampled].slice(-maxPendingPresses)
      };
      peer.inputAt = now;
      return;
    }
    if (peer.room) return updateLobby(peer, message, now);
    if (message.type !== 'create' && message.type !== 'join') return;
    const error = notice => send(socket, { type: 'error', notice });
    if (message.build !== build) return error('联机版本不一致，请更新网页后重试');
    if (message.type === 'create') {
      if (rooms.size >= 32) return error('房间已满，请稍后重试');
      let code;
      do { code = randomBytes(4).toString('hex').toUpperCase(); } while (rooms.has(code));
      peer.lineup = [roster[0].fighter.id, null];
      const room = { code, arena: arenas[0].id, players: [peer], updatedAt: now,
        format: 'standard', roundSeconds: rules.roundSeconds, winsToFinish: rules.winsToFinish };
      rooms.set(code, room);
      peer.room = room;
      send(socket, { type: 'waiting', code });
      return;
    }
    const room = rooms.get(message.code);
    if (!room || room.players.length !== 1) return error('房间不存在或已开始');
    peer.room = room;
    peer.lineup = [roster.at(-1).fighter.id, null];
    room.players.push(peer);
    room.updatedAt = now;
    publishLobby(room);
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
      if (now - room.updatedAt > 5 * 60_000) endRoom(room, '等候超时，请重新创建房间');
      continue;
    }
    const { config, state, relay } = room.match;
    const input = room.players.map(peer => now - (peer.inputAt ?? 0) <= 300 ? peer.input : NEUTRAL);
    const phase = state.phase;
    const events = relay ? stepRelayMatch(relay, input) : step(state, input, config);
    const swapped = Boolean(relay && relay.state !== state);
    for (const peer of room.players) {
      peer.input = swapped ? NEUTRAL : { ...peer.input, pressed: [], sampled: [] };
    }
    if (!relay && phase !== 'ready' && state.phase === 'ready' &&
        config.fighters.some(fighter => fighter.id === 'gaga' || fighter.id === 'banana')) {
      state.phaseTicks = 192;
    }
    const relayView = relay && { indices: relay.indices, eliminated: relay.eliminated, generation: relay.generation,
      history: relay.history, phase: relay.phase, winner: relay.winner };
    const packet = { type: 'frame', state: relay?.state ?? state, events: swapped ? [] : events, relay: relayView };
    for (const peer of room.players) send(peer.socket, packet);
    if (relay ? relay.phase === 'finished' : state.phase === 'match-over') {
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
