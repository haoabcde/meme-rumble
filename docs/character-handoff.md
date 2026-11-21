# 角色制作交接

两位角色制作者可以并行工作。先认领角色，各自在对应的 TypeScript 文件里填写属性、素材路径和动作。四个角色已经接入选角、对局和自由训练，目前都能使用公共动作，B、C 和独立大招槽留给你们填写。具体人选、角色设定和技能数值由你们决定。

## 找到自己的入口

| 角色 | 配置文件 | 当前立绘 | 当前动作图集 |
|---|---|---|---|
| DeepSeek 鲸鱼娘 | [whale.ts](../src/content/fighters/whale.ts) | [whale.webp](../assets/fighters/whale.webp) | [whale-motion.webp](../assets/fighters/whale-motion.webp) |
| 奶蛙 | [frog.ts](../src/content/fighters/frog.ts) | [frog-v2.webp](../assets/fighters/frog-v2.webp) | [frog-motion.webp](../assets/fighters/frog-motion.webp) |
| 香蕉猫 | [banana.ts](../src/content/fighters/banana.ts) | [banana.webp](../assets/fighters/banana.webp) | [banana-motion.webp](../assets/fighters/banana-motion.webp) |
| 姑姑嘎嘎 | [gaga.ts](../src/content/fighters/gaga.ts) | [gaga.webp](../assets/fighters/gaga.webp) | [gaga-motion.webp](../assets/fighters/gaga-motion.webp) |

保留表中四个文件现有的 `id`，它也是训练链接使用的角色标识。`name` 是显示名，`accent` 是界面配色，`height` 控制画面中的角色高度。

`stats` 只需填写想调整的字段。生命用 `maxHp`，地面跑速和空中横移速度用 `run`、`airSpeed`，起跳与二段跳的初速度用 `jump`、`airJump`，冲刺速度与空冲开关用 `dash`、`airDash`。身体宽度与受击框分别填 `bodyWidth` 和 `hurtbox`。位移按每个逻辑帧的世界单位计算。[角色包及默认值](../src/content/fighter-kit.ts)

## 第一次联调

1. 从最新 `main` 开一个自己的角色分支。在仓库目录用 Node.js 20 或更新版本执行下面的命令。

   ```sh
   npm ci
   npm run build
   npm start
   ```

