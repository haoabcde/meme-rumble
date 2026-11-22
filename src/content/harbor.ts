import type { ArenaDefinition, Platform } from '../core/types.js';

const floor = 2024;
function deck(id: string, name: string, tier: Platform['tier'], left: number, right: number,
  rise: number, prop: NonNullable<Platform['prop']>): Platform {
  return { id, name, tier, left, right, y: floor - rise, prop };
}

export const harbor: ArenaDefinition = {
  id: 'harbor', name: '余晖货港', theme: 'harbor', width: 4352, height: 2448, left: 96, right: 4256, floor,
  spawn: [2009, 2355],
  terrain: '渡船码头 · 横移吊盘',
  description: '三段栈桥可以连续横跳。两翼货柜通往龙门吊检修廊，在廊边可跳上往返中路的吊盘。',
  routes: [['loading', 'gangway', 'west-cabin', 'west-gallery'], ['east-loading', 'overpass', 'east-cabin', 'east-gallery']],
  artFrame: [],
  platforms: [
    deck('boat-bow', '渡船顶棚', 1, 155, 575, 88, 'ferry'),
    deck('west-shed', '船坞候船室', 2, 460, 936, 211, 'office'),
    deck('west-yard', '西堆场拖车', 1, 826, 1235, 121, 'trailer'),
    deck('west-transfer', '船坞踏桥', 2, 862, 1205, 256, 'catwalk'),
    deck('west-cabin', '西塔值班室', 3, 1060, 1430, 392, 'office'),
    deck('west-gallery', '西吊架检修廊', 4, 1220, 1555, 529, 'gallery'),
    deck('loading', '西侧货柜顶', 1, 1520, 1872, 130, 'container'),
    deck('gangway', '左侧装卸栈桥', 2, 1240, 1785, 261, 'catwalk'),
    deck('middle', '中央转运桥', 2, 1980, 2396, 256, 'bridge'),
    deck('overpass', '右侧绳栏栈桥', 2, 2590, 3130, 262, 'catwalk'),
    deck('east-loading', '东侧货柜顶', 1, 2492, 2890, 131, 'trailer'),
    deck('east-cabin', '东塔调度室', 3, 2968, 3340, 396, 'office'),
    deck('east-gallery', '东吊架检修廊', 4, 2828, 3146, 528, 'gallery'),
    deck('freight-dock', '东侧卸货台', 1, 3020, 3410, 102, 'container'),
    deck('east-pier', '东侧登船廊', 2, 3290, 3780, 234, 'catwalk'),
    deck('end-boat', '补给船客舱', 1, 3690, 4182, 111, 'ferry'),
    { ...deck('crane', '横移吊盘', 3, 1500, 1850, 394, 'pallet'),
      travel: { distance: 1050, period: 540, dwell: 36, phase: 135 } }
  ]
};
