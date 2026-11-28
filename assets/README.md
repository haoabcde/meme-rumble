# 美术与 UI 来源

项目现有角色原始位图、场景和菜单底图使用内置 ImageGen 生成，运行用 WebP 内嵌到游戏 HTML。用户提供的例图用于明确四个角色和街机方向。UI 先比较了三张 16:9 概念稿，采用第一张的蓝紫调、双侧角色展示与中心四宫格。原始 UI 方案存于 [选角视觉稿](../output/design/选角_视觉稿.png)。

## 最终资产与生成提示

### 实战场景与落脚线

宿舍楼顶、夜训球场、余晖货港和星电站先确定登高、换边和下撤路线，再用 ImageGen 把可站立的台沿与房顶、看台和装卸台画在一起。台沿按游戏坐标登记，选图和对局共用同一份定位。升降机和吊盘仍按战斗时间移动。

- [宿舍楼顶](arenas/dorm-rooftop-illustrated.webp)的两翼屋面平直，各自接入跨院连廊。
- [夜训球场](arenas/court-illustrated.webp)的两道青色看台顶棚、暖色中台和紫色计分牌对应三层落脚线。
- [余晖货港](arenas/harbor-illustrated.webp)的渡船和货柜共用平整装卸面，中层栈桥横跨水道。
- [星电站](arenas/station-illustrated.webp)的底层站房延伸到升降井两边，双方出生点都在低台下方。
- [直播擂台](arenas/broadcast-illustrated.webp)的台面贯通两侧，应援设施位于背景。

[五张场景路线图](../docs/arena-routes.png) · [台沿登记](../src/web/illustrated-arenas.ts)

### 香蕉猫与咕咕嘎嘎的倒地关键帧

内置 ImageGen 分别以两位角色的现有立绘作为身份和画风参考，生成朝右的透明四格图集。提示依次要求向后腾空、侧身撞地、用爪或手撑地、单膝发力站起，并保留服装、表情和原画轮廓。运行版每格 320×280，接触地面的轮廓对齐到同一条台沿。 [香蕉猫](fighters/banana-knockdown.webp) · [咕咕嘎嘎](fighters/gaga-knockdown.webp)

### 余晖货港的分层场景

货港使用三张原创手绘风场景图。远处海景随镜头缓慢移动，前景的每件可站景物按实测台沿摆放。两端的船顶、塔楼、中央转运桥以及吊盘在选图和实战中共用同一套素材。

| 资产 | 在游戏中的用途 |
|---|---|
| [港湾远景与码头地面](arenas/harbor-quay.webp) | 2172×724 全景，海港天际线与岸沿分开绘制。 |
| [港区景物图集](arenas/harbor-props.webp) | 1536×1024 透明图，含货柜、拖车、装卸栈桥、渡船、值班室和吊盘。 |
| [龙门吊与转运桥图集](arenas/harbor-gantry.webp) | 2172×724 透明图，上方为龙门吊架，下方为中央青色拱桥。 |

各景物的源像素范围和脚底对齐点记录在 [货港绘制代码](../src/web/harbor-art.ts)。移动台面的画面与碰撞使用同一帧的轨迹。

### 宿舍楼顶、夜训球场与星电站

每张场地各有一幅 2172×724 的手绘全景和一张 1536×1024 的透明建筑图集。生成时将远处校园、球场或山谷与可落脚的建筑分开，保留墨线和轻微像素边缘。图集中每件建筑都测量了前沿的左右端点和脚底高度，选图、训练与双人对战共用。[建筑切片与支撑绘制](../src/web/stage-art.ts)

| 场地 | 全景和图集 | 可落脚的景物 |
|---|---|---|
| 宿舍楼顶 | [黄昏校园](arenas/dorm-bg.webp) · [天台建筑](arenas/dorm-kit.webp) | 花坛、温室、常春藤连廊、机房、水塔、晾晒台。水塔的底座由两侧屋顶支撑，中庭可以横跳。 |
| 夜训球场 | [夜间球场](arenas/court-bg.webp) · [场边设施](arenas/court-kit.webp) | 长椅、替补棚、看台、转播席、计分牌、摄像台。计分牌的数字在对局中绘制。 |
| 星电站 | [紫暮山谷](arenas/station-bg.webp) · [厂区设备](arenas/station-kit.webp) | 接线台、变压器、控制室、电缆桥、线圈冠、升降机。钢缆和配重随轿厢位置变化。 |

