import type {FighterAction,FighterState,MatchConfig,MatchState} from '../core/types.js';
import {motionArt} from './art.js';
import {createUnifiedTornadoRenderer} from '../../assets/角色/防御/大肥鱼/蓝色龙卷风/旋风鲸影_统一渲染_V8.mjs';
import {createUltimateRenderer} from './whale-ultimate.mjs';
import portrait from '../../assets/角色/大招/大肥鱼/开源/演出分层/梁文峰_宽肩修订_V4.png';
import {createWaterRenderer} from './whale-water.mjs';
import whaleTurn from '../../assets/角色/特效/大肥鱼/水鲸动作_V2/水鲸_八方向张嘴.png';
import whaleLeap from '../../assets/角色/特效/大肥鱼/水鲸动作_V2/水鲸_抬头张嘴跃出_八帧.png';
import waterWhale from '../../assets/角色/特效/大肥鱼/水鲸符文_V1/水鲸_四姿态.png';
import waterParts from '../../assets/角色/特效/大肥鱼/水鲸符文_V1/水潭_水花_小鱼_花.png';
import runeParts from '../../assets/角色/特效/大肥鱼/水鲸符文_V1/符文_弧光_冲刺_上升_星芒.png';

let tornado:any,ultimate:any,water:any;
const load=(src:string)=>{const im=new Image();im.src=src;return im.decode().then(()=>im)};

void Promise.all(Object.entries({portrait,waterWhale,waterParts,runeParts,whaleTurn,whaleLeap}).map(async([k,v])=>[k,await load(v)] as const)).then(entries=>{
 const images=Object.fromEntries(entries);water=createWaterRenderer(images);tornado=createUnifiedTornadoRenderer(water.whales[0]);ultimate=createUltimateRenderer(images);
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
export function drawWhaleActor(ctx:CanvasRenderingContext2D,f:FighterState,state:MatchState,seat:0|1,action?:FighterAction){
 const sheet=motionArt.whale;if(!sheet?.naturalWidth)return;
 let cell=whaleCell(f,state,seat,action);
 if(action&&'whale' in action&&(action.whale==='spin'||action.whale==='counter')){
  const age=f.attack?.frame??0;if(age<(action.whale==='counter'?20:12))return;
 }
 if(f.dashActive){ctx.save();ctx.globalAlpha*=.15;for(const x of [-30,-60])ctx.drawImage(sheet,51%4*216,Math.floor(51/4)*216,216,216,x-108,-184,216,216);ctx.restore();}
 ctx.drawImage(sheet,cell%4*216,Math.floor(cell/4)*216,216,216,-108,-184,216,216);
 if(action&&'whale' in action&&action.whale==='spin-up'&&f.attack){const age=f.attack.frame,blend=age<6?age/6:age<14?1:Math.max(0,(22-age)/8);ctx.save();ctx.globalAlpha*=1-blend;ctx.drawImage(sheet,77%4*216,Math.floor(77/4)*216,216,216,-108,-184,216,216);ctx.restore();}
}
function riceBlob(ctx:CanvasRenderingContext2D,x:number,y:number,r=14){
 ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.fillStyle='#798da8';ctx.beginPath();ctx.ellipse(0,0,r,r*.56,0,0,Math.PI*2);ctx.fill();
 for(let i=0;i<17;i++){const a=i*2.399,rr=Math.sqrt(i/17)*r*.8;ctx.fillStyle=i%4?'#f8fbff':'#dce9f4';ctx.fillRect(Math.round(Math.cos(a)*rr/2)*2-3,Math.round((Math.sin(a)*rr*.5-3)/2)*2,5,3);}
 ctx.restore();
}
export function drawWhaleEntities(ctx:CanvasRenderingContext2D,state:MatchState,config:MatchConfig,layer:'back'|'front'){
 for(const e of state.entities??[]){const b=e.definition.behavior;if(!b)continue;
  if(b==='spin'||b==='spin-up'||b==='counter'){tornado?.wind(ctx,e.x,e.y,e.age,layer,e.windTicks??20);water?.orbit(ctx,e,layer);}
  if(layer==='front'&&b==='rice')riceBlob(ctx,e.x,e.y);
  if(b==='pool')water?.pool(ctx,e,layer);
 }
 for(const seat of [0,1] as const){const f=state.fighters[seat],a=config.fighters[seat].actions.find(a=>a.id===f.attack?.id),age=f.attack?.frame??0;
  if(a&&'whale' in a&&a.whale==='spin'&&age<12)tornado?.formation(ctx,{x:f.x,y:f.y},age,layer);
  if(config.fighters[seat].id==='whale')water?.motion(ctx,f,state,a,layer);
  if(layer==='front'&&(f.bindUntil??0)>state.arenaFrame)riceBlob(ctx,f.x,f.y-3,21);
 }
}
export function drawWhaleIntro(ctx:CanvasRenderingContext2D,config:MatchConfig,state:MatchState){
 if(!ultimate)return;
 for(const seat of [0,1] as const){const f=state.fighters[seat];if(config.fighters[seat].id==='whale'&&f.attack?.id==='open-source')ultimate.intro(ctx,ctx.canvas.width,ctx.canvas.height,f.attack.frame);}
}
