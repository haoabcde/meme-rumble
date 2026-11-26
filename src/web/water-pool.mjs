// A shared footprint constrains the water surface, all openings and the final ground waves.
export const POOL={rx:150,ry:42};
export function poolCutY(x,depth){
 const u=Math.max(-1,Math.min(1,x/POOL.rx));
 return -POOL.ry+(1+depth)*POOL.ry*Math.sqrt(Math.max(0,1-u*u));
}
export function poolMouth(spec){
 const y=poolCutY(spec.offset,spec.depth),edge=POOL.rx*Math.sqrt(Math.max(0,1-(y/POOL.ry)**2));
 return{x:spec.offset,y,width:Math.min(spec.width>500?222:115,Math.max(20,(edge-Math.abs(spec.offset))*1.76))};
}
export function clipFootprint(g,x,y){
 g.beginPath();g.ellipse(x,y,POOL.rx,POOL.ry,0,0,Math.PI*2);g.clip();
}
export function clipEmergence(g,x,y,depth){
 // Above the water anything can fly out. At the waterline the mask is curved, not a plane.
 g.beginPath();g.moveTo(x-2600,y-4600);g.lineTo(x+2600,y-4600);g.lineTo(x+2600,y-POOL.ry);
 for(let i=48;i>=0;i--){const xx=-POOL.rx+2*POOL.rx*i/48;g.lineTo(x+xx,y+poolCutY(xx,depth));}
 g.lineTo(x-2600,y-POOL.ry);g.closePath();g.clip();
}
