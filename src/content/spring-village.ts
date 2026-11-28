import type { ArenaDefinition, Platform } from '../core/types.js';

// Source art: 2172 × 724; roof coordinates map x linearly to the 4352-wide
// stage. Heights are mapped with one y scale from the painted floor (y=552).
const width = 4352;
const height = 2448;
const floor = 2024;
const roof = (id: string, name: string, tier: Platform['tier'], left: number, right: number, y: number): Platform =>
  ({ id, name, tier, left, right, y, prop: 'shelter' });

export const springVillage: ArenaDefinition = {
  id: 'spring-village', name: '花见晴街', theme: 'court', width, height, floor,
  left: 96, right: width - 96, spawn: [2003, 2349], artFrame: [],
  terrain: '花街屋面 · 远廊换线',
  description: '沿错落屋面上到三处长廊，再跳回花街或从屋面下穿追击。',
  routes: [['east-low'], ['east-low']],
  platforms: [
    roof('west-low', '西街低屋', 1, 252, 799, 1829),
    roof('west-mid', '西街中屋', 1, 787, 1371, 1768),
    roof('west-high', '西街高屋', 1, 1320, 1952, 1701),
    roof('east-mid', '东中高屋', 1, 2216, 2591, 1701),
    roof('east-bridge', '东中长屋', 1, 2511, 3010, 1792),
    roof('east-low', '东中低屋', 1, 2519, 2915, 1878),
    roof('far-east-low', '东街低屋', 1, 3214, 3699, 1829),
    roof('far-east-mid', '东街高屋', 1, 3639, 4172, 1720),
    roof('back-west', '西侧长廊', 1, 401, 1739, 1472),
    roof('back-center', '中央长廊', 1, 1970, 2853, 1470),
    roof('back-east', '东侧长廊', 1, 3182, 3823, 1472)
  ]
};
