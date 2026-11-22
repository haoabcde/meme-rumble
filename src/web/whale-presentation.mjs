const clamp=n=>Math.max(0,Math.min(1,n));
export function orbitAngle(age){
 return -2.7+clamp(age/48)*1.05*Math.PI*2;
}
export function orbitSample(age,windTicks=20,moving=false){
 const phase=moving?age%48:age,p=clamp(phase/48),angle=orbitAngle(phase);
 return{angle,p,depth:Math.sin(angle),fade:Math.min(clamp(phase/3),clamp((48-phase)/16),clamp((windTicks+28-age)/16))};
}
export const ERUPTIONS=Object.freeze([
 {at:0,degrees:-26,width:220,offset:-56},{at:4,degrees:17,width:135,offset:42},
 {at:13,degrees:-11,width:170,offset:-18},{at:19,degrees:28,width:115,offset:68},
 {at:27,degrees:-23,width:260,offset:-42},{at:34,degrees:6,width:150,offset:20},
 {at:40,degrees:22,width:190,offset:52},{at:48,degrees:-18,width:125,offset:-64},
 {at:55,degrees:13,width:235,offset:24},{at:63,degrees:-29,width:145,offset:-31},
 {at:70,degrees:10,width:165,offset:44},{at:77,degrees:0,width:620,offset:0}
]);
/** Presentation only: attack ticks remain twelve equal seven-tick windows in the core. */
export function eruptionSample(age,index){
 const spec=ERUPTIONS[index],a=spec.degrees*Math.PI/180,speed=index===11?49:33+(index*7%11);
 const distance=speed*(Math.max(0,age)-5*(1-Math.exp(-Math.max(0,age)/5)));
 const sway=index===11?0:Math.sin(age*.19+index)*6*clamp(age/10);
 const pose=clamp(age/8)*2.7+.12*Math.sin(age*.3);
 return{...spec,age,x:spec.offset+Math.sin(a)*distance+Math.cos(a)*sway,
  y:spec.width*.42-Math.cos(a)*distance,angle:-Math.PI/2+a,pose:Math.max(0,pose),
  rotation:-Math.PI/2+a+Math.min(.9,Math.max(0,pose)*.3),alpha:clamp(age/3),speed};
}
