import type {FighterAction,FighterState,MatchConfig,MatchState} from '../core/types.js';
import {frogPowered} from '../core/frog-kit.js';
import {cutGrid} from './pixel-sprites.mjs';
import {drawPixelFx} from './pixel-fx.mjs';
import moveSource from '../../assets/角色/技能/奶娃/拳脚与捧腹_八姿态.png';
import goldSource from '../../assets/角色/特效/奶蛙/金色符文_V1/星芒_法环_螺旋_星轨.png';
import travelSource from '../../assets/角色/常态/奶蛙/移动与悬浮_八帧_V1.png';
import angelSource from '../../assets/角色/大招/奶娃/神了/天使_四姿态.png';
import introSource from '../../assets/角色/大招/奶娃/神了/神性指尖_演出像素关键帧.png';
let moves:HTMLCanvasElement[]=[],angels:HTMLCanvasElement[]=[],travel:HTMLCanvasElement[]=[],gold:HTMLCanvasElement[]=[],intro:HTMLImageElement;
const load=(src:string)=>{const im=new Image();im.src=src;return im.decode().then(()=>im)};
void Promise.all([load(moveSource),load(angelSource),load(introSource),load(travelSource),load(goldSource)]).then(([m,a,i,t,v])=>{moves=cutGrid(m,4,2);angels=cutGrid(a,2,2);travel=cutGrid(t,4,2);gold=cutGrid(v,2,2);intro=i;});
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
function actorImage(g:CanvasRenderingContext2D,im:HTMLCanvasElement,h:number,y=0){const w=h*im.width/im.height;g.drawImage(im,-w/2,y-h,w,h);}
function goldMotif(g:CanvasRenderingContext2D,index:number,x:number,y:number,w:number,alpha:number,angle=0,squash=1){
 const im=gold[index];if(!im||alpha<=0)return;
 g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=alpha;g.translate(x,y);g.rotate(angle);g.scale(1,squash);g.drawImage(im,-w/2,-w*im.height/im.width/2,w,w*im.height/im.width);g.restore();
}
function whiteFeather(g:CanvasRenderingContext2D,x:number,y:number,angle:number,alpha:number,size=1){
 g.save();g.globalAlpha*=alpha;g.translate(Math.round(x),Math.round(y));g.rotate(angle);g.scale(size,size);
 g.fillStyle='#dce6f2';g.fillRect(-3,-9,4,15);g.fillRect(-5,-6,8,10);
 g.fillStyle='#ffffff';g.fillRect(-3,-8,4,12);g.fillRect(-5,-5,4,7);g.fillRect(1,-4,3,7);
 g.fillStyle='#f5f9ff';g.fillRect(-1,-10,2,21);g.restore();
}
function holyColumn(g:CanvasRenderingContext2D,f:FighterState,seconds:number,config:MatchConfig){
 const alpha=clamp((seconds-.25)/.2)*clamp((2.78-seconds)/.4);if(!alpha)return;
 // World-space column reaches above the entire map; the sun is kept at its original 1.65x position.
 const top=-config.arena.height-400,bottom=f.y+8;
 g.save();g.globalAlpha*=alpha;const glow=g.createLinearGradient(f.x-130,0,f.x+130,0);
 glow.addColorStop(0,'#ffcc5500');glow.addColorStop(.3,'#ffdb6b55');glow.addColorStop(.5,'#fff4c9aa');glow.addColorStop(.7,'#ffdb6b55');glow.addColorStop(1,'#ffcc5500');
 g.fillStyle=glow;g.fillRect(f.x-130,top,260,bottom-top);
 for(let i=-3;i<=3;i++){const x=Math.round((f.x+i*19+Math.sin(seconds*2+i)*4)/3)*3;
  g.globalAlpha=alpha*(i===0?.7:.25);g.fillStyle=i===0?'#fffce8':'#ffe7a0';g.fillRect(x-3,top,i===0?9:3,bottom-top);}
 g.restore();
}
function shockRing(g:CanvasRenderingContext2D,x:number,y:number,r:number,t:number,powered:boolean,layer:'back'|'front'){
 if(t<0||t>20)return;
 const p=clamp((t+1)/12),fade=clamp((20-t)/14),from=layer==='back'?Math.PI:0;
 g.save();g.translate(x,y);g.globalAlpha*=fade;
 for(const [offset,width,color,alpha]of [[0,powered?15:8,'#ffd87c',.25],[-4,3,'#fff3cf',.95],[5,2,'#ffce64',.65]] as const){
  g.globalAlpha=fade*alpha;g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.arc(0,0,Math.max(3,r*p+offset),from,from+Math.PI);g.stroke();
 }g.restore();
}
export function drawFrogActor(g:CanvasRenderingContext2D,f:FighterState,state:MatchState,action?:FighterAction){
 if(!moves.length)return;
 const frame=f.attack?.frame??0,powered=frogPowered(f,state),a=action&&'frog' in action?action.frog:undefined;
 const stage=['common-jab','common-sweep','frog-left-kick','frog-ha','common-finish'].indexOf(action?.id??'');
 let pose=f.guarding?7:a==='laugh'||a==='global'?6:stage>=0?stage+1:action?.id==='common-air'?3:0;
 const h=pose===5?100:130,evAge=state.arenaFrame-(f.poseEvent?.tick??-999);
 g.save();g.imageSmoothingEnabled=false;
 if(!f.hp||f.recovery?.phase==='down'){g.translate(0,-20);g.rotate(-1.25);}
 else if(f.recovery?.phase==='fall')g.rotate(-.2);
 else if(f.hitstun)g.rotate(-.07);
 if(powered){
  const y=-18+Math.sin(state.arenaFrame*.1)*3;
  // The sacred idle silhouette stays identical through every empowered attack.
  if(f.moving&&!action&&!f.hitstun&&!f.recovery&&travel.length){g.rotate(.035);actorImage(g,travel[4+Math.floor(state.arenaFrame/8)%4],164,y);}
  else actorImage(g,angels[0],164,y);
 }else{
  if(f.moving&&pose===0){g.translate(0,-Math.abs(Math.sin(state.arenaFrame*.4))*4);g.rotate(Math.sin(state.arenaFrame*.4)*.025);}
  if(a==='laugh'||a==='global'){g.rotate(Math.sin(frame*.8)*.035);g.scale(1+Math.sin(frame*.8)*.018,1-Math.sin(frame*.8)*.018);}
  if(stage>=0&&action){const anticipation=clamp(frame/action.startup);if(frame<action.startup){pose=0;g.rotate((stage%2?1:-1)*anticipation*.09);g.scale(1+anticipation*.025,1-anticipation*.06);}}
  if(f.dashActive){g.save();g.globalAlpha=.18;actorImage(g,moves[0],130,-3);g.restore();g.translate(18,0);}
  if(f.moving&&f.ground&&pose===0&&!action&&travel.length){actorImage(g,travel[Math.floor(state.arenaFrame/6)%4],130);}
  else actorImage(g,moves[pose],h);
 }
 g.restore();
}
export function drawFrogEffects(g:CanvasRenderingContext2D,state:MatchState,config:MatchConfig,layer:'back'|'front'){
 for(const seat of [0,1] as const){
  if(config.fighters[seat].id!=='frog')continue;
  const f=state.fighters[seat],a=config.fighters[seat].actions.find(a=>a.id===f.attack?.id),frame=f.attack?.frame??-999,power=frogPowered(f,state),scale=power?1.5:1;
  if(power&&f.moving&&!f.attack&&layer==='back')for(let i=0;i<4;i++){
   const p=((state.arenaFrame+i*8)%32)/32;
   whiteFeather(g,f.x-f.facing*(60+p*100),f.y-70-i*8+p*30,Math.sin(p*5+i)*.5,.75*Math.sin(p*Math.PI),.85+i*.05);
  }
  if(power)drawPixelFx(g,'halo',f.x,f.y-72,(state.arenaFrame%120)/60,2.4,layer,true,.44);
  const reveal=f.ascendVisual;
  if(reveal){
   const seconds=(state.arenaFrame-reveal.tick)/60;
   if(layer==='back')holyColumn(g,f,seconds,config);
   drawPixelFx(g,'pillar',f.x,f.y,seconds,1.65,layer,true,1);
   drawPixelFx(g,'feather',f.x,f.y-95,seconds-.66,1.6,layer,true,.85);
  }
  drawCastEffects(g,f,state,config,layer);
  if(a&&'frog' in a&&(a.frog==='laugh'||a.frog==='global')){
   if(frame<a.startup&&layer==='back'){
    g.save();g.globalAlpha=.35*frame/a.startup;g.strokeStyle='#ffe4a1';g.lineWidth=3;g.beginPath();g.arc(f.x,f.y-65,30+25*frame/a.startup,0,Math.PI*2);g.stroke();g.restore();
   }
  }
  if(!power&&a?.id==='frog-ha'&&frame>=3&&frame<19)drawPixelFx(g,'burst',f.x,f.y-65+28*scale, .22+(frame-3)/60*3,scale,layer,true,.8);
  if(!power&&a?.id==='common-finish'&&frame>=4&&frame<21){g.save();g.translate(f.x,f.y-25);g.scale(f.facing,1);g.rotate(.8);drawPixelFx(g,'uppercut',0,0,(frame-4)/60*2,1.25*scale,layer,true,.62);g.restore();}
  const target=state.fighters[seat===0?1:0],hitAge=state.arenaFrame-(target.poseEvent?.tick??-999);
  const laughing=a&&'frog' in a&&(a.frog==='laugh'||a.frog==='global');
  if(!laughing&&power&&layer==='front'&&['hurt','heavy','launch'].includes(target.poseEvent?.kind??'')&&hitAge<10)goldMotif(g,0,target.x,target.y-65,105+hitAge*3,.65*clamp((10-hitAge)/8),.12);
  if(!laughing&&layer==='front'&&['hurt','heavy','launch'].includes(target.poseEvent?.kind??'')&&hitAge<14)drawPixelFx(g,power?'spark':'blunt',target.x,target.y-30,hitAge/60*2,power?1.65:1.25,layer,true,.65);
 }
}
export function drawFrogIntro(g:CanvasRenderingContext2D,config:MatchConfig,state:MatchState){
 if(!intro)return;
 for(const seat of [0,1] as const){const f=state.fighters[seat];if(config.fighters[seat].id!=='frog'||f.attack?.id!=='frog-ascend')continue;
  const phase=f.attack.frame;if(phase>=60)continue;
  const alpha=clamp((phase+1)/6)*clamp((60-phase)/8),zoom=1.02+phase/60*.025;
  g.save();g.scale(g.canvas.width/1280,g.canvas.height/720);g.globalAlpha*=alpha;g.fillStyle='#432613';g.fillRect(0,0,1280,720);
  g.save();g.translate(640,360);g.scale(zoom,zoom);g.drawImage(intro,-640,-426,1280,853);g.restore();
  drawPixelFx(g,'rays',640,720,phase/60*3,4,'front',true,.33);
  g.restore();
 }
}

