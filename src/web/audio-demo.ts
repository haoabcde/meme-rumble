import { arenas } from '../content/arenas.js';
import { audioDemoRoster } from '../content/audio-demo.js';
import { roster } from '../content/roster.js';

for (const entry of audioDemoRoster) {
  const index = roster.findIndex(current => current.fighter.id === entry.fighter.id);
  roster[index] = entry;
}

const harbor = arenas.find(arena => arena.id === 'harbor')!;
harbor.spawn = [harbor.spawn[1] - 96, harbor.spawn[1]];
document.title = '音频联调 · Meme 乱斗';

void import('./game.js').then(({ openPractice }) => {
  const [testFighter, sparringFighter] = audioDemoRoster;
  openPractice(new URLSearchParams({ practice: harbor.id, p1: testFighter.fighter.id, p2: sparringFighter.fighter.id }));
  document.getElementById('footer-main')!.textContent = 'U 双轨与命中 · I 受击后继续播放 · H 判定框';
});
