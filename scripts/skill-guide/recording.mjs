import {createMatch,step} from '../../src/core/match.ts';
import {NEUTRAL} from '../../src/core/types.ts';
import {roster} from '../../src/content/roster.ts';
import {arenas} from '../../src/content/arenas.ts';
import {rules} from '../../src/content/demo.ts';
import {Renderer} from '../../src/web/renderer.ts';
import {FightAudio} from '../../src/web/audio.ts';
import {cinematicOwner} from '../../src/core/whale-kit.ts';
import {skills,characters} from './catalog.mjs';
const hq=new URLSearchParams(location.search).has('hq');
document.title=hq?'两角色技能高清逐帧导出':'大肥鱼与奶蛙技能素材录制';
document.body.innerHTML='<main><h1>两角色技能短片录制</h1><p>正式内核与正式渲染，余晖货港，正常速度。录制后自动保存到本机素材包，不改游戏规则。</p><canvas id="arena" width="1280" height="720"></canvas><p><button id="all">录制全部技能</button> <select id="pick" aria-label="选择技能"></select> <button id="one">录制所选技能</button></p><p id="status" role="status">素材准备中…</p><ol id="list"></ol></main>';
const style=document.createElement('style');style.textContent='body{margin:0;background:#101822;color:#e3edf7;font:15px/1.6 Microsoft YaHei}main{max-width:1280px;margin:16px auto;padding:0 16px}canvas{width:100%;display:block;image-rendering:pixelated}button,select{background:#203b53;color:white;padding:10px;border:1px solid #66859b}li{color:#a6bace}';document.head.append(style);
const $=s=>document.querySelector(s),canvas=$('#arena');
// Draw the same game in a closer 960×540 view at a true 2× backing resolution.
// All vector effects are rasterized at 1920×1080; sprite pixels stay sharp.
let renderCanvas=canvas;
if(hq){
 canvas.width=1920;canvas.height=1080;
 const actual=canvas.getContext('2d',{alpha:false}),virtual={width:960,height:540};
 const context=new Proxy(actual,{get(target,key){
  if(key==='canvas')return virtual;
  if(key==='resetTransform')return()=>target.setTransform(2,0,0,2,0,0);
  if(key==='setTransform')return(...args)=>{const a=args.length===1?args[0]:{a:args[0],b:args[1],c:args[2],d:args[3],e:args[4],f:args[5]};target.setTransform(a.a*2,a.b*2,a.c*2,a.d*2,a.e*2,a.f*2);};
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 },set(target,key,value){Reflect.set(target,key,value,target);return true;}});
 renderCanvas={...virtual,getContext:()=>context};
 $('h1').textContent='两角色技能高清逐帧导出';$('main>p').textContent='复用已定稿动画源；1920×1080清晰近景，每个逻辑帧直接输出PNG，再一次编码。保持60帧正常速度，声音复用实机录制。';
 $('#all').textContent='导出全部高清技能';$('#one').textContent='导出所选高清技能';
}
const renderer=new Renderer(renderCanvas,arenas[2]),audio=new FightAudio();
for(const s of skills){const o=document.createElement('option');o.value=s.id;o.textContent=characters.find(c=>c.id===s.character).name+' · '+s.name;$('#pick').append(o);const li=document.createElement('li');li.id=s.id;li.textContent=o.textContent;$('#list').append(li);}
let state,config,scene,sent,comboSent,scriptTick=0,calls=0,running=false,last=0,clock=0,recorder,chunks=[],stream,audioTrack,recordStart=0,draws=0,intervals=[],eventsSeen=[],queue=[];
const input=(pressed=[],x=0,y=0,held=[])=>({x,y,pressed,held});
function setup(s){
 scene=s;sent=new Set();comboSent=new Set();scriptTick=0;calls=0;eventsSeen=[];draws=0;intervals=[];last=0;clock=0;
 const actor=roster.find(r=>r.fighter.id===s.character),enemy=roster.find(r=>r.fighter.id==='banana');
 config={rules,training:true,arena:arenas[2],fighters:[actor.fighter,enemy.fighter],randomSeed:s.scenario==='eat'?1:123456789};
 state=createMatch(config);state.phase='fight';state.phaseTicks=0;
 const sc=s.scenario,powered=sc.startsWith('power-'),distance=['rice','rice-ultimate'].includes(sc)?300:sc==='ground-rice'?600:sc==='rice-up'?180:sc==='tornado'?450:sc==='tornado-up'?350:sc==='ultimate'&&s.character==='whale'?330:sc==='global'||sc==='power-global'?480:['burrow','power-burrow','power-dodge'].includes(sc)?260:95;
 Object.assign(state.fighters[0],{x:1850,y:config.arena.floor,ground:'floor',facing:1,energy:300});
 Object.assign(state.fighters[1],{x:1850+distance,y:config.arena.floor,ground:'floor',facing:-1});
 if(powered){state.fighters[0].ascendUntil=sc==='power-end'?80:2000;}
 renderer.load(config.arena);audio.stopAll();audio.configure([actor.audio,enemy.audio],__FIGHTER_AUDIO__);draw();
}
function trigger(at,key,y=0,x=0){const tag=at+'/'+key;if(scriptTick>=at&&!sent.has(tag)){sent.add(tag);return input([key],x,y);}return null;}
function controls(){
 let a=NEUTRAL,b=NEUTRAL;if(state.freeze||cinematicOwner(state)!==undefined)return[a,b];
 const s=scene.scenario,f=state.fighters[0],enemy=state.fighters[1];
 if(s==='combo'||s==='power-combo'){
  a=trigger(12,'A')??a;
  if(f.attack){const action=config.fighters[0].actions.find(a=>a.id===f.attack.id);if(action?.chainAfter!==undefined&&f.attack.frame>=action.chainAfter&&!comboSent.has(action.id)){comboSent.add(action.id);a=input(['A']);}}
 }
 if(s==='air'){a=trigger(8,'jump')??trigger(24,'A')??a;b=trigger(9,'jump')??b;}
 if(s==='guard'||s==='normal-guard'){if(scriptTick>=8&&scriptTick<160)a=input([],0,1);b=trigger(38,'A')??b;}
 if(s==='rice'||s==='ground-rice'||s==='eat')a=trigger(12,'B')??a;
 if(s==='ground-rice'&&scriptTick>=60&&scriptTick<100&&(enemy.bindUntil??0)<=state.arenaFrame)b=input([],-1);
 if(s==='rice-up'){b=trigger(8,'jump')??b;a=trigger(22,'B',-1)??a;}
 if(s==='tornado'||s==='tornado-up')a=trigger(12,'C',s==='tornado-up'?-1:0)??a;
 if(s==='ultimate')a=trigger(12,'ULT')??a;
 if(s==='rice-ultimate'){a=trigger(12,'B')??a;if((enemy.bindUntil??0)>state.arenaFrame&&f.energy===300)a=trigger(0,'ULT')??a;}
 if(s==='laugh'||s==='global'||s==='power-global')a=trigger(12,'B',s.includes('global')?-1:0)??a;
 if(s==='power-laugh'){a=trigger(8,'jump')??trigger(25,'B')??a;b=trigger(8,'jump')??b;}
 if(s==='counter'||s==='power-counter'){
  if(scriptTick>=8&&scriptTick<95)a=input([],0,0,['C']);
  const start=trigger(8,'C');if(start)a={...start,held:['C']};
  b=trigger(38,'A')??b;
 }
 if(s==='burrow'||s==='power-burrow')a=trigger(12,'C',-1)??a;
 if(s==='power-dodge')a=trigger(12,'dash',0,1)??a;
 scriptTick++;return[a,b];
}
function draw(){if(!state)return;renderer.draw(config,state,false,1/60,!hq,hq,0,hq?0:clock/(1000/60));}
function advance(sound){const events=step(state,controls(),config);renderer.add(events,state.arenaFrame);if(sound)audio.update(config,state,events);for(const e of events)if(['hit','parry','ultimate','block','swing'].includes(e.kind))eventsSeen.push({tick:calls,kind:e.kind,action:e.actionId,source:e.source,damage:e.amount});calls++;}
async function beginHQ(s){
 setup(s);$('#status').textContent='高清导出 '+s.name;
 let result=await fetch('/hd/start?id='+s.id,{method:'POST'});if(!result.ok)throw Error(await result.text());
 const count=Math.round(s.seconds*60);let packet=[];
 for(let n=0;n<count;n++){
  advance(false);draw();
  const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
  packet.push(blob);
  if(packet.length===4||n===count-1){result=await fetch('/hd/frame?id='+s.id+'&n='+(n-packet.length+1)+'&count='+packet.length,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:new Blob(packet)});if(!result.ok)throw Error(await result.text());packet=[];}
  if(n%20===0)$('#status').textContent='高清导出 '+s.name+' · '+n+'/'+count+' 帧';
 }
 const stats={id:s.id,frames:count,width:1920,height:1080,virtualWidth:960,virtualHeight:540,logicalFps:60,seconds:s.seconds,speed:1,method:'逐帧PNG直出，H.264 QP16单次编码，复用原实机音轨',events:eventsSeen};
 result=await fetch('/hd/end?id='+s.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(stats)});if(!result.ok)throw Error(await result.text());
 document.getElementById(s.id).textContent='高清已导出 · '+s.name+' · '+count+'帧';
}
async function begin(s){
 setup(s);chunks=[];recordStart=performance.now();
 stream=new MediaStream([...canvas.captureStream(60).getVideoTracks(),...audioTrack.stream.getAudioTracks()]);
 const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
 recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3500000,audioBitsPerSecond:128000});
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onstop=async()=>{
  running=false;audio.stopAll();stream.getVideoTracks().forEach(t=>t.stop());
  const elapsed=(performance.now()-recordStart)/1000,sorted=[...intervals].sort((a,b)=>a-b);
  const stats={id:s.id,frames:draws,wallSeconds:elapsed,fps:draws/elapsed,p95Ms:sorted[Math.floor(sorted.length*.95)],width:1280,height:720,speed:1,audio:true,simulationCalls:calls,events:eventsSeen};
  $('#status').textContent='保存 '+s.name+'…';
  const result=await fetch('/capture?id='+encodeURIComponent(s.id),{method:'POST',headers:{'Content-Type':mime,'X-Capture-Metrics':encodeURIComponent(JSON.stringify(stats))},body:new Blob(chunks,{type:mime})});
  if(!result.ok){$('#status').textContent='保存失败，请重试本段';queue=[];return;}
  document.getElementById(s.id).textContent='已录制 · '+s.name+' · '+(draws/elapsed).toFixed(1)+' FPS';
  if(queue.length){await new Promise(r=>setTimeout(r,400));await begin(queue.shift());}
  else{$('#status').textContent='本轮录制完成。';$('#all').disabled=$('#one').disabled=false;}
 };
 recorder.start(200);running=true;$('#status').textContent='正在录制 '+(skills.indexOf(s)+1)+'/'+skills.length+' · '+s.name;
}
async function start(items){
 if(running)return;$('#all').disabled=$('#one').disabled=true;
 if(hq){try{for(const s of items)await beginHQ(s);$('#status').textContent='本轮高清逐帧导出完成。';}catch(e){$('#status').textContent=String(e);}finally{$('#all').disabled=$('#one').disabled=false;}return;}
 audio.enableFromGesture();
 if(!audioTrack){const ctx=audio.context;audioTrack=ctx.createMediaStreamDestination();audio.output.disconnect();const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-6;compressor.knee.value=6;compressor.ratio.value=12;compressor.attack.value=.003;compressor.release.value=.18;audio.output.connect(compressor).connect(audioTrack);}
 await audio.context.resume();await new Promise(r=>setTimeout(r,800));queue=[...items];await begin(queue.shift());
}
$('#all').onclick=()=>void start(skills);$('#one').onclick=()=>void start([skills.find(s=>s.id===$('#pick').value)]);
setup(skills[0]);setTimeout(()=>$('#status').textContent='就绪。视频使用游戏原有声音混音，录制时本机扬声器静音。',1500);
function frame(now){const delta=last?now-last:0;last=now;
 if(running){clock+=Math.min(100,delta);if(delta){draws++;intervals.push(delta);}
  while(clock>=1000/60&&calls<Math.round(scene.seconds*60)){clock-=1000/60;advance(true);}
  draw();if(calls>=Math.round(scene.seconds*60)&&recorder.state==='recording')recorder.stop();
 }else if(!hq)draw();requestAnimationFrame(frame);
}requestAnimationFrame(frame);
