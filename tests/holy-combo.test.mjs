import test from 'node:test';
import assert from 'node:assert/strict';
import {holyComboSample} from '../src/web/frog-combo.mjs';
import {frog} from '../dist/content/fighters/frog.js';
import {whale} from '../dist/content/fighters/whale.js';
import {frogAction} from '../dist/core/frog-kit.js';
import {soundTarget} from '../dist/web/audio-levels.js';
import {readFileSync} from 'node:fs';

test('empowered five hits each have a distinct new swing and separate hit timbre from skill one',()=>{
 const f={ascendUntil:900},state={arenaFrame:1};
 const ids=['common-jab','common-sweep','frog-left-kick','frog-ha','common-finish'];
 for(const [i,id]of ids.entries()){
  const raw=frog.fighter.actions.find(a=>a.id===id),a=frogAction(raw,f,state);
  assert.equal(a.audioTimeline[0].clip,'holy-combo-'+(i+1));
  assert.equal(a.feedback.audio.clip,'holy-melee-hit');
  assert.equal(soundTarget(a.audioTimeline[0].clip),-20);
 }
 const skill=frogAction(frog.fighter.actions.find(a=>a.id==='frog-laugh'),f,state);
 assert.equal(skill.audioTimeline.find(c=>c.channel==='sfx').clip,'holy-wave');
 assert.equal(skill.entities[0].feedback.audio.clip,'holy-hit');
});

test('first four empowered effects strike solidly then vanish promptly without floating',()=>{
 for(let i=0;i<4;i++){
  assert.equal(holyComboSample(i,-4),null);
  const pre=holyComboSample(i,-2),hit=holyComboSample(i,0),tail=holyComboSample(i,10);
  assert.equal(hit.alpha,1);assert.equal(hit.impact,1);assert.ok(tail.alpha<hit.alpha);
  assert.equal(pre.x,hit.x);assert.equal(pre.y,hit.y);assert.equal(tail.y,hit.y);
  assert.equal(holyComboSample(i,16),null);
 }
});

test('dragon uses six sequential registered poses with a fixed ground and no rescaling',()=>{
 const samples=[-7,-2,3,8,13,18].map(t=>holyComboSample(4,t));
 assert.deepEqual(samples.map(s=>s.dragonFrame),[0,1,2,3,4,5]);
 for(const s of samples){assert.equal(s.baseY,6);assert.equal(s.width,310);assert.equal(s.height,310);assert.equal(s.x,160);}
 assert.equal(holyComboSample(4,38).dragonFrame,5);assert.equal(holyComboSample(4,39),null);
 assert.ok(holyComboSample(4,38).alpha<holyComboSample(4,18).alpha);
});

test('whale supplied voices use the voice channel with a louder cinematic tier and playable WAVs',()=>{
 for(const [id,clip]of [['common-jab','tail-voice-1'],['common-sweep','tail-voice-2'],['common-finish','tail-voice-3'],['open-source','ultimate-voice'],['whale-eat','eat-voice']]){
  const action=whale.fighter.actions.find(a=>a.id===id);
  const cue=action.audioTimeline.find(c=>c.channel==='voice');assert.equal(cue.clip,clip);assert.equal(cue.frame,0);
  assert.equal(cue.stopOnInterrupt,false);
  const data=readFileSync(new URL('../'+whale.audio[clip].src,import.meta.url));
  assert.equal(data.toString('ascii',0,4),'RIFF');assert.ok(data.length>4000);
 }
 assert.ok(soundTarget('ultimate-voice')>soundTarget('tail-voice-2'));
 const clips=Array.from({length:5},(_,i)=>frog.audio['holy-combo-'+(i+1)].src);
 assert.equal(new Set(clips).size,5);
 assert.ok(clips.every(src=>readFileSync(new URL('../'+src,import.meta.url)).length>4000));
});

test('rice stealing voice has only a short two-syllable excerpt, under one second',()=>{
 const data=readFileSync(new URL('../'+whale.audio['eat-voice'].src,import.meta.url));
 let offset=12,rate,align,length;
 while(offset+8<=data.length){const id=data.toString('ascii',offset,offset+4),size=data.readUInt32LE(offset+4);
  if(id==='fmt '){rate=data.readUInt32LE(offset+12);align=data.readUInt16LE(offset+20);}
  if(id==='data'){length=size;break;}offset+=8+size+(size%2);
 }
 const seconds=length/rate/align;assert.ok(seconds>.4&&seconds<.55,`duration ${seconds}`);
 assert.ok(whale.audio['eat-voice'].src.includes('V23'));
});
