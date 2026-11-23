const clamp=n=>Math.max(0,Math.min(1,n));
// Only presentation samples between simulation ticks; pause/seek/hitstop remain exact.
export function waterSubframe(fraction,freeze=0,cinematic=false){
 return freeze||cinematic?0:clamp(Number.isFinite(fraction)?fraction:0);
}
export function orbitAngle(age){
 return -2.7+clamp(age/48)*1.05*Math.PI*2;
}
export function orbitSample(age,windTicks=20,moving=false){
 const phase=moving?age%48:age,p=clamp(phase/48),angle=orbitAngle(phase);
 return{angle,p,depth:Math.sin(angle),fade:Math.min(clamp(phase/3),clamp((48-phase)/16),clamp((windTicks+28-age)/16))};
}
export const ERUPTIONS=Object.freeze([
 {at:0,degrees:-26,width:220,offset:-56,depth:-.46},{at:4,degrees:17,width:135,offset:42,depth:.35},
 {at:13,degrees:-11,width:170,offset:-18,depth:.02},{at:19,degrees:28,width:115,offset:68,depth:-.24},
 {at:27,degrees:-23,width:260,offset:-42,depth:.37},{at:34,degrees:6,width:150,offset:20,depth:-.52},
 {at:40,degrees:22,width:190,offset:52,depth:.12},{at:48,degrees:-18,width:125,offset:-64,depth:-.30},
 {at:55,degrees:13,width:235,offset:24,depth:.43},{at:63,degrees:-29,width:145,offset:-31,depth:-.48},
 {at:70,degrees:10,width:165,offset:44,depth:.28},{at:77,degrees:0,width:620,offset:0,depth:0}
]);
/** Presentation only: attack ticks remain twelve equal seven-tick windows in the core. */
export function eruptionSample(age,index){
 const spec=ERUPTIONS[index],a=spec.degrees*Math.PI/180,speed=index===11?49:33+(index*7%11);
 const distance=speed*(Math.max(0,age)-5*(1-Math.exp(-Math.max(0,age)/5)));
 const sway=index===11?0:Math.sin(age*.19+index)*24*clamp(age/10);
 const pose=2.4*(1-Math.exp(-Math.max(0,age)/6))+.55*Math.sin(age*.32+index*.7)*clamp(age/10);
 const yaw=Math.sin(age*.23+index*.7)*(index===11?.075:.16)*clamp(age/8);
 const width=spec.width*(1+spec.depth*.2);
 return{...spec,width,age,x:spec.offset+Math.sin(a)*distance+Math.cos(a)*sway,
  y:width*.42-Math.cos(a)*distance,angle:-Math.PI/2+a+(index===11?0:yaw),pose:Math.max(0,pose),
  rotation:-Math.PI/2+a+yaw+Math.min(.9,Math.max(0,pose)*.3),alpha:clamp(age/3),speed};
}
