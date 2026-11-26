import test from 'node:test';
import assert from 'node:assert/strict';
import {SOUND_LEVELS,soundTarget,sampleLevel,calibratedGain} from '../dist/web/audio-levels.js';
test('character loudness has seven increasing tiers, with ultimate and finale above skills',()=>{
 const levels=Object.values(SOUND_LEVELS);for(let i=1;i<levels.length;i++)assert.equal(levels[i]-levels[i-1],3);
 assert.equal(soundTarget('ultimate-bgm'),-17);assert.equal(soundTarget('pool-final'),-14);
 assert.ok(soundTarget('melee-hit')<soundTarget('wave'));assert.ok(soundTarget('wave')<soundTarget('holy-wave'));
 assert.equal(soundTarget('unknown'),undefined);
});
test('calibration equalizes sources with different amplitude and ignores silent padding',()=>{
 const a=Float32Array.from({length:1000},(_,i)=>Math.sin(i*.17)*.5);
 const b=Float32Array.from(a,n=>n*.2),padded=new Float32Array(3000);padded.set(a,1000);
 const sa=sampleLevel([a]),sb=sampleLevel([b]);
 assert.ok(Math.abs(sa.rms-sampleLevel([padded]).rms)<1e-9);
 assert.ok(Math.abs(sa.rms*calibratedGain(sa,-26)-sb.rms*calibratedGain(sb,-26))<1e-7);
 assert.ok(Math.abs(20*Math.log10(sa.rms*calibratedGain(sa,-26))+26)<1e-8);
});
test('quiet and transient sources respect the gain and peak ceilings without invalid output',()=>{
 assert.equal(calibratedGain(sampleLevel([new Float32Array(5)]),-14),1);
 assert.equal(calibratedGain({peak:.0001,rms:.00005},-14),4);
 const stats={peak:1,rms:.03};assert.ok(stats.peak*calibratedGain(stats,-14)<=10**(-3/20));
});
