import type { ArenaDefinition, Platform } from '../core/types.js';

const floor = 2024;
function deck(id: string, name: string, tier: Platform['tier'], left: number, right: number,
  rise: number, prop: NonNullable<Platform['prop']>): Platform {
  return { id, name, tier, left, right, y: floor - rise, prop };
}

export const harbor: ArenaDefinition = {
  id: 'harbor', name: '余晖货港', theme: 'harbor', width: 4352, height: 2448, left: 96, right: 4256, floor,
  spawn: [2009, 2355],
  terrain: '贯通栈桥 · 吊盘捷径',
  description: '两岸的渡船和货柜屋面各自拉平，可跳上相连的中层栈桥。高位经检修廊和横移吊盘换边。',
  routes: [['loading', 'gangway', 'west-gallery'], ['east-loading', 'gangway', 'east-gallery']],
  artFrame: [],
  platforms: [
    deck('loading', '西岸装卸台', 1, 330, 2075, 128, 'container'),
    deck('gangway', '贯通栈桥', 2, 805, 3547, 256, 'catwalk'),
    deck('west-gallery', '西吊架检修廊', 3, 520, 1515, 386, 'gallery'),
    deck('east-loading', '东岸装卸台', 1, 2277, 4045, 128, 'trailer'),
    deck('east-gallery', '东吊架检修廊', 3, 2885, 3810, 386, 'gallery'),
    { ...deck('crane', '横移吊盘', 3, 1500, 1850, 384, 'pallet'),
      travel: { distance: 1050, period: 540, dwell: 36, phase: 135 } }
  ]
};
