import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { embedFighterAudio } from '../scripts/fighter-audio.mjs';

// One frame of 8 kHz, mono, 16-bit PCM silence.
const wav = Buffer.from('UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==', 'base64');

async function project(t) {
  const directory = await mkdtemp(join(tmpdir(), 'meme-fighter-audio-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'assets/audio/voice'), { recursive: true });
  return directory;
}

function fighter(id, src) {
  return { fighter: { id }, audio: { line: { src } } };
}

test('offline fighter audio is keyed by its original project path, with one copy per shared source', async t => {
  const directory = await project(t);
  const src = 'assets/audio/voice/测试.WAV';
  await writeFile(join(directory, src), wav);
  assert.deepEqual(await embedFighterAudio([fighter('one', src), fighter('two', src)], directory), {
    [src]: 'data:audio/wav;base64,' + wav.toString('base64')
  });
  assert.deepEqual(await embedFighterAudio([{ fighter: { id: 'legacy' } }], join(directory, 'missing')), {});
});

test('offline fighter audio rejects missing, malformed, spoofed and oversized sources', async t => {
  const directory = await project(t);
  const invalid = [
    ['plain.wav', Buffer.from('not audio')], ['clip.mp3', wav], ['truncated.wav', wav.subarray(0, -2)],
    ['tag-only.mp3', Buffer.from('49443304000000000000', 'hex')],
    ['truncated.ogg', Buffer.from('OggS', 'ascii')], ['truncated.webm', Buffer.from('1a45dfa3', 'hex')]
  ];
  for (const [name, data] of invalid) {
    const src = 'assets/audio/' + name;
    await writeFile(join(directory, src), data);
    await assert.rejects(embedFighterAudio([fighter('fixture', src)], directory), /fixture.*audio\.line.*文件头/);
  }
  const missing = 'assets/audio/missing.wav';
  await assert.rejects(embedFighterAudio([fighter('fixture', missing)], directory), /fixture.*missing\.wav.*ENOENT/);
  const big = 'assets/audio/big.wav';
  await writeFile(join(directory, big), wav);
  await truncate(join(directory, big), 8 * 1024 ** 2 + 1);
  await assert.rejects(embedFighterAudio([fighter('fixture', big)], directory), /fixture.*big\.wav.*8 MiB/);
});

test('offline fighter audio checks logical paths and rejects symbolic links outside the audio tree', async t => {
  const directory = await project(t);
  for (const src of ['assets/audio/../outside.wav', 'assets/audio/%2e%2e/outside.wav', 'file:///outside.wav']) {
    await assert.rejects(embedFighterAudio([fighter('fixture', src)], directory), /fixture.*assets\/audio\/ 内/);
  }
  const outside = join(directory, 'external');
  await mkdir(outside);
  await writeFile(join(outside, 'line.wav'), wav);
  let fileLink=true;
  try { await symlink(join(outside, 'line.wav'), join(directory, 'assets/audio/link.wav'), 'file'); }
  catch(error){if(process.platform!=='win32'||error.code!=='EPERM')throw error;fileLink=false;t.diagnostic('File symlink privilege unavailable; directory escape checked via Windows junction.');}
  await symlink(outside, join(directory, 'assets/audio/escape'), process.platform==='win32'?'junction':'dir');
  for (const src of [...(fileLink?['assets/audio/link.wav']:[]), 'assets/audio/escape/line.wav']) {
    await assert.rejects(embedFighterAudio([fighter('fixture', src)], directory), /fixture.*素材解析后须位于/);
  }
  await rm(join(directory, 'assets/audio'), { recursive: true });
  await symlink(outside, join(directory, 'assets/audio'), process.platform==='win32'?'junction':'dir');
  await assert.rejects(embedFighterAudio([fighter('fixture', 'assets/audio/line.wav')], directory), /fixture.*不能重定向/);
});
