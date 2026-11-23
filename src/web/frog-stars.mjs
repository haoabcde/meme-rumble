let star;
const TAU=Math.PI*2;
export function setStarArt(im){
 // Sample an authored luminous star core; the connections are independently depth sorted.
 const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');
 const w=im.width*.15;g.drawImage(im,im.width*.28-w/2,im.height*.34-w/2,w,w,0,0,96,96);
 g.globalCompositeOperation='destination-in';const mask=g.createRadialGradient(48,48,15,48,48,48);
 mask.addColorStop(0,'#fff');mask.addColorStop(.6,'#ffff');mask.addColorStop(1,'#fff0');g.fillStyle=mask;g.fillRect(0,0,96,96);star=c;
}
const heights=[-60,-21,27,-42,25,-57,32,-13,3];
const links=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,0],[0,3],[1,4],[2,5],[3,6],[4,7],[5,8]];
export function starCage(tick){
 return heights.map((h,i)=>{const a=i/9*TAU+tick*.015;return{x:Math.cos(a)*125,y:-85+h+Math.sin(a)*23,z:Math.sin(a)};});
}
export function drawHeldStars(g,x,y,tick,layer){
 if(!star)return;const front=layer==='front',nodes=starCage(tick);
 g.save();g.translate(x,y);g.lineWidth=front?1.7:1.2;g.strokeStyle=front?'#fff0bd':'#e8cb8b';
 for(const [ia,ib]of links){
  let a=nodes[ia],b=nodes[ib];
  if((a.z>0)===(b.z>0)){if((a.z>0)!==front)continue;}
  else{const t=-a.z/(b.z-a.z),mid={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:0};if((a.z>0)===front)b=mid;else a=mid;}
  g.globalAlpha=front?.8:.42;g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
 }
 for(let i=0;i<nodes.length;i++){
  const p=nodes[i];if((p.z>0)!==front)continue;
  const w=(i%3===0?44:34)*(1+p.z*.12);g.globalAlpha=(front?.98:.58)*( .9+.1*Math.sin(tick*.08+i));
  g.drawImage(star,p.x-w/2,p.y-w/2,w,w);
 }g.restore();
}
