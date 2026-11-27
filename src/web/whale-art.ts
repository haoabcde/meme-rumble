import type {FighterAction,FighterState,MatchConfig,MatchState} from '../core/types.js';
import {motionArt} from './art.js';
import locomotionV25 from '../../assets/角色/基础动作/大肥鱼/V25/步态与起落_十六帧.png';
import {registerLocomotion,setActorMotion,drawActorMotion} from './actor-motion.mjs';
import {whaleTailPose} from './whale-tail-cleanup.mjs';
import {createUnifiedTornadoRenderer} from '../../assets/角色/防御/大肥鱼/蓝色龙卷风/旋风鲸影_统一渲染_V8.mjs';
import {createUltimateRenderer} from './whale-ultimate.mjs';
import portrait from '../../assets/角色/大招/大肥鱼/开源/演出分层/梁文峰_宽肩修订_V4.png';
import {createWaterRenderer} from './whale-water.mjs';
import {waterSubframe} from './whale-presentation.mjs';
import {WHALE_RULES,cinematicOwner} from '../core/whale-kit.js';
import whaleTurn from '../../assets/角色/特效/大肥鱼/水鲸动作_V2/水鲸_八方向张嘴.png';
import whaleLeap from '../../assets/角色/特效/大肥鱼/水鲸动作_V2/水鲸_抬头张嘴跃出_八帧.png';
import waterWhale from '../../assets/角色/特效/大肥鱼/水鲸符文_V1/水鲸_四姿态.png';
import waterParts from '../../assets/角色/特效/大肥鱼/水鲸符文_V1/水潭_水花_小鱼_花.png';
import runeParts from '../../assets/角色/特效/大肥鱼/水鲸符文_V1/符文_弧光_冲刺_上升_星芒.png';
import poolParts from '../../assets/角色/大招/大肥鱼/纵深水潭_V11/水面_前后沿_水膜_破水_八部件.png';
import fishSchool from '../../assets/角色/特效/大肥鱼/水鲸鱼群_V3/流光水鱼_独立鱼身与长尾.png';

let tornado:any,ultimate:any,water:any;
const load=(src:string)=>{const im=new Image();im.src=src;return im.decode().then(()=>im)};
void load(locomotionV25).then(im=>registerLocomotion(im,'whale'));

void Promise.all(Object.entries({portrait,waterWhale,waterParts,runeParts,whaleTurn,whaleLeap,fishSchool,poolParts}).map(async([k,v])=>[k,await load(v)] as const)).then(entries=>{
 const images=Object.fromEntries(entries);water=createWaterRenderer(images,{preview:true});tornado=createUnifiedTornadoRenderer(water.whales[0]);ultimate=createUltimateRenderer(images,water);
 const warmCanvas=document.createElement('canvas');const warmContext=warmCanvas.getContext('2d');
 let i=0;function warm(){for(const layer of ['back','front'])tornado.wind(warmContext,0,0,i,layer);if(++i<8)requestAnimationFrame(warm)}requestAnimationFrame(warm);
}).catch(e=>console.error('大肥鱼特效素材加载失败',e));

