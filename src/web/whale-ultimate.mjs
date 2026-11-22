import {drawPixelFx} from './pixel-fx.mjs';
// The portrait is centered; native library bursts supply depth and impact.
export function createUltimateRenderer(images){
 const clamp=x=>Math.max(0,Math.min(1,x));
 return{intro(g,w,h,phase){
  if(phase>=60)return;
  const alpha=clamp((phase+1)/5)*clamp((60-phase)/9),p=1-Math.pow(1-clamp(phase/13),3);
  g.save();g.scale(w/1280,h/720);g.globalAlpha=alpha;g.globalCompositeOperation='source-over';g.filter='none';
  const bg=g.createRadialGradient(640,335,50,640,370,740);bg.addColorStop(0,'#214d79');bg.addColorStop(.48,'#0c2447');bg.addColorStop(1,'#02091b');g.fillStyle=bg;g.fillRect(0,0,1280,720);
  drawPixelFx(g,'burst',640,570,.12+phase/60*.75,6.1,'both','blue',.62);
  drawPixelFx(g,'thunder',640,580,.08+phase/60*.7,4.8,'both','blue',.72);
  drawPixelFx(g,'wave',640,720,.65+phase/60*2.15,5,'both','blue',.6);
  const ph=650*(.96+.04*p),pw=ph*images.portrait.width/images.portrait.height;
  g.drawImage(images.portrait,640-pw/2,70+(1-p)*38,pw,ph);
  g.restore();
 }};
}
