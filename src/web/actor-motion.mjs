// Registered authored poses and short silhouette-aligned in-betweens. Combat timing is external.
import {whaleTailPose} from './whale-tail-cleanup.mjs';
const banks=new Map(),cache=new Map();let serial=0;
const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{n=clamp(n);return n*n*(3-2*n)};
export function setActorMotion(kind,source){const b=banks.get(kind)??{legacy:new Map()};Object.assign(b,source);banks.set(kind,b);}
function descriptor(c){
 const g=c.getContext('2d',{willReadFrequently:true}),p=g.getImageData(0,0,256,256).data;
 let top=256,bottom=0;const rows=[];
 for(let y=0;y<256;y++){let l=256,r=-1;for(let x=0;x<256;x++)if(p[(y*256+x)*4+3]>140){l=Math.min(l,x);r=x;}
  rows[y]=[l,r];if(r>=l){top=Math.min(top,y);bottom=Math.max(bottom,y);}}
 let last=[110,145];for(let y=top;y<=bottom;y++){if(rows[y][1]<rows[y][0])rows[y]=last;else last=rows[y];}
 const sole=[];let start=-1;
 for(let x=0;x<=256;x++){
  let on=false;for(let y=Math.max(top,bottom-6);y<=bottom&&x<256;y++)if(p[(y*256+x)*4+3]>140){on=true;break;}
  if(on&&start<0)start=x;if(!on&&start>=0){if(x-start>=3)sole.push((start+x-1)/2);start=-1;}
 }
 // Coherent row envelopes keep neighboring scanlines on the same smooth warp.
 // Raw pixel contours contain one-pixel fingers and outlines that must not be
 // stretched independently into horizontal streaks.
 const bands=[];
 for(let y=top;y<=bottom;y++){
  let l=0,r=0,sum=0;
  for(let dy=-8;dy<=8;dy++){const row=rows[Math.max(top,Math.min(bottom,y+dy))],weight=9-Math.abs(dy);l+=row[0]*weight;r+=row[1]*weight;sum+=weight;}
  bands[y]=[l/sum,r/sum];
 }
 return{canvas:c,pixels:p,id:++serial,top,bottom,rows,bands,sole};
}
export function registerLocomotion(im,kind){
 const cells=[];const w=Math.floor(im.width/4),h=Math.floor(im.height/4);
 let reference=1;
 for(let n=0;n<16;n++){
  const raw=document.createElement('canvas');raw.width=w;raw.height=h;const g=raw.getContext('2d',{willReadFrequently:true});
  g.drawImage(im,n%4*w,Math.floor(n/4)*h,w,h,0,0,w,h);const data=g.getImageData(0,0,w,h);let t=h,b=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const at=(y*w+x)*4,d=data.data;
   const noise=kind==='whale'&&((d[at+2]>200&&d[at]<30&&d[at+1]<30)||(y>h*.5&&Math.abs(d[at]-d[at+1])<6&&Math.abs(d[at+1]-d[at+2])<6&&d[at]>45&&d[at]<175));
   if(d[at+3]<150||noise){d[at+3]=0;continue;}t=Math.min(t,y);b=Math.max(b,y);
  }
  g.putImageData(data,0,0);if(n===0)reference=b-t+1;
  const scale=(kind==='frog'?130:144)/reference,c=document.createElement('canvas');c.width=c.height=256;
  const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;
  ctx.drawImage(raw,128-w*scale/2,236-b*scale,w*scale,h*scale);cells.push(descriptor(c));
 }
 setActorMotion(kind,{loco:cells});return cells;
}
function oldPose(b,kind,index,height=130){
 const key=index+'/'+height;if(b.legacy.has(key))return b.legacy.get(key);
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.imageSmoothingEnabled=true;
 if(kind==='frog'){
  const im=b.moves?.[index];if(!im)return;const w=height*im.width/im.height;g.drawImage(im,128-w/2,236-height,w,height);
 }else{
  if(!b.sheet?.naturalWidth)return;
  const cleaned=whaleTailPose(b.sheet,index);
  const size=b.sheet.naturalWidth/4;
  if(cleaned)g.drawImage(cleaned,20,52);else g.drawImage(b.sheet,index%4*size,Math.floor(index/4)*size,size,size,20,52,216,216);
 }
 const pose=descriptor(c);b.legacy.set(key,pose);return pose;
}
function soleNear(d,x){return d.sole.reduce((a,b)=>Math.abs(b-x)<Math.abs(a-x)?b:a,d.sole[0]??128);}
// The up-swing folds a very tall tail back into the body. Per-row width warps
// stretch isolated outline pixels into comb-like streaks at this large change.
// Fit one intact authored pose to the interpolated bounds instead.
function intactTween(a,b,t){
 if(!a||!b)return a?.canvas??b?.canvas;t=Math.round(clamp(t)*6)/6;
 if(t===0||a===b)return a.canvas;if(t===1)return b.canvas;
 const key='intact/'+a.id+'/'+b.id+'/'+t;if(cache.has(key))return cache.get(key);
 const bounds=d=>{const rows=d.rows.slice(d.top,d.bottom+1);return{left:Math.min(...rows.map(r=>r[0])),right:Math.max(...rows.map(r=>r[1])),top:d.top,bottom:d.bottom};};
 const ar=bounds(a),br=bounds(b),source=t<.5?a:b,sr=t<.5?ar:br;
 const x=ar.left+(br.left-ar.left)*t,y=ar.top+(br.top-ar.top)*t;
 const w=ar.right-ar.left+1+(br.right-br.left-ar.right+ar.left)*t,h=ar.bottom-ar.top+1+(br.bottom-br.top-ar.bottom+ar.top)*t;
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.imageSmoothingEnabled=true;
 g.drawImage(source.canvas,sr.left,sr.top,sr.right-sr.left+1,sr.bottom-sr.top+1,Math.round(x),Math.round(y),Math.round(w),Math.round(h));
 if(cache.size>180)cache.delete(cache.keys().next().value);cache.set(key,c);return c;
}
function tween(a,b,t,foot,coherent=false){
 if(!a||!b)return a?.canvas??b?.canvas;t=Math.round(clamp(t)*6)/6;
 if(foot===undefined&&(t===0||a===b))return a.canvas;if(foot===undefined&&t===1)return b.canvas;
 const key=a.id+'/'+b.id+'/'+t+'/'+(foot===undefined?'':Math.round(foot))+'/'+coherent;if(cache.has(key))return cache.get(key);
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.imageSmoothingEnabled=true;
 const top=a.top+(b.top-a.top)*t,bottom=a.bottom+(b.bottom-a.bottom)*t;
 const sa=soleNear(a,foot??128),sb=soleNear(b,foot??128),pin=foot===undefined?0:foot-(sa+(sb-sa)*t);
 const data=g.createImageData(256,256),out=data.data;
 for(let y=Math.ceil(top);y<=Math.min(255,Math.floor(bottom));y++){
  const v=clamp((y-top)/Math.max(1,bottom-top));
  const ya=Math.min(a.bottom,Math.round(a.top+v*(a.bottom-a.top))),yb=Math.min(b.bottom,Math.round(b.top+v*(b.bottom-b.top)));
  const ar=(coherent?a.bands:a.rows)[ya],br=(coherent?b.bands:b.rows)[yb],left=ar[0]+(br[0]-ar[0])*t,right=ar[1]+(br[1]-ar[1])*t;
  const shift=pin*ease((y-(bottom-42))/42);
  for(let x=coherent?0:Math.max(0,Math.ceil(left+shift));x<=(coherent?255:Math.min(255,Math.floor(right+shift)));x++){
   const rawU=(x-left-shift)/Math.max(1,right-left),u=coherent?rawU:clamp(rawU);
   const ax=Math.round(ar[0]+u*(ar[1]-ar[0])),bx=Math.round(br[0]+u*(br[1]-br[0]));
   const ai=(ya*256+ax)*4,bi=(yb*256+bx)*4,at=(y*256+x)*4;
   // One authored texture per in-between: keep eyes, hands and tail crisp,
   // while the registered silhouette moves continuously. No translucent double bodies.
   const pixels=t<.5?a.pixels:b.pixels,source=t<.5?ai:bi;
   const sx=t<.5?ax:bx;if(sx<0||sx>255)continue;
   out[at+3]=pixels[source+3];
   for(let channel=0;channel<3;channel++)out[at+channel]=pixels[source+channel];
  }
 }
 g.putImageData(data,0,0);
 if(foot!==undefined){
  const measured=descriptor(c),correction=foot-soleNear(measured,foot);
  if(Math.abs(correction)>.5){const copy=document.createElement('canvas');copy.width=copy.height=256;copy.getContext('2d').drawImage(c,0,0);
   g.clearRect(0,0,256,256);g.globalAlpha=1;g.globalCompositeOperation='source-over';
   for(let y=0;y<256;y+=2)g.drawImage(copy,0,y,256,2,correction*ease((y-(bottom-42))/42),y,256,2);
  }
 }
 if(cache.size>180)cache.delete(cache.keys().next().value);cache.set(key,c);return c;
}
function still(p){return{a:p,b:p,t:0};}
export function walkFootX(phase,stride){return stride/4-(((phase%4)+4)%4)*stride/8;}
function walk(b,s,kind){
 const phase=((s.phase%8)+8)%8,i=Math.floor(phase),t=phase-i,stride=kind==='frog'?126:74;
 return{a:b.loco[i+1],b:b.loco[(i+1)%8+1],t,foot:128+walkFootX(phase,stride)};
}
function attack(b,kind,s,actions){
 const action=actions.find(a=>a.id===s.attackId);if(!action)return still(b.loco[0]);
 const frame=s.attackFrame??0;
 if(kind==='whale'){
  const keys=action.animation??[],end=action.startup+action.active+action.recovery;
  for(let i=keys.length-1;i>=0;i--)if(frame>=keys[i].frame){const next=keys[i+1];return{a:oldPose(b,kind,keys[i].cell),b:oldPose(b,kind,next?.cell??77),intact:s.attackId==='common-finish'&&frame>=12,t:next?(frame-keys[i].frame)/(next.frame-keys[i].frame):clamp((frame-keys[i].frame)/(end-keys[i].frame))};}
  return still(oldPose(b,kind,77));
 }
 const stage=['common-jab','common-sweep','frog-left-kick','frog-ha','common-finish'].indexOf(s.attackId),cell=stage<0?3:stage+1;
 const hit=oldPose(b,kind,cell,cell===5?100:130),idle=oldPose(b,kind,0);
 if(frame<action.startup-2)return{a:idle,b:b.loco[9],t:.35*ease(frame/Math.max(1,action.startup-2))};
 if(frame<action.startup)return{a:idle,b:hit,t:ease((frame-action.startup+2)/2)};
 if(frame<action.startup+action.active)return still(hit);
 return{a:hit,b:idle,t:ease((frame-action.startup-action.active+1)/Math.max(1,action.recovery-2))};
}
function plan(b,kind,s,actions){
 if(s.mode.startsWith('attack:'))return attack(b,kind,s,actions);
 if(s.mode==='walk')return walk(b,s,kind);
 if(s.mode==='brake')return{a:b.loco[9],b:b.loco[0],t:ease(s.eventAge/7)};
 if(s.mode==='land'){
  if(s.moving){const moving=walk(b,s,kind);return s.eventAge<3?{a:b.loco[15],b:descriptorCached(renderPlan(moving,kind)),t:ease(s.eventAge/3)}:moving;}
  return s.eventAge<5?{a:b.loco[15],b:b.loco[9],t:ease(s.eventAge/5)}:{a:b.loco[9],b:b.loco[0],t:ease((s.eventAge-5)/5)};
 }
 if(s.mode==='air'){
  if(s.event==='jump'&&s.eventAge<5)return{a:b.loco[12],b:b.loco[13],t:ease(s.eventAge/4),dy:16*clamp(1-s.eventAge/2)};
  if(s.vy< -2)return{a:b.loco[13],b:b.loco[14],t:clamp(s.eventAge/10)};
  return{a:b.loco[14],b:b.loco[13],t:clamp((s.vy+2)/12)};
 }
 if(s.mode==='hurt'){
  const hurt=kind==='frog'?b.hurt?.[s.event==='heavy'?1:0]:oldPose(b,kind,s.event==='heavy'?53:52);
  return{a:hurt??b.loco[9],b:b.loco[0],t:s.stun>5?0:ease((5-s.stun)/5)};
 }
 return still(kind==='frog'?oldPose(b,kind,0):oldPose(b,kind,77));
}
const renderPlan=(p,kind)=>p.intact?intactTween(p.a,p.b,p.t):tween(p.a,p.b,p.t,p.foot,kind==='frog');
export function drawActorMotion(g,kind,f,state,action,actions){
 const b=banks.get(kind),v=f.motionVisual;if(!b?.loco||!v)return false;
 const s=v.stamp;
 if(s.mode==='special'||s.mode==='guard'||f.dashActive||f.dash)return false;
 if(f.attack&&action?.slot!=='A')return false;
 let p=plan(b,kind,s,actions),im=renderPlan(p,kind);if(!im)return false;
 const age=state.arenaFrame-v.changed;
 if(s.mode==='idle'&&age>=8&&state.arenaFrame-v.turnTick>=6)return false;
 if(v.from&&age<3&&!['hurt','land'].includes(s.mode)&&!v.from.mode.includes('special')&&v.from.mode!=='guard'){
  const from=renderPlan(plan(b,kind,v.from,actions),kind);if(from)im=tween(descriptorCached(from),descriptorCached(im),ease((age+1)/3),undefined,kind==='frog');
 }
 const turn=state.arenaFrame-v.turnTick;
 g.save();g.imageSmoothingEnabled=true;
 if(turn<6&&['idle','walk','brake'].includes(s.mode)){
  const front=b.loco[kind==='frog'?11:10];
  if(turn<2){g.scale(v.turnFrom/f.facing,1);im=tween(descriptorCached(im),front,ease((turn+1)/2),undefined,kind==='frog');}
  else if(turn<4)im=front.canvas;
  else im=tween(front,descriptorCached(im),ease((turn-3)/3),undefined,kind==='frog');
 }
 g.drawImage(im,-128,-236+(p.dy??0));g.restore();return true;
}
const descriptions=new WeakMap();function descriptorCached(im){let d=descriptions.get(im);if(!d){d=descriptor(im);descriptions.set(im,d);}return d;}
export function setFrogHurtPoses(images){const b=banks.get('frog')??{legacy:new Map()};b.hurt=images.map((im,i)=>{
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.imageSmoothingEnabled=true;const h=i?113:130,w=h*im.width/im.height;g.drawImage(im,128-w/2,236-h,w,h);return descriptor(c);
 });banks.set('frog',b);}