export function whaleCell(f:FighterState,state:MatchState,seat:0|1,action?:FighterAction){
 const tick=state.arenaFrame,ev=f.poseEvent,age=ev?tick-ev.tick:999;
 if(!f.hp)return 59;
 if(f.recovery)return f.recovery.phase==='rise'?57:f.recovery.phase==='down'?56:55;
 if(state.phase==='round-over'||state.phase==='match-over')return state.result?.winner===seat?(Math.floor(state.frame/40)%2?64:65):(state.phaseTicks>55?66:67);
 if(state.phase==='ready'){const t=120-state.phaseTicks;return t<35?60:t<60?61:t<90?62:77;}
 if(f.guardBreak)return 58;
 if(f.hitstun)return !f.ground?(f.vy<0?54:55):ev?.kind==='heavy'?53:52;
 if(f.guarding)return 3;
 if(action&&f.attack){let result=77;for(const key of action.animation??[])if(f.attack.frame>=key.frame)result=key.cell;return result;}
 if(f.dashActive||f.dash)return 51;
 if(!f.ground){if(ev?.kind==='jump'&&age<5)return age<2?44:45;if(ev?.kind==='air-jump'&&age<7)return 48;return f.vy<-2?46:f.vy>3?49:47;}
 if(ev?.kind==='land'&&age<7)return 50;
 if(f.moving)return 39+Math.floor(tick/6)%4;
 if(ev?.kind==='dash'&&age<18)return 43;
 if(ev?.kind==='brake'&&age<7)return 43;
 return tick%180>=132&&tick%180<138?37:tick%180>=78&&tick%180<94?38:77;
}
export function drawWhaleActor(ctx:CanvasRenderingContext2D,f:FighterState,state:MatchState,seat:0|1,action?:FighterAction,actions:readonly FighterAction[]=[]){
 const sheet=motionArt.whale;if(!sheet?.naturalWidth)return;
 setActorMotion('whale',{sheet});
 if(state.phase==='fight'&&drawActorMotion(ctx,'whale',f,state,action,actions))return;
 let cell=whaleCell(f,state,seat,action);
 if(action&&'whale' in action&&action.whale==='spin'&&(f.attack?.frame??0)<12)return;
 const sourceCell=sheet.naturalWidth/4;
 const drawCell=(index:number,x=0)=>ctx.drawImage(sheet,index%4*sourceCell,Math.floor(index/4)*sourceCell,sourceCell,sourceCell,x-108,-184,216,216);
 if(f.dashActive){ctx.save();ctx.globalAlpha*=.15;for(const x of [-30,-60])drawCell(51,x);ctx.restore();}
 const cleaned=whaleTailPose(sheet,cell);
 if(cleaned)ctx.drawImage(cleaned,-108,-184);else drawCell(cell);
 if(action&&'whale' in action&&action.whale==='spin-up'&&f.attack){const age=f.attack.frame,blend=age<6?age/6:age<14?1:Math.max(0,(22-age)/8);ctx.save();ctx.globalAlpha*=1-blend;drawCell(77);ctx.restore();}
}
// Cache the inked silhouette once for all eight projectiles.
let riceArt: HTMLCanvasElement | undefined;
function riceBall() {
 if (riceArt) return riceArt;
 const c=document.createElement('canvas'); c.width=80; c.height=72;
 const g=c.getContext('2d')!;
 g.scale(2,2); g.translate(20,19); g.lineJoin='round';
 g.beginPath(); g.moveTo(-16,4);
 g.quadraticCurveTo(-14,-3,-6,-12); g.quadraticCurveTo(0,-19,6,-13);
 g.quadraticCurveTo(15,-4,17,4); g.quadraticCurveTo(20,13,11,14);
 g.quadraticCurveTo(0,17,-12,14); g.quadraticCurveTo(-20,12,-16,4);
 g.closePath(); g.fillStyle='#fff5da'; g.fill(); g.strokeStyle='#493543'; g.lineWidth=2.6; g.stroke();
 g.fillStyle='#354643'; g.beginPath(); g.moveTo(-5,3); g.lineTo(5,2); g.lineTo(7,14); g.lineTo(-5,15); g.fill();
 for(const [x,y] of [[-10,2],[-5,-4],[1,-9],[9,-2],[11,6],[-11,9]]){
  g.fillStyle='#cfab83'; g.beginPath(); g.ellipse(x,y,2.2,1.2,-.6,0,Math.PI*2); g.fill();
  g.fillStyle='#fff'; g.beginPath(); g.ellipse(x-.5,y-1,2,1,-.6,0,Math.PI*2); g.fill();
 }
 riceArt=c; return c;
}

function drawRice(g:CanvasRenderingContext2D,x:number,y:number,vx:number,vy:number,grounded:boolean) {
 g.save(); g.translate(x,y);
 if(grounded) {
  g.translate(0,4); g.scale(1.12,.60); g.drawImage(riceBall(),-21,-30,42,32);
 } else {
  const angle=Math.atan2(vy,vx);
  g.rotate(angle);
  g.fillStyle='#f7da9d';
  g.beginPath(); g.ellipse(-25,1,7,2,-.08,0,Math.PI*2); g.fill();
  g.beginPath(); g.ellipse(-33,-4,3,1.4,-.2,0,Math.PI*2); g.fill();
  g.rotate(-angle + Math.sin(angle)*.25);
  g.drawImage(riceBall(),-21,-19,42,38);
 }
 g.restore();
}

