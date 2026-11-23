import {Rng,ease,seg,smooth} from '../../assets/特效库/PixelFX/src/core/index.js';

// Match the library pillar's seven seeded shafts and opening/folding rhythm in world space.
// The sun remains in the original unscaled pillar; only the moving fan reaches above the map.
const rng=new Rng(7),mid=3;
const shafts=Array.from({length:7},(_,i)=>{
 const off=i-mid,far=Math.abs(off)/mid;
 return{th:off*(.4/mid)+rng.range(-.02,.02),spread:rng.range(.05,.085)*(1-far*.25),b:(1-far*.35)*rng.range(.8,1),ph:rng.range(0,1),far};
});
export function holyFanSample(seconds,footY,mapHeight){
 const top=-mapHeight-400,span=footY-top;
 const alpha=smooth(.3,.4,seconds)*(1-smooth(2.7,2.8,seconds));
 return{alpha,shafts:shafts.map(s=>{
  const open=ease.outBack(seg(seconds,.3+s.far*.1,.72+s.far*.1),1.5);
  const fold=ease.inOutCubic(seg(seconds,2.05-s.far*.1,2.45));
  const angle=(s.th*open+.006*Math.sin(seconds*3+s.ph*6.28))*(1-fold);
  const front=span*(1-ease.inQuad(seg(seconds,.3+s.far*.06,.66+s.far*.06)));
  const lift=span*ease.inQuad(seg(seconds,2.5,2.75));
  const bottom=footY-Math.max(front,lift),shut=1-.75*smooth(2.45,2.75,seconds);
  return{top,bottom,topX:Math.tan(angle)*span,bottomX:Math.tan(angle)*(footY-bottom),
   topWidth:(2.3+span*s.spread)*shut,bottomWidth:(2.3+(footY-bottom)*s.spread)*shut,
   brightness:s.b*(.8+.2*Math.sin(seconds*7+s.ph*6.28))};
 })};
}
