import assert from 'node:assert/strict';
import test from 'node:test';
import { arenas } from '../dist/content/arenas.js';
import { rules, testFighter } from '../dist/content/demo.js';
import { basicAttack } from '../dist/content/fighter-kit.js';
import { frog } from '../dist/content/fighters/frog.js';
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
    this.stopTime=time;
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

  createDynamicsCompressor(){return Object.assign(new FakeNode(),Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k=>[k,new FakeParam()])));}

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

test('procedural contacts use the heaviest tone once when several hits resolve on one tick', t => {
  const { audio, context } = audioFixture(t, [undefined, undefined], {});
  const match = matchFixture(audio, []);
  const contact = { kind: 'hit', source: 0, x: 0, y: 0 };
  match.update([{ ...contact, impactTier: 'light' }, { ...contact, impactTier: 'medium' },
    { ...contact, source: 1, impactTier: 'heavy', trade: true }]);
  assert.deepEqual(context.played.map(source => source.kind), ['oscillator', 'buffer']);
  assert.equal(context.played[0].stopTime, context.currentTime + .133);
});

test('same-tick contact aliases keep the strongest copy of each sample and kind', async t => {
  const attacker = { tap: { src: 'open.wav' }, slam: { src: 'open.wav' }, separate: { src: 'active.wav' } };
  const defender = { 'event-block': { src: 'open.wav', volume: .3 } };
  const { audio, context } = audioFixture(t, [attacker, defender], sources);
  await finishPreload(context);
  const match = matchFixture(audio, []);
  const hitWith = (clip, volume) => ({ ...hit, feedback: { audio: { clip, volume } } });
  const block = { kind: 'block', source: 0, x: 0, y: 0 };
  match.update([hitWith('tap', .25), block, hitWith('slam', .8), hitWith('separate', .6), block]);
  assert.deepEqual(markers(context), [1, 1, 2]);
  assert.deepEqual(context.clips.map(source => source.output.gain.value), [.8, .3, .6]);

  match.state.frame++;
  match.update([hitWith('tap', .25)]);
  assert.deepEqual(markers(context), [1, 1, 2, 1]);
});

test('removed frog up-O is silent while the authored ascension starts its dedicated music', async t => {
  const musicBank = { 'ultimate-bgm': { src: 'open.wav' }, wave: { src: 'active.wav' } };
  const { audio, context } = audioFixture(t, [musicBank, undefined], sources);
  await finishPreload(context);
  const config = { rules, arena: arenas[0], fighters: [frog.fighter, testFighter], training: true };
  const start = y => {
    const state = createMatch(config);
    state.phase = 'fight';
    state.fighters[0].energy = 300;
    const events = step(state, [{ ...NEUTRAL, y, pressed: ['ULT'] }, NEUTRAL], config);
    audio.update(config, state, events);
    return { state, events };
  };

  const { state, events } = start(-1);
  assert.ok(!events.some(event=>event.kind==='ultimate'));
  assert.equal(state.fighters[0].energy,300);
  assert.deepEqual(context.played,[]);

  audio.stopAll();
  const offset = context.played.length;
  const ascension = start(0);
  assert.ok(ascension.events.some(event => event.kind === 'ultimate' && event.actionId === 'frog-ascend'));
  assert.deepEqual(context.played.slice(offset).map(source => source.buffer?.marker), [1]);
});

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


test('random voice cue plays exactly one of four clips and does not change combat state', async t => {
  const pool=Object.fromEntries([1,2,3,4].map(i=>['line'+i,{src:'line'+i+'.wav'}]));
  const embedded=Object.fromEntries([1,2,3,4].map(i=>['line'+i+'.wav',sourceData(i)]));
  const {audio,context}=audioFixture(t,[pool,undefined],embedded);
  await finishPreload(context);
  const cue={frame:0,clip:'line1',variants:['line2','line3','line4'],channel:'voice',stopOnInterrupt:false};
  const probe={...move,audioTimeline:[cue]};
  const fixture=matchFixture(audio,[probe]);
  const before=structuredClone(fixture.state);
  const oldRandom=Math.random;t.after(()=>Math.random=oldRandom);
  for(const roll of [0,.26,.51,.76]){
    Math.random=()=>roll;
    audio.update({fighters:[]}, {round:1,fighters:[{attack:null},{attack:null}]},[{kind:'action-audio',source:0,x:0,y:0,actionAudio:{attack:{},cue}}]);
  }
  assert.deepEqual(markers(context),[1,2,3,4]);
  assert.deepEqual(fixture.state,before);
  assert.ok(context.clips.slice(0,3).every(clip=>clip.stopped));
});


