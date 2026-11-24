import {readFile,writeFile} from 'node:fs/promises';

const base = new URL('./',import.meta.url);
const read = file => readFile(new URL(file,base),'utf8');
const [history,horizontal,voices,voiceLedger,synthesis] = await Promise.all([
 read('notes/纵向研究.md'),read('notes/横向研究.md'),read('notes/玩家声音与反证.md'),
 read('notes/玩家来源台账.md'),read('notes/报告导读与交汇.md')
]);
const entries = new Map();
for(const match of history.split('## 来源台账')[1].matchAll(/^(\d+)\. (.+)$/gm)) {
 const link = [...match[2].matchAll(/\]\((https?:[^)]+)\)/g)].at(-1);
 entries.set('H'+match[1],{url:link[1],text:match[2]});
}
for(const line of horizontal.split('## 证据台账')[1].split('\n')) {
 const cells=line.split('|').map(s=>s.trim());
 if(!/^[SBRT]\d+$/.test(cells[1]??''))continue;
 const url=cells[2].match(/\]\((https?:[^)]+)\)/)?.[1];
 entries.set(cells[1],{url,text:cells[2]+'。事件：'+cells[3]+'；发布/状态：'+cells[4]+'；'+cells[5]});
}
for(const line of voiceLedger.split('\n')) {
 const cells=line.split('|').map(s=>s.trim());
 if(!/^(BV|SM|BR|TF|RI)\d+$/.test(cells[1]??''))continue;
 const url=cells[5].match(/\]\((https?:[^)]+)\)/)?.[1];
 const timing=url.includes('reddit.com/')?'所列日历日期来自搜索索引；原帖快照多为相对时间，发布时间未独立核实。':'';
 entries.set(cells[1],{url,text:cells[5]+'。'+timing+cells[2]+'；玩家自选个案，'+cells[4]});
}
for(const [key,url,text] of [
 ['P1','evidence/项目结构核对.json','本项目结构核对。2026-11-24，本地一手代码观察；记录已提交基线与在途源文件哈希。未进行新玩法试玩或复测当前未提交功能。'],
 ['P2','../../玩法扩展研究_v0.1.md','本项目《玩法扩展研究v0.1》。2026-11-24，本地前次提案；用于核对本轮判断如何调整，提案不是功能实现证据。'],
 ['P3','../../../design-qa.md','本项目已提交验收记录。2026-11-24，本地一手历史记录；既有验收不能替代当前工作区改动或新玩法的复验。'],
 ['D1','https://www.gamedeveloper.com/design/-rage-development-postmortem','James Rowbotham，Rage Development Postmortem。发布2017-08-08，开发者本人复盘；记录先按1v1构建后取消四人功能的原因。历史项目，不是本项目工期证据。'],
 ['D2','https://www.gamedeveloper.com/business/postmortem-torpex-games-schizoid','Jamie Fristrom，Postmortem: Torpex Games Schizoid。发布2008-09-24，开发者本人复盘；合作核心与单人定位、多人边界情况。历史Xbox环境，不作当下市场推断。']
])entries.set(key,{url,text});

