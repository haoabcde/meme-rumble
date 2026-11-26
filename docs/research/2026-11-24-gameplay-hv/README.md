# 玩法扩展横纵分析

研究日期：2026-11-24。报告分析玩法演进、五个同类参照、玩家个案和当前项目结构，交付研究判断，不包含新增模式的实现或平衡证明。

- [PDF](梗角色大乱斗玩法扩展_横纵分析报告.pdf)
- [Markdown源稿](梗角色大乱斗玩法扩展_横纵分析报告.md)
- [HTML](梗角色大乱斗玩法扩展_横纵分析报告.html)
- [引用索引](evidence/引用索引.json)
- [项目结构核对](evidence/项目结构核对.json)

`notes/` 保留纵向、横向、玩家声音与证据台账，以及报告交汇论证。正文日期与来源性质按可核验范围标注；论坛是自选样本，不代表使用率或全体口碑。工作区其他在途改造未在本次重新验收。

## 重建

在仓库根目录运行：

```sh
node docs/research/2026-11-24-gameplay-hv/build-report.mjs
python3 docs/research/2026-11-24-gameplay-hv/render-report.py
```

需要 Python 的 `markdown`、`weasyprint` 和其系统字体依赖。渲染复用本机已安装的 hv-analysis 模板；默认查找用户目录下 `.codex/skills/hv-analysis`，其他位置可用 `HV_SKILL_DIR` 指定。项目的 `report-print.css` 只调整长链接、表格和分页，不修改 skill 文件。未提供署名，不添加作者。

PDF已检查中文字体、逐页缩略图、正文/表格/引用样页及文字边界。[文字与边界检查](evidence/PDF文字与边界检查.json)记录提取结果；它不能替代目检，也不证明游戏玩法可玩。
