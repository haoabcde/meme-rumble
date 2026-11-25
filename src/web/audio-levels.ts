// Active-sample RMS targets in dBFS, before user master/category volume controls.
export const SOUND_LEVELS=Object.freeze({movement:-32,swing:-29,hit:-26,skill:-23,powered:-20,ultimate:-17,finale:-14});
type Tier=keyof typeof SOUND_LEVELS;
const tiers:Record<string,Tier>={
 'tail-voice-1':'skill','tail-voice-2':'skill','tail-voice-3':'skill','ultimate-voice':'finale','eat-voice':'hit',
 'holy-combo-1':'powered','holy-combo-2':'powered','holy-combo-3':'powered','holy-combo-4':'powered','holy-combo-5':'powered','holy-melee-hit':'powered',
 'event-jump':'movement','event-air-jump':'movement','event-land':'movement','event-dash':'movement',eat:'movement',
 'tail-swing':'swing','melee-swing':'swing','tail-hit':'hit','melee-hit':'hit','event-block':'hit','event-break':'hit','event-knockdown':'hit',
 'rice-throw':'skill','rice-hit':'skill',wind:'skill',wave:'skill','wave-hit':'skill','global-wave':'skill',teleport:'skill','event-parry':'skill',
 laugh:'skill',ha:'skill','skill2-1':'skill','skill2-2':'skill','skill2-3':'skill','skill2-4':'skill',
 'holy-hit':'powered','holy-wave':'powered','ultimate-bgm':'ultimate',summon:'ultimate','pool-warning':'skill','water-hit':'powered','pool-breach':'ultimate','pool-final':'finale'
};
export function soundTarget(clip:string){const tier=tiers[clip];return tier===undefined?undefined:SOUND_LEVELS[tier];}
export function sampleLevel(channels:readonly Float32Array[]){
 let peak=0;for(const data of channels)for(const sample of data)peak=Math.max(peak,Math.abs(sample));
 let energy=0,count=0;const floor=peak*.08;
 for(const data of channels)for(const sample of data)if(Math.abs(sample)>floor){energy+=sample*sample;count++;}
 return{peak,rms:count?Math.sqrt(energy/count):0};
}
export function calibratedGain(stats:{peak:number;rms:number},target:number){
 if(stats.rms<1e-6||stats.peak<1e-6)return 1;
 // Keep each clip below -3 dBFS peak, and avoid lifting low-level noise more than 12 dB.
 return Math.min(4,10**(target/20)/stats.rms,10**(-3/20)/stats.peak);
}
