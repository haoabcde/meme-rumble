import type { ArenaDefinition, Duo, Platform } from '../core/types.js';

const artwork = { width: 1672, height: 941 };

type PaintedSurface = [id: string, name: string, tier: Platform['tier'], left: number, right: number, lipY: number];
type TerrainHeight = [lipY: number, riseFromFloor: number];
type ArenaDetails = Pick<ArenaDefinition, 'id' | 'name' | 'theme' | 'terrain' | 'description' | 'route' | 'width'>;

function arena(
  details: ArenaDetails,
  levels: TerrainHeight[],
  surfaces: PaintedSurface[]
): ArenaDefinition {
  const { width } = details;
  const height = width * 9 / 16;
  const left = 96;
  const right = width - left;
  const floor = Math.round(height * .827);
  const spawn: Duo<number> = [width / 2 - 173, width / 2 + 173];
  const scale = width / artwork.width;
  const [topLip, topRise] = levels[0];
  // Most extra vertical room is above the scenery. The playable tiers are calibrated
  // independently so every climb works with the roster's shared jump.
  const artFrame = [
    { sourceY: 0, worldY: 0 },
    { sourceY: (topLip - 196) / artwork.height, worldY: floor - topRise - Math.round(196 * scale) },
    ...levels.map(([lip, rise]) => ({ sourceY: lip / artwork.height, worldY: floor - rise })),
    { sourceY: 1, worldY: height }
  ];
  const x = (pixel: number) => Math.min(right, Math.max(left, Math.round(pixel * scale)));
  const y = (pixel: number) => {
    const sourceY = pixel / artwork.height;
    const next = artFrame.findIndex((point, index) => index > 0 && point.sourceY >= sourceY);
    const start = artFrame[next - 1];
    const end = artFrame[next];
    return Math.round(start.worldY + (end.worldY - start.worldY) *
      (sourceY - start.sourceY) / (end.sourceY - start.sourceY));
  };

  return {
    ...details, height, left, right, floor, spawn, artFrame,
    platforms: surfaces.map(([id, name, tier, start, end, lipY]) =>
      ({ id, name, tier, left: x(start), right: x(end), y: y(lipY) }))
  };
}

export const arenas: ArenaDefinition[] = [
  arena({
    id: 'dorm-roof', name: '宿舍楼顶', theme: 'dorm', width: 3840, terrain: '花坛起跳 · 连廊追击',
    description: '西侧树荫和东侧温室都能登阳台。跨楼连廊适合上层追击，也能从台沿落回长走廊。',
    route: ['west', 'bridge', 'terrace']
  }, [[458, 397], [538, 261], [653, 130], [801, 0]], [
    ['planter', '树荫花坛', 1, 25, 211, 762],
    ['west', '西侧花箱阳台', 1, 192, 682, 653],
    ['east', '东侧花箱阳台', 1, 991, 1364, 653],
    ['greenhouse', '温室门台', 1, 1389, 1549, 761],
    ['bridge', '跨楼连廊', 2, 366, 1298, 538],
    ['terrace', '机房屋顶', 3, 699, 974, 458]
  ]),
  arena({
    id: 'night-court', name: '夜训球场', theme: 'court', width: 3968, terrain: '双边半场 · 内外登台',
    description: '两端半场适合拉开距离。中央席和外侧长椅都能跳上看台，再向内跃上检修台。',
    route: ['bench', 'west-stand', 'score-deck']
  }, [[594, 395], [631, 263], [747, 134], [772, 127], [807, 0]], [
    ['west-bench', '西侧长椅', 1, 126, 385, 772],
    ['bench', '中央替补席', 1, 503, 1169, 747],
    ['east-bench', '东侧长椅', 1, 1289, 1547, 772],
    ['west-stand', '西翼看台', 2, 272, 698, 631],
    ['east-stand', '东翼看台', 2, 977, 1400, 631],
    ['score-deck', '计分牌检修台', 3, 682, 991, 594]
  ]),
  arena({
    id: 'harbor', name: '余晖货港', theme: 'harbor', width: 4352, terrain: '最长跑道 · 双向跨桥',
    description: '码头地面全线贯通。东侧卸货台通往货柜顶，两道栈桥能横跳互通，也能上中央吊盘。',
    route: ['loading', 'gangway', 'crane']
  }, [[479, 400], [583, 264], [672, 130], [785, 0]], [
    ['loading', '西侧货柜顶', 1, 215, 743, 672],
    ['east-loading', '东侧货柜顶', 1, 1085, 1423, 672],
    ['freight-dock', '东侧卸货台', 1, 1431, 1636, 727],
    ['gangway', '左侧装卸栈桥', 2, 505, 879, 583],
    ['overpass', '右侧绳栏栈桥', 2, 925, 1269, 583],
    ['crane', '悬吊货盘', 3, 731, 1065, 479]
  ]),
  arena({
    id: 'star-station', name: '星电站', theme: 'station', width: 4096, terrain: '高台分离 · 中层跳桥',
    description: '双塔各自制高。换边可以走开阔地面，也能在中层桥头起跳，跨到另一座塔。',
    route: ['dock-left', 'relay-left', 'upper-left']
  }, [[440, 402], [503, 269], [627, 134], [741, 0]], [
    ['dock-left', '左塔检修台', 1, 184, 650, 627],
    ['dock-right', '右塔检修台', 1, 1021, 1489, 627],
    ['relay-left', '左电缆桥', 2, 452, 788, 503],
    ['relay-right', '右电缆桥', 2, 890, 1220, 503],
    ['upper-left', '左塔控制台', 3, 253, 586, 440],
    ['upper-right', '右塔控制台', 3, 1085, 1426, 440]
  ])
];
