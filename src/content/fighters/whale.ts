import {defineFighter} from '../fighter-kit.js';
import type {ActionDefinition} from '../../core/types.js';
import type {EntityDefinition} from '../../core/entities.js';

const tail=(stage:1|2|3):ActionDefinition=>({
 id:['common-jab','common-sweep','common-finish'][stage-1],name:['左转抽尾','右转反抽','转身上挑'][stage-1],slot:'A',posture:'ground',
 linkOnly:stage>1,startup:stage===3?8:6,active:4,recovery:stage===3?24:15,
 hitbox:{x:4,y:stage===3?-166:-112,w:150,h:stage===3?158:92},damage:45,fixedDamage:true,
 hitstun:stage===3?34:22,blockstun:7,guardCost:50,guardHitsToBreak:2,push:stage===3?5.5:2.6,lift:stage===3?13:0,
 stop:4,advance:18/(stage===3?8:6),chainAfter:13,cancelOnHit:stage===1?['common-sweep']:stage===2?['common-finish']:[],
 pose:stage===3?'rise':stage===1?'strike':'sweep',feedback:{color:'#91d9ff',shake:stage===3?3:1.5,flash:.65},
 animation:(stage===3?[[0,0],[1,1],[3,2],[6,3],[8,4],[12,5],[19,6],[27,7]]:[[0,0],[1,1],[3,2],[5,3],[6,4],[9,5],[14,6],[21,7]])
 .map(([frame,index])=>({frame,cell:12+(stage-1)*8+index}))
});
const projectile=(id:string,behavior:EntityDefinition['behavior'],spawnFrame:number,sign=1):EntityDefinition=>({
 id,behavior,spawnFrame,offset:{x:behavior==='rice'?26*sign:behavior==='orca'?-107.5:0,y:behavior==='rice'?-92:behavior==='orca'?-90:0},
 velocity:{x:behavior==='spin'?24:behavior==='orca'?20:behavior==='rice'?sign:0,y:0},
 lifetime:behavior==='rice'?120:behavior==='orca'?240:48,
 hitbox:behavior==='rice'?{x:-14,y:-11,w:28,h:22}:behavior==='orca'?{x:-202.5,y:-92,w:405,h:197}:{x:-86,y:-240,w:172,h:240},
 damage:behavior==='orca'?35:behavior==='counter'?20:30,hitstun:behavior==='rice'?0:behavior==='orca'?12:22,
 blockstun:7,guardCost:behavior==='orca'?8:20,push:behavior==='rice'?0:behavior==='orca'?3.4:7,lift:behavior==='spin'||behavior==='spin-up'||behavior==='counter'?12:0,
 stop:behavior==='orca'?1:3,feedback:{color:'#8bdfff',shake:2,flash:.6},color:'#65baff'
});
const rice=(up=false):ActionDefinition&{slot:'B'}=>({
 id:up?'rice-up':'rice',name:up?'高抛米饭':'米饭投手',slot:'B',posture:'ground',direction:up?'up':undefined,
 startup:8,active:1,recovery:9,whale:up?'rice-up':'rice',hitTimeline:[],hitbox:{x:0,y:0,w:1,h:1},damage:0,hitstun:0,blockstun:0,guardCost:0,push:0,lift:0,stop:0,advance:0,pose:'strike',
 animation:[{frame:0,cell:68},{frame:8,cell:up?70:69},{frame:15,cell:77}],entities:[projectile(up?'rice-up':'rice','rice',8)]
});
const spin=(up=false):ActionDefinition&{slot:'C'}=>({
 id:up?'tornado-up':'tornado',name:up?'定点旋风':'旋风推进',slot:'C',posture:'ground',direction:up?'up':undefined,
 startup:12,active:1,recovery:15,whale:up?'spin-up':'spin',hitTimeline:[],hitbox:{x:0,y:0,w:1,h:1},damage:0,hitstun:0,blockstun:0,guardCost:0,push:0,lift:0,stop:0,advance:0,pose:'strike',
 animation:[{frame:0,cell:up?76:72},{frame:6,cell:up?76:74},{frame:22,cell:77}],entities:[projectile(up?'spin-up':'spin',up?'spin-up':'spin',12)]
});
const counter:ActionDefinition&{slot:'C'}={...spin(),id:'whale-counter',name:'旋风防反',whale:'counter',linkOnly:true,startup:0,active:20,recovery:0,
 entities:[projectile('counter','counter',0),projectile('counter-rice-left','rice',12,-1),projectile('counter-rice-right','rice',12)],
 animation:[{frame:0,cell:72},{frame:3,cell:73},{frame:6,cell:74},{frame:9,cell:75},{frame:12,cell:77}]};
const ult:ActionDefinition={...spin(),id:'open-source',name:'开源！',slot:'ULT',direction:undefined,whale:'open-source',startup:64,active:1,recovery:10,
 animation:[{frame:0,cell:76},{frame:22,cell:77}],entities:[projectile('open-source-orca','orca',64)]};
const {slot:_slot,energyCost:_energy,...ultimateMove}=ult;
export const whale=defineFighter({id:'whale',name:'大肥鱼',accent:'#75a9ff',height:144,art:{portrait:'大肥鱼/常态.webp',motion:'大肥鱼/完整动作.webp'},
 stats:{run:7,airSpeed:8,jump:18,airJump:14,dash:24,airDash:true,hurtbox:{x:-27,y:-140,w:54,h:140},bodyWidth:72},
 commonMoves:[tail(1),tail(2),tail(3),{...tail(1),id:'common-air',name:'空中尾击',posture:'air',advance:0,linkOnly:false,chainAfter:undefined,cancelOnHit:[],airControl:.35}],
 guardCounter:{windowFrames:4,actionId:'whale-counter'},
 signatureMoves:[rice(),rice(true),spin(),spin(true),counter,{...rice(),id:'whale-eat',name:'贪吃反噬',whale:'eat',linkOnly:true,entities:[],startup:12,recovery:15,animation:[{frame:0,cell:68},{frame:8,cell:71},{frame:21,cell:77}]}],
 ultimate:{cost:300,move:ultimateMove}
});
