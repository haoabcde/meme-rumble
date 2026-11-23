import {tornado,createFrame,createFx,composite} from './蓝色龙卷风_加宽漏斗渲染_V3.mjs';
import {createWhaleVolumeRenderer} from './虎鲸顶端张口_渲染_V7.mjs';
import {TORNADO_TIMING,sampleTornadoVisual} from './旋风鲸影_共用时序_V8.mjs';
const blue={palette:['#06152c','#102c50','#16497f','#226db3','#3598df','#75cff1','#c0eeff','#f4fcff'],
  dust:['#152436','#2a3e52','#48627c','#88aabd','#d3e9f0'],leaves:['#213149','#4b6582','#8cb6d2','#d2ecff'],height:212,seed:4};
const clamp=n=>Math.max(0,Math.min(1,n));
export function createUnifiedTornadoRenderer(image){
  const cache=new Map(),volume=createWhaleVolumeRenderer(image);
  function frame(age,layer){
    const phase=Math.floor(age)%TORNADO_TIMING.turn,key=phase+'/'+layer;if(cache.has(key))return cache.get(key);
    const f=createFrame(320,300),fx=createFx(tornado,{...blue,x:160,y:275});
    fx.update(phase/TORNADO_TIMING.turn*tornado.meta.duration);fx.draw(f,layer);
    const bytes=new Uint8ClampedArray(f.w*f.h*4);composite(f,bytes,null,1);
    const c=document.createElement('canvas');c.width=f.w;c.height=f.h;c.getContext('2d').putImageData(new ImageData(bytes,f.w,f.h),0,0);cache.set(key,c);return c;
  }
  function wind(ctx,x,y,age,layer,duration=TORNADO_TIMING.wind){
    const v=sampleTornadoVisual(age,duration).wind;if(!v)return;
    ctx.save();ctx.translate(x,y);ctx.scale(v.grow*1.07,v.grow*1.07);ctx.globalAlpha*=v.alpha;
    ctx.drawImage(frame(age,layer),-448,-308,896,336);ctx.restore();
  }
  function whale(ctx,x,y,age,layer,duration=TORNADO_TIMING.wind){
    const v=sampleTornadoVisual(age,duration).whale;if(!v)return;
    ctx.save();ctx.translate(x,y);ctx.scale(1.07,1.07);volume.draw(ctx,v.progress,layer,.9*v.alpha,true);ctx.restore();
  }
  return {volume,wind,whale,
    prewarm(age){if(age<TORNADO_TIMING.turn)for(const layer of ['back','front'])frame(age,layer);const v=sampleTornadoVisual(age).whale;if(v)volume.render(v.progress,true);},
    formation(ctx,origin,age,layer){
      if(age<0||age>=16)return;ctx.save();ctx.translate(origin.x,origin.y);ctx.scale(1.07,1.07);
      ctx.globalAlpha*=clamp((age+1)/2)*clamp((16-age)/4);ctx.drawImage(frame(age,layer),-448,-308,896,336);ctx.restore();
    },
    draw(ctx,storm,age,layer){
      if(!storm)return;const duration=storm.visualWindFrames??TORNADO_TIMING.wind;
      if(layer==='back')whale(ctx,storm.x,storm.y,age,layer,duration);
      wind(ctx,storm.x,storm.y,age,layer,duration);
      if(layer==='front')whale(ctx,storm.x,storm.y,age,layer,duration);
    }
  };
}