2. 打开[奶蛙对香蕉猫的货港训练](http://127.0.0.1:4182/?practice=harbor&p1=frog&p2=banana)。`p1` 是键盘控制的角色，`p2` 是陪练，可以填相同 ID。地图可填 `harbor`、`dorm-roof`、`night-court` 或 `star-station`。
3. 改完角色文件或图片，在第二个终端运行 `npm run build`，然后刷新试玩页。按 **H** 看攻击框、受击框、动作名和当前帧，**R** 复位。需要慢放时选 **0.5×**，也可以在暂停菜单点「前进一帧」。

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

| 字段 | 填法和效果 |
|---|---|
| `id`、`name`、`slot` | 每个动作在本角色内有唯一 ID。训练面板显示名称，专属槽填 `'B'` 或 `'C'`。 |
| `posture`、`direction` | 可用姿态为 `'ground'`、`'air'` 或 `'any'`。可选方向为 `'up'`、`'down'`、`'forward'` 或 `'back'`。前后按输入瞬间的朝向判断。同槽可有多个变体，有方向的优先，条件相同时先匹配先写的动作。 |
| `startup`、`active`、`recovery` | 固定 60 Hz，从动作帧 0 计数。例如 5 / 3 / 13 表示第 0–4 帧起手、第 5–7 帧有效、第 8–20 帧收招。 |
| `hitbox`、`stats.hurtbox`、`stats.bodyWidth` | 攻击框与受击框均为 `{ x, y, w, h }`。原点在脚底，按朝右填写，右方为正 X，上方为负 Y。引擎负责换边镜像。身体宽度另行决定双方接近时的推挤距离。 |
| `damage`、`hitstun`、`blockstun`、`guardCost` | 分别为基础伤害、命中硬直帧、防御硬直帧、防御耐力消耗。连击伤害按公共规则衰减。 |
| `advance`、`push`、`lift`、`stop` | 起手每帧向前的位移、命中时的水平推速、向上击飞的初速度、命中停顿帧。可选 `knockdown` 开启倒地，`airControl` 配置空中出招时的水平控制比例。 |
| `cancelOnHit`、`linkOnly` | 命中后可转入列出的动作 ID 或槽位。`'jump'` 允许地面命中后跳追。`linkOnly: true` 的动作可以作为连招或防反的后续动作。要让公共直拳接到本角色的动作，在角色包顶层加 `extraCancels: { 'common-jab': ['你的动作ID'] }`。防住和打空会照常收招。 |
| `pose`、`animation` | `pose` 选择公共表现类型 `'strike'`、`'sweep'`、`'finish'`、`'rise'` 或 `'air'`。可选 `animation` 按动作帧指定图集画格，每个画格保持到下一个关键帧。命中时机由上面的有效帧与攻击框决定。 |

现有动作判定支持随角色移动的矩形攻击框，每次出招可以命中一次。需要独立飞行的弹体、召唤物、多次命中或角色专属资源时，把期望的输入、生成/命中时机、消失或重置条件交给框架维护者，一起补对应接口。人机陪练目前主要演练公共动作，专属技能的主动使用优先用自由训练和本地双人核对。[完整动作类型](../src/core/types.ts) · [输入与命中实现](../src/core/match.ts)

## 防反接口

角色可以选「按下防御」或「按 B/C 摆架势」，也可以两种都接，分别指向不同反击。下面用公共直拳跑通流程。4 个逻辑帧约 67 毫秒，正式时机、伤害和动画由角色设计师填写。

想先比较手感，可以下载联调样例，用桌面浏览器打开 HTML。开场已靠近陪练，半速重复出拳。默认按 **S** 试精准防御，按 **U** 试架势，按 **R** 复位。从源码运行 `npm run build` 也会生成同一份 `dist/guard-counter-demo.html`。[下载独立防反训练场](https://github.com/haoabcde/meme-rumble/releases/download/guard-counter-v1/guard-counter-demo.html) · [本机直接试玩](http://127.0.0.1:4182/guard-counter-demo.html) · [样例配置](../src/web/counter-demo.ts)

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

**一个人试招**。重新构建并刷新自由训练，靠近对手，把陪练切到「重复直拳」，打开 **H** 面板和 **0.5×** 速度。观察陪练起手，按防御或架势键。面板依次显示「防反窗口」「防反成立」和反击动作名。再提前长按防御一次，或提早摆架势一次，分别核对普通格挡的耐力消耗和架势落空后的收招。

## 大招接口

在角色文件的 `defineFighter({ ... })` 顶层加入 `ultimate`。它有独立按键，P1 默认按 **O**，P2 默认按**单引号**或小键盘 **6**。每个角色可选配一个大招。下面的「联调大招」复用直拳的数据和现有图集，供接入时试招。

```ts
import { basicAttack, defineFighter } from '../fighter-kit.js';

const { slot: _slot, ...probeMove } = basicAttack;
```

将下面这段放入同一文件的 `defineFighter({ ... })`。

```ts
ultimate: {
  cost: 60,
  move: {
    ...probeMove,
    id: 'ultimate-probe',
    name: '联调大招',
    startup: 12,
    cancelOnHit: [],
    animation: [{ frame: 0, cell: 4 }, { frame: 12, cell: 7 }]
  }
},
```

- **能量**每回合从 0 开始，最多 100。默认普通招式实际造成伤害时，出招方加 20，承受伤害的一方加 10。大招命中仅给承伤方加能量。打空、格挡和被防反拦下的攻击不计。角色可用 `gain: { onHit: 20, onHurt: 10 }` 覆盖任一项。
- **释放**要求能量达到 `cost`，且当前姿态、方向和动作状态允许出招。填 `cost: 0` 可无消耗释放，此时不显示能量条。`cost` 和两项 `gain` 均使用 0–100 的整数。动作被接受并开始时立即扣除能量，中断、打空或被防住都不返还。
- **动作**沿用普通动作的帧数、攻击框和图集动画，`posture`、`direction` 可限制起招姿态和方向。配置 `extraCancels: { 'common-jab': ['ULT'] }` 可在直拳命中后按大招键衔接，也可写大招的动作 ID。`linkOnly: true` 可限制为命中衔接。防反动作的 `counterTo` 和 `guardCounter.actionId` 使用普通攻击 ID。

下载独立样例后，用桌面浏览器直接打开 HTML。先按 **O** 试能量不足，再靠近陪练，用 **J** 命中三次积到 60，或点「充满大招能量」立即试招。用 **H** 面板查看起手、有效和收招，用 **0.5×** 或暂停后的「前进一帧」检查第 12 帧切换的画格与判定。用 **R** 复位验证能量归零。改自己的角色后，用自由训练的角色链接重复这套检查。[下载大招联调样例](https://github.com/haoabcde/meme-rumble/releases/download/ultimate-handoff-v1/ultimate-demo.html) · [本机直接试玩](http://127.0.0.1:4182/ultimate-demo.html)

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
