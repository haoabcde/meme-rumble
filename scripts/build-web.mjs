import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { audioDemoRoster } from '../dist/content/audio-demo.js';
import { roster } from '../dist/content/roster.js';
import { embedFighterImages } from './fighter-art.mjs';
import { embedFighterAudio } from './fighter-audio.mjs';
import { loadOnlineConfig } from './online-config.mjs';
import { listSoundBank } from './sound-bank.mjs';

const root = new URL('../', import.meta.url);
const { onlineBuild, onlineUrl } = await loadOnlineConfig(root);
const demoRoster = roster.map(entry => audioDemoRoster.find(demo => demo.fighter.id === entry.fighter.id) ?? entry);
async function loadSoundBank(subpath, extensions) {
  const entries = await listSoundBank(root, subpath, extensions);
  return Object.fromEntries(await Promise.all(entries.map(async ([key, , fileUrl]) => [
    key, (await readFile(fileUrl)).toString('base64')
  ])));
}

const [fighterImages, fighterAudio, demoAudio, gagaSounds, bananaSounds] = await Promise.all([
  embedFighterImages(roster, fileURLToPath(new URL('assets/fighters/', root))),
  embedFighterAudio(roster, fileURLToPath(root)),
  embedFighterAudio(demoRoster, fileURLToPath(root)),
  loadSoundBank('assets/audio/gaga/', ['.wav']),
  loadSoundBank('assets/audio/banana/', ['.mp3', '.wav'])
]);
const pixelfxLicense = await readFile(new URL('assets/fx/pixelfx/LICENSE', root), 'utf8');
async function bundleEntry(entry, audio = fighterAudio) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('src/web/' + entry, root))],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    loader: { '.webp': 'dataurl', '.png': 'dataurl' },
    define: {
      __FIGHTER_IMAGES__: JSON.stringify(fighterImages),
      __FIGHTER_AUDIO__: JSON.stringify(audio),
      __GAGA_SOUNDS__: JSON.stringify(gagaSounds),
      __BANANA_SOUNDS__: JSON.stringify(bananaSounds),
      __ONLINE_BUILD__: JSON.stringify(onlineBuild),
      __ONLINE_URL__: JSON.stringify(onlineUrl)
    },
    write: false
  });
  return result.outputFiles[0].text;
}
const [template, css, game, counterDemo, ultimateDemo, combatDemo, audioDemo, whaleReview, frogReview, launchPage, launchDemo, motionReview] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'), readFile(new URL('styles.css', root), 'utf8'),
  bundleEntry('game.ts'), bundleEntry('counter-demo.ts'), bundleEntry('ultimate-demo.ts'), bundleEntry('combat-demo.ts'),
  bundleEntry('audio-demo.ts', demoAudio), bundleEntry('whale-review.ts'), bundleEntry('frog-review.ts'),
  readFile(new URL('src/web/launch-demo.html', root), 'utf8'), bundleEntry('launch-demo.ts'), bundleEntry('motion-review.ts')
]);

function standalone(script, page = template, entry = 'game') {
  return page
    .replace('<!doctype html>', () => '<!doctype html>\n<!-- Pixelfx sprite sheets\n' + pixelfxLicense + '-->')
    .replace('<link rel="stylesheet" href="./styles.css">', () => '<style>\n' + css + '</style>')
    .replace('<script src="./dist/' + entry + '.bundle.js"></script>', () =>
      '<script>\n' + script.replace(/<\/script/gi, '<\\/script') + '</script>');
}
async function publish(file, content) {
  const pending = new URL('dist/.' + file + '.' + process.pid, root);
  await writeFile(pending, content);
  await rename(pending, new URL('dist/' + file, root));
}
await Promise.all([
  publish('online-version.txt', onlineBuild + '\n'),
  publish('game.bundle.js', game), publish('index.html', standalone(game)),
  publish('frog-review.bundle.js', frogReview),
  publish('frog-review-dev.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>奶蛙造型审阅</title><body><script src="./dist/frog-review.bundle.js"></script></body></html>'),
  publish('guard-counter-demo.html', standalone(counterDemo)),
  publish('ultimate-demo.html', standalone(ultimateDemo)),
  publish('combat-demo.html', standalone(combatDemo)),
  publish('launch-demo.html', standalone(launchDemo, launchPage, 'launch-demo')),
  publish('frog-review.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>奶娃制作</title><body><script>'+frogReview.replace(/<\/script/gi,'<\\/script')+'</script></body></html>'),
  publish('whale-review.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>大肥鱼完整接入</title><body><script>'+whaleReview.replace(/<\/script/gi,'<\\/script')+'</script></body></html>'),
  publish('motion-review.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><script>'+motionReview.replace(/<\/script/gi,'<\\/script')+'</script></body></html>'),
  publish('audio-demo.html', standalone(audioDemo))
]);
