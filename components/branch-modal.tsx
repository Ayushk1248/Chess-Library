"use client";

import { useState, type ReactNode } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ChevronLeft, ChevronRight, GitBranch, Plus, Trash2, X } from "lucide-react";

type BranchModalTheme = {
  sidebarBg: string;
  accent: string;
  accentText: string;
  boardLight: string;
  boardDark: string;
};

export type BranchLine = {
  id: string;
  name: string;
  parentNodeId: string | null;
  startFen: string;
  moves: BranchMove[];
};

export type BranchMove = {
  id: string;
  parentNodeId: string | null;
  moveSan: string;
  fenAfter: string;
  moveNumber: number;
  isMainline: boolean;
};

type BranchModalProps = {
  openingName: string;
  initialPosition: string;
  parentNodeId: string | null;
  branchContextLabel: string;
  colors: BranchModalTheme;
  onClose: () => void;
  onConfirm: (lines: BranchLine[]) => Promise<void>;
};

export function BranchModal({
  openingName,
  initialPosition,
  parentNodeId,
  branchContextLabel,
  colors,
  onClose,
  onConfirm,
}: BranchModalProps) {
  const [game] = useState(() => new Chess(initialPosition));
  const [position, setPosition] = useState(() => game.fen());
  const [lines, setLines] = useState<BranchLine[]>([]);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [moveIndex, setMoveIndex] = useState(0);
  const [nextLineNumber, setNextLineNumber] = useState(1);
  const [lineError, setLineError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const activeLine = lines.find((line) => line.id === activeLineId) ?? null;
  const hasMoves = lines.some((line) => line.moves.length > 0);
  const allMoves = lines.flatMap((line) => line.moves);
  const modalParentMove = activeLine?.parentNodeId
    ? allMoves.find((move) => move.id === activeLine.parentNodeId)
    : undefined;
  const branchContext = activeLine && moveIndex > 0
    ? `move ${activeLine.moves[moveIndex - 1].moveNumber} (${activeLine.moves[moveIndex - 1].moveSan})`
    : modalParentMove
      ? `move ${modalParentMove.moveNumber} (${modalParentMove.moveSan})`
      : branchContextLabel;

  async function handleConfirm() {
    if (!hasMoves || isConfirming) return;
    setIsConfirming(true);
    setConfirmError("");

    try {
      await onConfirm(lines);
      onClose();
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : "Could not save these lines.");
    } finally {
      setIsConfirming(false);
    }
  }

  function loadLinePosition(line: BranchLine, movesToPlay: number) {
    const replayGame = new Chess(line.startFen);
    for (const move of line.moves.slice(0, movesToPlay)) {
      const playedMove = replayGame.move(move.moveSan);
      if (!playedMove || replayGame.fen() !== move.fenAfter) {
        throw new Error(`Could not replay ${move.moveSan} in ${line.name}.`);
      }
    }
    game.load(replayGame.fen());
    setPosition(replayGame.fen());
    setMoveIndex(movesToPlay);
  }

  function addLineAtCurrentPosition() {
    const parentMove = activeLine && moveIndex > 0 ? activeLine.moves[moveIndex - 1] : null;
    const line: BranchLine = {
      id: crypto.randomUUID(),
      name: `Line ${nextLineNumber}`,
      parentNodeId: parentMove?.id ?? activeLine?.parentNodeId ?? parentNodeId,
      startFen: position,
      moves: [],
    };

    setLines((current) => [...current, line]);
    setActiveLineId(line.id);
    setNextLineNumber((number) => number + 1);
    setMoveIndex(0);
    setLineError("");
    return line;
  }

  function handlePieceDrop({ sourceSquare, targetSquare }: {
    sourceSquare: string;
    targetSquare: string | null;
  }) {
    if (!targetSquare) return false;

    let line = activeLine;
    let lineMoves = activeLine?.moves.slice(0, moveIndex) ?? [];
    const startsFromHistory = activeLine !== null && moveIndex < activeLine.moves.length;

    if (!line || startsFromHistory) {
      if (startsFromHistory) {
      try {
        const probeGame = new Chess(position);
        if (!probeGame.move({ from: sourceSquare, to: targetSquare, promotion: "q" })) {
          return false;
        }
      } catch {
        return false;
      }
      }

      line = addLineAtCurrentPosition();
      lineMoves = [];
      if (startsFromHistory) game.load(position);
    }

    if (!line) return false;

    try {
      const move = game.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      if (!move) return false;

      const branchMove: BranchMove = {
        id: crypto.randomUUID(),
        parentNodeId: lineMoves.at(-1)?.id ?? line.parentNodeId,
        moveSan: move.san,
        fenAfter: game.fen(),
        moveNumber: Math.max(1, game.moveNumber() - (game.turn() === "b" ? 1 : 0)),
        isMainline: lineMoves.length > 0,
      };
      const nextLine = { ...line, moves: [...lineMoves, branchMove] };

      setLines((current) => current.some((item) => item.id === nextLine.id)
        ? current.map((item) => item.id === nextLine.id ? nextLine : item)
        : [...current, nextLine]);
      setMoveIndex(nextLine.moves.length);
      setPosition(game.fen());
      setLineError("");
      return true;
    } catch {
      return false;
    }
  }

  function handleSelectLine(line: BranchLine) {
    setActiveLineId(line.id);
    setLineError("");
    try {
      loadLinePosition(line, line.moves.length);
    } catch (error) {
      setLineError(error instanceof Error ? error.message : "Could not load this line.");
    }
  }

  function handleNavigateMove(step: number) {
    if (!activeLine) return;
    const nextIndex = Math.max(0, Math.min(activeLine.moves.length, moveIndex + step));
    try {
      loadLinePosition(activeLine, nextIndex);
      setLineError("");
    } catch (error) {
      setLineError(error instanceof Error ? error.message : "Could not navigate this line.");
    }
  }

  function handleDeleteMove() {
    if (!activeLine) return;
    const removedMove = activeLine.moves.at(-1);
    if (!removedMove) return;

    const removedIds = new Set([removedMove.id]);
    let foundChild = true;
    while (foundChild) {
      foundChild = false;
      for (const line of lines) {
        for (const move of line.moves) {
          if (move.parentNodeId && removedIds.has(move.parentNodeId) && !removedIds.has(move.id)) {
            removedIds.add(move.id);
            foundChild = true;
          }
        }
      }
    }

    const remainingLines = lines
      .filter((line) => !line.parentNodeId || !removedIds.has(line.parentNodeId))
      .map((line) => ({
        ...line,
        moves: line.moves.filter((move) => !removedIds.has(move.id)),
      }));
    const updatedLine = remainingLines.find((line) => line.id === activeLine.id);

    setLines(remainingLines);
    setLineError("");
    if (updatedLine) {
      try {
        loadLinePosition(updatedLine, updatedLine.moves.length);
      } catch (error) {
        setLineError(error instanceof Error ? error.message : "Could not delete this move.");
      }
    }
  }

  function findParentLineId(line: BranchLine) {
    if (!line.parentNodeId) return null;
    return lines.find((candidate) =>
      candidate.id !== line.id && candidate.moves.some((move) => move.id === line.parentNodeId)
    )?.id ?? null;
  }

  function renderLine(line: BranchLine, ancestors = new Set<string>()): ReactNode {
    if (ancestors.has(line.id)) return null;
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(line.id);
    const children = lines.filter((candidate) => findParentLineId(candidate) === line.id);

    return (
      <div key={line.id}>
        <button
          type="button"
          onClick={() => handleSelectLine(line)}
          className={`w-full rounded-md px-2 py-2 text-left text-sm transition-colors ${
            line.id === activeLineId ? "bg-white/5 text-white" : "text-zinc-300 hover:bg-white/5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span>{line.name}</span>
            <span className="text-xs text-zinc-500">{line.moves.length} moves</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {line.moves.length === 0 ? "No moves yet" : line.moves.map((move) => move.moveSan).join(" ")}
          </p>
        </button>
        {children.length > 0 && (
          <div className="ml-3 border-l border-white/10 pl-2">
            {children.map((child) => renderLine(child, nextAncestors))}
          </div>
        )}
      </div>
    );
  }

  const chessboardOptions = {
    position,
    onPieceDrop: handlePieceDrop,
    allowDragging: true,
    boardOrientation: "white" as const,
    darkSquareStyle: { backgroundColor: colors.boardDark },
    lightSquareStyle: { backgroundColor: colors.boardLight },
    boardStyle: { borderRadius: "0px" },
    allowDrawingArrows: true,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="branch-modal-title"
        className="my-auto flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-white/10 shadow-2xl"
        style={{ backgroundColor: colors.sidebarBg }}
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <GitBranch size={17} className="text-zinc-400" />
            <div>
              <h2 id="branch-modal-title" className="text-base font-semibold text-white">
                Branch
              </h2>
              <p className="text-xs text-zinc-500">{openingName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            aria-label="Discard branches and close"
            title="Close without saving"
            className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={17} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="w-full max-w-[480px] overflow-hidden rounded-md border border-white/10">
              <Chessboard options={chessboardOptions} />
            </div>
          </div>

          <aside className="flex min-h-[220px] flex-col border-t border-white/10 pt-4 lg:min-h-0 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <p className="text-sm font-medium text-white">Conditional Lines</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleNavigateMove(-1)}
                  disabled={!activeLine || moveIndex === 0}
                  aria-label="Previous move"
                  title="Previous move"
                  className="rounded p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="min-w-10 text-center text-xs tabular-nums text-zinc-500">
                  {moveIndex}/{activeLine?.moves.length ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => handleNavigateMove(1)}
                  disabled={!activeLine || moveIndex === activeLine.moves.length}
                  aria-label="Next move"
                  title="Next move"
                  className="rounded p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {confirmError && (
                <p role="alert" className="px-2 py-2 text-xs text-red-400">{confirmError}</p>
              )}
              {lineError && (
                <p role="alert" className="px-2 py-2 text-xs text-red-400">{lineError}</p>
              )}
              {lines.length === 0 && !confirmError && !lineError && (
                <p className="px-2 py-2 text-xs text-zinc-500">No lines yet. Add a line or play a move.</p>
              )}
              {(lines.filter((line) => findParentLineId(line) === null).length > 0
                ? lines.filter((line) => findParentLineId(line) === null)
                : lines
              ).map((line) => renderLine(line))}
            </div>

            <div className="flex flex-wrap items-start gap-3 border-t border-white/10 pt-3">
              <div className="flex min-w-0 flex-col items-start gap-1">
                <button
                  type="button"
                  onClick={addLineAtCurrentPosition}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <Plus size={14} />
                  Add Line
                </button>
                <p className="max-w-full truncate px-1 text-xs text-zinc-500">
                  Branches from: {branchContext}
                </p>
              </div>
              <div className="ml-auto flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDeleteMove}
                  disabled={!activeLine || activeLine.moves.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={14} />
                  Delete Move
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!hasMoves || isConfirming}
                  className="rounded-md px-3.5 py-2 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ backgroundColor: colors.accent, color: colors.accentText }}
                >
                  {isConfirming ? "Saving..." : "Confirm"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}