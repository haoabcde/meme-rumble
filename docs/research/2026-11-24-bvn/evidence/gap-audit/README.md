# 当前游戏缺口审计 · 验证记录

2026-11-24 · 源码 `b7324b66cc8e95c62dc88fcf41e96c0bf5b48648` · Node.js v25.8.1

## 单测和离线构建

在当前源码的隔离副本运行 `npm test`，包含 TypeScript 编译、离线网页构建及全部 237 个现有测试。角色资源使用物理副本，生产构建的资源路径检查会拒绝将整个资源目录替换为指向仓库外的符号链接。离线单文件另由生产脚本打包到临时目录，再比对 ZIP 完整性、包内 HTML、版本和哈希。 [单测摘要](npm-test-summary.log) · [打包校验](package-check.txt)

## 核心探针

在仓库根目录执行。只向临时目录写编译结果、重跑矩阵和输出。

```sh
audit_dir=$(mktemp -d)
cp package.json "$audit_dir/"
./node_modules/.bin/tsc --outDir "$audit_dir/dist"
evidence_dir=docs/research/2026-11-24-bvn/evidence
node "$evidence_dir/gap-audit/core-matrix.mjs" "$audit_dir/dist" "$audit_dir/core-matrix.json"
node "$evidence_dir/gap-audit/input-lifecycle.mjs" "$audit_dir/dist"
cp "$evidence_dir/check.mjs" "$audit_dir/"
node "$audit_dir/check.mjs"
```

- 576 组指令覆盖四位生产角色、两席、地空、四档气量及九种输入。附加 14 个剧本覆盖零眼泪、台阶输入、挑空、受击、资源和移动等。 [矩阵源码](core-matrix.mjs) · [矩阵结果](core-matrix.json)
- 同帧大招在两类角色组合中分别从第 1、2 回合开始试，通过设定回合字段直接观察两种仲裁。短地面受击用测试体复制招式，在原六帧缓冲下令其硬直为两帧且关闭 hitstop，以隔离旧队列状态。 [追加探针](input-lifecycle.mjs) · [实际输出](input-lifecycle.txt)

## 实际界面

Chrome 走正常生产界面，软件键盘事件驱动 P1/P2。复验包括同机超时结算、再战、换角、设置保存、星电站训练及直播擂台暂停。日志包含从页面读到的 HUD 与动作状态。记录中气槽的 `ready=true` 为 DOM 状态；截图同时显示当前气量与提示。

- [双人结算](17-result.jpg) · [训练和设置持久性](browser-training.json) · [四角关键动作与暂停复验](browser-advanced.json) · [格挡至起身的训练读数](browser-recovery.json)
- [二格气显示就绪却需要三格](26b-gaga-ready-ground-fails.jpg) · [暂停时记录两次 J](33-two-j-queued-at-pause.jpg) · [恢复后自动转入第二段](34-second-j-after-resume.jpg)

本轮浏览器验证使用脚本发键。实际键盘组合、声压与听感、移动设备、手柄和辅助技术的使用结论另需实物核对。
