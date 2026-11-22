import {createFrame,createFx,composite} from '../../assets/特效库/PixelFX/src/core/index.js';
import * as blunt from '../../assets/特效库/PixelFX/src/fx/impacts/blunt-hit.js';
import * as burst from '../../assets/特效库/PixelFX/src/fx/arcane/mana-burst.js';
import * as uppercut from '../../assets/特效库/PixelFX/src/fx/melee/uppercut.js';
import * as pillar from '../../assets/特效库/PixelFX/src/fx/holy/holy-pillar.js';
import * as halo from '../../assets/特效库/PixelFX/src/fx/holy/halo.js';
import * as feather from '../../assets/特效库/PixelFX/src/fx/holy/feather-burst.js';
import * as rays from '../../assets/特效库/PixelFX/src/fx/weather/god-rays.js';
import * as thrust from '../../assets/特效库/PixelFX/src/fx/melee/thrust.js';
import * as spark from '../../assets/特效库/PixelFX/src/fx/impacts/hit-spark.js';
import * as smite from '../../assets/特效库/PixelFX/src/fx/holy/smite.js';
import * as sun from '../../assets/特效库/PixelFX/src/fx/holy/sunburst.js';
export const selectedEffects={blunt,burst,uppercut,pillar,halo,feather,rays,thrust,spark,smite,sun};
export const GOLD=['#342032','#75402e','#b46c26','#e6a53a','#ffcf62','#ffeaa4','#fff8d8','#ffffff'];
const stores=new Map();
export function pixelFrame(name,seconds,layer='both',gold=false){
 const mod=selectedEffects[name],meta=mod.meta,fps=30;
 if(seconds<0||!meta.loop&&seconds>meta.duration)return null;
 const tick=Math.floor((meta.loop?seconds%meta.duration:seconds)*fps),key=name+'/'+layer+'/'+gold;
 let store=stores.get(key);
 function reset(){const f=createFrame(...meta.size);return{f,fx:createFx({...mod,meta:{...meta,actor:false}},{x:meta.origin[0],y:meta.origin[1],...(gold?{palette:GOLD}:{}),seed:7}),tick:0,frames:new Map()};}
 if(!store){store=reset();stores.set(key,store);}
 if(store.frames.has(tick))return store.frames.get(tick);
 if(tick<store.tick){const cached=store.frames;store=reset();store.frames=cached;stores.set(key,store);}
 while(store.tick<tick){store.fx.update(1/fps);store.tick++;}
 store.f.color.fill(0);store.f.light.fill(0);store.fx.draw(store.f,layer==='both'?undefined:layer);
 const bytes=new Uint8ClampedArray(store.f.w*store.f.h*4);composite(store.f,bytes,null,1);
 const c=document.createElement('canvas');c.width=store.f.w;c.height=store.f.h;c.getContext('2d').putImageData(new ImageData(bytes,c.width,c.height),0,0);
 if(store.frames.size>180)store.frames.delete(store.frames.keys().next().value);store.frames.set(tick,c);return c;
}
export function drawPixelFx(g,name,x,y,seconds,scale=1,layer='both',gold=true,alpha=1){
 const im=pixelFrame(name,seconds,layer,gold);if(!im)return;
 const o=selectedEffects[name].meta.origin;
 g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=alpha;g.translate(x,y);g.scale(scale,scale);g.drawImage(im,-o[0],-o[1]);g.restore();
}