### 香蕉猫对战造型

以用户的香蕉猫表情包为角色参考，使用姑姑嘎嘎的对战美术作为线条与配色参考，由 ImageGen 重新绘制 [六姿势透明动作图](fighters/banana-arcade-actions.webp)。[对战渲染](../src/web/banana-art.ts) 按姿势读取动作图，并用各姿势的脚底和眼角坐标对齐地面与水柱。[选角与头像](fighters/banana-reference-portrait.webp) 从同一对战造型导出。[平喷咬牙与升龙仰头大哭](fighters/banana-jet-expressions.webp) 是两张单独的实战作画，水柱按各自眼角定位。[海浪大招的六张关键帧](fighters/banana-wave-actions.webp) 用于准备、下蹲、聚水、抬手、推浪和收招。实战使用这套关键帧。特写由 ImageGen 单独绘制 [咬牙、蓄泪和大哭三张表情](fighters/banana-wave-expressions.webp)。

海浪大招使用 Pixelfx 实际导出的透明帧。Whirlpool 用于场上与特写中的聚水，Wave Crash 用于跟随海浪的滚涌和命中破浪，Splash 用于 U 与 W + U 的水花。三组序列由上游内置导出器以 30 FPS、蓝色水系调色板生成。项目采用 Whirlpool 每隔一帧采一帧、Wave Crash 第 20 至 70 帧、Splash 第 5 至 43 帧每隔一帧采一帧。MIT 许可随单文件构建一并嵌入。 [Pixelfx 源码版本](https://github.com/patch-gg/pixelfx/tree/5294518ce7c72e48b6100a744596e0acf57f2826/src/fx/water) · [导出帧及许可](fx/pixelfx)

[香蕉猫受击图集](fighters/banana-hit-reactions.webp) 使用 ImageGen 以现有角色图集为造型参考，独立绘制轻击后仰、重击失衡、击飞和落地撑手四帧。命中使用 Pixelfx 的 Hit Spark 帧，击飞落地使用 Heavy Landing 去除示例人物后导出的尘屑帧。两组序列沿用上述 Pixelfx 版本及许可。[Hit Spark](https://github.com/patch-gg/pixelfx/blob/5294518ce7c72e48b6100a744596e0acf57f2826/src/fx/impacts/hit-spark.js) · [Heavy Landing](https://github.com/patch-gg/pixelfx/blob/5294518ce7c72e48b6100a744596e0acf57f2826/src/fx/impacts/heavy-landing.js)

### 科幻设施与帝江号武器 · `props/*-v2.png`

使用内置 ImageGen 生成。以用户参考图的比例和轮廓为依据，按星电站场景采用灰白装甲、深灰骨架、像素阶梯边缘和透明底。四件生成提示分别强调以下识别点。

- [榴弹炮](props/grenade-turret-v2.png)　单个粗炮口及细橙环、厚重镂空支架、圆底座。
- [铳械塔](props/dual-bolt-tower-v2.png)　两个并排蓝色铳口、笔直双柱、圆底座。
- [电线杆](props/power-pole-v2.png)　细直方杆、小顶盖、左右斜拉黄线、三脚底座。
- [帝江号武器](props/dijiang-weapon-v2.png)　向左尖端、外露双长轨、深灰主轴和尾部蓝窗舱段。横版战斗前景素材。

[帝江号召唤图集](fighters/gaga-dijiang.webp) 通过内置 ImageGen 参考咕咕嘎嘎现有造型绘制抽终端、翻盖、重按与抬眼。砸落镜头使用 [帝江号武器的 WebP 版本](props/dijiang-impact.webp)，将尖端定位到实际落点。

咕咕嘎嘎的第三、四段普攻搭配 [横扫和反扫关键帧](fighters/gaga-pole-attacks.webp)。第五段使用单独的 [抡杆上挑图集](fighters/gaga-pole-launch.webp)，通过内置 ImageGen 参考原动作图集绘制咬牙低蹲、蹬地前跨、发力斜挥、抡过头顶四个姿势。保留企鹅连帽服和角色比例，透明底，武器和挥击轨迹由游戏绘制。武器从 [电线杆的 WebP 图](fighters/gaga-pole.webp) 取小顶盖、分段方杆和三脚底座。握点在底座上方，斜拉线从武器画面中去除。

横扫和上挑的扬尘参考 Pixelfx 的贴地碎屑和起手烟团，使用 Canvas 按本游戏的像素网格绘制。挥杆风声由 Web Audio 合成。[Spear Sweep](https://github.com/patch-gg/pixelfx/blob/main/src/fx/melee/spear-sweep.js) · [Uppercut](https://github.com/patch-gg/pixelfx/blob/main/src/fx/melee/uppercut.js) · [MIT 许可](https://github.com/patch-gg/pixelfx/blob/main/LICENSE)

[空中掷杆图集](fighters/gaga-air-pole.webp) 用内置 ImageGen 参考同一角色绘制，包含举杆蓄力、转肩、斜下甩手和准备落地四帧。飞杆复用电线杆画稿，尘土、碎块和台面裂纹由 Canvas 绘制。

[铳械塔展开图集](props/gaga-turret-deploy.webp) 用内置 ImageGen 按原铳械塔的双发射口、银灰立柱和三脚圆座绘制。蓝色工程箱落地后的第 0、3、7、11、16、20 帧分别表现闭箱触地、支脚打开、侧盖翻开、双柱抬升、铳口就位和建成。空中的箱体复用第一帧。

[咕咕嘎嘎的终端动作图集](fighters/gaga-turret-terminal.webp) 用内置 ImageGen 参考原角色制作。六帧按顺序画摸口袋、掏终端、按下确认、后摆托箱、松手上抛和收势。手中的箱体由游戏叠画，离手后接续自己的抛物线。

[榴弹炮展开图集](props/gaga-howitzer-deploy.webp) 用内置 ImageGen 参考原榴弹炮的单圆炮口、橙色炮口环和厚装甲，制作六帧橙色工程箱展开动作。空中投箱沿用咕咕嘎嘎的空中投掷动作，按手部握点叠画橙箱。圆形榴弹、气浪和爆炸由游戏绘制。

### 首版四人角色图集 · `fighters/*.webp`

> Use case: stylized-concept. Create ONE game-ready sprite atlas on genuine transparent background, landscape 3:2, strict 2 by 2 grid. The input image is a design and roster reference ONLY: make four original chibi arcade fighters in the same broad meme identities and colors, use a fresh pose, crisp dark contours, clean pixel-art-inspired cel shading, no logos or lettering. Top left: DeepSeek whale-girl, cute determined blue-haired chibi with a frilled white headband and deep blue outfit with white bib, distinct blue whale tail and fin accents. Top right: Chinese internet 奶蛙, a round vivid buttery yellow frog creature, pale cream belly, one big circular green visible eye and small second eye, cheeky calm expression, tiny brown fighting gloves and squat frog limbs. Bottom left: Banana Cat, panicked cream-and-orange kitten in a clearly curved upright golden banana costume with brown stem and blue tears, little paws raised, original expressive design. Bottom right: 姑姑嘎嘎, mischievous purple-haired chibi girl in a black-and-white penguin kigurumi with beak-shaped hood and warm yellow collar, penguin flippers, trim pose. Each is full body including head, shoes and tail. Three-quarter view facing visually right, compact ready-to-fight action pose, expressive bold silhouettes, ample transparent padding 7% inside the boundaries of each quadrant, each illustration stays completely within its quadrant, equally sized, sharp selective outlines, polished indie arcade art. Transparent background only. Absolutely no ground planes, glow surrounding the figures, shadows outside the silhouette, borders, UI, letters, words or watermark. Preserve readability at 96px tall.

### 场景 · `arenas/*.webp`

> Use case: game-asset. Generate one landscape 1536x1024 background sprite atlas, precisely divided into four rectangular paintings in a 2x2 equal grid with straight center boundaries at 50% x and 50% y. Each quadrant is a complete wide horizontally composed INDIE 2D fighting game background, original finely painted pixel-art aesthetic, atmospheric depth, near eye-level horizon at about 68 percent height, clear lower 20 percent for placing the game-built walkable stage floor, legible behind colorful chibi fighters. Top left: sunset Chinese school dormitories, warm apricot sun and a reddish violet city skyline, angular rooftop water tower in the far distance, wispy clouds, amber lit windows. Top right: blue-violet city basketball court at night, a moon, chain-link fencing far in background, electric blue and warm yellow floodlights, faint city lights. Bottom left: teal harbor shipping terminal, big cranes far behind water, glimmers of sunset pink on turquoise water, containers only in the far background, seabirds in distance. Bottom right: violet and cobalt futuristic rooftop power station, luminous cyan reactor towers in the distance and floating electricity, no sci-fi text. Very distinct palettes across the 4 quadrants. Build a sense of place with muted midground, expressive silhouettes, deliberate horizontal compositions. Background scenery only, no platforms, no foreground characters, no logos, no UI, no lettering, no white gutter, no border, no framing around the panels. Nothing overlapping the exact quadrant boundaries.

### 菜单舞台 · `ui/arcade.webp`

> Use case game-asset. Create an ORIGINAL polished wide 16:9 EMPTY desktop video game menu background, 1440x810 or equivalent. The selected mock attached is a lighting and palette reference only: use saturated midnight indigo and dark ultramarine, subtle diagonal halftone panels in the far background, a thin distant luminous lavender horizon line around 73 percent from top, low-glare reflective arcade floor in perspective below it. Very subtle cinematic beams on the outer edges, keep upper left and central area mostly quiet dark navy for readable UI; polished but sparse. A bright blue pool at lower left and warm pink pool at lower right. This is strictly a background asset, no chibi figures, no foreground props, no panels/button/text/logo, no stars that look like icons, no UI or text, no lettering or watermarks.


### 奶蛙修订 · `fighters/frog-v2.webp`

本版使用内置 ImageGen 重绘。参考 [奶蛙设计页](https://milkyfrog.com/design) 的「惊鸿一瞥」和手部照片，以及 [仰头捧腹大笑](https://naiwa.meme/sticker/s031/) 的动作图。造型保留梨形、侧脸小眼、浅腹与深橄榄色手脚。卡通手绘用色，头顶、肩线和手指处加入少量像素阶梯。[奶蛙参考图集](../output/design/奶蛙参考图集.html)

> Use case: style-transfer. Image 1 is the edit target, a game sprite. Images 2 and 3 are references for the street meme character silhouette and bare fingers. Preserve the target full-body right-facing three-quarter stance and extremely recognizable 奶蛙 Naiwa meme face, small high green-ring black eyes and thin straight mouth, a single pear-shaped pale butter-yellow head-to-belly silhouette and pale warm cream belly, skinny legs and naturally deep olive rounded fingertips and bare toes. Refine the art style to exactly this request: 卡通手绘＋少量像素边缘, hand-drawn cartoon illustration plus just a touch of pixel edges. Hand-inked expressive variable-weight dark lines and flat hand-painted gouache-like cel fills, two to three clean warm shade tones instead of glossy vector gradients, subtly uneven human stroke lines around hands and limbs, small speckles of paint grain only inside shadow shapes, high legibility. Add small intentionally visible 2 to 5 pixel stair-step accents to a few portions of the outline near the left shoulder, head crest, fingertips and bottom of feet, selectively at curve transitions; leave the rest as drawn lines. The pixel touches should be subtly visible even when the sprite appears below 300px but the design is still predominantly classic illustrated arcade art. Keep quiet deadpan meme expression, round middle, fingers naturally olive with no gloves. No eyebrow, ornamental costume, bullfrog cheek or snout. Centered full figure, every toe visible, plenty of margin. The entire backdrop must have genuine alpha, no floor, no ambient shadow, no letters or objects. Return only the updated single sprite.

## 场景一体化地图修订

四张最终场景由内置 ImageGen 单独生成。第一张输入是项目的原创地形构图草图，用来约束可站平台的相对位置。第二张输入是旧版地图，仅提供色调和地点。输出以 WebP 放在 `assets/arenas`，游戏按最终画稿的台沿实测像素登记碰撞。旧场景图保留作美术参考。

| 资产 | 建筑和实际落脚点 |
|---|---|
| [dorm-decks.webp](arenas/dorm-decks.webp) | 宿舍阳台、跨楼连廊、机房屋顶 |
| [court-decks.webp](arenas/court-decks.webp) | 替补席、左右看台、计分牌检修台 |
| [harbor-decks.webp](arenas/harbor-decks.webp) | 货柜顶、错位装卸栈桥、悬吊货盘 |
| [station-decks.webp](arenas/station-decks.webp) | 左右发电塔检修台、电缆桥与分开的高控制台 |

生成提示以 16:9 横向格斗视角为约束，采用手绘卡通建筑、少量像素边缘、无遮挡的平直前沿和可辨认的支撑结构。宿舍采用暖橘落日、两侧有物件的阳台、贯通天空桥和桥上机房。球场采用冷蓝夜色、中央替补席、分开的高看台与计分牌。货港采用粉色海上落日、错位货柜、吊车和可辨前沿的吊盘。电站采用紫蓝配色和青色电缆，两侧塔台高位各自独立，中层之间保留间隙。

## 历史画稿 · 第一版宽场地图

使用内置 ImageGen 按每张图的地形草图绘制新版，再转换成 1672×941 WebP。四张图共用的生成要求是连续贯通的地面、能从侧视角辨认的真实台沿、手绘卡通建筑和少量像素边缘。运行时按实际台沿登记坐标，分段映射画稿的高度，给逐层跳跃留出空间。 [场地数据](../src/content/arenas.ts)

| 画稿 | 生成提示中的主要结构 |
|---|---|
| [dorm-wide.webp](arenas/dorm-wide.webp) | 落日宿舍，树荫花坛、温室门台、两翼阳台、连廊和机房屋顶。 |
| [court-wide.webp](arenas/court-wide.webp) | 月下球场，两端球框与边线、侧边长椅、替补席、两翼看台和计分牌检修台。 |
| [harbor-wide.webp](arenas/harbor-wide.webp) | 黄昏码头，开放式泊位、两组集装箱、钢制栈桥、吊盘和东侧卸货区。 |
| [station-wide.webp](arenas/station-wide.webp) | 紫蓝发电站，双塔检修台、留缝电缆桥、分开的高位控制台。 |

### 场景一体化首版出图提示

<details><summary>宿舍楼顶</summary>

> Create final original playable BACKGROUND PAINTING for a 2D indie fighting game stage, wide 16:9 1280x720 or equivalent. '宿舍楼顶': two Chinese university dormitory towers facing a shared rooftop courtyard at orange sunset, expressive hand-inked cartoon architecture, warm apricot/violet painterly cel colors and sparse pixel staircase at detailed window edges. Input 1 is the non-negotiable registered level-design layout, input 2 is only lighting/location inspiration. Use 100% of the 16:9 input canvas, match the exact y and x runs of the 4 colored level lines and the ground line; REPLACE the colored bars with naturally integrated architecture while keeping each line equivalent to the visually obvious FLAT WALKABLE TOP FRONT LIP of a structure. Low left x13–38% and right x62–87% at 70% y are actual broad attached dorm balcony decks with plate fronts, apartment walls, supporting struts and inset stenciled apartments. The long continuous middle at y60% x25–75% is the enclosed-base pedestrian skybridge spanning the buildings, railed behind its ledge, repeated braces and windows below. The shorter central high deck at y54% x41–59% is the top of the roof machinery housing within and attached to that bridge assembly, machinery vents on the front face below the top. All four flat top lips clearly visible, expressive spaces BELOW, feel genuinely part of a cohesive structure, not free-floating horizontal strips; deck supports must remain behind the actors. Ground/front roof surface begins at y82%, floor as open forecourt with flat clear line. Side-scrolling eye-level 2D view, no isometric/horizon-diagonal walking surfaces, keep broad upper canopy largely atmospheric and lower center clear for fighters. No painted dots, guide lines or debug overlays from diagram, no characters, UI, lettering, logos, watermark. Keep exactly this topology without adding any extra sharp long horizontal top edges in front that look like collision surfaces. Render highly detailed original game stage, carefully readable.

</details>

<details><summary>夜训球场</summary>

> Original INDIE ARCADE side-view fighting game stage background '夜训球场', a Chinese outdoor basketball arena under ultramarine moonlight, hand-painted bold cartoon anatomy, sparse pixel-dither at edges, distant apartments and trees, cool blue court stripes with warm amber lamps. Exact 16:9 frame 1280x720 or proportional, no motion graphics or UI or fighters. Follow the 5 horizontal lines in image 1 for spatial registration; image 2 is only atmosphere. STAGE ARCHITECTURE BELONGS IN LOWER HALF: reserve the upper 52 percent primarily as open sky/floodlights, give a lot of space above all playable structures to support character jumping. Four DOCKS built into one believable basketball bleacher assembly, horizontal no diagonal front edges. Lower central wide first deck (x31–69%, y72%) is one forecourt bench or seating stage with a CLEAR FLAT FRONT LIP and angular blue cladding. Two raised commentator galleries (left x14–46%, right x54–86%, both y61%) with separate sides supported by blue steel arch struts, side benches and steps in far back; leave central gap below the small high deck. Highest central playable press-box maintenance roof (x41–59%, y55%) integrated in front of a stylized scoreboard tower, horizontal regular top flat walking edge distinct from scoreboard electronics and back netting. Important each walkway is one point to stand on, obvious level plane, physical supports, no unrelated fake floating bars. Ground court line y82.5% visible feet-height spanning width, no foreground fencing. Orthographic horizontal side view of scene gameplay plane, rails behind front lips as low-contrast design. Aim for visually engaging credible architecture, full-surface original illustration. No strings of text, letters, logos, numbers, characters, timer or reticles.

</details>

<details><summary>余晖货港</summary>

> Create an original final 16:9 1280x720 or proportional backdrop for the arcade fighting game stage '余晖货港'. Stage architecture uses mostly lower  half, keep upper 50% primarily maritime sky, warm pink sunset over deep teal water, dock cranes far in the background. Input 1 is exact collision blockout to follow, input 2 lighting and mood reference. Hand-painted cartoon steel and water, tiny pixel accents on industrial edges, clear flat orthographic side-view; no perspective diagonals for the WALKABLE FRONT TOP EDGE. Turn the 5 width-defined guide lines into a cohesive real cargo staging installation rather than isolated ledges: western broad lower DOCK gantry topped by a teal cargo container roof (x12–40%, y73%), separate low stack on far right (x71–89%, y71%), staggered amber service gangway (x30–55%, y60%) fixed on struts behind those containers, mid-level narrow rope-and-steel catwalk to its right (x59–80%, y59%), and only one highest solid deck (x46–67%, y54%) is the TOP FRONT LIP of a yellow and green cargo container hung from a recognizable crane spreader and cables, body is directly BELOW the lip. Every top lip should be uncrowded and bright on dark structure legible at game size; supports and rails belong to the ships, dock or cranes against the scenery. Ground starts around y82.5%, painterly quayside in front. Large open area above center, preserve separate rounded corners and asymmetrical layout. Avoid putting extra bars in front of these, no floating rectangles without visible relationship, no lettering, characters, UI, overlay lines, numerals or watermarks. Make the five horizontal playing planes unmistakable; no top cover crop.

</details>

<details><summary>星电站</summary>

> Create an original richly detailed 16:9 1280x720 orthographic 2D indie fighting-game stage '星电站', handsomely hand-painted purple and blue futuristic power plant with cyan accents, slight pixel edging around industrial architecture. Image 1 is the invariant gameplay geometry layout, image 2 is purely atmosphere. Most of upper half is open night sky, violet empty air for combat; left and right coil generators with muted distant top caps stand on large industrial steel support frames. At y71% two actual low maintenance perimeter work decks spanning x13–38% and x62–87%, attached to generator side machinery. At y59% two inward-facing inspection gangways, approximately x27–46% and x54–73% but with a clean gap between, supported by the two generator assemblies, central gap visually readable. At y53% two outward high control bays, left x18–34% right x66–82%, NOT a central high bar, mounted to and visibly braced by columns and giant machinery. Upper route is split and fighters return through the lower inner route. Use the six actual flat clear WALKABLE FRONT TOP LIPS with the approximate proportions and heights of the drawing: low cyan, middle warm cream, highest soft magenta, all secondary nonplayable geometry darker and higher in back. Add richly illustrated cable conduits and emergency power strips to the support structures, an inviting open ground along y82% separated from the background, and a narrow row of floor light. Every lip physically belongs to the station; realistic mechanical continuity. No floating bars without supports, isometric/diagonal ledges, lighting animation overlays, text, icons, characters, UI, watermark, extra competing bright lines. Make the stage readable at a small display size.

</details>

## 漫画公共界面与直播擂台

本轮使用用户提供的漫画 VS 图与霓虹直播场景作为风格参考，内置 ImageGen 生成原创素材，PNG 保留源图，WebP 用于离线构建。原有角色素材未改动。

| 素材 | 规格与用途 |
|---|---|
| [漫画纸张底图](ui/comic-paper.webp) | 1672×941，紫红网点、黑白剪纸斜切、明黄爆炸形。标题、模式和 VS 共用；文字及按钮仍为可操作 DOM。 |
| [直播馆远景](arenas/broadcast-bg.webp) | 1672×941，旧版紫色钢架、青粉观众与主持屏；仅作历史源图保留，当前游戏不加载。 |
| [直播建筑图集](arenas/broadcast-kit.webp) | 1536×1024 透明图，2列×3行：看台台阶、观众席、转播间、灯桥、LED 屏、升降台。台沿与实际碰撞同坐标。 |

设计参考阅读了 [P5 游戏内菜单赏析](https://www.vgover.com/zh-tw/news/12008)、[探索与战斗界面赏析](https://game.3loumao.org/95536035) 及 [MIT 开源菜单](https://github.com/Hunkak03/persona5-web)。学习层级、轮廓与交互反馈，未拷贝原作素材或项目代码。游戏运行不依赖这些外站。

## 单层直播擂台与角色合并

旧版[单层场馆v2](arenas/broadcast-flat-bg-v2.webp)曾取代18个可站立道具，现仅作历史源图保留。当前直播擂台由 [arena-ink.ts](../src/web/arena-ink.ts) 绘制，仍保留4480宽世界与单层地面。中央转播屏改为嘎嘎主持，观众席安排奶蛙与香蕉猫应援，复用现有角色素材并按背景色调绘制。旧鸭子场馆图不再进入运行构建，选图预览与实战使用同一套新背景。

大肥鱼、奶蛙、香蕉猫和姑姑嘎嘎的最新动作、语音与专属特效来自队友分支，具体素材及授权见各角色说明与已合入的来源记录；角色设计不在本轮重新制作。嘎嘎动作音效由 `assets/audio/gaga/SOURCES.md` 记录，公共 PixelFX 精灵保留其 MIT 许可证，许可证注释随离线HTML分发。

## 高清手绘人物 · 2026-11-24

用户追加授权后，四位角色保留队友的身份、动作意图和技能设计，使用内置 ImageGen 实际重绘人物。源图、原始生成批次、透明运行图和配准清单位于 `fighters/unified-handdrawn-v1/`。新图与原资产并存，具体路径和当前奶蛙修订状态见[素材说明](fighters/unified-handdrawn-v1/README.md)及[制作记录](../docs/角色画风统一进度.md)。单独的泪水、法阵、炮台等道具和特效沿用原资产；不把人物的重绘扩大为技能重新设计。
