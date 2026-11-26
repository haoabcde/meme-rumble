# 咕咕嘎嘎音效来源

表内标注 Kenney 和 artisticdude 的素材为 CC0 1.0。游戏内使用单声道、32 kHz、16 位 PCM WAV，并随网页打包。

| 游戏文件 | 原始素材 |
|---|---|
| `jab.wav`、`backhand.wav` | [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) 的 `impactSoft_medium_000.ogg`、`impactSoft_medium_001.ogg` |
| `pole-sweep.wav`、`pole-reverse.wav`、`pole-launch.wav` | [artisticdude 的 Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack) 的 `swish-1.wav`、`swish-4.wav`、`swish-8.wav`。横扫和反扫剪短了开头的静音 |
| `pole-hit.wav`、`guard.wav` | [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) 的 `impactMetal_medium_000.ogg`、`impactMetal_light_003.ogg` |
| `pole-heavy-hit.wav` | Kenney 的 `impactPunch_heavy_001.ogg` 叠加 `impactMetal_medium_000.ogg`，均衡后裁短尾音 |
| `pole-ground.wav` | Kenney 的 `impactWood_heavy_001.ogg` 叠加 `impactMetal_medium_000.ogg`，表现电线杆击地 |
| `feet-land.wav`、`body-land.wav` | Kenney 的 `impactSoft_medium_002.ogg`、`impactSoft_heavy_000.ogg`，分别用于跳跃落地和倒地撞地，均裁切并滤去高频尾音 |
| `turret-land.wav` | [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) 的 `impactMetal_medium_000.ogg`，做了低通滤波并降低音高 |
| `turret-ready.wav` | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) 的 `switch_001.ogg` |
| `turret-bolt.wav`、`grenade-impact.wav`、`dijiang-impact.wav` | [Kenney Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds) 的 `laserSmall_001.ogg`、`explosionCrunch_000.ogg`、`lowFrequency_explosion_000.ogg`。榴弹爆炸剪至 0.55 秒并淡出 |
| `slide-call.wav` | [Myinstants 的「咕咕嘎嘎」流传音频](https://www.myinstants.com/en/instant/gu-gu-ga-ga-35988/)，截取 0:00.050–0:01.195 的第一声，保留原音高和速度，转换为游戏格式 |
| `victory-lalala.wav` | 胜利演出的录音，计划使用抖音上流传的「啦啦啦啦啦」。**文件尚未加入**，原始出处与授权待核实后登记 |

Kenney 源文件取自 [Open Game SFX Index](https://github.com/Mcamento8/open-game-sfx-index)。本次落地及重击所用的源文件已与 [索引固定版本的 SHA-256](https://github.com/Mcamento8/open-game-sfx-index/blob/34bbe8b525b5ceff3804915ea745532af11f6055/index.json) 核对。开源格斗游戏 [3d-fighter 的素材清单](https://github.com/clintcan/3d-fighter/blob/main/assets/CREDITS.md) 也记录了这套撞击包用于拳击、格挡和跌倒。