function expand(text,prefix='') {
 text=text.replace(/[［\[]([A-Z]*)(\d+)[–-](?:[A-Z]*)(\d+)[］\]]/g,(_,p,a,b)=>Array.from({length:Number(b)-Number(a)+1},(_,i)=>'['+(p||prefix)+(Number(a)+i)+']').join(''));
 if(prefix)text=text.replace(/\[(\d+)\]/g,(_,n)=>'['+prefix+n+']');
 return text.replace(/［([A-Z]+\d+)］/g,'[$1]');
}
let historyBody=expand(history.split('## 一、')[1].split('## 来源台账')[0].replace(/^/,'## 一、'),'H')
 .replace(/^## [一二三四五]、/gm,'### ')
 .replace('每人依次上阵会迅速用完可选组合','大编队会占据现有角色池的大部分');
historyBody=historyBody.split('三条适合拿进同一轮玩法讨论的推断如下。')[0].trim();
function section(text,heading,next='## ') {
 const start=text.indexOf(heading);if(start<0)throw Error('Missing '+heading);
 const end=text.indexOf('\n'+next,start+heading.length);return text.slice(start,end<0?undefined:end).trim();
}
const bvVoice=section(voices,'## 死神 VS 火影').replace(/^## .+\n/,'');
const bvProfile='### 死神VS火影：直接参照是共享操作与角色对局\n\n它最接近本项目的血量制双人起点，而不只是题材相似。早期网页入口、共享键位以及后来的小队和无双，提供了从首场试招到不同赛程的历史参照。现有官方源码的Alpha日志只能说明对应工程的更新，不能把社区常玩的旧版、移植版和改版合并为一个当下版本。收费生态与活跃规模本次未核实。[H2][H3][H5]\n\n'+bvVoice+'\n\n一位长期玩家说另一款作品的招式与运作“the moves and stuff feel different”。这是一人的主观手感区别，不是两款作品的完整评测，也不足以证明哪种模式更常玩。[BV1]\n\n';
const profiles=[
 ['## Super Smash Bros. Ultimate','## Smash Ultimate','玩家原话：“Play it more than anything else.” 这句来自模式爱好者，绝对回帖日期未独立核实。[SM2]'],
 ['## Brawlhalla：','## Brawlhalla：','玩家原话：“the aggression comes from threat and positioning”。它让我们把站位施压和单纯逃跑分开记录。[BR2]'],
 ['## Rivals of Aether II：','## Rivals II：','玩家原话：“I have trouble finding people near my rank”。该用户自报的地区和段位不能代表全体服务区。[RI3]'],
 ['## TowerFall Ascension：','## TowerFall：','玩家原话：“so many setting options for different combinations”。这是喜欢变体的一方，混合新手桌的相反经验也须保留。[TF2]']
];
let horizontalBody=bvProfile;
for(const [heading,voiceHeading,quote] of profiles) {
 horizontalBody+=section(horizontal,heading).replace(/^## /,'### ')+'\n\n';
 horizontalBody+=section(voices,voiceHeading).replace(/^## .+\n/,'')+'\n\n'+quote+'\n\n';
}
// Relative dates in cached community pages are not an independent calendar verification.
horizontalBody=horizontalBody.replace('2026 年 9 月的客厅聚会讨论里','一则带日期搜索索引的客厅聚会讨论里')
 .replace('2026 年 10 月，一位','一则讨论中，一位')
 .replace('近三个月样本能确认一次具体匹配困境','该样本核到一名玩家的匹配困境自述')
 .replace('另一组近期回帖中','另一组回帖中')
 .replace('近三个月仍有人明确想要线上 Squad Strike','带日期搜索索引还显示有人明确想要线上 Squad Strike');
const intro=synthesis.split('## 导读')[1].split('## 项目横向定位')[0].trim();
const position=synthesis.split('## 项目横向定位')[1].split('## 交汇')[0].trim();
const intersection=synthesis.split('## 交汇')[1].trim();
const comparison=`
### 同期参照简表

| 对象 | 战斗与参与场景 | 可借鉴的扩展 | 移植时的主要差异 |
|---|---|---|---|
| 死神VS火影 | 血量制双人、角色与共享动作 | 小队、练习、连续挑战 [H2][H3] | 原作角色池、不同分支和资源约定 |
| Smash Ultimate | 击飞与回场、聚会及线上 [S1][S3] | 编队、情境、规则选择 [S2] | 边缘平衡与成熟角色池 |
| Brawlhalla | 击飞与持械争夺、免费跨平台 [B1] | 资源牵引、轮换、预设 [B2][H20] | 公共武器不是我们的角色技能体系 |
| Rivals II | 平台攻防、本地与回滚联机 [R1] | 地图禁选、休闲场地、独立队列 [R2][R3] | 多席位、内容工具及协商规则 |
| TowerFall | 有限弹药、短回合、本地同屏 [T1] | 靶标挑战、波次、可选变体 [H15][H16] | 一击淘汰与敌群维护成本 |

表中比较产品结构，不对市场份额、模式人气或总体口碑排序。纵向部分是并行的设计路线，未建立这些作品之间的完整传承关系。
`;
const timeline=`
### 关键时间线

| 时段 | 已核验的变化 | 与扩展玩法的关系 |
|---|---|---|
| 1999 | 初代Smash已有多人、单人和训练 | 多种使用场景可以共享动作 [H6][H7][H8] |
| 2008—2010 | BVN已进入网页门户，攻略列出双人和练习 | 减少开局准备不等于证明长期留存 [H1][H3] |
| 2013—2014 | TowerFall从本地核心发展Quest与Trials | 单人靶标与敌群波次具有不同依赖 [H12][H14][H15] |
| 2017—2018 | BVN小队、Smash更细的编队与路线 | 赛程和对阵可以制造变化 [H2][H10] |
| 2022 | Brawlhalla实验并采用凝聚资源位置 | 交战激励可以在原规则内调整 [B2][B3] |
| 2026近三个月 | Alpha工程、休闲内容、锦标赛及输入修订并行 | 扩内容与稳核心是不同任务 [H5][B4][R4][R5] |
`;
let body='# 梗角色大乱斗玩法扩展：横纵分析报告\n> 研究时间：2026-11-24 | 所属领域：血量制与平台格斗玩法设计 | 研究对象类型：产品与玩法决策\n\n'+
 '## 一、一句话定义与阅读结论\n\n'+intro+'\n'+timeline+
 '\n## 二、纵向分析：玩法怎样从一场对局长出来\n\n'+historyBody+
 '\n## 三、横向分析：当下的竞争与替代图谱\n\n'+position+'\n\n'+comparison+'\n'+horizontalBody+
 '\n## 四、横纵交汇：对本项目的判断与验证顺序\n\n'+intersection;
body=expand(body);
const byUrl=new Map(),sources=[];
body=body.replace(/\[([A-Z]+\d+)\]/g,(_,key)=>{
 const entry=entries.get(key);if(!entry?.url)throw Error('Unknown citation '+key);
 let number=byUrl.get(entry.url);
 if(!number){number=sources.length+1;byUrl.set(entry.url,number);sources.push({number,...entry,keys:[key]});}
 else if(!sources[number-1].keys.includes(key)){sources[number-1].keys.push(key);sources[number-1].text+='；同源补充：'+entry.text;}
 return '[['+number+']]('+entry.url+')';
});
body+='\n\n## 五、信息来源与证据边界\n\n所有外部来源访问日期均为2026-11-24。下列日期指来源记载的事件或发表时间，不由网页“几天前”倒推。若原帖正文不可直读，使用范围限台账中可见的搜索索引。市场份额、各模式使用率、留存因果、本项目新模式平衡性没有本次可用的实证，不作结论。\n\n';
body+=sources.map(s=>s.number+'. '+s.text+' [原始来源]('+s.url+')。访问2026-11-24。').join('\n\n');
body+='\n\n横纵分析法由数字生命卡兹克提出，以历时演变、同期比较及两者交汇组织研究。本报告按该方法取证与判断；具体来源性质、日期和访问限制另见随附研究笔记及证据台账。\n';
const file='梗角色大乱斗玩法扩展_横纵分析报告.md';
await writeFile(new URL(file,base),body);
await writeFile(new URL('evidence/引用索引.json',base),JSON.stringify(sources,null,2)+'\n');
const chinese=(body.match(/[\u3400-\u9fff]/g)??[]).length;
console.log(JSON.stringify({file,chineseCharacters:chinese,sources:sources.length,unresolved:(body.match(/\[[A-Z]+\d+\]/g)??[])}));
