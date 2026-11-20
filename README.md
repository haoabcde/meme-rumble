# Meme 乱斗 · 抽象之王

克隆仓库后运行 `npm ci` 和 `npm run build`，再用桌面浏览器打开 `dist/index.html`。HTML 已内嵌程序、界面、角色和地图，打开即可离线游玩。

## 进入对战

1. 从标题页进入本地双人、人机对战或自由训练。
2. 双方各选一位并确认。四位可选角色是 DeepSeek 鲸鱼娘、奶蛙、香蕉猫、姑姑嘎嘎。双方可以使用同一角色。
3. 选地图。点「登台路线」查看实际可站的台沿。标准局为每回合 60 秒、先赢两回合，可在选图页调整。
4. VS 开场会显示阵容、场地和规则。结算页逐回合记录结果，支持保留规则与阵容再战，也可以换人、换图或返回模式。

单人验证地图时可直接选**自由训练**。屏幕左下会随实际落脚更新平台名称和已到达的最高层。陪练可静止、防御或跟随，训练支持半速。暂停后可前进一帧，按 R 可以重置。

| 地图 | 场景和路线 |
|---|---|
| 宿舍楼顶 | 两侧花箱阳台通往跨楼连廊，机房屋顶在长桥中央，地面可以绕开。 |
| 夜训球场 | 从中央替补席上看台，再向内跃上计分牌检修台。左右看台留有缺口。 |
| 余晖货港 | 从货柜顶走错位栈桥，向内斜跳到吊车的悬吊货盘。 |
| 星电站 | 两塔各有高台。想换边可以回到中层，从左电缆桥跨到右电缆桥。 |

## 公共按键

| 操作 | P1 | P2 |
|---|---|---|
| 左右移动 | A / D | ← / → |
| 防御 | S | ↓ |
| 跳跃 | K | 右 Shift 或小键盘 2 |
| 逐层下穿 | S + K | ↓ + 右 Shift |
| 冲刺 | L | Enter 或小键盘 3 |
| 基础攻击 | J | 逗号或小键盘 1 |
| 预留专属槽 | U / I | 句号 / 斜杠 |

从台面下方起跳，在下降经过台沿时落脚，空中可以左右调整。按住下方向再跳跃会从脚下的平台向下掉一层。Esc 暂停，H 显示判定框与台沿。选角的方向键和确认键可在「设置」内修改，操作说明会一起更新。同键冲突会提示。全屏受容器限制时，「全屏」会切换到窗口内放大。

## 接入正式技能

四位角色使用同一套公开的测试生命值、移动参数和基础攻击。[roster.ts](src/content/roster.ts) 的 `signatureMoves` 保留角色专属动作入口，当前每位的专属槽都是空的。团队确认后，在对应角色填入 B/C 槽的动作定义。方向和键位、地面/空中限制、起动/有效/收招帧、攻击框、伤害及硬直都由数据描述。帧数基于固定 60 Hz，判定框以角色脚底为原点，按朝右填写，内核负责镜像。

## 地图、美术与运行

- [场地数据](src/content/arenas.ts) 以原创地图画稿上的台沿像素为准建立碰撞，选图预览、训练读数与实战使用同一份地形。场景上移或压缩时，台沿与判定一起重算。
- [地图资产](assets/arenas) 中的 `*-decks.webp` 是带阳台、连廊、看台、货柜及栈桥的实景画稿。背景中的支架、栏杆和机械负责表现，台沿端头的细色标标明可站边界。 [资产制作记录](assets/README.md)
- TypeScript 固定 60 Hz 战斗内核、Canvas 2D 渲染、Web Audio。默认全景，设置里可以切换跟随缩放。

开发需要 Node.js 20 或更新版本。

```sh
npm ci
npm run build
npm test
```

构建生成 `dist/index.html`。本轮通过本机 HTTP 预览验证了最终画面、交互与按键。构建检查确认九张 WebP、样式与脚本均在单文件内嵌，应用内浏览器的 `file:` 入口仍由浏览器限制。 [详细验收记录](design-qa.md)

## 参考

5DPLAY 公开工程中把跳、下跳和瞬步拆成不同指令，空中处理里另有空中移动，地图地板记录左右边界和高度。我们的公共试玩采用一次起跳、空中左右调整和逐层下穿。场景和布局为独立设计。 [原作输入](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/blob/d51f13dc36cac8e7622328bf4a9afc94156fb79f/CORE_Shared/src/net/play5d/game/bvn/data/fighter/FighterInputCmd.as#L70-L75) · [原作空中处理](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/blob/d51f13dc36cac8e7622328bf4a9afc94156fb79f/CORE_KernelLogic/src/net/play5d/game/bvn/fighter/ctrler/mc/FighterMcAirHandler.as#L290-L331) · [原作地板对象](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/blob/d51f13dc36cac8e7622328bf4a9afc94156fb79f/CORE_KernelLogic/src/net/play5d/game/bvn/map/FloorVO.as#L22-L37) · [项目完整设计稿](Meme乱斗_完整设计框架_v0.1.md)
