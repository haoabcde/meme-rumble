import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('frog battle pose banks use the approved runtime inventory', async () => {
  const inventory = JSON.parse(await readFile('assets/fighters/unified-handdrawn-v1/motion/frog-reference-v2/frog-runtime-coverage.json', 'utf8'));
  const renderer = await readFile('src/web/frog-art.ts', 'utf8');
  const imports = {
    moveSource: inventory.bodyBanks.moves,
    basicSource: inventory.bodyBanks.basics,
    sceneSource: inventory.bodyBanks.scenes,
    travelSource: inventory.bodyBanks.travel,
    angelSource: inventory.bodyBanks.angels,
    normalGuardSource: inventory.bodyBanks['normal-guard'],
    crouchSource: inventory.bodyBanks.crouch,
    thinkingSource: inventory.bodyBanks.thinking,
    introSource: inventory.intro
  };
  for (const [name, asset] of Object.entries(imports)) {
    const match = renderer.match(new RegExp(`import ${name} from '([^']+)'`));
    assert.ok(match, `${name} must be imported by the battle renderer`);
    assert.equal(match[1], '../../' + asset.source, `${name} must use the approved asset`);
    const hash = createHash('sha256').update(await readFile(asset.source)).digest('hex');
    assert.equal(hash, asset.sha256, `${name} must preserve the approved image`);
  }
});
