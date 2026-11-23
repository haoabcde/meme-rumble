// Authored reference-derived spell textures; projected floor discs stay horizontal.
let spirals=[],discs=[];
export function setWarpArt(swirl,disc){spirals=swirl;discs=disc;}
const clamp=n=>Math.max(0,Math.min(1,n));
export function drawWarp(g,x,y,age,powered,layer,disc=false){
 if(age<0||age>38)return;
 const im=(disc?discs:spirals)[powered?1:0];if(!im)return;
 const fade=clamp((age+1)/3)*clamp((38-age)/18),grow=disc?.78+.22*clamp(age/5):1-.48*clamp(age/30);
 const w=(powered?disc?245:205:disc?180:158)*grow,h=w*im.height/im.width;
 g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=fade*(powered?.98:.46);g.translate(x,y);
 g.beginPath();g.rect(-w,layer==='back'?-h:0,w*2,h);g.clip();
 if(disc){g.scale(1,.94+Math.sin(age*.22)*.06);g.drawImage(im,-w/2,-h/2,w,h);}
 else{g.rotate(-age*.105);g.scale(1+.035*Math.sin(age*.6),1+.035*Math.cos(age*.6));g.drawImage(im,-w/2,-h/2,w,h);}
 if(powered){g.globalCompositeOperation='screen';g.globalAlpha*=.34;g.drawImage(im,-w*.52,-h*.52,w*1.04,h*1.04);}
 g.restore();
}
