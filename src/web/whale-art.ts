import type {FighterAction,FighterState,MatchConfig,MatchState} from '../core/types.js';
import {motionArt} from './art.js';
import {createUnifiedTornadoRenderer} from '../../assets/角色/防御/大肥鱼/蓝色龙卷风/旋风鲸影_统一渲染_V8.mjs';
import {createUltimateRenderer} from './whale-ultimate.mjs';
import portrait from '../../assets/角色/大招/大肥鱼/开源/演出分层/梁文峰_宽肩修订_V4.png';
import title from '../../assets/角色/大招/大肥鱼/开源/演出分层/开源_递增透视字_透明_V2.png';
import logo from '../../assets/角色/大招/大肥鱼/开源/虎鲸/开源_虎鲸_原图标弯折母版_V2.png';
import calm from '../../assets/角色/大招/大肥鱼/开源/虎鲸/游动凶化_V3/虎鲸_初醒闭口_表情.png';
import alert from '../../assets/角色/大招/大肥鱼/开源/虎鲸/游动凶化_V3/虎鲸_凝视微露齿_表情.png';
import fierce from '../../assets/角色/大招/大肥鱼/开源/虎鲸/游动凶化_V3/虎鲸_凶化露齿_像素母版.png';

let tornado:any,ultimate:any;
const load=(src:string)=>{const im=new Image();im.src=src;return im.decode().then(()=>im)};
function trimmed(im:HTMLImageElement){const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d')!;g.drawImage(im,0,0);const p=g.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=0,y1=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]>100){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}const out=document.createElement('canvas');out.width=x1-x0+1;out.height=y1-y0+1;out.getContext('2d')!.drawImage(c,x0,y0,out.width,out.height,0,0,out.width,out.height);return out;}
void Promise.all(Object.entries({portrait,title,logo,calm,alert,fierce}).map(async([k,v])=>[k,await load(v)] as const)).then(entries=>{
 const images=Object.fromEntries(entries);tornado=createUnifiedTornadoRenderer(trimmed(images.fierce));ultimate=createUltimateRenderer(images);
 let i=0;function warm(){tornado.prewarm(i++);if(i<48)requestAnimationFrame(warm)}requestAnimationFrame(warm);
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
  if(b==='spin'||b==='spin-up'||b==='counter')tornado?.draw(ctx,{x:e.x,y:e.y,visualWindFrames:e.windTicks??20},e.age,layer);
  if(layer==='front'&&b==='rice')riceBlob(ctx,e.x,e.y);
  if(layer==='front'&&b==='orca')ultimate?.draw(ctx,e);
 }
 for(const seat of [0,1] as const){const f=state.fighters[seat],a=config.fighters[seat].actions.find(a=>a.id===f.attack?.id),age=f.attack?.frame??0;
  if(a&&'whale' in a&&a.whale==='spin'&&age<12)tornado?.formation(ctx,{x:f.x,y:f.y},age,layer);
  if(layer==='front'&&a&&'whale' in a&&a.whale==='open-source'&&age>=60&&age<64)ultimate?.portalStart(ctx,f.x+f.facing*95,f.y-90,f.facing,age-60);
  if(layer==='front'&&(f.bindUntil??0)>state.arenaFrame)riceBlob(ctx,f.x,f.y-3,21);
 }
}
export function drawWhaleIntro(ctx:CanvasRenderingContext2D,config:MatchConfig,state:MatchState){
 if(!ultimate)return;
 for(const seat of [0,1] as const){const f=state.fighters[seat];if(config.fighters[seat].id==='whale'&&f.attack?.id==='open-source')ultimate.intro(ctx,ctx.canvas.width,ctx.canvas.height,f.attack.frame);}
}
