# 角色制作交接

四位角色均已接入队友的专属动作、技能、音效和大招；框架负责输入、资源、碰撞、实体、倒地、声音和预览。后续从最新 `main` 继续开发角色，保留已有 ID 和队友的配置，不用再从公共占位动作重新搭建。默认 P1 用 O，P2 用单引号或小键盘 6 释放已配置大招。

## 找到自己的入口

| 角色 | 配置文件 | 当前立绘 | 当前动作图集 |
|---|---|---|---|
| 大肥鱼 | [whale.ts](../src/content/fighters/whale.ts) | [常态.webp](../assets/fighters/大肥鱼/常态.webp) | [完整动作.webp](../assets/fighters/大肥鱼/完整动作.webp) |
| 奶蛙 | [frog.ts](../src/content/fighters/frog.ts) | [frog-v2.webp](../assets/fighters/frog-v2.webp) | [frog-motion.webp](../assets/fighters/frog-motion.webp) |
| 香蕉猫 | [banana.ts](../src/content/fighters/banana.ts) | [banana-reference-portrait.webp](../assets/fighters/banana-reference-portrait.webp) | [banana-motion.webp](../assets/fighters/banana-motion.webp) |
| 姑姑嘎嘎 | [gaga.ts](../src/content/fighters/gaga.ts) | [gaga-arcade.webp](../assets/fighters/gaga-arcade.webp) | [gaga-motion.webp](../assets/fighters/gaga-motion.webp) |

保留表中四个文件现有的 `id`，它也是训练链接使用的角色标识。`name` 是显示名，`accent` 是界面配色，`height` 控制画面中的角色高度。

`stats` 只需填写想调整的字段。生命用 `maxHp`，地面跑速和空中横移速度用 `run`、`airSpeed`，起跳与二段跳的初速度用 `jump`、`airJump`，冲刺速度与空冲开关用 `dash`、`airDash`。身体宽度与受击框分别填 `bodyWidth` 和 `hurtbox`。位移按每个逻辑帧的世界单位计算。[角色包及默认值](../src/content/fighter-kit.ts)

公共对局中，地面冲刺消耗 20 点耐力，空中冲刺消耗 30 点。耐力与格挡共用，见血条下方的小条。空冲与二段跳共用一次离地后的空中移动机会，落地恢复。冲刺可以穿过对手，受击保护持续到最后一个冲刺位移帧，下一可推进的逻辑帧恢复受击。角色参数控制可用动作和速度，冲刺消耗、保护与穿身分别由公共规则的 `dashGuardCost`、`dashInvulnerable` 和 `dashPassThrough` 控制。[公共规则](../src/content/demo.ts) · [控制与移动](../src/core/match.ts)

公共规则开启 `airDashPauseGravity`。空冲的 6 个位移帧保持当前高度并保留竖向速度，下一可推进的逻辑帧恢复重力。地面冲刺越过平台边缘时正常下落。[控制与移动](../src/core/match.ts)

## 第一次联调

1. 从最新 `main` 开一个自己的角色分支。在仓库目录用 Node.js 20 或更新版本执行下面的命令。

   ```sh
   npm ci
   npm run build
   npm start
   ```

