import assert from 'node:assert/strict';
import test from 'node:test';
import { arenas } from '../dist/content/arenas.js';
import { rules, testFighter } from '../dist/content/demo.js';
import { basicAttack } from '../dist/content/fighter-kit.js';
import { createMatch, step } from '../dist/core/match.js';
import { NEUTRAL } from '../dist/core/types.js';
import { FightAudio } from '../dist/web/audio.js';

class FakeNode {
  connect(output) {
    this.output = output;
    return output;
  }

  disconnect() {
    this.output = undefined;
  }
}

class FakeParam {
  value = 1;
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}

class FakeSource extends FakeNode {
  frequency = new FakeParam();
  stopped = false;

  constructor(context, kind) {
    super();
    this.context = context;
    this.kind = kind;
  }

  start() {
    this.context.played.push(this);
  }

  stop(time) {
    if (time === undefined) this.stopped = true;
  }
}

class FakeAudioContext {
  state = 'suspended';
  currentTime = 1;
  sampleRate = 8000;
  destination = new FakeNode();
  played = [];
  requests = [];

  createGain() {
    return Object.assign(new FakeNode(), { gain: new FakeParam() });
  }

  createBiquadFilter() {
    return Object.assign(new FakeNode(), { frequency: new FakeParam(), Q: new FakeParam() });
  }

  createOscillator() {
    return new FakeSource(this, 'oscillator');
  }

  createBufferSource() {
    return new FakeSource(this, 'buffer');
  }

  createBuffer(_channels, length) {
    return { getChannelData: () => new Float32Array(length) };
  }

  decodeAudioData(bytes) {
    return new Promise((resolve, reject) => {
      const marker = new Uint8Array(bytes)[0];
      this.requests.push({ resolve: () => resolve({ marker }), reject });
    });
  }

  async resume() {
    this.state = 'running';
  }

  async suspend() {
    this.state = 'suspended';
  }

  get clips() {
    return this.played.filter(source => source.buffer?.marker !== undefined);
  }
}

function audioFixture(t, banks, sources, activate = true) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  let context;
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: class extends FakeAudioContext {
      constructor() {
        super();
        context = this;
      }
    }
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'AudioContext', original);
    else delete globalThis.AudioContext;
  });
  const audio = new FightAudio();
  audio.configure(banks, sources);
  if (activate) audio.enableFromGesture();
  return { audio, context };
}

function sourceData(marker) {
  return 'data:audio/wav;base64,' + Buffer.from([marker]).toString('base64');
}

const move = {
  ...basicAttack, id: 'probe', slot: 'B', startup: 2, active: 2, recovery: 4,
  push: 0, advance: 0, stop: 3, hitstun: 1
};
const attack = { ...NEUTRAL, pressed: ['B'] };
const hit = { kind: 'hit', source: 0, x: 0, y: 0, feedback: { audio: { clip: 'opening' } } };
const bank = {
  opening: { src: 'open.wav', volume: .5 },
  active: { src: 'active.wav' },
  impact: { src: 'impact.wav' }
};
const sources = { 'open.wav': sourceData(1), 'active.wav': sourceData(2), 'impact.wav': sourceData(3) };
const markers = context => context.clips.map(source => source.buffer.marker);

async function finishPreload(context) {
  for (const request of context.requests) request.resolve();
  await Promise.resolve();
}

function matchFixture(audio, first, second = []) {
  const config = {
    rules, arena: arenas[0], training: true,
    fighters: [{ ...testFighter, actions: first }, { ...testFighter, actions: second }]
  };
  const state = createMatch(config);
  state.phase = 'fight';
  state.fighters[0].x = 1800;
  state.fighters[1].x = 1890;
  return {
    state,
    update(events = []) { audio.update(config, state, events); },
    tick(player = NEUTRAL, opponent = NEUTRAL) {
      const events = step(state, [player, opponent], config);
      this.update(events);
      return events;
    }
  };
}

