const clamp=n=>Math.max(0,Math.min(1,n));
export function orbitAngle(age,windTicks=20,moving=false){
 return -2.7+(moving?age/24:clamp(age/(windTicks+28))*1.05)*Math.PI*2;
}
export function leapSample(age,index){
 const p=clamp(age/48),rise=clamp(p/.34),fall=clamp((p-.54)/.46);
 const height=p<.34?1-Math.pow(1-rise,3):p<.54?1-.025*Math.sin((p-.34)/.2*Math.PI):1-fall*fall;
 const pose=p<.34?rise*3:p<.54?3+(p-.34)/.2*.8:3.8+fall*3.19;
 const rank=Math.floor(index/4);
 return{p,height,pose,width:176+rank*34,peak:230+rank*35,alpha:clamp(age/3)*clamp((48-age)/10)};
}
