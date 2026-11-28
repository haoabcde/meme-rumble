import type { RelaySession } from '../core/relay.js';
import type { CombatEvent, Duo, InputFrame, MatchState } from '../core/types.js';

declare const __ONLINE_BUILD__: string;
declare const __ONLINE_URL__: string;

export type OnlineFormat = 'standard' | 'relay';
export type OnlineLineup = [string, string | null];
type OnlineRules = { roundSeconds: number; winsToFinish: number };
type RelayView = Pick<RelaySession, 'indices' | 'eliminated' | 'generation' | 'history' | 'phase' | 'winner'>;

export interface OnlineLobby extends OnlineRules {
  type: 'lobby';
  seat: 0 | 1;
  lineups: Duo<OnlineLineup>;
  format: OnlineFormat;
  ready: Duo<boolean>;
  arena: string;
  revision: number;
}

export interface OnlineStart extends OnlineRules {
  type: 'start';
  seat: 0 | 1;
  selections: Duo<string>;
  teams?: Duo<Duo<string>>;
  arena: string;
  state: MatchState;
}

interface OnlineFrame {
  type: 'frame';
  state: MatchState;
  events: CombatEvent[];
  relay?: RelayView;
}

type ServerMessage = OnlineLobby | OnlineStart | OnlineFrame | { type: 'waiting'; code: string } |
  { type: 'error' | 'closed'; notice: string };

export function onlineServiceUrl(
  locationLike: Pick<Location, 'protocol' | 'hostname' | 'host' | 'port'> = location,
  configured = typeof __ONLINE_URL__ !== 'undefined' ? __ONLINE_URL__ : ''
) {
  if (configured) return configured;
  if (locationLike.protocol !== 'http:' && locationLike.protocol !== 'https:') return undefined;
  const ws = locationLike.protocol === 'https:' ? 'wss://' : 'ws://';
  if (locationLike.port === '4182' || locationLike.port === '4183') {
    return ws + locationLike.hostname + ':4184/match';
  }
  return ws + locationLike.host + '/match';
}

function serviceUrl() {
  return onlineServiceUrl();
}

export class OnlineRoom {
  private socket?: WebSocket;
  private dialog = document.querySelector<HTMLDialogElement>('#online-room')!;
  private status = document.querySelector<HTMLElement>('#online-status')!;
  private create = document.querySelector<HTMLButtonElement>('#online-create')!;
  private join = document.querySelector<HTMLButtonElement>('#online-join')!;
  private code = document.querySelector<HTMLInputElement>('#online-code')!;
  private selectionRevision = 0;
  private active = false;
  private finished = false;

  constructor(
    private readonly onLobby: (packet: OnlineLobby) => void,
    private readonly onStart: (packet: OnlineStart) => void,
    private readonly onFrame: (packet: OnlineFrame) => void,
    private readonly onLeave: (notice: string) => void
  ) {
    this.create.addEventListener('click', () => this.connect('create'));
    this.join.addEventListener('click', () => this.connect('join'));
    document.querySelector('#online-close')!.addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('close', () => { if (!this.active) this.disconnect(); });
  }

  get open() { return this.dialog.open; }

  show() {
    if (this.dialog.open) return;
    this.disconnect();
    this.code.value = '';
    const configured = Boolean(serviceUrl());
    this.setBusy(!configured);
    this.status.textContent = configured ? '' : '此版本还没有连接联机房间服务。';
    this.dialog.showModal();
  }

  get canSendInput() {
    return this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 8192;
  }

  sendInput(input: InputFrame) {
    if (this.canSendInput) {
      this.socket?.send(JSON.stringify({ type: 'input', input }));
    }
  }

  select(lineup: OnlineLineup, ready: boolean) {
    this.sendLobby({ type: 'select', lineup, ready, revision: ++this.selectionRevision });
  }

  chooseArena(arena: string) {
    this.sendLobby({ type: 'arena', arena });
  }

  setFormat(format: OnlineFormat) {
    this.sendLobby({ type: 'format', format });
  }

  setRules(roundSeconds: number, winsToFinish: number) {
    this.sendLobby({ type: 'rules', roundSeconds, winsToFinish });
  }

  start() {
    this.sendLobby({ type: 'start' });
  }

  returnToLobby() {
    this.sendLobby({ type: 'return-lobby' });
  }

  private sendLobby(message: object) {
    if (this.active && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  disconnect() {
    const socket = this.socket;
    this.socket = undefined;
    this.active = false;
    this.finished = false;
    this.selectionRevision = 0;
    socket?.close();
  }

  private setBusy(busy: boolean) {
    this.create.disabled = busy;
    this.join.disabled = busy;
  }

  private connect(type: 'create' | 'join') {
    const url = serviceUrl();
    const code = this.code.value.trim().toUpperCase();
    if (!url) return;
    if (type === 'join' && !/^[0-9A-F]{8}$/.test(code)) {
      this.status.textContent = '请输入房主给的 8 位房间码。';
      return;
    }
    this.disconnect();
    let socket: WebSocket;
    try { socket = new WebSocket(url); }
    catch { this.status.textContent = '联机地址无效，请检查部署配置。'; return; }
    this.socket = socket;
    this.setBusy(true);
    this.status.textContent = '正在连接房间服务…';
    const timeout = window.setTimeout(() => {
      if (this.socket !== socket || socket.readyState === WebSocket.OPEN) return;
      this.disconnect();
      this.setBusy(false);
      this.status.textContent = '连接超时，请稍后重试。';
    }, 8000);
    socket.addEventListener('open', () => {
      window.clearTimeout(timeout);
      if (this.socket !== socket) return;
      socket.send(JSON.stringify({ type, code, build: __ONLINE_BUILD__ }));
    });
    socket.addEventListener('message', event => {
      if (this.socket !== socket || typeof event.data !== 'string') return;
      let packet: ServerMessage;
      try { packet = JSON.parse(event.data); } catch { socket.close(); return; }
      if (packet.type === 'waiting') {
        this.setBusy(false);
        this.code.value = packet.code;
        this.code.select();
        this.status.textContent = '把房间码发给好友，等对方加入。';
      } else if (packet.type === 'lobby') {
        if (packet.revision < this.selectionRevision) return;
        this.active = true;
        this.dialog.close();
        this.onLobby(packet);
      } else if (packet.type === 'start') {
        this.active = true;
        this.dialog.close();
        this.onStart(packet);
      } else if (packet.type === 'frame' && this.active) {
        this.finished = packet.relay ? packet.relay.phase === 'finished' : packet.state.phase === 'match-over';
        this.onFrame(packet);
      } else if (packet.type === 'error' || packet.type === 'closed') {
        const active = this.active;
        this.disconnect();
        this.setBusy(false);
        this.status.textContent = packet.notice;
        if (active) this.onLeave(packet.notice);
      }
    });
    socket.addEventListener('close', () => {
      window.clearTimeout(timeout);
      if (this.socket !== socket) return;
      const active = this.active;
      const finished = this.finished;
      this.disconnect();
      this.setBusy(false);
      if (finished) return;
      const notice = active ? '联机已断开，本场结束。' : '无法连接房间服务，请稍后重试。';
      this.status.textContent = notice;
      if (active) this.onLeave(notice);
    });
  }
}
