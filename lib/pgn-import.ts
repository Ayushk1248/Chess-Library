import { Chess, DEFAULT_POSITION } from "chess.js";

export const PGN_MAX_BYTES = 1_000_000;
export const PGN_MAX_GAMES = 50;
export const PGN_MAX_MOVES = 5_000;

export type ImportedNode = {
  parent: number | null;
  move_san: string;
  fen_after: string;
  move_number: number;
  is_mainline: boolean;
  variation_name: string | null;
};

export type ImportedGame = {
  name: string;
  nodes: ImportedNode[];
  mainline: string[];
  variationCount: number;
};

/** Parse standard-position PGN, retaining RAV branches in the repertoire tree. */
export function parsePgn(source: string): ImportedGame[] {
  if (new TextEncoder().encode(source).length > PGN_MAX_BYTES) {
    throw new Error("Use a PGN file smaller than 1 MB.");
  }
  const games: ImportedGame[] = [];
  let chess = new Chess();
  let headers: Record<string, string> = {};
  let nodes: ImportedNode[] = [];
  let mainline: string[] = [];
  let parent: number | null = null;
  const branches: { fen: string; parent: number; pendingBranch: boolean }[] = [];
  let pendingBranch = false;
  let variationCount = 0;
  let totalMoves = 0;
  let ended = false;

  function fail(message: string): never {
    throw new Error(`Game ${games.length + 1}: ${message}`);
  }

  function finish() {
    if (branches.length) fail("close every variation with a matching parenthesis.");
    if (!nodes.length) {
      if (Object.keys(headers).length) fail("this game has no moves to import.");
      return;
    }
    if (games.length >= PGN_MAX_GAMES) fail(`import at most ${PGN_MAX_GAMES} games at a time.`);
    const players = [headers.White, headers.Black].filter(value => value && value !== "?");
    const name = headers.Opening || (players.length === 2 ? players.join(" vs ") : undefined)
      || (headers.Event !== "?" ? headers.Event : undefined) || `Imported opening ${games.length + 1}`;
    games.push({ name: name.slice(0, 100), nodes, mainline, variationCount });
    headers = {};
    nodes = [];
    mainline = [];
    chess = new Chess();
    parent = null;
    pendingBranch = false;
    variationCount = 0;
    ended = false;
  }

  // Sticky scanning rejects malformed tags/comments rather than silently skipping them.
  const scanner = /\s+|\{[^}]*\}|;[^\r\n]*|\[\s*([A-Za-z0-9_]+)\s+"((?:\\.|[^"\\])*)"\s*\]|\(|\)|\$\d+|[^\s{}[\]();$]+/gy;
  let offset = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  while (offset < source.length) {
    scanner.lastIndex = offset;
    const match = scanner.exec(source);
    if (!match) fail("malformed tag or comment. Check brackets and braces.");
    offset = scanner.lastIndex;
    const token = match[0];
    if (/^\s|^[{;]/.test(token)) continue;
    if (match[1]) {
      if (nodes.length) finish();
      const value = match[2].replace(/\\(["\\])/g, "$1");
      headers[match[1]] = value;
      if (match[1] === "FEN" && value !== DEFAULT_POSITION) {
        fail("custom starting positions are not supported by the repertoire board.");
      }
      if (match[1] === "Variant" && !/^(standard|chess|normal)$/i.test(value)) {
        fail("only standard chess is supported.");
      }
      continue;
    }
    if (token === "(") {
      if (ended || parent === null || pendingBranch) fail("a variation must follow a move.");
      if (branches.length >= 32) fail("variations may nest at most 32 levels deep.");
      branches.push({ fen: chess.fen(), parent, pendingBranch });
      parent = nodes[parent].parent;
      chess = new Chess(parent === null ? DEFAULT_POSITION : nodes[parent].fen_after);
      pendingBranch = true;
      continue;
    }
    if (token === ")") {
      const previous = branches.pop();
      if (!previous || pendingBranch) fail("empty or unmatched variation.");
      chess = new Chess(previous.fen);
      parent = previous.parent;
      pendingBranch = previous.pendingBranch;
      continue;
    }
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) {
      if (branches.length) fail("place the game result after all variations.");
      if (!nodes.length) fail("this game has no moves to import.");
      ended = true;
      continue;
    }
    if (/^\$\d+$|^[!?]+$|^\.{1,3}$/.test(token)) continue;
    const san = token.replace(/^\d+\.(?:\.\.)?/, "").replace(/\$\d+$/, "").replace(/[!?]+$/, "");
    if (!san) continue;
    if (ended) finish();
    if (++totalMoves > PGN_MAX_MOVES) fail(`import at most ${PGN_MAX_MOVES} moves at a time.`);
    let move;
    try { move = chess.move(san, { strict: true }); }
    catch { fail(`invalid move "${san.slice(0, 40)}". Check the PGN notation.`); }
    if (pendingBranch) variationCount++;
    nodes.push({
      parent,
      move_san: move.san,
      fen_after: chess.fen(),
      move_number: Number(move.before.split(" ")[5]),
      is_mainline: !pendingBranch,
      variation_name: pendingBranch ? `Variation ${variationCount}` : null,
    });
    parent = nodes.length - 1;
    pendingBranch = false;
    if (!branches.length) mainline.push(move.san);
  }
  finish();
  if (!games.length) throw new Error("Add PGN containing at least one legal move.");
  return games;
}
