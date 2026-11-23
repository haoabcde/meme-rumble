# 大肥鱼动作重绘

使用内置 ImageGen。输入为原 `大肥鱼/完整动作.webp` 每相邻两行的八格裁片、`unified-handdrawn-v1/whale.png` 与已完成的首批动作。

## 第 08–31 格共用提示词

RESTYLE EXISTING GAME SPRITES, preserving every authored pose. Input 1 is EIGHT exact action poses in FOUR COLUMNS by TWO ROWS, row-major; input 2 is the same character's new unified clean hand-drawn style; input 3 is an already completed animation sheet showing the required finish. Redraw all 8 poses from input 1 using the same face, navy/cyan long hair, maid costume, white frills, gold trim and blue whale apron as input 2. Keep EACH original pose, facing, eyes and mouth expression, silhouette, arm/leg gesture, body lean, whale tail position and props. Do not repeat idle poses, simplify movements or invent new actions. Preserve original animation order. Remove thin straight colored glitch lines from the original: they are artifacts, not tails or effects. Clean high-resolution cartoon hand drawing with readable dark ink contours, matte colors, simple shaded masses, extremely restrained fine brush grain like input 2. No pixel art, jagged pixel stepping, blur, glow or vector gloss. Clear at real fighting-game size. Output ONE wide transparent sheet, target2048x1024, precisely4 evenly spaced columns and2 rows, one isolated COMPLETE full-body figure per square cell, all8 figures same rendering finish as input3. Keep transparent gutters and margin, no overlapping/crossing cells; opaque bodies on true transparent background. No floor, drop shadow, grid, labels, numbers or typography. Preserve all 8 exact source poses.

末尾追加批次原格编号，以及保留每格动作姿态、闭眼或受击表情的要求。格序不变，原始图集不覆盖。

## 第 32–79 格提示词

Create one genuinely transparent 2:1 landscape RGBA animation sprite sheet for our game's DeepSeek whale maid, laid out in exactly four evenly spaced columns by two evenly spaced rows. IMAGE 1 is the edit target and immutable frame-by-frame pose map, in strict left-to-right row-major order. IMAGE 2 is the approved style only. Redraw each occupied slot from image 1 separately in the high-definition hand-painted anime/chibi style of image 2. Exact same character: deep indigo curled hair and flowing cyan tips, French maid ivory headdress, navy dress, soft ivory apron with small blue whale emblem, crisp gold trim, same eye color, face proportions and thick shoe silhouettes. Delicate continuous dark brush outlines, refined smooth painted cel shading, crisp clean silhouettes, no pixelated or jagged detail. Every cell must preserve reference orientation, action silhouette, hand/leg positions, expression, clothing, and whether the tail or rice bowl is visible.

- 32–39. Top row: far-left wide low tail sweep facing LEFT; taller nearly vertical whale tail strike facing LEFT; low right-facing recovery with tail fin upright at the right; compact neutral standing at the right. Bottom row: alert stance; same stance eyes shut; eyes open alert stance; right-facing forward start with raised foot.
- 40–47. Top row: four genuine distinct phases of the right-facing run, each matching knees and footforms in IMAGE 1. Bottom row: four distinct phases of the low crouch into compact aerial jump cycle, preserving the posture height, inward arms and exact tucked leg position of each.
- 48–55. Top row: eight cells total, first four are distinct small airborne/recovery sprites with legs tucked, lift, drop, then a strongly leaning right lunge respectively. Bottom row: two standing flinches with eyes squeezed and face progressively redder, one small crouched recovering body, then prone on her side horizontally with head pointing RIGHT. Preserve the prone cell silhouette/height. IMAGE 1 contains accidental straight blue bands outside her, omit all.
- 56–63. Top row exact: low collapsed sleeping on her side head RIGHT eyes shut; low kneeling rising pose; upright startled/tiny feet lifted; horizontally collapsed on her side eyes shut head RIGHT. Bottom row exact: four upright food handling poses with the small white rice bowl and tiny spoon only as shown, preserving hand position and expressions. Retain lying vs full-height distinctions. Omit raster grey rules.
- 64–71. Top row: standing raised rice bowl smiling, standing rice bowl grin eyes closed, upset face with hands down, then seated low with folded skirt and sad expression. Bottom row: neutral hands tucked; small prop lift; spoon extended diagonally to her right; eyes closed delighted hands near mouth. Tiny white spoon belongs only in relevant gestures. No straight connector line.
- 72–79. IMPORTANT seven sprites only, with exact four-column two-row slot layout: top four are model turn front, right profile facing RIGHT, BACK VIEW, left profile facing LEFT; bottom first three are two modest right-facing subtle stances, then standing with inverted silver basin helmet. Bottom-right slot is intentionally COMPLETELY BLANK alpha zero. Only seven painted character sprites. Remove all low horizontal raster rules.

All whole bodies, no clipping. Keep each pose isolated in its own zone with ample transparent separators and canvas padding. Remove all source raster dirt, stray lines, color strips, faint blocks and halo. No visible grid, staging background, floor shadow, text, frames, labels, extra effects or duplicated poses.

## 检查记录

- 首批与08–15、24–31已生成，逐格保留原方向、动作和尾巴姿势。
- 16–23的透明导出在左上方和格间有游离蓝灰碎片，必须在装配时隔离并复查，不可把原始生成图直接当最终图集。
- `atlas.webp` 以原四列二十行、两倍像素复装。`atlas.json` 记录生成分格、裁框、每格原脚底和复装脚底，末格保持全透明。
