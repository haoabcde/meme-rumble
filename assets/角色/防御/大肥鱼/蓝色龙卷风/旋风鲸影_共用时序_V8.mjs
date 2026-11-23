import {sampleCounterWhale} from './虎鲸顶端张口_渲染_V7.mjs';
export const TORNADO_TIMING=Object.freeze({turn:12,wind:20,whaleHoldAfterWind:12,whaleFade:16,whaleTotal:48});
const clamp=n=>Math.max(0,Math.min(1,n));
export function sampleTornadoVisual(age,windFrames=TORNADO_TIMING.wind){
  const wind=age>=0&&age<windFrames?{alpha:Math.min(1,(age+1)/2,(windFrames-age)/4),grow:.78+.22*clamp(age/2)}:null;
  // Preserve a full 28-frame afterwind period, even for a longer moving storm.
  const mapped=age<=windFrames?age*TORNADO_TIMING.wind/windFrames:TORNADO_TIMING.wind+age-windFrames;
  return {wind,whale:age<0?null:sampleCounterWhale(mapped)};
}
