# Meme 乱斗 · 抽象之王

## 直接下载游玩：大肥鱼＋奶蛙角色试玩版

本角色分支已接入两位角色的完整招式、奶蛙出场与胜负动作、最终水潭、技能配音、专属音效和大招BGM。

**不需要安装开发工具。** 下载下面的成品：

- [下载角色试玩版 ZIP（推荐）](https://github.com/haoabcde/meme-rumble/releases/download/characters-preview-20261123/meme-rumble-characters.zip)：解压后，用桌面版 Chrome 或 Edge 双击“开始游戏.html”。
- [下载角色试玩版单文件 HTML](https://github.com/haoabcde/meme-rumble/releases/download/characters-preview-20261123/meme-rumble-characters.html)：下载到电脑后直接打开。
- [查看这一版的发布说明](https://github.com/haoabcde/meme-rumble/releases/tag/characters-preview-20261123)。私有仓库的下载需要先登录有权限的 GitHub 账号。

游戏程序、界面、地图、角色和声音均已内嵌，打开后可离线游玩。先点击页面或按一次键解锁声音。支持同机双人、人机和自由训练；目前没有跨电脑联机。

**“Code → Download ZIP”下载的是源码，不是上面的成品。根目录的 `index.html` 不能直接游玩。** GitHub 的 `releases/latest` 当前仍指向队长发布的框架版，和本角色试玩版是不同发布；请使用上面的明确版本链接。

## 从源码构建

下载源码时请先切到本角色分支 `feat/whale-integrated-20261122`，或下载[本分支源码ZIP](https://github.com/haoabcde/meme-rumble/archive/refs/heads/feat/whale-integrated-20261122.zip)。需要 Node.js 20 或更新版本，在解压后的仓库目录依次执行：

```sh
npm ci
npm run build
```

然后打开 **`dist/index.html`**，可以单独把这个文件发给其他人。也可以执行 `npm start`，访问终端显示的本机地址（默认 <http://127.0.0.1:4182/>）。要重新生成可分发的 HTML 和 ZIP，执行 `npm run package:characters`，成品在 `output/角色试玩版/`。

大肥鱼接入记录见[说明](docs/大肥鱼完整接入.md)，最新角色收尾记录见[制作与验收](docs/角色收尾_V19制作与验收.md)。构建后的 `dist/frog-review.html` 和 `dist/whale-review.html` 提供分动作预览。

负责角色的队友从这里开始。文档列出了四个独立的配置入口、最小接入示例、动作图集规格和实机验收方法。[角色制作交接](docs/character-handoff.md)

移动、受击、击飞倒地和战斗界面与《死神 VS 火影》的源码差异、复现及修复，见[独立对照记录](docs/bvn-independent-audit.md)。

## 进入对战

1. 从标题页进入本地双人、人机对战或自由训练。
2. 双方各选一位并确认。四位可选角色是大肥鱼（DeepSeek拟人）、奶蛙、香蕉猫、姑姑嘎嘎。双方可以使用同一角色。
3. 选地图。默认场地是余晖货港。点「登台路线」可查看双方从开局点到高台的走法。标准局为每回合 60 秒、先赢两回合，可在选图页调整。
4. VS 开场会显示阵容、场地和规则。结算页逐回合记录结果，支持保留规则与阵容再战，也可以换人、换图或返回模式。

单人验证地图时可直接选**自由训练**。展开左下「训练设置」可查看实际落脚的平台名称和已到达的最高层。陪练可静止、防御、重复直拳或跟随，训练支持半速。暂停后可前进一帧，按 R 可以重置。给角色接入精准防反后，用「重复直拳」和 H 面板可以核对生效窗口与反击动作。[防反接口与试招方法](docs/character-handoff.md#防反接口)

实战界面将生命、耐力和胜场标记收在上缘，三段气槽位于下缘两侧。受击后的尾条短暂保留近期损失，连击计数显示在屏幕侧边。按 H 打开调试时可查看生命和耐力数值。防御耐力按来招的 `guardCost` 削减，耗尽会破防。训练中展开「训练设置」选择陪练、慢放或充气。

| 地图 · 直接进训练 | 可走宽度（游戏单位） | 落脚面 | 场景和路线 |
|---|---:|---:|---|
| [余晖货港](http://127.0.0.1:4182/?practice=harbor) | 4160 | 17 | 地面贯通船坞，中路可以连续横跳过三段桥。黄黑吊盘横移 1050 单位，连通两端吊架。 |
| [宿舍楼顶](http://127.0.0.1:4182/?practice=dorm-roof) | 3968 | 15 | 跳上花房，从西楼连廊越过 198 单位的中庭。东侧晾晒台和西侧机房屋顶都通到水塔。 |
| [夜训球场](http://127.0.0.1:4182/?practice=night-court) | 4288 | 17 | 两座替补棚之间留出 629 单位的中圈。沿一侧看台和转播席登上计分牌，可从对面的看台下场。牌面同步显示胜场和倒计时。 |
| [星电站](http://127.0.0.1:4182/?practice=star-station) | 4160 | 18 | 两塔各自可从地面登顶。中层电缆桥可以横跳换边，中央升降机上下移动 465 单位，靠顶时能直接跳上任一塔冠。 |

四张图都有地面和四层高台，最高台离地 527–529 游戏单位。双方开局相距 346 单位，都能一次普通跳上各自的首台。普通跳跃的峰值为 153，固定登顶路线可逐层单跳。双方拉远或开启 H 调试时，位置条显示整张图的位置与当前镜头范围。[三张新地图实机走图](https://github.com/haoabcde/meme-rumble/releases/download/four-arenas-v1/arena-routes.mp4)

第一次玩货港时，P1 开局按住 A 再按 K，可落到西侧青色货柜。沿柜顶往左一小段，再跳上黄色栈桥。从桥的右端向右跳到青色转运桥，再从转运桥右端跳向东侧栈桥。横移吊盘靠近时可以跳上去，松开方向键就会随它移动。在西侧栈桥上方按 S＋K，可以从吊盘落回栈桥。自由训练里将陪练切到「跟随」，它也会沿平台追上来。

## 公共按键

| 操作 | P1 | P2 |
|---|---|---|
| 左右移动 | A / D | ← / → |
| 防御 | S | ↓ |
| 跳跃 / 二段跳 | K | 右 Shift 或小键盘 2 |
| 逐层下穿 | S + K | ↓ + 右 Shift |
| 地面 / 空中冲刺 | L | Enter 或小键盘 3 |
| 普攻 / 空中攻击 | J | 逗号或小键盘 1 |
| 地面挑空 | W + J | ↑ + 逗号 |
| 预留专属槽 | U / I | 句号 / 斜杠 |
| 大招（角色已接入时） | O | 单引号或小键盘 6 |

第一拳打中后再按攻击，可接第二段和第三段。第三段击倒对手。普通挑空与空中受击会持续失控到落地，但空中仍可被追击；落地后经过倒地和起身，结束后恢复操作。公共倒地与起身合计约 0.8 秒，期间不能移动或出招。前两段也能接挑空。以 P1 为例，按 J 命中、W + J 挑空、K 起跳、J 空中追击。打空或被防住时要等收招。每次离地可在二段跳和空中冲刺之间选一次，落地恢复。

从台面下方起跳，在下降经过台沿时落脚，空中可以左右调整。按住下方向再跳跃会从脚下的平台向下掉一层。Esc 暂停，H 显示判定框与台沿。在自由训练中，H 还会显示双方所处的动作阶段、剩余帧数和最近四次按键。选角的方向键和确认键可在「设置」内修改，操作说明会一起更新。同键冲突会提示。全屏受容器限制时，「全屏」会切换到窗口内放大。

## 接入正式技能

四个角色文件各自拥有 `stats`、`art`、`signatureMoves` 和可选的公共招式命中衔接配置。队友可以分别填入 B/C 动作和独立的 `ultimate`，追加动画画格、替换素材，构建会检查并打入离线版本。自由训练链接支持 `p1` 和 `p2` 指定两个角色。[角色文件](src/content/fighters) · [接口与示例](docs/character-handoff.md) · [奶蛙对香蕉猫训练](http://127.0.0.1:4182/?practice=harbor&p1=frog&p2=banana)

技能能量最多存三格，每格 100 点，默认通过命中和承伤积累。B/C 技能和大招都能使用这同一条气槽，消耗按动作设置。角色可只配一个大招，也可用不同方向或组合键触发其他大招。训练中展开「训练设置」，点「充满三格能量」补到 300 点，用 H 面板与半速核对出招。独立样例可用桌面浏览器直接打开，源码构建也会生成 `dist/ultimate-demo.html`。[技能能量接口](docs/character-handoff.md#技能能量) · [下载试招样例](https://github.com/haoabcde/meme-rumble/releases/latest/download/ultimate-demo.html) · [本机试玩](http://127.0.0.1:4182/ultimate-demo.html)

角色可以配置逐帧攻击框和受击框、多段命中组、独立飞行或驻留实体，以及命中特效、震动和声音预设。组合输入用逻辑按键声明，方向修饰和键位重绑共用现有输入层。构建会生成独立的 `dist/combat-demo.html`。[战斗接口交接](docs/character-handoff.md#逐帧判定组合输入与命中表现) · [本机试招](http://127.0.0.1:4182/combat-demo.html)

角色包还可登记音效和语音文件，用 `audioTimeline` 按动作帧播放，用 `feedback.audio` 配置命中声；公共普攻也可按角色更换音频。支持受击打断或继续播放、双方独立语音、暂停及总音量／音效／角色语音调节。文件随离线版内嵌，正式素材由角色负责人提供。[音频交接](docs/character-handoff.md#音效与角色语音) · [本机音频联调](http://127.0.0.1:4182/audio-demo.html) · [下载联调页](https://github.com/haoabcde/meme-rumble/releases/latest/download/audio-demo.html)

技能的射程、影响高度与位移按世界坐标设计。场地左右边界用 `arena.left` 和 `arena.right`，地面高度用 `arena.floor`。1280×720 是镜头画布尺寸，镜头平移和缩放独立于战斗判定。

## 地图、美术与运行

- [场地数据](src/content/arenas.ts) 定义出生点、可走边界和登台路线。[货港布局](src/content/harbor.ts) 把货柜、步桥、渡船、值班室与吊盘的落脚线放进同一份数据。选图预览、实战与训练都使用这些坐标。
- 四张场地都用远景、建筑图集和独立的动态物体绘制。建筑台沿、预览路线和实战落点使用同一份坐标，吊盘与升降机随战斗帧推进。[校园场景绘制](src/web/stage-art.ts) · [货港绘制](src/web/harbor-art.ts) · [移动平台轨迹](src/core/terrain.ts) · [资产制作记录](assets/README.md)
- [角色资产](assets/fighters) 中的 `*-motion.webp` 包含跑动、起手、不同攻击、格挡、收招与受击姿势。姿势按战斗状态和动作帧切换。 [动作图集规格](assets/README.md#公共动作图集)
- TypeScript 固定 60 Hz 战斗内核、Canvas 2D 渲染、Web Audio。默认使用同屏跟随，设置里可以切换近身特写。 [镜头计算](src/web/camera.ts)

开发需要 Node.js 20 或更新版本。

```sh
npm ci
npm run build
npm test
```

构建生成的 `dist/index.html` 内嵌所引用的角色和场景图片、样式与脚本，可以单独拷走。[详细验收记录](design-qa.md)

## 参考

5DPLAY 的公开工程单独定义了地面、落脚面和出生点，空中跳跃与冲刺共享次数限制。Meme 乱斗用现有场景的屋顶、货柜和栈桥规划双方的开局路线，并按自己的高度和位移设计公共动作。 [5DPLAY 地图工程](https://github.com/5DPLAY-Game-Studio/OpenBleachVsNaruto/tree/master/swf_source/map) · [5DPLAY 空中动作实现](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/blob/d51f13dc36cac8e7622328bf4a9afc94156fb79f/CORE_KernelLogic/src/net/play5d/game/bvn/fighter/ctrler/mc/FighterMcAirHandler.as#L244-L325) · [项目完整设计稿](Meme乱斗_完整设计框架_v0.1.md)
