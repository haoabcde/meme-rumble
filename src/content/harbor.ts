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
  description: '两翼货柜经栈桥通往检修廊。等吊盘靠近栈桥便可跳上，搭它穿过两座吊架之间的水道。',
  routes: [['loading', 'gangway', 'west-gallery'], ['east-loading', 'overpass', 'east-gallery']],
  artFrame: [],
  platforms: [
    deck('boat-bow', '渡船顶棚', 1, 760, 1320, 98, 'ferry'),
    deck('loading', '西侧货柜顶', 1, 1520, 1872, 128, 'container'),
    deck('gangway', '左侧装卸栈桥', 2, 1240, 1785, 256, 'catwalk'),
    deck('west-gallery', '西吊架检修廊', 3, 1170, 1515, 386, 'gallery'),
    deck('east-loading', '东侧货柜顶', 1, 2492, 2890, 128, 'trailer'),
    deck('overpass', '右侧绳栏栈桥', 2, 2590, 3130, 256, 'catwalk'),
    deck('east-gallery', '东吊架检修廊', 3, 2885, 3240, 386, 'gallery'),
    deck('end-boat', '补给船客舱', 1, 3090, 3690, 98, 'ferry'),
    { ...deck('crane', '横移吊盘', 3, 1500, 1850, 384, 'pallet'),
      travel: { distance: 1050, period: 540, dwell: 36, phase: 135 } }
  ]
};
