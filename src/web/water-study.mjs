// Candidate composition only: native PixelFX water textures plus the authored V11 water sheets.
import {drawPixelFx} from './pixel-fx.mjs';
import {POOL,clipFootprint,clipEmergence} from './water-pool.mjs';
const clamp=n=>Math.max(0,Math.min(1,n));
export function studySurface(g,e,age,fade,texture){
 g.save();clipFootprint(g,e.x,e.y);
 // A gently scalloped wet boundary, contained in the shared gameplay footprint.
 g.beginPath();
 for(let i=0;i<=96;i++){
  const a=i/96*Math.PI*2,r=.965+.018*Math.sin(a*7+age*.045)+.012*Math.sin(a*13-age*.03);
  const x=e.x+Math.cos(a)*POOL.rx*r,y=e.y+Math.sin(a)*POOL.ry*r;
  if(!i)g.moveTo(x,y);else g.lineTo(x,y);
 }
 g.closePath();g.clip();
 // A shallow translucent water skin beneath the foam, with small travelling ripples.
 // Avoid the previous opaque radial-gradient plate and its uniformly raised rim.
 g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=fade*.52;
 const strips=32;
 for(let i=0;i<strips;i++){
  const u=(i+.5)/strips,dy=Math.sin(age*.11-u*10)*1.1;
  g.drawImage(texture,i*texture.width/strips,0,texture.width/strips+1,texture.height,
   e.x-POOL.rx+i/strips*POOL.rx*2,e.y-POOL.ry+dy,POOL.rx*2/strips+1,POOL.ry*2);
 }
 g.restore();
 // Keep the field shallow and translucent; the native moving foam gives it material.
 g.translate(e.x,e.y);g.scale(POOL.rx/60,POOL.ry/36);
 drawPixelFx(g,'whirlpool',0,0,age/60,1,'both','ice',fade*.6);
 g.restore();
}
export function studyBreach(g,e,spec,mouth,age,front,fade,patch,parts){
 if(age< -7||age>52)return;
 const last=spec.width>500,x=e.x+mouth.x,y=e.y+mouth.y,w=mouth.width;
 const opening=clamp((age+7)/9),alpha=clamp((52-age)/20)*fade;
 if(age<0){if(!front)patch(g,parts[3],x,y-w*.12*opening,w*(.3+.6*opening),w*.3*opening,alpha*.65);return;}
 g.save();clipEmergence(g,e.x,e.y,spec.depth);
 // All water roots are in the pool. Airborne whales may continue beyond it.
 g.beginPath();g.rect(e.x-POOL.rx,e.y-1500,POOL.rx*2,1500+POOL.ry);g.clip();
 const h=(last?202:105)*(.65+.35*clamp(age/6));
 if(!front){
  patch(g,parts[6],x,y-h*.43,w*.96,h,alpha*.96);
  patch(g,parts[4],x-w*.21,y-h*.42,w*.6,h*.92,alpha*.82);
 }else{
  patch(g,parts[5],x+w*.2,y-h*.29,w*.57,h*.69,alpha*.9);
 }
 // A curling lip with a dark underside breaks into actual ballistic spray and foamy lace.
 // Opposing wave normals open outward around the whale, not a single luminous ring.
 const time=.58+age/60*2.3,scale=w/(front?218:240);
 for(const sign of [-1,1]){
  g.save();g.translate(x+sign*w*.16,y+(front?3:-4));g.scale(sign,front?.93:1.2);
  drawPixelFx(g,'wave',0,0,time+(front?.13:0),scale,front?'front':'both','ice',alpha*(front?.95:.8));g.restore();
 }
 g.restore();
}
