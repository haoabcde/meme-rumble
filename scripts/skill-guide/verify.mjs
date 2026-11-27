import assert from 'node:assert/strict';
import {readFile,stat,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const out=new URL('../../deliverables/大肥鱼与奶蛙角色交付_20261126/',import.meta.url),manifest=JSON.parse(await readFile(new URL('技能清单.json',out),'utf8')),audit=JSON.parse(await readFile(new URL('录制与文件校验.json',out),'utf8'));
assert.deepEqual(manifest.characters.map(c=>c.id),['whale','frog']);
const cards=manifest.characters.flatMap(c=>c.skills),ids=new Set();assert.equal(cards.length,26);
const ff=process.env.GUIDE_FFMPEG??'E:/剪映/JianyingPro/11.6.0.14552/ffmpeg.exe';
let bytes=0;const reports=[];
for(const s of cards){
 assert.ok(!ids.has(s.id));ids.add(s.id);assert.ok(s.p1&&s.p2&&s.description&&s.command);
 for(const path of [s.video,s.poster]){assert.ok(!path.startsWith('/')&&!path.split('/').includes('..'));assert.ok((await stat(new URL(path,out))).size>1000);}
 const a=audit.clips.find(c=>c.id===s.id),buffer=await readFile(new URL(s.video,out));bytes+=buffer.length;
 assert.equal(createHash('sha256').update(buffer).digest('hex'),a.sha256);
 const decoded=spawnSync(ff,['-hide_banner','-v','error','-progress','pipe:1','-nostats','-i',fileURLToPath(new URL(s.video,out)),'-map','0:v:0','-map','0:a:0','-f','null','-'],{encoding:'utf8'});
 assert.equal(decoded.status,0,decoded.stderr);assert.equal(decoded.stderr.trim(),'');
 if(s.recording.sourceLogicalFps){assert.equal(s.recording.width,1920);assert.equal(s.recording.height,1080);assert.equal(s.recording.sourceLogicalFps,60);assert.equal(a.frameExport.frames,s.recording.sourceFrames);assert.deepEqual(a.events,a.frameExport.events);const count=Number([...decoded.stdout.matchAll(/^frame=(\d+)$/gm)].at(-1)?.[1]);assert.equal(count,s.recording.sourceFrames,'decoded frame count '+s.id);}
 reports.push({id:s.id,decoded:true,width:s.recording.width,height:s.recording.height,logicalFps:s.recording.sourceLogicalFps??null,measuredFps:s.recording.measuredFps??null});
}
const hitSum=id=>audit.clips.find(c=>c.id===id).events.filter(e=>e.kind==='hit'&&e.source===0).reduce((v,e)=>v+e.damage,0);
const hitCount=id=>audit.clips.find(c=>c.id===id).events.filter(e=>e.kind==='hit'&&e.source===0).length;
assert.equal(hitCount('whale.ultimate'),12);assert.equal(hitSum('whale.ultimate'),420);
assert.equal(hitCount('whale.combo'),3);assert.equal(hitSum('whale.combo'),135);
assert.equal(hitSum('whale.rice'),30);assert.equal(hitSum('whale.ground-rice'),0);
assert.equal(hitCount('frog.combo'),5);assert.equal(hitSum('frog.combo'),158);
assert.equal(hitSum('frog.power-combo'),237);assert.equal(hitSum('frog.laugh'),100);assert.equal(hitSum('frog.power-laugh'),140);
assert.equal(hitSum('frog.global'),25);assert.equal(hitSum('frog.power-global'),35);
for(const id of ['whale.guard','frog.counter','frog.power-counter'])assert.ok(audit.clips.find(c=>c.id===id).events.some(e=>e.kind==='parry'));
assert.equal(hitSum('frog.power-counter'),140);
const result={passed:true,characters:2,clips:cards.length,posters:cards.length,totalVideoBytes:bytes,allVideoAndAudioDecoded:true,sourceFrameExports:reports.every(r=>r.logicalFps===60),checks:reports};
await writeFile(new URL('素材验收.json',out),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