test('frame zero and active-frame clips follow real ticks and hitstop without replaying', async t => {
  const { audio, context } = audioFixture(t, [bank, undefined], sources, false);
  assert.equal(context.state, 'suspended');
  assert.equal(context.requests.length, 3, 'selected clips begin decoding before the first gesture');
  await finishPreload(context);
  audio.enableFromGesture();
  const match = matchFixture(audio, [{
    ...move,
    audioTimeline: [{ frame: 0, clip: 'opening' }, { frame: 2, clip: 'active' }],
    feedback: { audio: { clip: 'impact' } }
  }]);

  match.tick(attack);
  assert.deepEqual(markers(context), [1]);
  match.tick();
  assert.deepEqual(markers(context), [1]);
  assert.ok(match.tick().some(event => event.kind === 'hit'));
  assert.deepEqual(markers(context), [1, 2, 3]);
  assert.equal(context.played.filter(source => source.kind === 'oscillator').length, 1, 'only the original swing tone plays');
  for (let i = 0; i < move.stop; i++) match.tick();
  assert.equal(match.state.fighters[0].attack.frame, 2);
  assert.deepEqual(markers(context), [1, 2, 3]);

  for (let i = 0; i < move.active + move.recovery; i++) match.tick();
  assert.equal(match.state.fighters[0].attack, null);
  assert.ok(context.clips.every(source => !source.stopped), 'natural recovery leaves the existing tails audible');
  match.tick(attack);
  assert.deepEqual(markers(context), [1, 2, 3, 1]);
});

test('a trade plays only opt-out cues on the frame that interrupts the action', async t => {
  const { audio, context } = audioFixture(t, [bank, undefined], sources);
  await finishPreload(context);
  for (const frame of [0, 1]) {
    const sameFrame = { ...move, startup: frame };
    const authored = {
      ...sameFrame,
      audioTimeline: [
        { frame, clip: 'opening' },
        { frame, clip: 'active', stopOnInterrupt: false }
      ]
    };
    const match = matchFixture(audio, [authored], [sameFrame]);
    const started = match.tick(attack, attack);
    const trade = frame === 0 ? started : match.tick();
    assert.equal(trade.filter(event => event.kind === 'hit').length, 2);
    assert.ok(match.state.fighters.every(fighter => fighter.attack === null));
    assert.deepEqual(markers(context), Array(frame + 1).fill(2));
    audio.stopAll();
  }
});

test('a hit and an early cancel stop owned clips while opt-out clips survive to the next round', async t => {
  const { audio, context } = audioFixture(t, [bank, undefined], sources);
  await finishPreload(context);
  const timed = {
    ...move,
    audioTimeline: [
      { frame: 0, clip: 'opening' },
      { frame: 0, clip: 'active', channel: 'voice', stopOnInterrupt: false }
    ]
  };
  const interrupted = matchFixture(audio, [timed], [{ ...move, startup: 1 }]);
  interrupted.tick(attack, attack);
  assert.equal(interrupted.tick()[0].kind, 'hit');
  assert.equal(interrupted.state.fighters[0].attack, null);
  assert.ok(context.clips[0].stopped);
  assert.ok(!context.clips[1].stopped);
  assert.equal(context.played.filter(source => source.kind === 'oscillator').length, 2, 'unconfigured hits keep their original tone');
  interrupted.state.round++;
  interrupted.update();
  assert.ok(context.played.every(source => source.stopped));

  const followup = { ...move, id: 'followup', slot: 'C', linkOnly: true };
  const cancelled = matchFixture(audio, [{ ...timed, cancelOnHit: ['followup'] }, followup]);
  cancelled.tick(attack);
  for (let i = 0; i < move.startup + move.stop; i++) cancelled.tick();
  cancelled.tick({ ...NEUTRAL, pressed: ['C'] });
  assert.equal(cancelled.state.fighters[0].attack.id, 'followup');
  assert.ok(context.clips[2].stopped);
  assert.ok(!context.clips[3].stopped);
});

