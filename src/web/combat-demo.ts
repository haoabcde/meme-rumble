import { arenas } from '../content/arenas.js';
import { basicAttack, defineFighter } from '../content/fighter-kit.js';
import { roster } from '../content/roster.js';

// Shared interface examples with public artwork, independent of the four authored kits.
const box = { x: 8, y: -112, w: 145, h: 100 };
for (const id of ['whale', 'banana']) {
  const index = roster.findIndex(entry => entry.fighter.id === id);
  const { fighter, art, height, accent } = roster[index];
  roster[index] = defineFighter({
    id, name: '接口训练体', art, height, accent,
    signatureMoves: [
      {
        ...basicAttack, id: 'timeline-probe', name: '两段判定样例', slot: 'B',
        startup: 4, active: 12, recovery: 10, advance: 0, push: 0,
        cancelOnHit: [], damage: 30, hitstun: 24,
        hitTimeline: [
          { from: 4, to: 7, group: 'first', boxes: [box] },
          { from: 11, to: 16, group: 'second', boxes: [box], damage: 50, stop: 6 }
        ],
        hurtTimeline: [{ from: 0, to: 4, boxes: [{ x: -26, y: -80, w: 52, h: 80 }] }],
        feedback: { color: '#93ffe7', sound: 'sharp', shake: 3, flash: .3 },
        animation: [{ frame: 0, cell: 4 }, { frame: 4, cell: 5 }, { frame: 11, cell: 7 }]
      },
      {
        ...basicAttack, id: 'entity-probe', name: '独立实体样例', slot: 'C',
        startup: 2, active: 1, recovery: 2, advance: 0, cancelOnHit: [], hitTimeline: [],
        entities: [{
          id: 'sample-orb', spawnFrame: 2, lifetime: 120,
          offset: { x: 30, y: -70 }, velocity: { x: 6, y: 0 },
          hitbox: { x: -15, y: -15, w: 30, h: 30 },
          damage: 45, hitstun: 20, blockstun: 7, guardCost: 10,
          push: 0, lift: 0, stop: 4, color: '#f6cf79',
          feedback: { color: '#f6cf79', sound: 'heavy', shake: 4, flash: .2 }
        }]
      },
      {
        ...basicAttack, id: 'chord-probe', name: '组合输入样例', slot: 'C',
        comboKeys: ['B'], cancelOnHit: [], damage: 20
      }
    ],
    ultimate: { cost: 100, move: { ...basicAttack, id: 'ultimate-probe', name: '大招联调', cancelOnHit: [] } }
  });
}
const arena = arenas.find(entry => entry.id === 'harbor')!;
arena.spawn = [arena.spawn[1] - 96, arena.spawn[1]];
document.title = '战斗接口联调 · Meme 乱斗';
document.querySelector<HTMLSelectElement>('#training-speed')!.value = '.5';
void import('./game.js').then(({ openPractice }) => {
  openPractice(new URLSearchParams({ practice: arena.id, p1: 'whale', p2: 'banana' }));
  document.getElementById('debug')!.click();
  document.getElementById('footer-main')!.textContent = 'U 两段判定 · I 独立实体 · U＋I 组合输入 · O 大招';
});
