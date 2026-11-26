# 本地战斗验证记录

2026-11-24（中国时区）。首轮实跑时基底 `bbd48c0`，并包含当时角色图和构建脚本的未提交改动。终稿时 `b7324b6` 已合入，同基底比较仅有四处角色美术配置变更，战斗内核、战斗 HUD 和键位映射源码一致。Node.js v25.8.1。分析过程未修改游戏源文件。

## Chrome 实跑

在项目根执行 `npm run build` 并成功，运行当前生成的离线 `dist/index.html`。Chrome 1280×800，减弱动态效果，打开实战调试。双人通过主路径进入，双方输入通过浏览器按键事件触发，本地一回合制 30 秒超时，P1 大肥鱼以生命比例领先 1∶0。界面日志见 [observations.json](observations.json)，页面异常 0。截图动作帧与日志采样可能相差数帧。

- [双人交锋](14-versus-exchange.jpg) · [完整结算](15-result.jpg)
- [大肥鱼命中格挡](06-whale-guard.jpg) · [奶蛙强化](bvn-local-frog-o.jpg)
- [香蕉猫高压眼泪](10-banana-tears.jpg) · [姑姑嘎嘎挑空](12-gaga-up-j.jpg)
- [姑姑嘎嘎部署与 2 格气](03-gaga-turret.jpg) · [姑姑嘎嘎 U 待接入](bvn-local-gaga-u.jpg)

训练复验时，打开 `dist/index.html?practice=broadcast-ring&p1=gaga&p2=frog&silent`。使用 H 看动作状态，用「训练设置」充气或把陪练调成防御。U 显示 B 待接入；零气 I 不部署；三格气地面 I 消耗 100，气量下降到 200。炮弹稍后命中可获得 12 气，仍不足默认 O 的 300。切换四位时将 `p1` 改成 `whale`、`frog`、`banana` 或 `gaga`，W+J 识别结果见原日志。奶蛙用训练充气后按 O，约 1 秒进入强化，能量栏变为倒计时。

## 源码定向验证与独立探针

在项目根执行。将 TypeScript 输出到临时目录，避免准备验证用例时改写角色包。复制同仓已有的四个测试，探针独立调用编译后的生产核心和角色。

```zsh
audit_dir=$(mktemp -d /private/tmp/meme-bvn-audit.XXXXXX)
node_modules/.bin/tsc --outDir "$audit_dir/dist"
mkdir "$audit_dir/tests"
cp tests/{match,character-adaptation,frog,whale}.test.mjs "$audit_dir/tests/"
cp docs/research/2026-11-24-bvn/evidence/check.mjs "$audit_dir/"
node --test "$audit_dir"/tests/*.test.mjs
node "$audit_dir/check.mjs"
```

首轮实际临时目录为 `/private/tmp/meme-combat-audit.glDGNp`。Node 日志明确记有 **158/158 通过**，无失败、跳过或取消。第一次收集命令在测试后给 zsh 只读变量 `status` 赋值，外层中止在回显以前，后续单独查看完整 [tests.log](tests.log) 确认上述结果。独立探针退出 0，其[输出](probe-output.txt)来自成功的工具调用。探针给猫和嘎嘎临时追加一个 W+O 一格大招复现抢键，仅改变内存中的定义以验证分支。

## 外部参考

- [Snokido 展开 Control 面板](snokido-host-controls.jpg)，是门户自己的说明。
- [Snokido Ruffle 加载观察](snokido-screen25.jpg) · [BVNPlay 另一 3.3 托管](bvnplay-screen25.jpg) · [对应日志](controls.json)。
- [3.2 游戏内 Options 截图](bvn32-options.jpg)，截自[标明 3.2 的媒体操作图文](https://soft.zol.com.cn/1054/10542444.html)的公开截图。通过浏览器实际打开原图，确认 P1 KEY SET、P2 KEY SET、OPERATE MODE CLASSIC 与 APPLY。证据范围是截图里的选项。
- [3.3 PC 录像约 0:48](bvn33-video-0048.jpg) · [约 1:20](bvn33-video-0120.jpg) · [播放器跳时及托管补验记录](fast-watch.json)。录像由 Andréj 在 2019-05-01 上传，观察可见的实战画面；其中 1:20 自动降到较低分辨率。没有用录像读硬直帧数或逐键操作。
- [设置原图与另一版本托管记录](settings-image.json)。GameBox 外页写 3.3，内层标 3.01。Browser 访问超过 52 秒，BVNPlay 的 3.3 未进游戏，2.6 保持黑屏。3.3 游戏内重绑范围、设置跨刷新保留和逐输入行为未直接核验。
