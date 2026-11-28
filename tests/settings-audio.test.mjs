import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPreferences } from '../dist/web/settings.js';

test('old saved settings retain their master volume while new audio channels start enabled', () => {
  const storage = globalThis.localStorage;
  try {
    globalThis.localStorage = { getItem: () => JSON.stringify({ volume: 35, shake: false }) };
    const settings = loadPreferences();
    assert.equal(settings.volume, 35);
    assert.equal(settings.sfxVolume, 100);
    assert.equal(settings.voiceVolume, 100);
    assert.equal(settings.bgmVolume, 100);
    assert.equal(settings.shake, false);
    globalThis.localStorage = { getItem: () => JSON.stringify({ volume: 70, sfxVolume: 0, voiceVolume: 45, bgmVolume: 25 }) };
    const channels = loadPreferences();
    assert.equal(channels.sfxVolume, 0);
    assert.equal(channels.voiceVolume, 45);
    assert.equal(channels.bgmVolume, 25);
  } finally {
    if (storage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = storage;
  }
});
