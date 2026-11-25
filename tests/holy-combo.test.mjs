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

test('gold effects open, bend and decay once, and the finisher has longer follow-through',()=>{
 for(let i=0;i<5;i++){
  assert.equal(holyComboSample(i,-4),null);
  const early=holyComboSample(i,-2),peak=holyComboSample(i,5),tail=holyComboSample(i,21);
  assert.ok(peak.width>early.width);assert.ok(tail.alpha<peak.alpha);
  assert.notEqual(peak.angle,tail.angle);assert.equal(holyComboSample(i,33),null);
 }
 assert.ok(holyComboSample(4,29));assert.equal(holyComboSample(0,29),null);
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
