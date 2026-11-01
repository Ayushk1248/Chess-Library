const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { Chess } = require('chess.js');

const filename = path.resolve(__dirname, '../lib/pgn-import.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const parser = new Module(filename, module);
parser.filename = filename;
parser.paths = module.paths;
parser._compile(compiled, filename);
const { parsePgn } = parser.exports;

test('imports headers, comments, annotations and canonical move numbers', () => {
  const [game] = parsePgn('[Opening "Sicilian Defense"]\n1.e4 {A comment} c5 $1 2.Nf3! d6 *');
  assert.equal(game.name, 'Sicilian Defense');
  assert.deepEqual(game.mainline, ['e4', 'c5', 'Nf3', 'd6']);
  assert.deepEqual(game.nodes.map(n => n.move_number), [1, 1, 2, 2]);
  assert.deepEqual(game.nodes.map(n => n.parent), [null, 0, 1, 2]);
});

test('nested and sibling variations retain correct parent positions and main line', () => {
  const [game] = parsePgn('1. e4 (1. d4 d5 (1... Nf6) 2. c4) (1. c4 e5) e5 2. Nf3 *');
  assert.equal(game.variationCount, 3);
  assert.deepEqual(game.mainline, ['e4', 'e5', 'Nf3']);
  assert.deepEqual(game.nodes.filter(n => n.variation_name).map(n => n.move_san), ['d4', 'Nf6', 'c4']);
  for (const [index, node] of game.nodes.entries()) {
    assert.ok(node.parent === null || node.parent < index);
    const position = new Chess(node.parent === null ? undefined : game.nodes[node.parent].fen_after);
    position.move(node.move_san);
    assert.equal(position.fen(), node.fen_after);
  }
  const roots = game.nodes.filter(n => n.parent === null && n.is_mainline);
  assert.equal(roots.length, 1);
  assert.equal(roots[0].move_san, 'e4');
});

test('imports multiple games without mixing positions or metadata', () => {
  const games = parsePgn('[White "Alice"]\n[Black "Bob"]\n1. e4 e5 1-0\n\n[Event "Second game"]\n1. d4 d5 *');
  assert.deepEqual(games.map(g => g.name), ['Alice vs Bob', 'Second game']);
  assert.deepEqual(games[1].mainline, ['d4', 'd5']);
  assert.equal(games[1].nodes[0].parent, null);
});

test('rejects an invalid later game rather than returning a partial batch', () => {
  assert.throws(() => parsePgn('1. e4 e5 *\n[Event "Bad game"]\n1. e5 *'), /Game 2: invalid move/);
});

test('rejects malformed, empty and illegal PGN', () => {
  for (const source of ['', '[Event "Empty"]', 'hello', '1. e4 {unfinished', '1. e4 (1. d4', '1. e4 ()', '1. e4 )', '1. e5', '(1. e4)']) {
    assert.throws(() => parsePgn(source), undefined, source);
  }
});

test('rejects unsupported positions and chess variants explicitly', () => {
  assert.throws(() => parsePgn('[FEN "8/8/8/8/8/8/4K3/7k w - - 0 1"]\n1. Kf3'), /custom starting/);
  assert.throws(() => parsePgn('[Variant "Chess960"]\n1. e4'), /standard chess/);
});

test('validates castling, captures, promotion, check and mate', () => {
  const [game] = parsePgn('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O Nf6 *');
  assert.equal(game.mainline[6], 'O-O');
  const [mate] = parsePgn('1. f3 e5 2. g4 Qh4# 0-1');
  assert.equal(mate.mainline.at(-1), 'Qh4#');
  assert.equal(parsePgn('1. e4 d5 2. exd5 Qxd5 *')[0].mainline.at(-1), 'Qxd5');
  const [promotion] = parsePgn('1. a4 h5 2. a5 h4 3. a6 h3 4. axb7 hxg2 5. bxa8=Q gxh1=Q *');
  assert.equal(promotion.mainline.at(-1), 'gxh1=Q');
});

test('enforces file size and game limits', () => {
  assert.throws(() => parsePgn(' '.repeat(1_000_001)), /smaller than 1 MB/);
  assert.throws(() => parsePgn('1. e4 *\n'.repeat(51)), /at most 50 games/);
});

test('accepts adjacent NAG annotations and limits recursive variation depth', () => {
  assert.deepEqual(parsePgn('1.e4$1$2 e5$5 *')[0].mainline, ['e4', 'e5']);
  assert.throws(() => parsePgn('1. e4 ('.repeat(33) + '1. d4' + ')'.repeat(33)), /32 levels/);
});

test('accepts BOM, semicolon comments and escaped PGN tag quotes', () => {
  const [game] = parsePgn('\ufeff[Opening "A \\"quoted\\" opening"]\n1. e4 ; comment\ne5 *');
  assert.equal(game.name, 'A "quoted" opening');
  assert.equal(game.nodes.length, 2);
});
