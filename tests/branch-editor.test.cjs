const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { Chess } = require('chess.js');
const filename = path.resolve(__dirname, '../lib/branch-editor.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { activeBranch, branchPosition, newBranch, playBranchMove, removeBranchMoves } = loaded.exports;

function initial() {
  const game = new Chess();
  for (const move of ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']) game.move(move);
  return { anchor: { fen: game.fen(), parentNodeId: 'fifth-move', label: 'After 3. Bb5' },
    lines: [], activeLineId: null, moveIndex: 0, nextLineNumber: 1 };
}

test('creates multiple sibling lines from the same fifth-move anchor without rewinding', () => {
  let state = playBranchMove(initial(), 'a7', 'a6');
  state = playBranchMove(state, 'b5', 'a4');
  const first = activeBranch(state);
  state = newBranch(state);
  assert.equal(branchPosition(state).fen, initial().anchor.fen);
  state = playBranchMove(state, 'd7', 'd6');
  assert.equal(state.lines.length, 2);
  assert.ok(state.lines.every(line => line.parentNodeId === 'fifth-move' && line.startFen === initial().anchor.fen));
  assert.deepEqual(first.moves.map(move => move.moveSan), ['a6', 'Ba4']);
  assert.equal(activeBranch(state).moves[0].moveSan, 'd6');
});

test('retains nested branching and the old line when playing a different historical move', () => {
  let state = playBranchMove(initial(), 'a7', 'a6');
  state = playBranchMove(state, 'b5', 'a4');
  const first = activeBranch(state);
  state = { ...state, moveIndex: 1 };
  state = playBranchMove(state, 'b5', 'c6');
  assert.equal(state.lines.length, 2);
  assert.equal(activeBranch(state).parentNodeId, first.moves[0].id);
  assert.equal(activeBranch(state).moves[0].moveSan, 'Bxc6');
  assert.deepEqual(first.moves.map(move => move.moveSan), ['a6', 'Ba4']);
  assert.equal(state.anchor.parentNodeId, 'fifth-move');
});

test('follows an existing continuation instead of creating duplicates', () => {
  let state = playBranchMove(initial(), 'a7', 'a6');
  state = playBranchMove(state, 'b5', 'a4');
  const line = activeBranch(state);
  state = playBranchMove({ ...state, moveIndex: 1 }, 'b5', 'a4');
  assert.equal(state.lines.length, 1);
  assert.equal(state.moveIndex, 2);
  state = playBranchMove(newBranch(state), 'a7', 'a6');
  assert.equal(state.lines.length, 1);
  assert.equal(state.activeLineId, line.id);
  assert.equal(state.moveIndex, 1);
});

test('new lines use a newly pinned deeper position until the anchor is changed', () => {
  let state = playBranchMove(initial(), 'a7', 'a6');
  const anchor = branchPosition(state);
  state = { ...state, anchor };
  state = playBranchMove(newBranch(state), 'b5', 'a4');
  state = playBranchMove(newBranch(state), 'b5', 'c6');
  assert.equal(state.lines.length, 3);
  assert.ok(state.lines.slice(1).every(line => line.startFen === anchor.fen && line.parentNodeId === anchor.parentNodeId));
});

test('invalid moves leave no empty or partially modified draft', () => {
  const state = initial();
  assert.throws(() => playBranchMove(state, 'e7', 'e4'));
  assert.deepEqual(state, initial());
  const empty = newBranch(state);
  assert.equal(newBranch(empty).lines.length, 1);
});

test('records standard full-move numbers and validates all saved parent/FEN chains', () => {
  let state = playBranchMove(initial(), 'a7', 'a6');
  state = playBranchMove(state, 'b5', 'a4');
  state = playBranchMove(state, 'g8', 'f6');
  const line = activeBranch(state);
  assert.deepEqual(line.moves.map(move => move.moveNumber), [3, 4, 4]);
  assert.deepEqual(line.moves.map(move => move.isMainline), [false, true, true]);
  const game = new Chess(line.startFen);
  let parent = line.parentNodeId;
  for (const move of line.moves) {
    assert.equal(move.parentNodeId, parent);
    game.move(move.moveSan);
    assert.equal(game.fen(), move.fenAfter);
    parent = move.id;
  }
});

test('deletion prunes dependent branches and resets a deleted pinned anchor', () => {
  let state = playBranchMove(initial(), 'a7', 'a6');
  const first = activeBranch(state);
  state = { ...state, anchor: branchPosition(state) };
  state = playBranchMove(newBranch(state), 'b5', 'a4');
  const before = state;
  const result = removeBranchMoves(state, new Set([first.moves[0].id]), initial().anchor, first.id);
  assert.equal(result.lines.length, 0);
  assert.equal(result.activeLineId, null);
  assert.deepEqual(result.anchor, initial().anchor);
  assert.equal(before.lines.length, 2, 'Undo snapshot remains immutable');
});
