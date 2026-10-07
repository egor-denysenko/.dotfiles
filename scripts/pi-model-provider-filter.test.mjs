import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import * as logic from '../dot_config/pi/agent/extensions/model-provider-filter/logic.ts';

const extensionUrl = new URL('../dot_config/pi/agent/extensions/model-provider-tab-filter.ts', import.meta.url);

async function loadExtension(Selector) {
  const source = stripTypeScriptTypes(await readFile(extensionUrl, 'utf8'));
  const module = new vm.SourceTextModule(source);
  await module.link(async (specifier) => {
    let exports;
    if (specifier === '@earendil-works/pi-coding-agent') {
      exports = { AgentSession: class {}, ModelSelectorComponent: Selector };
    } else if (specifier === '@earendil-works/pi-tui') {
      exports = { getKeybindings: () => ({ matches: () => false }), Spacer: class {}, Text: class {} };
    } else if (specifier.endsWith('/logic.ts')) {
      exports = logic;
    } else if (specifier === 'node:fs') {
      exports = { promises: { readFile: async () => { throw new Error('No persisted preference'); } } };
    } else {
      exports = await import(specifier);
    }
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  const handlers = new Map();
  module.namespace.default({ on: (event, handler) => handlers.set(event, handler) });
  return handlers;
}

test('model IDs remain case-sensitive and whitespace-sensitive', () => {
  const models = [
    { provider: 'alpha', id: 'Model' },
    { provider: 'alpha', id: 'model' },
    { provider: 'alpha', id: ' Model' },
    { provider: 'alpha', id: 'Model' },
  ];
  assert.deepEqual(logic.filterModels(models, 'ALPHA'), models.slice(0, 3));
});

test('provider cycling and filtering', () => {
  const models = [{ provider: 'beta', id: 'b' }, { provider: 'alpha', id: 'a' }];
  assert.deepEqual(logic.providers(models), ['alpha', 'beta']);
  assert.equal(logic.nextProvider(logic.providers(models), 'beta'), 'alpha');
  assert.deepEqual(logic.filterModels(models, 'alpha'), [models[1]]);
});

test('snapshot loading filters on first open and subsequent refresh; shutdown restores hook', async () => {
  const models = [{ provider: 'alpha', id: 'a' }, { provider: 'beta', id: 'b' }];
  class Selector {
    currentModel = models[1];
    searchInput = { getValue: () => '' };
    selectedIndex = 0;
    constructor() { this.loadModelsFromSnapshot(); }
    loadModelsFromSnapshot() {
      this.activeModels = models;
      this.filteredModels = models;
    }
    sortModels(items) { return items; }
    filterModels() { this.filteredModels = this.activeModels; }
    updateList() {}
    handleInput() {}
    getScopeText() { return 'Scope'; }
    getScopeHintText() { return 'Hint'; }
  }
  const original = Selector.prototype.loadModelsFromSnapshot;
  const handlers = await loadExtension(Selector);
  handlers.get('session_start')();
  try {
    const selector = new Selector();
    assert.deepEqual(selector.filteredModels, [models[1]]);
    await new Promise(setImmediate);
    selector.loadModelsFromSnapshot();
    assert.deepEqual(selector.filteredModels, [models[1]]);
  } finally {
    handlers.get('session_shutdown')();
  }
  assert.equal(Selector.prototype.loadModelsFromSnapshot, original);
});