function drawStickyFeet(g:CanvasRenderingContext2D,x:number,y:number,remaining:number) {
 const release=Math.min(1,remaining/12);
 const impact=Math.max(0,1-(WHALE_RULES.bind-remaining)/9);
 g.save(); g.translate(x,y-2); g.scale(1+impact*.2, .48+.52*release);
 g.lineJoin='round';
 g.beginPath(); g.moveTo(-32,0); g.quadraticCurveTo(-24,-2,-21,-15);
 g.quadraticCurveTo(-16,-24,-11,-15); g.quadraticCurveTo(-7,-5,1,-7);
 g.quadraticCurveTo(10,-6,14,-17); g.quadraticCurveTo(19,-25,23,-12);
 g.quadraticCurveTo(26,-2,32,0); g.quadraticCurveTo(25,6,8,4);
 g.quadraticCurveTo(-4,2,-15,5); g.quadraticCurveTo(-27,6,-32,0); g.closePath();
 g.fillStyle='#ffedc9'; g.fill(); g.strokeStyle='#573f48'; g.lineWidth=2.8; g.stroke();
 for(const [dx,dy] of [[-22,-4],[-16,-12],[-8,-2],[5,-2],[15,-7],[19,-13],[25,0]]){
  g.beginPath();g.ellipse(dx,dy,3.5,1.7,-.45,0,Math.PI*2);g.fillStyle='#fff';g.fill();
 }
 g.restore();
}

export function drawWhaleEntities(ctx:CanvasRenderingContext2D,state:MatchState,config:MatchConfig,layer:'back'|'front',fraction=0){
 const subframe=waterSubframe(fraction,state.freeze,cinematicOwner(state)!==undefined);
 for(const e of state.entities??[]){const b=e.definition.behavior;if(!b)continue;
  if(b==='spin'||b==='spin-up'||b==='counter'){
   ctx.save(); ctx.translate(e.x,e.y);
   const counter=b==='counter';
   // Clear the center as the rice launches, keeping the column visible until its hit window closes.
   const fade=counter ? 1-.5*Math.min(1,Math.max(0,(e.age-8)/5)) : 1;
   ctx.scale(counter ? .64 : .84,.91);
   ctx.globalAlpha*=fade*(layer==='front' ? .65 : .84);
   tornado?.wind(ctx,0,0,e.age,layer,e.windTicks??20);
   ctx.restore();
   if(b==='spin')water?.orbit(ctx,e,layer);
  }
  if(layer==='front'&&b==='rice')drawRice(ctx,e.x,e.y,e.vx,e.vy,Boolean(e.grounded));
  if(b==='pool')water?.pool(ctx,e,layer,subframe);
 }
 for(const seat of [0,1] as const){const f=state.fighters[seat],a=config.fighters[seat].actions.find(a=>a.id===f.attack?.id),age=f.attack?.frame??0;
  if(a&&'whale' in a&&a.whale==='spin'&&age<12){
   ctx.save();ctx.translate(f.x,f.y);ctx.scale(.65,.68);ctx.globalAlpha*=.7;
   tornado?.formation(ctx,{x:0,y:0},age,layer);ctx.restore();
  }
  if(config.fighters[seat].id==='whale')water?.motion(ctx,f,state,a,layer);
  if(layer==='front'&&(f.bindUntil??0)>state.arenaFrame)drawStickyFeet(ctx,f.x,f.y,f.bindUntil!-state.arenaFrame);
 }
}
export function drawWhaleIntro(ctx:CanvasRenderingContext2D,config:MatchConfig,state:MatchState,fraction=0){
 if(!ultimate)return;
 for(const seat of [0,1] as const){const f=state.fighters[seat];if(config.fighters[seat].id==='whale'&&f.attack?.id==='open-source')ultimate.intro(ctx,ctx.canvas.width,ctx.canvas.height,f.attack.frame+waterSubframe(fraction,state.freeze));}
}
// Review-only close-up uses exactly the same material, timeline and depth masks as the arena.
let studyFrame:HTMLCanvasElement|undefined,studyAge:number|undefined=Number.NaN;
export function drawWhaleWaterStudy(ctx:CanvasRenderingContext2D,age:number|undefined){
 if(!water)return false;
 if(!studyFrame||studyFrame.width!==ctx.canvas.width||studyFrame.height!==ctx.canvas.height){studyFrame=document.createElement('canvas');studyFrame.width=ctx.canvas.width;studyFrame.height=ctx.canvas.height;studyAge=Number.NaN;}
 if(age!==studyAge){
  const g=studyFrame.getContext('2d')!;g.fillStyle='#0b1726';g.fillRect(0,0,studyFrame.width,studyFrame.height);
  if(age!==undefined){g.save();g.translate(studyFrame.width/2,studyFrame.height*.81);g.scale(2,2);const e={x:0,y:0,age};water.pool(g,e,'back');water.pool(g,e,'front');g.restore();}
  studyAge=age;
 }
 ctx.drawImage(studyFrame,0,0);return true;
}
