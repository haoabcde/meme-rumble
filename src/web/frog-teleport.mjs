// Reference-authored seal and flowing strands follow the actual simulation endpoints.
let seal,ribbon;
const clamp=n=>Math.max(0,Math.min(1,n));
export function setTeleportArt(parts){[seal,ribbon]=parts;}
export function teleportPoint(w,u){
 const x=w.fromX+(w.toX-w.fromX)*u,y=w.fromY-70+(w.toY-w.fromY)*u;
 return{x,y:y-Math.sin(u*Math.PI)*Math.min(70,Math.hypot(w.toX-w.fromX,w.toY-w.fromY)*.13)};
}
export function teleportWindow(age){return{head:clamp(age/6),tail:clamp((age-6)/23),alpha:clamp((age+1)/2)*clamp((32-age)/15)};}
export function drawTeleport(g,w,age,layer){
 if(!w.powered||layer!=='back'||age<0||age>32||!seal||!ribbon)return;
 const {head,tail,alpha}=teleportWindow(age);
 g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=alpha;
 // Texture strips bend with the flight curve, rather than a straight rigid beam.
 const strips=44;
 for(let i=0;i<strips;i++){
  const a=Math.max(tail,i/strips),b=Math.min(head,(i+1)/strips);if(b<=a)continue;
  const p=teleportPoint(w,a),q=teleportPoint(w,b),len=Math.hypot(q.x-p.x,q.y-p.y);
  if(len<.01)continue;
  g.save();g.translate(p.x,p.y);g.rotate(Math.atan2(q.y-p.y,q.x-p.x));
  const height=35+14*Math.sin((a+b)*Math.PI/2);
  g.drawImage(ribbon,a*ribbon.width,0,(b-a)*ribbon.width,ribbon.height,0,-height/2,len+1.2,height);g.restore();
 }
 const bloom=clamp((age+1)/6),size=174*(.68+.32*Math.sin(bloom*Math.PI/2))*(1+.035*Math.sin(age*.3));
 g.translate(w.toX,w.toY-70);
 g.globalAlpha*=clamp((age+2)/5);
 g.drawImage(seal,-size/2,-size/2,size,size);
 g.restore();
}
