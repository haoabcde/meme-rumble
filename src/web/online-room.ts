import { arenas } from '../content/arenas.js';
import { roster } from '../content/roster.js';
import type { CombatEvent, Duo, InputFrame, MatchState } from '../core/types.js';

declare const __ONLINE_BUILD__: string;
declare const __ONLINE_URL__: string;

export interface OnlineStart {
  type: 'start';
  seat: 0 | 1;
  selections: Duo<string>;
  arena: string;
  state: MatchState;
}

interface OnlineFrame {
  type: 'frame';
  state: MatchState;
  events: CombatEvent[];
}

type ServerMessage = OnlineStart | OnlineFrame | { type: 'waiting'; code: string } |
  { type: 'error' | 'closed'; notice: string };

function serviceUrl() {
  if (typeof __ONLINE_URL__ !== 'undefined' && __ONLINE_URL__) return __ONLINE_URL__;
  if (location.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(location.hostname)) {
    return 'ws://' + location.hostname + ':4184/match';
  }
}

export class OnlineRoom {
  private socket?: WebSocket;
  private dialog = document.querySelector<HTMLDialogElement>('#online-room')!;
  private status = document.querySelector<HTMLElement>('#online-status')!;
  private create = document.querySelector<HTMLButtonElement>('#online-create')!;
  private join = document.querySelector<HTMLButtonElement>('#online-join')!;
  private code = document.querySelector<HTMLInputElement>('#online-code')!;
  private fighter = document.querySelector<HTMLSelectElement>('#online-fighter')!;
  private arena = document.querySelector<HTMLSelectElement>('#online-arena')!;
  private active = false;
  private finished = false;

  constructor(
    private readonly onStart: (packet: OnlineStart) => void,
    private readonly onFrame: (packet: OnlineFrame) => void,
    private readonly onLeave: (notice: string) => void
  ) {
    for (const { fighter } of roster) this.fighter.add(new Option(fighter.name, fighter.id));
    for (const arena of arenas) this.arena.add(new Option(arena.name, arena.id));
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

  disconnect() {
    const socket = this.socket;
    this.socket = undefined;
    this.active = false;
    this.finished = false;
    socket?.close();
  }

  private setBusy(busy: boolean) {
    this.create.disabled = busy;
    this.join.disabled = busy;
    this.fighter.disabled = busy;
    this.arena.disabled = busy;
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
      socket.send(JSON.stringify({ type, code, fighter: this.fighter.value, arena: this.arena.value, build: __ONLINE_BUILD__ }));
    });
    socket.addEventListener('message', event => {
      if (this.socket !== socket || typeof event.data !== 'string') return;
      let packet: ServerMessage;
      try { packet = JSON.parse(event.data); } catch { socket.close(); return; }
      if (packet.type === 'waiting') {
        this.code.value = packet.code;
        this.code.select();
        this.status.textContent = '把房间码发给好友，等对方加入。';
      } else if (packet.type === 'start') {
        this.active = true;
        this.dialog.close();
        this.onStart(packet);
      } else if (packet.type === 'frame' && this.active) {
        this.finished = packet.state.phase === 'match-over';
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
