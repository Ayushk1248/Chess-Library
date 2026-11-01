const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { Chess } = require('chess.js');
const filename = path.resolve(__dirname, '../lib/repertoire-navigation.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { repertoireMoveRows, repertoirePosition, moveLabel } = loaded.exports;

function savedLine() {
  const chess = new Chess();
  return ['c4', 'c5', 'Nf3', 'Nc6', 'Nc3'].map((san, index) => {
    const move = chess.move(san);
    return { id: `move-${index}`, move_san: move.san, fen_after: chess.fen(), move_number: Number(move.before.split(' ')[5]) };
  });
}

test('a saved four-move variation starting with Black keeps the correct columns and numbers', () => {
  const rows = repertoireMoveRows(savedLine().slice(1));
  assert.deepEqual(rows, [
    { no: 1, black: 'c5', blackIndex: 0 },
    { no: 2, white: 'Nf3', whiteIndex: 1, black: 'Nc6', blackIndex: 2 },
    { no: 3, white: 'Nc3', whiteIndex: 3 },
  ]);
});

test('selecting an interior move resolves its exact parent and position across ancestors', () => {
  const path = savedLine();
  const selected = repertoirePosition(path, 1, 2);
  assert.equal(selected.parentNodeId, path[2].id);
  assert.equal(selected.fen, path[2].fen_after);
  assert.equal(selected.label, 'After 2. Nf3');
  assert.equal(new Chess(selected.fen).turn(), 'b');
  const replay = new Chess(selected.fen);
  assert.equal(replay.move('Nf6').san, 'Nf6');
  assert.equal(path.length, 5, 'selecting a position preserves the complete saved line');
});

test('line start points at the ancestor, and end points at the final saved move', () => {
  const path = savedLine();
  assert.equal(repertoirePosition(path, 1, 0).parentNodeId, path[0].id);
  assert.equal(repertoirePosition(path, 1, 999).parentNodeId, path[4].id);
  assert.equal(repertoirePosition([], 0, 0).label, 'Starting position');
  assert.equal(moveLabel(path[1]), '1... c5');
});

test('invalid saved positions are rejected before branching', () => {
  const path = savedLine();
  path[1].fen_after = new Chess().fen();
  assert.throws(() => repertoirePosition(path, 1, 2), /Could not replay saved move c5/);
});
