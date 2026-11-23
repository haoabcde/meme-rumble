// A constellation stays behind the disappearing body; the arrival web lies under the feet.
// Whole star nodes keep their depth instead of cutting a bright core across a clipping plane.
let stars;
export function setStarArt(image){stars=image;}
const clamp=n=>Math.max(0,Math.min(1,n));
export function drawWarp(g,x,y,age,powered,layer,ground=false){
 if(!stars||layer!=='back'||age<0||age>42)return;
 const fade=clamp((age+1)/3)*clamp((42-age)/20);
 const grow=ground?.76+.24*clamp(age/7):1-.3*clamp(age/34);
 const w=(powered?ground?275:230:ground?205:178)*grow;
 const h=w*stars.height/stars.width*(ground?.55:1);
 g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=fade*(powered?1:.48);g.translate(x,y);
 const breath=1+Math.sin(age*.25)*.018;g.scale(breath,breath);
 g.drawImage(stars,-w/2,-h/2,w,h);
 if(powered){g.globalCompositeOperation='screen';g.globalAlpha*=.18+.1*Math.sin(age*.3)**2;g.drawImage(stars,-w/2,-h/2,w,h);}
 g.restore();
}
