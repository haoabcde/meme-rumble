import type {FighterAction,FighterState,MatchConfig,MatchState} from '../core/types.js';
import {frogPowered} from '../core/frog-kit.js';
import {cutGrid} from './pixel-sprites.mjs';
import {drawPixelFx} from './pixel-fx.mjs';
import moveSource from '../../assets/角色/技能/奶娃/拳脚与捧腹_八姿态.png';
import angelSource from '../../assets/角色/大招/奶娃/神了/天使_四姿态.png';
import introSource from '../../assets/角色/大招/奶娃/神了/神性指尖_演出像素关键帧.png';
let moves:HTMLCanvasElement[]=[],angels:HTMLCanvasElement[]=[],intro:HTMLImageElement;
const load=(src:string)=>{const im=new Image();im.src=src;return im.decode().then(()=>im)};
void Promise.all([load(moveSource),load(angelSource),load(introSource)]).then(([m,a,i])=>{moves=cutGrid(m,4,2);angels=cutGrid(a,2,2);intro=i;});
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
function actorImage(g:CanvasRenderingContext2D,im:HTMLCanvasElement,h:number,y=0){const w=h*im.width/im.height;g.drawImage(im,-w/2,y-h,w,h);}
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
  actorImage(g,angels[0],164,y);
 }else{
  if(f.moving&&pose===0){g.translate(0,-Math.abs(Math.sin(state.arenaFrame*.4))*4);g.rotate(Math.sin(state.arenaFrame*.4)*.025);}
  if(a==='laugh'||a==='global'){g.rotate(Math.sin(frame*.8)*.035);g.scale(1+Math.sin(frame*.8)*.018,1-Math.sin(frame*.8)*.018);}
  if(stage>=0&&action){const anticipation=clamp(frame/action.startup);if(frame<action.startup){pose=0;g.rotate((stage%2?1:-1)*anticipation*.09);g.scale(1+anticipation*.025,1-anticipation*.06);}}
  if(f.dashActive){g.save();g.globalAlpha=.18;actorImage(g,moves[0],130,-3);g.restore();g.translate(18,0);}
  actorImage(g,moves[pose],h);
 }
 g.restore();
}
export function drawFrogEffects(g:CanvasRenderingContext2D,state:MatchState,config:MatchConfig,layer:'back'|'front'){
 for(const seat of [0,1] as const){
  if(config.fighters[seat].id!=='frog')continue;
  const f=state.fighters[seat],a=config.fighters[seat].actions.find(a=>a.id===f.attack?.id),frame=f.attack?.frame??-999,power=frogPowered(f,state),scale=power?1.5:1;
  if(power)drawPixelFx(g,'halo',f.x,f.y-72,(state.arenaFrame%120)/60,2.4,layer,true,.44);
  const reveal=f.ascendVisual;
  if(reveal){
   const seconds=(state.arenaFrame-reveal.tick)/60;
   drawPixelFx(g,'pillar',reveal.x,reveal.y,seconds,1.65,layer,true,.9);
   drawPixelFx(g,'feather',reveal.x,reveal.y-95,seconds-.66,1.6,layer,true,.85);
  }
  drawCastEffects(g,f,state,layer);
  if(a&&'frog' in a&&(a.frog==='laugh'||a.frog==='global')){
   const starts=a.frog==='global'?[32]:[16,26,36];
   if(frame<a.startup&&layer==='back'){
    g.save();g.globalAlpha=.35*frame/a.startup;g.strokeStyle='#ffe4a1';g.lineWidth=3;g.beginPath();g.arc(f.x,f.y-65,30+25*frame/a.startup,0,Math.PI*2);g.stroke();g.restore();
   }
   for(const start of starts){const t=frame-start;if(t<0||t>20)continue;
    const k=a.frog==='global'?3:240/90*scale;
    drawPixelFx(g,'burst',f.x,f.y-65+28*k,.22+t/60*3,k,layer,true,.7);
    if(a.frog==='global'&&layer==='front'){
     const r=(config.arena.right-config.arena.left+config.arena.height)*clamp((t+1)/12);
     g.save();g.globalAlpha=clamp((20-t)/18)*.65;g.strokeStyle='#ffe5a8';g.lineWidth=9;g.beginPath();g.arc(f.x,f.y-65,r,0,Math.PI*2);g.stroke();g.restore();
    }
   }
  }
  if(!power&&a?.id==='frog-ha'&&frame>=3&&frame<19)drawPixelFx(g,'burst',f.x,f.y-65+28*scale, .22+(frame-3)/60*3,scale,layer,true,.8);
  if(!power&&a?.id==='common-finish'&&frame>=4&&frame<21){g.save();g.translate(f.x,f.y-25);g.scale(f.facing,1);g.rotate(.8);drawPixelFx(g,'uppercut',0,0,(frame-4)/60*2,1.25*scale,layer,true,.62);g.restore();}
  const target=state.fighters[seat===0?1:0],hitAge=state.arenaFrame-(target.poseEvent?.tick??-999);
  if(layer==='front'&&['hurt','heavy','launch'].includes(target.poseEvent?.kind??'')&&hitAge<14)drawPixelFx(g,power?'spark':'blunt',target.x,target.y-30,hitAge/60*2,power?1.65:1.25,layer,true,.65);
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
function drawCastEffects(g:CanvasRenderingContext2D,f:FighterState,state:MatchState,layer:'back'|'front'){
 for(const c of f.frogCasts??[]){
  const age=state.arenaFrame-c.tick;
  if(c.id==='frog-laugh'||c.id==='frog-laugh-global'){
   if(!c.powered)continue; // The approved normal laugh remains unchanged.
   const envelope=clamp(age/12)*clamp((100-age)/50);
   drawPixelFx(g,'sun',c.x,c.y-80,age/60,4.7,layer,true,.36*envelope);
   const strikes=c.id==='frog-laugh-global'?[[32,0]]:[[16,0],[36,-230],[36,230]];
   for(const [at,dx]of strikes){const t=.54+(age-at)/60;if(t<.25)continue;drawPixelFx(g,'smite',c.x+dx,c.y,t,1.12,layer,true,.72);}
   if(age>=36)drawPixelFx(g,'feather',c.x,c.y-90,(age-36)/60,2.3,layer,true,.55);
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