test('frog transformation and buff silence only its voice, stop prior dialogue and retain sfx',async t=>{
 const {audio,context}=audioFixture(t,[bank,bank],sources);await finishPreload(context);
 const config={rules,arena:arenas[0],training:true,fighters:[{...testFighter,id:'frog'},testFighter]};
 const state=createMatch(config);state.phase='fight';
 const cue={frame:0,clip:'opening',channel:'voice',stopOnInterrupt:false};
 const event=(source=0,c=cue)=>({kind:'action-audio',source,x:0,y:0,actionAudio:{attack:{},cue:c}});
 audio.update(config,state,[event()]);assert.equal(context.clips.length,1);
 state.fighters[0].attack={id:'frog-ascend',frame:0,connected:false,landed:false};
 audio.update(config,state,[event()]);assert.equal(context.clips.length,1);assert.equal(context.clips[0].stopped,true);
 state.fighters[0].attack=null;state.fighters[0].ascendUntil=state.arenaFrame+900;
 audio.update(config,state,[event(),event(1),event(0,{...cue,channel:'sfx'})]);
 assert.equal(context.clips.length,3,'opponent voice and frog effect remain audible');
 delete state.fighters[0].ascendUntil;
 audio.update(config,state,[event()]);assert.equal(context.clips.length,4,'normal form voice resumes');
});


test('pool sounds follow entity age once through hitstop, ending with a distinct giant breach',async t=>{
 const poolBank={'pool-warning':{src:'open.wav'},'pool-breach':{src:'active.wav'},'pool-final':{src:'impact.wav'}};
 const {audio,context}=audioFixture(t,[poolBank,undefined],sources);await finishPreload(context);
 const config={fighters:[testFighter,testFighter]},entity={id:7,owner:0,definition:{behavior:'pool'},age:0};
 const state={round:1,phase:'fight',arenaFrame:0,fighters:[{attack:null},{attack:null}],entities:[entity]};
 audio.update(config,state,[]);audio.update(config,state,[]);assert.deepEqual(markers(context),[1]);
 entity.age=35;audio.update(config,state,[]);assert.equal(context.clips.length,1);
 for(let i=0;i<12;i++){entity.age=36+i*7;audio.update(config,state,[]);audio.update(config,state,[]);}
 assert.deepEqual(markers(context),[1,...Array(11).fill(2),3]);
 audio.stopAll();audio.update(config,state,[]);assert.equal(context.clips.length,14);
});

test('audio preloads external relative URLs via fetch for static site builds', async t => {
  const originalFetch = globalThis.fetch;
  const fetched = [];
  globalThis.fetch = async url => {
    fetched.push(url);
    return { ok: true, status: 200, async arrayBuffer() { return Uint8Array.from([7]).buffer; } };
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const { audio, context } = audioFixture(t, [{ opening: bank.opening }, undefined], { 'open.wav': './assets/audio/open.wav' });
  await Promise.resolve();
  await Promise.resolve();
  await finishPreload(context);
  assert.deepEqual(fetched, ['./assets/audio/open.wav']);
  const match = matchFixture(audio, [{ ...move, audioTimeline: [{ frame: 0, clip: 'opening' }] }]);
  match.tick(attack);
  assert.deepEqual(markers(context), [7]);
});

test('frog ultimate music survives transformation and attacks, fades at buff end and clears on reset',async t=>{
 const musicBank={'ultimate-bgm':{src:'open.wav'},active:{src:'active.wav'}};
 const {audio,context}=audioFixture(t,[musicBank,undefined],sources);await finishPreload(context);
 const config={rules,arena:arenas[0],fighters:[{...testFighter,id:'frog'},testFighter]};const state=createMatch(config);state.phase='fight';
 const f=state.fighters[0];f.attack={id:'frog-ascend',frame:0,connected:false,landed:false};
 audio.update(config,state,[{kind:'action-audio',source:0,x:0,y:0,actionAudio:{attack:f.attack,cue:{frame:0,clip:'ultimate-bgm',channel:'sfx',stopOnInterrupt:false}}}]);
 const music=context.clips[0];assert.ok(music);f.attack=null;f.ascendUntil=900;
 audio.update(config,state,[]);assert.equal(music.stopTime,undefined);
 audio.update(config,state,[{kind:'action-audio',source:0,x:0,y:0,actionAudio:{attack:{},cue:{frame:0,clip:'active',channel:'sfx',stopOnInterrupt:false}}}]);
 assert.equal(music.stopTime,undefined,'skill sound must not replace BGM');
 state.arenaFrame=900;audio.update(config,state,[]);assert.equal(music.stopTime,context.currentTime+.3);
 audio.stopAll();assert.equal(music.stopped,true);
});

test('opening a scene or starting a round never automatically plays scene-entry audio',async t=>{
 const {audio,context}=audioFixture(t,[{'event-entry':bank.opening},undefined],sources);await finishPreload(context);
 const config={rules,arena:arenas[0],fighters:[testFighter,testFighter]},state=createMatch(config);
 audio.update(config,state,[]);state.frame++;audio.update(config,state,[]);state.phase='fight';audio.update(config,state,[]);
 state.round++;state.phase='ready';audio.update(config,state,[]);assert.equal(context.clips.length,0);
});