2. 打开[奶蛙对香蕉猫的货港训练](http://127.0.0.1:4182/?practice=harbor&p1=frog&p2=banana)。`p1` 是键盘控制的角色，`p2` 是陪练，可以填相同 ID。地图可填 `harbor`、`dorm-roof`、`night-court`、`star-station` 或 `broadcast-ring`。
3. 改完角色文件或图片，在第二个终端运行 `npm run build`，然后刷新试玩页。按 **H** 看攻击框、受击框、动作名和当前帧，**R** 复位。展开「训练设置」选择陪练、充气或切换 **0.5×**，也可以在暂停菜单点「前进一帧」。

**想先确认一个按键能从选角通到命中**，可以在自己的本地分支做下面的连通性试验。它复用已有直拳，测试结束后换成自己的数据。

角色文件先导入公共直拳和角色包函数。

```ts
import { basicAttack, defineFighter } from '../fighter-kit.js';
```

在同一文件里，用下面的数组暂时替换空的 `signatureMoves`。

```ts
signatureMoves: [
  {
    ...basicAttack,
    id: 'probe-b',
    name: '接口测试',
    slot: 'B',
    cancelOnHit: [],
    animation: [{ frame: 0, cell: 4 }, { frame: 5, cell: 5 }, { frame: 8, cell: 10 }]
  }
]
```

重新构建后，选角面板应显示「可用专属槽 · B」。进训练靠近陪练，按 **U**，能在 **H** 面板看到「接口测试」依次经过起手、有效和收招，命中时陪练掉血。默认 P1 的 B/C 是 **U / I**，本地双人中 P2 是 **句号 / 斜杠**，也可以用小键盘 **4 / 5**。改键后以「操作说明」为准。

## 填自己的动作

角色包可通过 \`normalMoves\` 替换 A 槽的公共动作，用 \`signatureMoves\` 登记 B/C，用 \`ultimate\` 登记大招。香蕉猫的水球和海浪、姑姑嘎嘎的炮塔和帝江由各自招式的特殊规则处理，伤害结算共用公共的受击框与硬直流程。包内填写 \`animation\` 的招式会按配置播放动作图集，已有专用美术仍可用自己的表现逻辑。


| 字段 | 填法和效果 |
|---|---|
| `id`、`name`、`slot` | 每个动作在本角色内有唯一 ID。训练面板显示名称，专属槽填 `'B'` 或 `'C'`。 |
| `posture`、`direction` | 可用姿态为 `'ground'`、`'air'` 或 `'any'`。可选方向为 `'up'`、`'down'`、`'forward'` 或 `'back'`。前后按输入瞬间的朝向判断。组合键数量相同时，有方向的优先。同槽且条件相同时按配置顺序匹配。 |
| `startup`、`active`、`recovery` | 固定 60 Hz，从动作帧 0 计数。例如 5 / 3 / 13 表示第 0–4 帧起手、第 5–7 帧有效、第 8–20 帧收招。 |
| `hitbox`、`stats.hurtbox`、`stats.bodyWidth` | 攻击框与受击框均为 `{ x, y, w, h }`。原点在脚底，按朝右填写，右方为正 X，上方为负 Y。引擎负责换边镜像。身体宽度另行决定双方接近时的推挤距离。 |
| `damage`、`hitstun`、`blockstun`、`guardCost` | 分别为基础伤害、命中硬直帧、防御硬直帧、防御耐力消耗。连击伤害按公共规则衰减。 |
| `advance`、`push`、`lift`、`stop` | 起手每帧向前的位移、命中时的水平推速、向上击飞的初速度、命中停顿帧。正数 `lift` 启动可追击的击飞，落地后倒地；`knockdown: true` 启动带保护的强制倒地。`airControl` 配置主动空中出招时的水平控制比例，不允许在受击时控制。 |
| `cancelOnHit`、`linkOnly` | 命中后可转入列出的动作 ID 或槽位。`'jump'` 允许地面命中后跳追。`linkOnly: true` 的动作可以作为连招或防反的后续动作。要让公共直拳接到本角色的动作，在角色包顶层加 `extraCancels: { 'common-jab': ['你的动作ID'] }`。防住和打空会照常收招。 |
| `pose`、`animation` | `pose` 选择公共表现类型 `'strike'`、`'sweep'`、`'finish'`、`'rise'` 或 `'air'`。可选 `animation` 按动作帧指定图集画格，每个画格保持到下一个关键帧。命中时机由上面的有效帧与攻击框决定。 |

人机陪练目前主要演练公共动作。专属技能的主动使用可在自由训练和本地双人中核对。[完整动作类型](../src/core/types.ts) · [输入与命中实现](../src/core/match.ts)

### 击飞与倒地

普通地面命中由 `hitstun` 决定硬直。正数 `lift` 或空中受击会进入 `launched` 状态：即使命中硬直倒计时结束，也不能移动、防御、跳跃、冲刺或出招，直到实际落到平台或地面。此时仍能被近战和独立实体追击，新命中会重新结算推力、硬直与连击。

落地后依次经过倒地和起身，公共默认分别为 30、18 个可推进逻辑帧，约 0.8 秒；由公共规则 `knockdownFrames`、`riseFrames` 调整。两阶段不能操作，并有受击保护。命中停顿和暂停不会偷跑倒地计时。显式 `knockdown: true` 及连击上限保护从空中下落时就禁止追加命中，适合结束连段。

联调时在自由训练按 **H**，用 **W＋J** 挑空后观察“击飞 → 倒地 → 起身 → 可操作”，也可暂停后逐帧查看。倒地和起身期间输入不能提前使角色行动；临近结束时的按键仍遵循公共输入缓冲规则。角色负责人继续填写自己的招式、击飞力度和正式受击动画。

### 逐帧判定、组合输入与命中表现

| 字段 | 填法和效果 |
|---|---|
| `hitTimeline` | 可选。每项填 `{ from, to, group, boxes }`，起止均为从 0 计的绝对动作帧，含 `from`、不含 `to`，范围须落在有效帧内。可用多个矩形。一个命中组每次出招只能接触一次，命中、格挡和防反都会消耗该组。同帧有多组重叠时，按填写顺序取第一个可接触的组。区间内可覆盖 `damage`、`hitstun`、`blockstun`、`guardCost`、`push`、`lift`、`stop` 或 `knockdown`。省略整个字段时沿用 `hitbox`。填写后，未覆盖帧及空 `boxes` 不产生近战攻击框。 |
| `hurtTimeline` | 可选。每项填 `{ from, to, boxes }`，范围可覆盖起手、有效和收招。填写后，各帧取覆盖区间内所有矩形。未覆盖帧和空 `boxes` 无受击框。要保留常规受击区，在对应区间填入常规矩形。省略整个字段时沿用角色的 `hurtbox`。 |
| `comboKeys` | 填主动作槽之外必须同时按住的逻辑槽。例如 `slot: 'C', comboKeys: ['B']` 可先按住 B 再按 C，也可同一帧按下 B 和 C。C 必须是新按键。角色仍须处于可出招或允许衔接的状态。先按 B 导致出招时，要等收招结束或配置命中衔接，再按 C。要求的键越多越优先匹配，成立后消费同帧的其他动作输入。改键后以当前绑定为准。 |
| `feedback` | 可选。命中表现支持 `color` 特效色、`shake` 抖动幅度、`flash` 命中闪亮强度（显示范围 0–1）和 `sound` 预设（`'light'`、`'heavy'`、`'sharp'`）。 |
| `entities` | 可选。基于 `spawnFrame` 在出招时独立生成，使用自身的坐标偏移、速度、存活帧数、攻击框、命中参数和表现。速度为每逻辑帧的世界单位，横向坐标和速度随生成时朝向镜像，速度为零可用于驻留实体。实体可以在施放动作结束后命中，对手首次接触后消失，也会在到期、换回合和训练复位时清除。实体随命中停顿暂停。当前判定对象是对手的受击框，实体接触也可被格挡或防反。外观使用引擎预设图形，可用 `color` 调色。 |

构建后打开战斗接口联调页。默认按 **U** 检查两段判定，按 **I** 生成独立实体，同时按 **U＋I** 或按住 **U** 后再按 **I** 检查组合输入。用 **H** 检查框和当前帧，需要看清区间边缘时使用暂停后的「前进一帧」。[下载离线联调页](https://github.com/haoabcde/meme-rumble/releases/latest/download/combat-demo.html) · [本机联调页](http://127.0.0.1:4182/combat-demo.html) · [样例配置](../src/web/combat-demo.ts) · [独立实体类型](../src/core/entities.ts)

## 音效与角色语音

声音放在 `assets/audio/` 下，在角色包顶层的 `audio` 登记。文件由角色负责人提供；框架不会替角色生成笑声或台词。支持 WAV、MP3、Ogg 和 WebM，具体编码需当前浏览器能够解码。构建时按引用内嵌到离线 HTML，不需要联网加载。单文件上限 8 MiB，每份打包音频总量上限 32 MiB。

```ts
audio: {
  laugh: { src: 'assets/audio/frog/laugh.mp3', volume: .8 },
  impact: { src: 'assets/audio/frog/impact.wav' }
},
commonAudio: {
  'common-jab': { hit: { clip: 'impact', volume: .9 } }
},
```

上面的路径是接入示例，需要先放入实际文件。同一角色的专属动作、大招和防反架势都可以追加 `audioTimeline`：

```ts
audioTimeline: [
  { frame: 12, clip: 'laugh', channel: 'voice', volume: 1, stopOnInterrupt: true }
],
feedback: { audio: { clip: 'impact', volume: .9 } },
```

`frame` 从动作第 0 帧开始，12 帧在 60 Hz 下约为 0.2 秒；必须落在起手、有效、收招的总时长内。同一帧可同时播放音效和语音。`feedback.audio` 在实际命中或格挡接触时播放，实体的命中反馈也支持它；省略时保留公共合成音，角色无需提供全套素材。公共动作的出手声可配置在 `commonAudio[动作ID].audioTimeline`，不会改变公共判定或伤害。

| 字段 | 行为 |
|---|---|
| `clip` | 引用本角色 `audio` 中的 ID；不同角色可以使用相同 ID。 |
| `channel` | `sfx` 或 `voice`，默认 `sfx`。双方语音分别管理，同一角色的新语音替换旧语音；音效可叠加。 |
| `volume` | 0–1；最终音量是总音量 × 分类音量 × 素材音量 × 本次播放音量。设置变更立即作用于正在播放的声音。 |
| `stopOnInterrupt` | 默认 `true`。动作在结束前受击、被取消或换招时停止该声音；设为 `false` 可继续播完。动作自然结束允许尾音继续。 |

半速按逻辑帧推迟触发，声音本身保持原速。命中停顿不会重复触发同一帧音轨。暂停会暂停声音，暂停逐帧只推进动作和消费该帧提示，不积攒声音到恢复时爆发。训练复位、换人、换回合和离开对局会清理旧声音。

浏览器需要一次点击或键盘操作解锁音频。配置对局时预解码，交互后才允许播放；未及时就绪的动作提示跳过，不在之后突然补播。自定义命中音频未就绪时回退公共音，解码失败可在浏览器控制台看到文件信息。

构建后打开[音频联调页](http://127.0.0.1:4182/audio-demo.html)，也可[下载离线联调页](https://github.com/haoabcde/meme-rumble/releases/latest/download/audio-demo.html)。先点击画布，再按 **U** 检查第 0 帧音效、第 12 帧语音和命中音；按 **I** 检查受击后继续播放。展开训练设置，选择「重复直拳」和 **0.5×**，复位后分别测试 U、I 的打断差异。设置里的「总音量」「音效」「角色语音」可独立调节，**H** 查看动作阶段，**R** 复位。样例只包含中性电子测试信号，正式角色声音由负责人替换。[样例数据](../src/content/audio-demo.ts)

## 防反接口

角色可以选「按下防御」或「按 B/C 摆架势」，也可以两种都接，分别指向不同反击。下面用公共直拳跑通流程。4 个逻辑帧约 67 毫秒，正式时机、伤害和动画由角色设计师填写。

想先比较手感，可以下载联调样例，用桌面浏览器打开 HTML。开场已靠近陪练，半速重复出拳。默认按 **S** 试精准防御，按 **U** 试架势，按 **R** 复位。从源码运行 `npm run build` 也会生成同一份 `dist/guard-counter-demo.html`。[下载独立防反训练场](https://github.com/haoabcde/meme-rumble/releases/latest/download/guard-counter-demo.html) · [本机直接试玩](http://127.0.0.1:4182/guard-counter-demo.html) · [样例配置](../src/web/counter-demo.ts)

### 按下防御

在这个角色的 `defineFighter({ ... })` 顶层添加一行。

```ts
guardCounter: { windowFrames: 4, actionId: 'common-jab' },
```

在地面可操作时按下防御（默认 P1 按 **S**，P2 按 **↓**）。从按下的当帧算起，第 1 至第 4 帧内接到正面攻击会出现「防反」。从第 5 帧起，继续按住是常规格挡，照常消耗耐力。松开并重新按下可再次开窗。在空中或受击硬直期间提前长按防御，也要松开重按才会开窗。

### 按 B/C 摆架势

在自己角色的 `signatureMoves` 数组中加入下面的动作。B 默认是 P1 的 **U**、P2 的**句号**，换成 C 就是 P1 的 **I**、P2 的**斜杠**。也可以用已有的 `direction` 配方向键，或用 `animation` 指定架势画格。

```ts
{
  id: 'parry-stance', name: '防反架势', slot: 'B', posture: 'ground',
  startup: 2, active: 4, recovery: 12, counterTo: 'common-jab'
}
```

这个例子从动作帧 0 起算。第 0–1 帧起手，第 2–5 帧能接招。没人打进来时，第 6–17 帧收招。起手和收招都能被打断。架势本身没有攻击框，双方同时摆架势可以一起落空。

### 反击与训练

两种入口都要求在地面接到正面攻击，背后攻击照常命中。成功时这一下保住生命和防御耐力。停顿结束后的第一帧，角色自动从第 0 帧执行反击。反击使用自己的动画、攻击框和伤害，对手仍可能躲开或防住。`parry` 事件的 `source` 是完成防反的一方，坐标是拦下攻击的位置。

换成专属反击时，在 `signatureMoves` 注册自己的地面或通用攻击，把它的 ID 填进 `guardCounter.actionId` 或架势的 `counterTo`。希望只能防反触发时，给反击动作加 `linkOnly: true`，并让其他动作的 `cancelOnHit` 避开它的 ID 和槽位。

**一个人试招**。重新构建并刷新自由训练，靠近对手，展开「训练设置」，把陪练切到「重复直拳」并选择 **0.5×**。按 **H** 打开面板。观察陪练起手，按防御或架势键。面板依次显示「防反窗口」「防反成立」和反击动作名。再提前长按防御一次，或提早摆架势一次，分别核对普通格挡的耐力消耗和架势落空后的收招。

## 技能能量

技能能量每回合从 0 开始，最多存三格，每格 100 点，满气为 300 点。B/C 技能与大招共用气槽。要让 B/C 动作耗气，在 `signatureMoves` 对应动作中填 `energyCost`，例如 `energyCost: 100` 消耗一格。只接耗气 B/C 的角色可省略 `ultimate`。防反成立后自动触发的反击动作须为零消耗。

实战气槽放在画面下方两侧，分成三段，旁边数字表示完整格数。具体点数保留在状态数据和调试检查里。原作 `QiBar.as` 的 `InsBar.setProcess` 按 0–3 的进度分别填充槽段、更新格数，可用于核对储能表现。[原作气槽实现](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/blob/d51f13dc36cac8e7622328bf4a9afc94156fb79f/CORE_KernelLogic/src/net/play5d/game/bvn/ui/fight/QiBar.as)

动作获准开始时立即扣除本招消耗，中断、打空或被防住都不返还。满气用掉一格后还剩 200 点。能量不足时无法启动该动作。消耗使用 0–300 的整数。所有角色共用三格气槽，尚未配置耗气技能时也可积攒。

默认 A/B/C 实际造成伤害时出招方加 20 点，承伤方加 10 点。耗气 B/C 命中也适用。大招命中时仅承伤方加气。打空、格挡和被防反拦下的攻击不计。接入 `ultimate` 时，可用 `gain: { onHit: 20, onHurt: 10 }` 覆盖任一项，值为 0–300 的整数。

## 大招接口

在角色文件的 `defineFighter({ ... })` 顶层加入 `ultimate`。P1 的大招键默认为 **O**，P2 默认为**单引号**或小键盘 **6**。角色只做一招时，填写 `cost` 和 `move` 即可。需要更多大招时再用 `variants`，每招各自填写动作、输入条件与消耗。下面的配置复用直拳的数据和现有图集，供接入时试招。

```ts
import { basicAttack, defineFighter } from '../fighter-kit.js';

const { slot: _slot, ...probeMove } = basicAttack;
```

将下面这段放入同一文件的 `defineFighter({ ... })`。

```ts
ultimate: {
  cost: 100,
  move: {
    ...probeMove,
    id: 'ultimate-probe',
    name: '联调大招',
    startup: 12,
    cancelOnHit: [],
    animation: [{ frame: 0, cell: 4 }, { frame: 12, cell: 7 }]
  },
  variants: [
    {
      cost: 200,
      move: { ...probeMove, id: 'ultimate-probe-up', name: '两格联调大招', direction: 'up' }
    },
    {
      cost: 300,
      move: { ...probeMove, id: 'ultimate-probe-down', name: '三格联调大招', direction: 'down' }
    }
  ]
},
```

- **释放**。大招使用 `cost` 配置消耗，常用的 100、200、300 分别对应一格、两格和三格。
- **输入与衔接**。所有大招共用逻辑输入 `ULT`。每个 `move` 沿用普通动作的帧数、攻击框和图集动画，可用 `posture`、`direction` 和 `comboKeys` 指定姿态、方向或组合键。上例的方向和消耗只用于联调，正式角色按动作设计填写。配置 `extraCancels: { 'common-jab': ['ULT'] }` 可在直拳命中后衔接大招，也可填写具体大招的动作 ID。`linkOnly: true` 可限制为命中衔接。防反动作的 `counterTo` 和 `guardCounter.actionId` 使用普通攻击 ID。

用桌面浏览器打开下载的独立样例，或打开构建生成的 `dist/ultimate-demo.html`。先按 **O** 验证缺气时无法释放，再靠近陪练，用 **J** 命中五次攒满第一格。也可以展开「训练设置」点「充满三格能量」，分别试 **O**、**W + O** 和 **S + O** 的一格、两格和三格消耗，每次试招前充满。用 **H** 面板查看起手、有效和收招，用 **0.5×** 或暂停后的「前进一帧」检查画格与判定。用 **R** 复位验证能量归零。改自己的角色后，用自由训练的角色链接重复这套检查。[下载大招联调样例](https://github.com/haoabcde/meme-rumble/releases/latest/download/ultimate-demo.html) · [本机直接试玩](http://127.0.0.1:4182/ultimate-demo.html)

## 交付美术

把文件放在 `assets/fighters/`，也可以在其中建自己的角色目录。在角色文件的 `art.portrait`、`art.motion` 填相对于该目录的路径。构建会自动收集引用的 WebP，打进离线 HTML。

- **立绘**用透明底、朝右的全身图，脚底贴近下边缘。选角、VS、HUD、结算和场上待机共用这张图。
- **动作图集**固定四列，每格 216×216 像素，格内脚底锚点为 `(108, 184)`，参考身高 144 像素。前三行共 12 格供跑步、跳跃、防御、公共攻击和受击使用。[前十二格排布](../assets/README.md#公共动作图集)
- **专属动画**往图集底部追加整行，宽度保持 864 像素，高度每次增加 216 像素。格号从 0 开始逐行向右数，第四行是 12–15。只有已画好并打包的格号才能写入 `animation`。

## 提交前验收

运行 `npm test`。构建会指出缺失素材、动作 ID 重复、取消目标不存在、时间轴不合法、图集尺寸不符或画格越界。随后在游戏里核对下面三件事。

1. 从标题走一次选角 → 选图 → VS → 对局，确认名字、双方立绘和 HUD 对得上。两人可以镜像选同一角色。
2. 在地面、空中各试一次对应输入，再用本地双人换到 P2 验证朝向。分别观察命中、防住和打空，停顿时画面与判定应停在同一动作帧。
3. 在有平台的图上试上下穿台和换边。可以用星电站的升降机检查角色在移动台面上的脚底与判定。复位或再战后，生命和动作应回到初始状态。

提交自己的角色配置和素材，推送角色分支。PR 里写清角色 ID、试招按键和训练链接，另一位队友就能按同样步骤复测。需要核对动作时机时，可以附短录屏或关键帧截图。[接入回归用例](../tests/fighter-kit.test.mjs)

## 直播擂台联调

`broadcast-ring` 已按最新要求改成单层特殊地图：[大肥鱼对奶蛙](http://127.0.0.1:4182/?practice=broadcast-ring&p1=whale&p2=frog) · [嘎嘎对香蕉猫](http://127.0.0.1:4182/?practice=broadcast-ring&p1=gaga&p2=banana)。世界宽4480，可走区间96–4384，地面2084，平台数组与双方登台路线均为空。此图只在连续地面交锋；另外四图保留上下层和移动平台，仍须用它们测试高低差和穿台。选图页在此图显示“单层地面”并隐藏登台路线，切回多层图恢复。

## 四角色合并后的公共约定

- 已整合 `feat/whale-integrated-20261122` 的 `2a2625b` 与 `art/gaga-pixel` 的 `f7150bc`。角色设计和素材以队友这两份提交为准，框架层完成冲突合并。
- `defineFighter` 同时接受先前的 `commonMoves` 和香蕉猫/嘎嘎的 `normalMoves`；优先级为 `normalMoves ?? commonMoves ?? commonActions`。角色 `audio`、`moveSummary` 均保留。
- `ActionDefinition.chain` 管理可预输入的连段，`chainAfter`/`cancelOnHit` 继续支持另外两位角色的命中衔接。两种约定不互相覆盖。
- 大肥鱼/奶蛙使用公共 `entities` 生命周期；嘎嘎的投掷物、炮台和帝江召唤保留各自逻辑。两类实体共同参与命中结算、防反、暂停和回合清理。
- 普通挑空持续失控到落地，之后共用默认30帧倒地、18帧起身；规则可覆盖。`Recovery.facing` 为倒地美术保留受击朝向；空中落地触发带 `reaction: 'air'` 的 `knockdown` 事件，不再额外触发一次 `land`，避免重复音效。
- 嘎嘎的17份录音已通过角色 `audio` 注册，并随既有 `__FIGHTER_AUDIO__` 离线内嵌；统一从 `FightAudio.update(config,state,events)` 播放，未引入第二套解码/音量旁路。
- 渲染入口为 `renderer.add(events, state.arenaFrame, config.fighters)`；第三参数可省略以兼容动作审阅页。`draw` 的尾部参数依次为 `shake, focus, reducedMotion, opening, interpolation`。特效寿命按竞技帧计算，暂停和大招演出不消耗普通特效寿命。
- 嘎嘎与香蕉猫的独立机制测试使用公共陪练测试体；真实跨角色防反、同帧多水球瞬移、大招冻结和快照重放见[跨角色集成测试](../tests/cross-character-integration.test.mjs)。

## 高清手绘素材接入

用户追加要求真正重绘四角色及队友原有动作，采用清晰卡通手绘，可完全取消像素感。新全身基准另存于[统一手绘目录](../assets/fighters/unified-handdrawn-v1/README.md)，完整动作制作状态见[进度](角色画风统一进度.md)。奶蛙以 `frog-v2.png` 的长头、修长上半身和大鼓腹为当前比例，旧矮胖动作不能直接作为最终稿。

公共四列动作图可设置 `art.motionScale: 2`，使用432×432源像素格；逻辑格仍为216、脚锚仍为(108,184)，动作 `animation[].cell` 编号、显示大小、位移和判定均保持原值。省略时继续校验216格。构建会按实际源格数检查越界；只放大图集而不声明源密度会被拒绝。可选源密度为1、2、3、4。

奶蛙、嘎嘎和香蕉猫还包含各自的独立动作及演出素材，不能只替换 `art.motion` 就宣布全部完成。重绘后须逐格配准裁框/手眼锚/脚底，核对移步、受击、倒地起身和技能演出，避免套用旧像素化降采样让新图再次变糊。原动作与技能设计归角色负责人，新素材保留版本记录。
