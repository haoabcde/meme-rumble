import {defineFighter} from '../fighter-kit.js';
import type {ActionDefinition} from '../../core/types.js';
import type {EntityDefinition} from '../../core/entities.js';
const sfx=(frame:number,clip:string)=>({frame,clip,channel:'sfx' as const,stopOnInterrupt:false});
const ids=['common-jab','common-sweep','frog-left-kick','frog-ha','common-finish'];
const combo=(stage:number):ActionDefinition=>({
 id:ids[stage-1],name:['左拳','右拳','左踢腿','哈！','右脚飞踢'][stage-1],slot:'A',posture:'ground',linkOnly:stage>1,
 startup:stage===5?7:5,active:stage===4?5:4,recovery:stage===5?20:14,
 audioTimeline:[sfx(stage===5?7:5,'melee-swing')],
 hitbox:stage===4?{x:-80,y:-145,w:160,h:160}:{x:5,y:-122,w:stage===5?170:stage===3?146:120,h:115},
 radial:stage===4,damage:[28,28,32,20,50][stage-1],fixedDamage:true,
 hitstun:stage===5?28:22,blockstun:7,guardCost:stage===5?20:10,push:stage===4?4.5:stage===5?9:1.8,lift:stage===5?9:0,
 stop:stage===5?5:3,advance:stage===5?9:stage===4?0:1.8,chainAfter:10,
 cancelOnHit:stage<5?[ids[stage],'B','ULT']:[],pose:stage===5?'finish':stage===4?'rise':'strike',feedback:{audio:{clip:'melee-hit'},color:'#ffe1a1',shake:stage===5?3:1.3,flash:.5}
});
const wave=(n:number,global=false):EntityDefinition=>({
 id:global?'frog-global-wave':'frog-laugh-wave-'+n,behavior:global?'frog-global':'frog-wave',spawnFrame:global?32:16+n*10,
 offset:{x:0,y:-65},velocity:{x:0,y:0},lifetime:8,
 hitbox:{x:-240,y:-240,w:480,h:480},damage:global?25:n===2?44:28,
 hitstun:global?18:n===2?30:14,blockstun:8,guardCost:global?12:14,push:global?9:n===2?10:0,lift:global?10:n===2?15:0,stop:2,
 feedback:{audio:{clip:'wave-hit'},shape:'ring',color:'#ffe7b0',shake:global?2:2.5,flash:.55}
});
const laugh=(global=false):ActionDefinition&{slot:'B'}=>({
 id:global?'frog-laugh-global':'frog-laugh',name:global?'响彻天地':'捧腹大笑',slot:'B',direction:global?'up':undefined,posture:'any',frog:global?'global':'laugh',
 audioTimeline:[{frame:0,clip:global?'ha':'laugh',channel:'voice',stopOnInterrupt:true},...(global?[sfx(32,'global-wave')]:[sfx(16,'wave'),sfx(26,'wave'),sfx(36,'wave')])],
 startup:global?32:16,active:global?1:21,recovery:18,hitTimeline:[],hitbox:{x:0,y:0,w:1,h:1},damage:0,hitstun:0,blockstun:0,guardCost:0,push:0,lift:0,stop:0,advance:0,pose:'rise',
 entities:global?[wave(0,true)]:[wave(0),wave(1),wave(2)],feedback:{color:'#ffe5ac',shake:2,flash:.5}
});
const slip=(mode:'crouch'|'burrow'|'evade'):ActionDefinition&{slot:'C'}=>({
 id:'frog-'+mode,name:mode==='crouch'?'调皮下蹲':mode==='burrow'?'脚下钻出':'绕背闪现',slot:'C',frog:mode,
 direction:mode==='burrow'?'up':undefined,posture:mode==='evade'?'any':'ground',linkOnly:mode==='evade',
 ...(mode==='evade'?{audioTimeline:[sfx(6,'teleport')]}:{audioTimeline:[{frame:0,clip:'skill2-1',variants:['skill2-2','skill2-3','skill2-4'],channel:'voice' as const,stopOnInterrupt:false},...(mode==='burrow'?[sfx(0,'teleport'),sfx(6,'teleport')]:[])]}),
 startup:0,active:1,recovery:mode==='crouch'?0:17,hitTimeline:[],
 ...(mode==='crouch'?{}:{hurtTimeline:[{from:6,to:18,boxes:[{x:-32,y:-128,w:64,h:128}]}]}),
 hitbox:{x:0,y:0,w:1,h:1},damage:0,hitstun:0,blockstun:0,guardCost:0,push:0,lift:0,stop:0,advance:0,pose:'rise'
});
export const frog=defineFighter({id:'frog',name:'奶蛙',accent:'#ffcf54',height:130,art:{portrait:'frog-v2.webp',motion:'frog-motion.webp'},
 audio:{'ultimate-bgm':{src:'assets/audio/frog/大招专属BGM.wav',volume:1},...Object.fromEntries(Object.entries({'melee-swing':'拳脚挥风','melee-hit':'拳脚命中','event-block':'落地缓冲','event-land':'落地缓冲','event-jump':'起跳蹬地','event-air-jump':'起跳蹬地','event-dash':'拳脚挥风','event-knockdown':'落败坐地','event-break':'落败坐地','event-entry':'侧躺起身','event-parry':'金色瞬移',wave:'捧腹震波','wave-hit':'拳脚命中','global-wave':'全图冲击',teleport:'金色瞬移','holy-hit':'神圣命中','holy-wave':'神圣震波'}).map(([id,name])=>[id,{src:'assets/audio/frog/'+name+'.wav',volume:1}])),laugh:{src:'assets/audio/frog/捧腹大笑_V2.wav'},ha:{src:'assets/audio/frog/哈.wav'},...Object.fromEntries([1,2,3,4].map(i=>['skill2-'+i,{src:'assets/audio/frog/二技能_语音'+i+'.wav'}]))},
 stats:{bodyWidth:80,hurtbox:{x:-32,y:-128,w:64,h:128}},
 commonMoves:[...Array.from({length:5},(_,i)=>combo(i+1)),{...combo(3),id:'common-air',name:'空中踢腿',posture:'air',linkOnly:false,advance:0,chainAfter:undefined,cancelOnHit:[],airControl:.5}],
 signatureMoves:[laugh(),laugh(true),slip('crouch'),slip('burrow'),slip('evade')],ultimate:{cost:300,move:{id:'frog-ascend',name:'神了！',frog:'ascend',audioTimeline:[sfx(0,'ultimate-bgm')],posture:'any',startup:60,active:1,recovery:0,hitTimeline:[],hitbox:{x:0,y:0,w:1,h:1},damage:0,hitstun:0,blockstun:0,guardCost:0,push:0,lift:0,stop:0,advance:0,pose:'rise'}}
});
