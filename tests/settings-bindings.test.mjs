import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPreferences } from '../dist/web/settings.js';

test('ultimate defaults to O and old defaults migrate without overwriting custom bindings', () => {
  const original = globalThis.localStorage;
  let saved = null;
  globalThis.localStorage = { getItem: () => saved };
  try {
    const fresh = loadPreferences();
    assert.equal(fresh.bindings[0].ULT, 'KeyO');
    assert.equal(fresh.bindings[0].C, 'KeyI');
    assert.equal(fresh.bindings[1].ULT, 'Numpad6');
    const old = structuredClone(fresh);
    delete old.bindingVersion;
    [old.bindings[0].C, old.bindings[0].ULT] = ['KeyO', 'KeyI'];
    [old.bindings[1].C, old.bindings[1].ULT] = ['Numpad6', 'Numpad5'];
    saved = JSON.stringify(old);
    const migrated = loadPreferences();
    assert.deepEqual([migrated.bindings[0].C, migrated.bindings[0].ULT], ['KeyI', 'KeyO']);
    assert.deepEqual([migrated.bindings[1].C, migrated.bindings[1].ULT], ['Numpad5', 'Numpad6']);
    old.bindings[0].ULT = 'KeyP';
    saved = JSON.stringify(old);
    const custom = loadPreferences();
    assert.deepEqual([custom.bindings[0].C, custom.bindings[0].ULT], ['KeyO', 'KeyP']);
    old.bindingVersion = 2;
    old.bindings[0].ULT = 'KeyI';
    saved = JSON.stringify(old);
    assert.deepEqual([loadPreferences().bindings[0].C, loadPreferences().bindings[0].ULT], ['KeyO', 'KeyI']);
  } finally { globalThis.localStorage = original; }
});
