const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../lib/repertoire-trim.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { continuationToRemove } = loaded.exports;
const nodes = [
  { id: 'c4', parent_node_id: null, variation_name: null },
  { id: 'e5', parent_node_id: 'c4', variation_name: null },
  { id: 'Nc3', parent_node_id: 'e5', variation_name: null },
  { id: 'Nf6', parent_node_id: 'Nc3', variation_name: null },
  { id: 'c5', parent_node_id: 'c4', variation_name: 'Symmetric English' },
  { id: 'Nf3', parent_node_id: 'c5', variation_name: null },
];

test('removes the accidental main-line extension while preserving c4 and Symmetric English', () => {
  const removed = continuationToRemove(nodes, ['c4', 'e5', 'Nc3', 'Nf6'], 1);
  assert.deepEqual(removed.map(node => node.id), ['e5', 'Nc3', 'Nf6']);
  assert.ok(!removed.some(node => node.id === 'c4' || node.id === 'c5' || node.id === 'Nf3'));
  assert.equal(nodes.length, 6, 'preview must not mutate the saved data');
});

test('includes dependent variations in the removal preview', () => {
  const withChild = [...nodes, { id: 'child', parent_node_id: 'Nc3', variation_name: 'Dependent branch' }];
  assert.deepEqual(continuationToRemove(withChild, ['c4', 'e5', 'Nc3', 'Nf6'], 1).map(node => node.id), ['e5', 'Nc3', 'Nf6', 'child']);
});

test('no continuation at the final move; invalid selection is rejected', () => {
  assert.deepEqual(continuationToRemove(nodes, ['c4'], 1), []);
  assert.throws(() => continuationToRemove(nodes, ['c4'], -1));
  assert.throws(() => continuationToRemove(nodes, ['c4'], 2));
  assert.throws(() => continuationToRemove(nodes, ['missing'], 0));
});
