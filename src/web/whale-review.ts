import {createMatch,step} from '../core/match.js';
import {NEUTRAL,type InputFrame,type MatchConfig,type ActionKey} from '../core/types.js';
import {whale} from '../content/fighters/whale.js';
import {roster} from '../content/roster.js';
import {arenas} from '../content/arenas.js';
import {rules} from '../content/demo.js';
import {Renderer} from './renderer.js';
import {cinematicOwner,WHALE_RULES} from '../core/whale-kit.js';

document.title='大肥鱼 · 完整接入试玩';
document.body.innerHTML=`<main><h1>大肥鱼 · 完整接入试玩</h1><p>此页使用正式战斗逻辑、角色包和渲染器。点击场景查看实际命中；自由操作请进入训练场。</p><nav id="cases"></nav><canvas id="arena" width="1280" height="720" tabindex="0" aria-label="大肥鱼实际对战场景"></canvas><div class="bar"><button id="pause">暂停</button><button id="restart">重播场景</button><button id="step">前进一帧</button><button id="mirror">方向：右</button><label>速度 <select id="speed" aria-label="演示速度"><option value="1">正常</option><option value=".5">0.5×</option><option value=".25">0.25×</option></select></label><button id="debug">判定框：关</button><a href="/?practice=harbor&p1=whale&p2=banana&silent=1">自由训练 · 大肥鱼</a><a href="/?silent=1">标题与本地双人</a></div><label>场景进度 <input id="seek" aria-label="实战场景进度" type="range" min="0" max="320" value="0" style="flex:1"></label><p id="stats" role="status"></p><p id="notes"></p><p class="hint">P1：A/D移动，W向上组合，S即时戴盆防御，K跳跃，L冲刺，J普攻，U技能1，I技能2，O大招。O消耗三格，训练设置可以充气。数值为首轮接入版。</p></main>`;
const style=document.createElement('style');style.textContent=`*{box-sizing:border-box}body{margin:0;background:#091321;color:#d8eafa;font:14px/1.6 'Microsoft YaHei',sans-serif}main{max-width:1250px;padding:18px 20px;margin:auto}h1{font-size:24px;margin:0}p{color:#a9bfd2;margin:7px 0 12px}nav,.bar{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}button,a,select{font:inherit;border:1px solid #375772;border-radius:6px;padding:6px 10px;background:#172e45;color:#dfedfa;text-decoration:none;cursor:pointer}button[aria-pressed=true]{border-color:#8edfff;background:#245774}canvas{display:block;width:100%;height:auto;border:1px solid #34506b;border-radius:8px;image-rendering:pixelated}label{display:flex;align-items:center;gap:6px}.hint{font-size:12px;color:#9bb4c9}#stats{color:#b4e5ff;min-height:24px}`;document.head.append(style);
const $=<T extends HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const canvas=$<HTMLCanvasElement>('#arena'),renderer=new Renderer(canvas,arenas[2]);
const scenes=[['tail','三段普攻','三段均45伤害，第三段上挑；每段向前小移。'],['guard','两段格挡后破防','前两次实际格挡零伤害、轻推；第二次破防，后续命中才有正常效果。'],['counter','旋风防反','持续按住防御受击后原地成风，双侧饭团；风柱20帧，鲸影48帧。'],['rice','米饭直投','直接命中30伤害、粘住1.2秒；地面米饭只束缚。'],['rice-up','↑＋技能1','以约60°直线快速对空投掷，普通/上投、地面/空中每次独立20%概率偷吃。'],['step-rice','踩中米饭','饭团落地后敌人走入，只束缚不扣血。'],['greed','随机偷吃','每次独立20%概率偷吃，没有连续投掷计数或冷却。'],['spin','技能2高速推进','大肥鱼原地成风；风柱独立快速远行，命中后继续推进；鲸鱼独立每24帧旋转一圈。'],['spin-up','↑＋技能2定点','简单抬手，在敌人横坐标与自身高度生成；风柱与防反同形同寿命。'],['ult','水潭十二段','梁文峰演出时整个战场静止；演出结束即在敌人脚下生成固定水潭，完整预警0.6秒，淡蓝水鲸在第1/5/9段三次主跃出，最后一次最高最大，水鱼与水花穿插；共十二段，每段35伤害。'],['ult-dodge','水潭预警走避','预警期可离开水潭；水潭不追踪，未处于范围内就不会受到伤害。'],['rice-ult','米饭接水潭','先用米饭束缚1.2秒，再接大招。演出不消耗束缚时间，预警0.6秒后开始十二段攻击。'],['air-rice','空中投饭','跳跃中也能普通投掷或上投；独立20%概率偷吃。'],['jump','基础移动与二段跳','跑动、起跳、二段跳、落地和冲刺；使用同一套公共动作图集。'],['spin-chain','技能2连续释放','普通→强化→普通；收招后可以立刻再出，没有额外冷却。']] as const;
let scene:string='tail',mirror=false,paused=false,debug=false,speed=1,clock=0,loopTick=0,hitCount=0,damage=0,seen=new Set<string>();
let history:any[]=[];
let config:MatchConfig,state:ReturnType<typeof createMatch>;
function reset(){
 config={rules,arena:arenas[2],fighters:mirror?[roster[2].fighter,whale.fighter]:[whale.fighter,roster[2].fighter],training:false};
 state=createMatch(config);state.phase='fight';state.phaseTicks=0;
 const caster=state.fighters[mirror?1:0],target=state.fighters[mirror?0:1],d=mirror?-1:1;
 const distance=scene==='ult'||scene==='ult-dodge'?650:(scene==='spin'||scene==='spin-chain')?600:scene==='spin-up'?380:scene==='rice-up'?150:scene==='step-rice'?600:scene==='greed'?900:scene==='rice'||scene==='rice-ult'||scene==='air-rice'?150:scene==='jump'?650:105;
 caster.x=mirror?2500:1900;target.x=caster.x+d*distance;caster.facing=d;target.facing=d===1?-1:1;caster.energy=300;
 clock=0;loopTick=0;hitCount=0;damage=0;seen.clear();history=[];renderer.load(config.arena);saveSnapshot();
 $('#notes').textContent=scenes.find(s=>s[0]===scene)![2];
 document.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===scene)));
 draw();
}
for(const[id,name]of scenes){const b=document.createElement('button');b.textContent=name;b.dataset.scene=id;b.onclick=()=>{scene=id;paused=false;$('#pause').textContent='暂停';reset()};$('#cases').append(b);}
const press=(key:ActionKey,y=0,x=0):InputFrame=>({x:x as -1|0|1,y:y as -1|0|1,pressed:[key]});
function trigger(n:number,key:ActionKey,y=0){const id=n+'/'+key;if(loopTick>=n&&!seen.has(id)){seen.add(id);return press(key,y)}return null;}
function inputs():[InputFrame,InputFrame]{
 let caster:InputFrame=NEUTRAL,target:InputFrame=NEUTRAL;
 if(state.freeze===0&&cinematicOwner(state)===undefined){
  if(scene==='tail'||scene==='guard')caster=trigger(4,'A')??trigger(18,'A')??trigger(32,'A')??NEUTRAL;
  if(scene==='guard')target={...NEUTRAL,y:1};
  if(scene==='rice'||scene==='rice-up'||scene==='step-rice')caster=trigger(8,'B',scene==='rice-up'?-1:0)??NEUTRAL;
  if(scene==='rice-up')target=trigger(4,'jump')??trigger(18,'jump')??NEUTRAL;
  if(scene==='spin-chain')caster=trigger(8,'C')??trigger(44,'C',-1)??trigger(80,'C')??NEUTRAL;
  if(scene==='step-rice'&&loopTick>=55)target={...NEUTRAL,x:mirror?1:-1};
  if(scene==='greed')for(const n of [4,24,44,64,84,104,124,160]){const p=trigger(n,'B');if(p){caster=p;break;}}
  if(scene==='spin'||scene==='spin-up')caster=trigger(8,'C',scene==='spin-up'?-1:0)??NEUTRAL;
  if(scene==='ult'||scene==='ult-dodge')caster=trigger(4,'ULT')??NEUTRAL;
  if(scene==='ult-dodge'&&state.entities?.some(e=>e.definition.behavior==='pool'))target={...NEUTRAL,x:mirror?-1:1};
  if(scene==='rice-ult'){caster=trigger(4,'B')??NEUTRAL;const f=state.fighters[mirror?1:0],t=state.fighters[mirror?0:1];if((t.bindUntil??0)>state.arenaFrame&&f.energy===300)caster=trigger(0,'ULT')??caster;}
  if(scene==='air-rice')caster=trigger(4,'jump')??trigger(12,'B')??trigger(30,'B',-1)??NEUTRAL;
  if(scene==='counter'){target=trigger(14,'A')??NEUTRAL;if(loopTick<60)caster={...NEUTRAL,y:1};}
  if(scene==='jump'){caster={...NEUTRAL,x:loopTick<22?(mirror?-1:1):0};caster=trigger(24,'jump')??trigger(43,'jump')??trigger(105,'dash')??caster;}
  loopTick++;
 }
 return mirror?[target,caster]:[caster,target];
}
function saveSnapshot(){history[state.frame]=structuredClone({state,loopTick,hitCount,damage,seen:[...seen]});}
function advance(){const events=step(state,inputs(),config);renderer.add(events,state.arenaFrame);for(const e of events)if(e.kind==='hit'&&e.source===(mirror?1:0)){hitCount++;damage+=e.amount??0;}saveSnapshot();}
function draw(){renderer.draw(config,state,debug,paused?0:1,false,true);const caster=state.fighters[mirror?1:0],target=state.fighters[mirror?0:1];
 const ctx=canvas.getContext('2d')!;ctx.resetTransform();ctx.fillStyle='#071427df';ctx.fillRect(0,0,1280,63);ctx.font='bold 20px Microsoft YaHei';ctx.fillStyle='#c8edff';ctx.textAlign='left';ctx.fillText('大肥鱼  HP '+caster.hp+' / 气 '+(caster.energy??0),24,38);ctx.textAlign='right';ctx.fillStyle='#ffd5c9';ctx.fillText('陪练  HP '+target.hp,1256,38);ctx.textAlign='center';ctx.fillStyle='#e6f5ff';ctx.fillText(hitCount+' 段 · 累计 '+damage,640,38);
 $<HTMLInputElement>('#seek').value=String(state.frame);
 $('#stats').textContent=`${paused?'已暂停':'播放中'} · ${(state.arenaFrame/60).toFixed(2)}s · ${hitCount}次实际命中 / ${damage}伤害 · 场上实体${state.entities?.length??0} · ${cinematicOwner(state)!==undefined?'梁文峰演出 · 战斗时间静止':state.entities?.some(e=>e.definition.behavior==='pool'&&e.age<WHALE_RULES.telegraph)?'水潭预警 · '+((WHALE_RULES.telegraph-state.entities.find(e=>e.definition.behavior==='pool')!.age)/60).toFixed(2)+'s':caster.attack?.id??'待机'}${(target.bindUntil??0)>state.arenaFrame?' · 敌人被米饭粘住':''}`;
}
$<HTMLInputElement>('#seek').oninput=e=>{const target=Number((e.target as HTMLInputElement).value);paused=true;$('#pause').textContent='播放';if(!history[target]){const last=history[history.length-1];state=structuredClone(last.state);loopTick=last.loopTick;hitCount=last.hitCount;damage=last.damage;seen=new Set(last.seen);while(state.frame<target)advance();}const point=history[target];state=structuredClone(point.state);loopTick=point.loopTick;hitCount=point.hitCount;damage=point.damage;seen=new Set(point.seen);draw();};
$('#pause').onclick=()=>{paused=!paused;$('#pause').textContent=paused?'播放':'暂停';draw()};$('#restart').onclick=()=>reset();$('#step').onclick=()=>{paused=true;$('#pause').textContent='播放';advance();draw()};
$('#mirror').onclick=()=>{mirror=!mirror;$('#mirror').textContent='方向：'+(mirror?'左':'右');reset()};$<HTMLSelectElement>('#speed').onchange=e=>speed=Number((e.target as HTMLSelectElement).value);$('#debug').onclick=()=>{debug=!debug;$('#debug').textContent='判定框：'+(debug?'开':'关');draw()};
reset();let last=0;function frame(now:number){const dt=last?Math.min(80,now-last):0;last=now;if(!paused){clock+=dt*speed;while(clock>=1000/60){clock-=1000/60;advance();}if(state.frame> (scene==='greed'?360:scene==='ult'||scene==='ult-dodge'||scene==='rice-ult'?320:scene==='spin'?330:220))reset();}draw();requestAnimationFrame(frame)}requestAnimationFrame(frame);
