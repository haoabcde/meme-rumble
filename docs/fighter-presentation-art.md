# 角色胜利图接入

`victoryArt` 用于整场胜利结算的左侧角色画面。它可以表现完整站姿或标志性胜利动作。比分和操作位于右侧。四个角色的大招继续使用各自已经制作的演出资源和原有绘制路径。

## 文件与安全区

在 `assets/fighters/` 下提交 `<角色 ID>-victory.webp` 或 `<角色 ID>-victory.png`，使用 sRGB 和透明背景。建议画布为 1440 × 1600，脸、手和标志性道具放在中间约 75% 宽、80% 高的区域。导出后在米白与深灰底上检查半透明边缘。角色 ID 为 `whale`、`frog`、`banana`、`gaga`。

## 接入

把实际文件放入素材目录，再编辑 [fighter-presentation.ts](../src/web/fighter-presentation.ts)。

```ts
import whaleVictory from '../../assets/fighters/whale-victory.webp';

export const fighterPresentation: Readonly<Partial<Record<string, FighterPresentation>>> = {
  whale: {
    victoryArt: {
      src: whaleVictory,
      anchor: { x: .50, y: .53 },
      scale: 1.08,
      facing: 'right',
      safeArea: { x: .15, y: .10, width: .70, height: .80 },
    },
  },
};
```

- `anchor` 使用归一化素材坐标，左上角为 `(0, 0)`，右下角为 `(1, 1)`。它是缩放时保持稳定的焦点，通常在脸部与躯干之间。
- `scale` 默认 1。`safeArea` 表示必须保留的区域，使用同一套归一化坐标。表现层据此限制缩放。
- `facing` 表示源图朝向。结算画面让角色朝向比分区域。
- Web 构建会把静态导入的 PNG/WebP 内联到离线 HTML。没有配置或素材解码失败时，结算使用选角立绘。

## 本地验收

1. 执行 `npm run build`，打开 `dist/index.html`。
2. 用该角色赢得一回合决胜。检查胜利图方向和比分安全区。`#result-art[data-custom]` 表示定制图已载入，可确认图片的 `currentSrc` 为 `data:image/` 且 `naturalWidth > 0`。
3. 用未配置胜利图的角色再赢一局，确认结算改用该角色的选角立绘。
