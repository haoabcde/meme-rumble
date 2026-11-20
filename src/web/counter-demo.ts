import { arenas } from '../content/arenas.js';
import { defineFighter } from '../content/fighter-kit.js';
import { roster } from '../content/roster.js';

// Only the separate demo entry uses these sample moves and close-range spawns.
const sampleSlot = roster.findIndex(entry => entry.fighter.id === 'whale');
const { fighter, art, accent, height } = roster[sampleSlot];
roster[sampleSlot] = defineFighter({
  id: fighter.id, name: '防反训练体', art, accent, height,
  guardCounter: { windowFrames: 4, actionId: 'common-jab' },
  signatureMoves: [{
    id: 'parry-stance', name: '防反架势', slot: 'B', posture: 'ground',
    startup: 2, active: 4, recovery: 12, counterTo: 'common-jab'
  }]
});
const harbor = arenas.find(arena => arena.id === 'harbor')!;
harbor.spawn = [harbor.spawn[1] - 96, harbor.spawn[1]];

document.title = '防反联调 · Meme 乱斗';
document.querySelector<HTMLSelectElement>('#training-dummy')!.value = 'jab';
document.querySelector<HTMLSelectElement>('#training-speed')!.value = '.5';

// Initialize the game with the sample roster before its portraits and inputs are built.
void import('./game.js').then(({ openPractice }) => {
  openPractice(new URLSearchParams({ practice: harbor.id, p1: fighter.id, p2: 'banana' }));
  document.getElementById('debug')!.click();
});
