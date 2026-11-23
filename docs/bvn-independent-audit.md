# 《死神 VS 火影》战斗框架独立复查

对照 5DPLAY 提交 `d51f13dc36cac8e7622328bf4a9afc94156fb79f`。逻辑结论来自固定版源码与本项目实际执行的对局帧。3.3 对战截图只用于观察 HUD 布局。复现使用正式名单的鲸鱼娘与奶蛙，以及两者共用的挑空和空中踢。[固定提交](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/tree/d51f13dc36cac8e7622328bf4a9afc94156fb79f) · [3.3 对战画面](https://www.jeux.org/img/games/screen/26928.jpg)

## 本轮缺陷复查

### 致死挑空在回合结算时卡住

夜训球场主地面，双方横坐标为 2190 / 2280。P2 剩 100 生命，P1 按默认键位 `W+J`。修复前的第 129 帧已产生命中和 KO，P2 已脱离支撑并得到向上的速度，随后 104 个逻辑帧里位置和速度完全相同，连 5 帧命中停顿也一直保留。下一轮直接重置。原因是回合结束分支提前返回，跳过了命中停顿与被动移动。原作零血时仍根据着地情况进入击飞或倒地，击飞对象着地后才完成死亡状态。[本项目对局结算](../src/core/match.ts) · [原作受击与死亡分流](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/blob/d51f13dc36cac8e7622328bf4a9afc94156fb79f/CORE_KernelLogic/src/net/play5d/game/bvn/fighter/ctrler/mc/FighterMcHurtCtrl.as#L718-L735) · [原作击飞与倒地动画](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/blob/d51f13dc36cac8e7622328bf4a9afc94156fb79f/CORE_KernelLogic/src/net/play5d/game/bvn/fighter/FighterMC.as#L537-L635)

修复后复跑同一输入，第 129 帧仍即时判定 KO。第 130–134 帧只扣停顿，第 135 帧向上移动，第 165 帧落地并产生倒地事件。结算期间双方追加的攻击、冲刺和跳跃均未触发，倒计时保持，下一轮正常开始。另复跑了地面直拳 KO 和双方同时挑空的双 KO，分别收到一次和两次倒地事件。

### 平台边缘起身瞬间被推落

夜训球场西侧长椅，平台右缘横坐标 690。两人从平台的 560 / 660 开始，P1 用 `W+J`，等待 P2 落回长椅，再走到 P2 身边。修复前 P2 第 165 帧在横坐标 683 倒地，第 195 帧起身时被角色间的推挤移到横坐标 716.5，立即失去支撑。第 210 帧落到主地面，重新倒地，第 240 帧才第二次起身。P2 全程无输入，也没有再被命中。触发点是倒地期间跳过推挤、起身首帧却恢复推挤。该复现涉及本项目的多平台规则，原作的着地和起身链作为表现参照。[本项目角色碰撞与平台支撑](../src/core/match.ts) · [原作起身链](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/blob/d51f13dc36cac8e7622328bf4a9afc94156fb79f/CORE_KernelLogic/src/net/play5d/game/bvn/fighter/FighterMC.as#L605-L635)

修复后第 165 帧进入 30 帧倒地，第 195 帧进入 18 帧起身。P2 保持横坐标 683 和长椅支撑，继续推进 60 帧后仍在同一平台，仅收到一次倒地和一次起身事件，此后按住下方向可防御。

### 对局和训练画面

已检查离线版双人对局用实际按键触发的 KO 截图。倒地前角色在空中后仰，落地后贴地，KO 与胜场读数保持。训练截图中，击飞者等待落地时不再显示空中机动菱形，可追击期间仍显示受击框，进入保护倒地时隐藏受击框。本地截图在 `output/playwright/`，包括 `recovery-ko-air.png`、`recovery-ko-down.png`、`recovery-air.png` 和 `recovery-down.png`。

首次回看 KO 画面时，零血一侧的伤害尾条仍占满，攻方的挥击弧线也一直留在画面。已将受击状态续延尾条的规则限于交战阶段，KO 保留单次伤害延迟，随后退至零。挥击弧线和红色攻击判定随 KO 的命中停顿结束而收起。再次按键复验时，落地截图的尾条已退至 54.4%，蓝色挥击弧线已消失，第二回合正常恢复满血。[伤害尾条更新](../src/web/game.ts) · [挥击和判定绘制](../src/web/renderer.ts)

## 玩法差异与后续接口

| 范围 | 对照结论 |
| --- | --- |
| 移动和空中行动 | 原作地面移动时朝输入方向转身，空中水平移动直接使用角色移速。当前自由状态自动面向对手，地面与空中移速可独立配置。原作空中普通攻击默认一次，出招会消耗剩余跳跃次数。当前可以在同一次腾空中完成 `K → J → 收招 → K → J`，两次空中踢和二段跳均实际触发。空冲与二段跳共用一次移动机会，起跳立即生效，耐力不足时冲刺失败。若要靠近原作，应先确定公共空中出招是否消费移动机会，再为角色保留例外接口。[本项目控制](../src/core/match.ts) · [原作地面移动与冲刺](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/blob/d51f13dc36cac8e7622328bf4a9afc94156fb79f/CORE_KernelLogic/src/net/play5d/game/bvn/fighter/ctrler/mc/FighterMcFloorHandler.as#L257-L306) · [原作空中行动](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/blob/d51f13dc36cac8e7622328bf4a9afc94156fb79f/CORE_KernelLogic/src/net/play5d/game/bvn/fighter/ctrler/mc/FighterMcAirHandler.as#L262-L395) |
| 出招、命中与受击 | 两套框架都有逐帧判定。原作从动画当前帧取得攻击区域和受击区，并在普通受击及格挡后设置短暂的再次受击间隔。当前按动作和命中组去重，支持同帧互击、命中取消和实体接触，普通格挡无擦伤。未来如设计连续压制或空中解围，应先统一帧规则、取消条件、重叠命中优先级，以及限时无敌和霸体的接口。角色动画、判定框、技能资源和连招路线由角色设计者配置。[本项目动作和命中规则](../src/core/match.ts) · [原作逐帧攻击区](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/blob/d51f13dc36cac8e7622328bf4a9afc94156fb79f/CORE_KernelLogic/src/net/play5d/game/bvn/fighter/FighterMC.as#L446-L523) · [原作受击间隔与格挡](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/blob/d51f13dc36cac8e7622328bf4a9afc94156fb79f/CORE_KernelLogic/src/net/play5d/game/bvn/fighter/ctrler/mc/FighterMcHurtCtrl.as#L744-L831) |
| 击飞、倒地与反馈 | 普通击飞保留追击，着地进入倒地 30 帧、起身 18 帧，强制倒地从空中即保护。原作区分弹地、轻重撞地，并有消耗体力的弹地受身。当前的命中火花、音色、双轴震动、命中停顿和倒地冲击由公共事件驱动。重落地与弹地演出、整屏彩闪、按招慢放和附着目标的特效适合按需分别接入。[本项目反馈绘制](../src/web/renderer.ts) · [原作受身消耗](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/blob/d51f13dc36cac8e7622328bf4a9afc94156fb79f/CORE_KernelLogic/src/net/play5d/game/bvn/fighter/ctrler/mc/FighterMcHurtCtrl.as#L903-L924) · [原作特效执行](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/blob/d51f13dc36cac8e7622328bf4a9afc94156fb79f/CORE_KernelLogic/src/net/play5d/game/bvn/ctrler/EffectCtrl.as#L196-L249) |
| HUD | 双边头像、生命和耐力在上，倒计时居中，三格技能能量在下，连击贴屏幕侧边。原作生命条平滑追值，红色尾条随受击状态延迟，底部同时可显示援助区。当前生命主条即时更新，伤害尾条独立追值，保留训练读数和判定开关。援助、计分和耐力超载属于玩法需求。判定调试应把受击框与保护状态一起展示，便于判断落空原因。[本项目战斗读数](../src/web/game.ts) · [原作生命条](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/blob/d51f13dc36cac8e7622328bf4a9afc94156fb79f/CORE_KernelLogic/src/net/play5d/game/bvn/ui/HpBarLerp.as#L67-L120) · [原作三格气与援助条](https://github.com/5DPLAY-Game-Studio/BleachVsNaruto/blob/d51f13dc36cac8e7622328bf4a9afc94156fb79f/CORE_KernelLogic/src/net/play5d/game/bvn/ui/fight/QiBar.as#L108-L136) |
