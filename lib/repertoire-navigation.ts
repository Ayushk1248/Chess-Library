import { Chess } from "chess.js";

export type RepertoireMove = {
  id: string;
  move_san: string;
  fen_after: string;
  move_number: number;
};

export function moveLabel(move: RepertoireMove) {
  return `${move.move_number}${move.fen_after.split(" ")[1] === "b" ? "." : "..."} ${move.move_san}`;
}

/** Keep the original move number and side even when a variation starts with Black. */
export function repertoireMoveRows(moves: RepertoireMove[]) {
  const rows: { no: number; white?: string; whiteIndex?: number; black?: string; blackIndex?: number }[] = [];
  moves.forEach((move, index) => {
    let row = rows.at(-1);
    if (!row || row.no !== move.move_number) {
      row = { no: move.move_number };
      rows.push(row);
    }
    if (move.fen_after.split(" ")[1] === "b") { row.white = move.move_san; row.whiteIndex = index; }
    else { row.black = move.move_san; row.blackIndex = index; }
  });
  return rows;
}

/** Resolve a selected variation move against its full ancestor path, not just its local index. */
export function repertoirePosition(path: RepertoireMove[], lineStart: number, moveCount: number) {
  const count = Math.max(0, Math.min(path.length - lineStart, moveCount));
  const prefix = path.slice(0, lineStart + count);
  const chess = new Chess();
  for (const node of prefix) {
    const move = chess.move(node.move_san);
    if (!move || chess.fen() !== node.fen_after) throw new Error(`Could not replay saved move ${node.move_san}.`);
  }
  const parent = prefix.at(-1);
  return { fen: chess.fen(), parentNodeId: parent?.id ?? null,
    label: parent ? `After ${moveLabel(parent)}` : "Starting position", count };
}