test('voices replace clips only on the same seat and channel gains affect existing sounds', async t => {
  const { audio, context } = audioFixture(t, [bank, bank], sources);
  assert.equal(context.requests.length, 3, 'mirror matches share predecoded data');
  await finishPreload(context);
  audio.volume = .8;
  audio.sfxVolume = .6;
  audio.voiceVolume = .4;
  const opening = {
    ...move,
    audioTimeline: [
      { frame: 0, clip: 'opening', channel: 'voice', volume: .5, stopOnInterrupt: false },
      { frame: 0, clip: 'active' },
      { frame: 1, clip: 'impact', channel: 'voice' },
      { frame: 1, clip: 'active' }
    ]
  };
  const match = matchFixture(audio, [opening], [{ ...opening, audioTimeline: opening.audioTimeline.slice(0, 2) }]);
  match.tick(attack, attack);
  const [leftVoice, leftEffect, rightVoice, rightEffect] = context.clips;
  assert.equal(leftVoice.output.gain.value, .25, 'asset and cue levels multiply');
  const voiceBus = leftVoice.output.output;
  const effectBus = leftEffect.output.output;
  const master = voiceBus.output;
  assert.equal(voiceBus.gain.value, .4);
  assert.equal(effectBus.gain.value, .6);
  assert.equal(effectBus.output, master);
  assert.equal(master.gain.value, .8);

  match.tick();
  assert.deepEqual(markers(context), [1, 2, 1, 2, 3, 2]);
  assert.ok(leftVoice.stopped);
  assert.ok(!rightVoice.stopped);
  assert.ok(!leftEffect.stopped && !rightEffect.stopped);
  audio.voiceVolume = .1;
  audio.sfxVolume = .3;
  audio.enabled = false;
  assert.equal(voiceBus.gain.value, .1);
  assert.equal(effectBus.gain.value, .3);
  assert.equal(master.gain.value, 0);
  audio.enabled = true;
  assert.equal(master.gain.value, .8);
  assert.ok(!rightVoice.stopped);

  rightVoice.onended();
  assert.equal(rightVoice.output, undefined);
  audio.stopAll();
  assert.ok(!rightVoice.stopped, 'completed nodes are removed before later teardown');
  assert.ok(leftEffect.stopped && rightEffect.stopped);
});

test('paused steps and outstanding decode never enqueue sounds for later playback', async t => {
  const { audio, context } = audioFixture(t, [bank, undefined], sources);
  const timed = { ...move, audioTimeline: [0, 1, 2].map(frame => ({ frame, clip: 'opening' })) };
  const match = matchFixture(audio, [timed]);
  match.tick(attack);
  match.update([hit]);
  assert.deepEqual(markers(context), []);
  assert.equal(context.played.filter(source => source.kind === 'oscillator').length, 2, 'an unready impact falls back immediately');

  audio.setPaused(true);
  assert.equal(context.state, 'suspended');
  await finishPreload(context);
  assert.deepEqual(markers(context), []);
  match.tick();
  assert.equal(match.state.fighters[0].attack.frame, 1);
  audio.setPaused(false);
  assert.equal(context.state, 'running');
  match.update();
  assert.deepEqual(markers(context), []);
  match.tick();
  assert.deepEqual(markers(context), [1]);
});

test('a replaced audio bank ignores old decode results and reports unusable audio once', async t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const singleBank = {
    opening: bank.opening, absent: { src: 'absent.wav' }, invalid: { src: 'invalid.wav' }
  };
  const { audio, context } = audioFixture(t, [{ opening: bank.opening }, undefined], { 'open.wav': sourceData(1) });
  const stale = context.requests[0];
  audio.configure([singleBank, undefined], { 'open.wav': sourceData(9), 'invalid.wav': sourceData(8) });
  const latest = context.requests[1];
  context.requests[2].reject(new Error('Invalid audio bytes'));

  const match = matchFixture(audio, [{
    ...move,
    audioTimeline: [
      { frame: 0, clip: 'opening' },
      { frame: 1, clip: 'opening' },
      { frame: 2, clip: 'unknown' },
      { frame: 3, clip: 'unknown' }
    ]
  }]);
  stale.resolve();
  await Promise.resolve();
  match.tick(attack);
  assert.deepEqual(markers(context), []);
  latest.resolve();
  await Promise.resolve();
  match.tick();
  assert.deepEqual(markers(context), [9]);
  match.tick();
  match.tick();
  assert.equal(warn.mock.callCount(), 3, 'the missing asset, decoder error, and unknown clip each produce one warning');
  audio.configure([bank, undefined], { 'open.wav': sourceData(4), 'active.wav': sourceData(5), 'impact.wav': sourceData(6) });
  assert.ok(context.played.every(source => source.stopped));
});
