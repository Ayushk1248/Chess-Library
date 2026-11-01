import { Chess } from "chess.js";

export type BranchMove = {
  id: string;
  parentNodeId: string | null;
  moveSan: string;
  fenAfter: string;
  moveNumber: number;
  isMainline: boolean;
};

export type BranchLine = {
  id: string;
  name: string;
  parentNodeId: string | null;
  startFen: string;
  moves: BranchMove[];
};

export type BranchAnchor = { fen: string; parentNodeId: string | null; label: string };
export type BranchEditor = {
  anchor: BranchAnchor;
  lines: BranchLine[];
  activeLineId: string | null;
  moveIndex: number;
  nextLineNumber: number;
};

export function activeBranch(state: BranchEditor) {
  return state.lines.find(line => line.id === state.activeLineId) ?? null;
}

export function branchPosition(state: BranchEditor): BranchAnchor {
  const line = activeBranch(state);
  if (!line) return state.anchor;
  const move = line.moves[state.moveIndex - 1];
  if (move) return {
    fen: move.fenAfter, parentNodeId: move.id,
    label: `After ${move.moveNumber}${new Chess(move.fenAfter).turn() === "b" ? "." : "..."} ${move.moveSan}`,
  };
  const parent = state.lines.flatMap(item => item.moves).find(item => item.id === line.parentNodeId);
  return { fen: line.startFen, parentNodeId: line.parentNodeId,
    label: parent ? `After ${parent.moveNumber}${new Chess(parent.fenAfter).turn() === "b" ? "." : "..."} ${parent.moveSan}` : "Line start" };
}

/** An explicit new line always starts from the supplied anchor, never the last move played. */
export function newBranch(state: BranchEditor, anchor: BranchAnchor = state.anchor): BranchEditor {
  const empty = state.lines.find(line => !line.moves.length && line.startFen === anchor.fen && line.parentNodeId === anchor.parentNodeId);
  if (empty) return { ...state, activeLineId: empty.id, moveIndex: 0 };
  const line: BranchLine = {
    id: crypto.randomUUID(), name: `Line ${state.nextLineNumber}`,
    parentNodeId: anchor.parentNodeId, startFen: anchor.fen, moves: [],
  };
  return { ...state, lines: [...state.lines, line], activeLineId: line.id, moveIndex: 0, nextLineNumber: state.nextLineNumber + 1 };
}

/** Validate first; invalid drops cannot create empty lines or modify a saved draft. */
export function playBranchMove(state: BranchEditor, from: string, to: string): BranchEditor {
  const position = branchPosition(state);
  const game = new Chess(position.fen);
  const move = game.move({ from, to, promotion: "q" });
  let next = state;
  let line = activeBranch(next);
  if (line && state.moveIndex < line.moves.length && line.moves[state.moveIndex].moveSan === move.san) {
    return { ...state, moveIndex: state.moveIndex + 1 };
  }
  if (!line || state.moveIndex < line.moves.length || line.moves.length === 0) {
    const existing = state.lines.find(item => item.id !== line?.id && item.startFen === position.fen && item.parentNodeId === position.parentNodeId && item.moves[0]?.moveSan === move.san);
    if (existing) return { ...state, lines: state.lines.filter(item => item.id !== line?.id || item.moves.length > 0), activeLineId: existing.id, moveIndex: 1 };
    next = newBranch(state, position);
    line = activeBranch(next);
  }
  if (!line) throw new Error("Select a line before playing a move.");
  const branchMove: BranchMove = {
    id: crypto.randomUUID(), parentNodeId: line.moves.at(-1)?.id ?? line.parentNodeId,
    moveSan: move.san, fenAfter: game.fen(), moveNumber: Number(move.before.split(" ")[5]),
    isMainline: line.moves.length > 0,
  };
  const updated = { ...line, moves: [...line.moves, branchMove] };
  return { ...next, lines: next.lines.map(item => item.id === updated.id ? updated : item), moveIndex: updated.moves.length };
}

/** Remove dependent branches together, and never leave the pinned anchor dangling. */
export function removeBranchMoves(state: BranchEditor, ids: Set<string>, rootAnchor: BranchAnchor, lineId?: string): BranchEditor {
  let changed = true;
  while (changed) {
    changed = false;
    for (const line of state.lines) for (const move of line.moves) {
      if (move.parentNodeId && ids.has(move.parentNodeId) && !ids.has(move.id)) { ids.add(move.id); changed = true; }
    }
  }
  const lines = state.lines.filter(line => line.id !== lineId && (!line.parentNodeId || !ids.has(line.parentNodeId)))
    .map(line => ({ ...line, moves: line.moves.filter(move => !ids.has(move.id)) }));
  const active = lines.find(line => line.id === state.activeLineId);
  return { ...state, lines, activeLineId: active?.id ?? null,
    moveIndex: active ? Math.min(state.moveIndex, active.moves.length) : 0,
    anchor: state.anchor.parentNodeId && ids.has(state.anchor.parentNodeId) ? rootAnchor : state.anchor };
}
