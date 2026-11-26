# 统一手绘角色素材

本目录存放四位角色的高清卡通手绘立绘、动作图集和含角色的演出素材。队友负责原角色与技能设计，美术更新沿用既有动作意图、时序、世界尺寸和判定。

| 角色 | 立绘与外形参考 | 动作素材 |
|---|---|---|
| 大肥鱼 | [立绘](whale.webp)，保留蓝发、发箍、女仆服和鲸鱼围裙。 | [2 倍源像素图集](motion/whale/atlas.webp)保留 80 槽，其中 79 槽有画，逻辑格仍为 216×216。 [配准记录](motion/whale/atlas.json) |
| 奶蛙 | [用户最终选定的原图](frog-reference.png)是唯一的外形与比例基准，游戏立绘使用[同源 WebP](frog-reference.webp)。 | [最终身体图集目录](motion/frog-reference-v2/)，构成见下文。 |
| 姑姑嘎嘎 | [游戏立绘](motion/gaga/registered/gaga-arcade.webp)，保留企鹅帽、短紫黑发、X 发夹、鳍袖和黄蹼脚。 | [场上动作及演出](motion/gaga/registered/)含 55 个场上关键格和 4 个帝江演出格。 |
| 香蕉猫 | [游戏立绘](banana.webp)，保留弯曲香蕉套装、棕色蕉柄、小棕猫脸与眼泪。 | [场上动作及演出](motion/banana/registered/)含 21 个场上关键格和 3 个泪海演出格。 |

## 奶蛙动作与演出

- 39 个常态槽中，37 格重新绘制。包括 16 个基础动作、6 个出场与胜负动作、8 个拳脚及技能动作、4 个普通移动动作，以及防御、下蹲、思考各 1 格。用户指定保留 `scenes.png` 的前两格侧躺出场。
- 8 个强化槽沿用用户认可的原像素，包括 `angels.png` 的 4 格和 `travel.png` 下半部的 4 格。变身演出保留左侧天使，右侧普通奶蛙按最终选图修订。[演出素材](motion/frog-reference-v2/intro.png) · [天使保留记录](motion/frog-reference-v2/approved-angel.json)
- 普通形态按选定图保留连贯的长圆头颈、微圆的短横嘴、修长四肢和前挺圆腹。护腹防御姿势保留，目光须朝玩家。身体裁图使用 `cutGrid(..., { pixelate: false })`，沿用原显示高度与底部中央锚点。
- `frog-v2.png` 为历史立绘稿，前一版 47 槽方案已弃用。新增或更新姿态时，以选定原图和 `motion/frog-reference-v2/` 为准。

生成与配准资料随资产保存。[大肥鱼提示词](motion/whale/prompt.md) · [奶蛙基础与出场生成清单](motion/frog-reference-v2/frog-canonical-basics-scenes-manifest.json) · [嘎嘎与香蕉猫清单](motion/gaga-banana-imagegen-manifest.json) · [验收范围与试玩入口](../../../docs/角色画风统一进度.md)