/** Persist the library's natural decay across attack cancels and hit reactions. */
function drawCastEffects(g:CanvasRenderingContext2D,f:FighterState,state:MatchState,config:MatchConfig,layer:'back'|'front'){
 for(const c of f.frogCasts??[]){
  const age=state.arenaFrame-c.tick;
  if(c.id==='frog-laugh'||c.id==='frog-laugh-global'){
   const global=c.id==='frog-laugh-global',envelope=clamp(age/12)*clamp((65-age)/25);
   const radius=global?config.arena.right-config.arena.left+config.arena.height:240*(c.powered?2:1);
   if(c.powered&&layer==='back')goldMotif(g,1,c.x,c.y-65,Math.min(global?960:radius*2,200+age*19),.36*envelope,age*.022);
   for(const at of global?[32]:[16,26,36]){
    const point=c.anchors?.find(a=>a.frame===at)??c;
    shockRing(g,point.x,point.y-65,radius,age-at,c.powered,layer);
   }
   if(c.powered&&layer==='front'&&age>=36&&age<76)for(let i=0;i<4;i++){
    const p=(age-36)/40;whiteFeather(g,c.x+(i-1.5)*(30+p*40),c.y-60-p*50+i*8,Math.sin(p*4+i),Math.sin(p*Math.PI)*.55,.8);
   }
   continue;
  }
  const stage=['common-jab','common-sweep','frog-left-kick','frog-ha','common-finish'].indexOf(c.id);
  if(stage<0&&c.id!=='common-air')continue;
  const t=(age-c.startup)/60;
  g.save();g.translate(c.x,c.y);g.scale(c.facing,1);
  if(stage===0||stage===1){
   g.save();g.translate(10,stage===0?-51:-43);g.rotate(stage===0?-.12:.1);
   drawPixelFx(g,'thrust',0,0,t+.07,c.powered?1.85:1.22,layer,true,c.powered?.9:.62);g.restore();
  }
  if(stage===2||c.id==='common-air'){
   g.save();g.translate(27,-18);g.rotate(.7);drawPixelFx(g,'uppercut',0,0,t+.08,c.powered?1.7:1.15,layer,true,.72);g.restore();
  }
  if(c.powered){
   if(stage===3){
    const e=clamp((t+.06)*15)*clamp((.65-t)*3);
    if(layer==='front')goldMotif(g,3,0,-75,180,.4*e,t*.3);
    drawPixelFx(g,'sun',0,-75,Math.max(0,t),2.1,layer,true,.8*e);
    drawPixelFx(g,'burst',0,-23,t+.22,1.5,layer,true,.75);
   }else if(stage===4){
    drawPixelFx(g,'smite',155,0,t+.54,1.1,layer,true,.85);
    g.save();g.translate(30,-20);g.rotate(.8);drawPixelFx(g,'uppercut',0,0,t+.08,1.9,layer,true,.85);g.restore();
   }else if(t>=0&&t<.5){
    drawPixelFx(g,'sun',105,-70,t,1.05,layer,true,.6*clamp((.5-t)*4));
   }
  }
  g.restore();
 }
}

export function frogGoldFrame(index:number){return gold[index];}
