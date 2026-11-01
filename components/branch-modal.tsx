"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ChevronLeft, ChevronRight, GitBranch, Pin, Plus, RotateCcw, Trash2, Undo2, X } from "lucide-react";
import { activeBranch, branchPosition, newBranch, playBranchMove, removeBranchMoves,
  type BranchAnchor, type BranchEditor, type BranchLine } from "@/lib/branch-editor";
export type { BranchLine, BranchMove } from "@/lib/branch-editor";

type BranchModalProps = {
  openingName: string;
  sourceLineName?: string;
  initialPosition: string;
  parentNodeId: string | null;
  branchContextLabel: string;
  colors: { sidebarBg: string; accent: string; accentText: string; boardLight: string; boardDark: string };
  boardOrientation?: "white" | "black";
  onClose: () => void;
  onConfirm: (lines: BranchLine[]) => Promise<void>;
};

export function BranchModal({ openingName, sourceLineName, initialPosition, parentNodeId, branchContextLabel,
  colors, boardOrientation = "white", onClose, onConfirm }: BranchModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const rootAnchor: BranchAnchor = { fen: initialPosition, parentNodeId, label: branchContextLabel };
  const [editor, setEditor] = useState<BranchEditor>(() => ({ anchor: rootAnchor, lines: [], activeLineId: null, moveIndex: 0, nextLineNumber: 1 }));
  const [undoState, setUndoState] = useState<BranchEditor | null>(null);
  const [error, setError] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const activeLine = activeBranch(editor);
  const current = branchPosition(editor);
  const populated = editor.lines.filter(line => line.moves.length > 0);
  const atAnchor = current.fen === editor.anchor.fen && current.parentNodeId === editor.anchor.parentNodeId;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  function update(next: BranchEditor) {
    setUndoState(null);
    setEditor(next);
    setSelectedSquare(null);
    setError("");
    setDiscardPrompt(false);
  }

  function requestClose() {
    if (isConfirming) return;
    if (populated.length) setDiscardPrompt(true);
    else onClose();
  }

  function selectPosition(line: BranchLine, index: number) {
    if (isConfirming) return;
    update({ ...editor, activeLineId: line.id, moveIndex: index });
  }

  function handlePieceDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) {
    if (!targetSquare || isConfirming || discardPrompt) return false;
    try { update(playBranchMove(editor, sourceSquare, targetSquare)); return true; }
    catch { return false; }
  }

  function removeLastMove() {
    if (!activeLine?.moves.length || isConfirming) return;
    update(removeBranchMoves(editor, new Set([activeLine.moves.at(-1)!.id]), rootAnchor));
    setUndoState(editor);
  }

  function deleteLine(line: BranchLine) {
    if (isConfirming) return;
    update(removeBranchMoves(editor, new Set(line.moves.map(move => move.id)), rootAnchor, line.id));
    setUndoState(editor);
  }

  async function handleConfirm() {
    if (isConfirming || !populated.length) return;
    if (populated.some(line => !line.name.trim())) { setError("Give each line a name before saving."); return; }
    setIsConfirming(true);
    setError("");
    setUndoState(null);
    try { await onConfirm(populated.map(line => ({ ...line, name: line.name.trim() }))); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save these lines. Your drafts are still here."); }
    finally { setIsConfirming(false); }
  }

  function parentLineId(line: BranchLine) {
    return editor.lines.find(candidate => candidate.id !== line.id && candidate.moves.some(move => move.id === line.parentNodeId))?.id ?? null;
  }

  function renderLine(line: BranchLine, ancestors = new Set<string>()): ReactNode {
    if (ancestors.has(line.id)) return null;
    const visited = new Set(ancestors).add(line.id);
    const children = editor.lines.filter(candidate => parentLineId(candidate) === line.id);
    return <div className="branch-tree-item" key={line.id}>
      <div className={`branch-line ${activeLine?.id === line.id ? "is-active" : ""}`}>
        <div className="branch-line-heading">
          <button type="button" className="branch-select" disabled={isConfirming} onClick={() => selectPosition(line, line.moves.length)} aria-pressed={activeLine?.id === line.id}>{line.name}</button>
          <button type="button" className="branch-icon" disabled={isConfirming} aria-label={`Delete ${line.name}`} onClick={() => deleteLine(line)}><Trash2 size={16} /></button>
        </div>
        <div className="branch-moves" aria-label={`${line.name} moves`}>
          <button type="button" disabled={isConfirming} aria-pressed={activeLine?.id === line.id && editor.moveIndex === 0} onClick={() => selectPosition(line, 0)}>Start</button>
          {line.moves.map((move, index) => <button type="button" key={move.id} disabled={isConfirming} aria-pressed={activeLine?.id === line.id && editor.moveIndex === index + 1}
            onClick={() => selectPosition(line, index + 1)}>{move.moveNumber}{new Chess(move.fenAfter).turn() === "b" ? "." : "..."} {move.moveSan}</button>)}
        </div>
        {!line.moves.length && <p className="branch-help">Play a move to build this line.</p>}
      </div>
      {children.length > 0 && <div className="branch-children">{children.map(child => renderLine(child, visited))}</div>}
    </div>;
  }

  return <dialog ref={dialog} role="dialog" className="branch-dialog" aria-labelledby="branch-modal-title" aria-busy={isConfirming}
    onCancel={event => { event.preventDefault(); requestClose(); }}
    onClick={event => { if (event.target === event.currentTarget) requestClose(); }}>
    <header className="branch-header">
      <div><h2 id="branch-modal-title">Branch from {sourceLineName ?? openingName}</h2><p>{sourceLineName ? openingName : "Create alternatives from a selected move"}</p></div>
      <button type="button" onClick={requestClose} disabled={isConfirming} aria-label="Close branch editor" className="branch-icon"><X size={20} /></button>
    </header>
    <div className="branch-anchor">
      <Pin size={18} aria-hidden="true" /><div><span>New lines start here</span><strong>{editor.anchor.label}</strong></div>
      <button type="button" className="quiet-action" disabled={atAnchor || isConfirming || discardPrompt} onClick={() => update({ ...editor, anchor: current })}>Pin current position</button>
    </div>
    <div className="branch-workspace">
      <section className="branch-board-column" aria-label="Variation board">
        <div className="branch-board"><Chessboard options={{ id: "branch-editor-board", position: current.fen, onPieceDrop: handlePieceDrop,
          allowDragging: !isConfirming && !discardPrompt, boardOrientation,
          onSquareClick: ({ square }) => {
            if (isConfirming || discardPrompt) return;
            if (selectedSquare && handlePieceDrop({ sourceSquare: selectedSquare, targetSquare: square })) return;
            const game = new Chess(current.fen);
            setSelectedSquare(game.get(square as Square)?.color === game.turn() ? square : null);
          },
          squareStyles: selectedSquare ? { [selectedSquare]: { backgroundColor: "var(--color-accent)" } } : {},
          darkSquareStyle: { backgroundColor: colors.boardDark }, lightSquareStyle: { backgroundColor: colors.boardLight },
          allowDrawingArrows: true, animationDurationInMs: 120 }} /></div>
        <div className="branch-board-controls">
          <button type="button" className="branch-icon" aria-label="Previous move in line" disabled={!activeLine || editor.moveIndex === 0 || isConfirming} onClick={() => selectPosition(activeLine!, editor.moveIndex - 1)}><ChevronLeft size={20} /></button>
          <span>{editor.moveIndex} / {activeLine?.moves.length ?? 0}</span>
          <button type="button" className="branch-icon" aria-label="Next move in line" disabled={!activeLine || editor.moveIndex === activeLine.moves.length || isConfirming} onClick={() => selectPosition(activeLine!, editor.moveIndex + 1)}><ChevronRight size={20} /></button>
          <button type="button" className="branch-text-button" disabled={isConfirming || atAnchor} onClick={() => update({ ...editor, activeLineId: null, moveIndex: 0 })}><RotateCcw size={16} /> Back to anchor</button>
        </div>
        <p className="branch-help">Click a piece and its destination, or drag to move.</p>
      </section>
      <aside className="branch-lines-panel" aria-label="Draft variations">
        <div className="branch-lines-title"><h3>Your lines</h3><span>{populated.length} drafts</span></div>
        <div className="branch-create-actions">
          <button type="button" className="primary-action" disabled={isConfirming || discardPrompt} onClick={() => update(newBranch(editor))}><Plus size={16} /> New line from anchor</button>
          <button type="button" className="quiet-action" disabled={!activeLine || isConfirming || discardPrompt} onClick={() => update(newBranch(editor, current))}><GitBranch size={16} /> Branch here</button>
        </div>
        {!editor.lines.length && <p className="branch-empty">Play a continuation on the board. Add another line to try an alternative from your pinned position.</p>}
        <div className="branch-line-list">{editor.lines.filter(line => parentLineId(line) === null).map(line => renderLine(line))}</div>
        {activeLine && <div className="branch-line-edit"><label htmlFor="branch-line-name">Line name</label><input id="branch-line-name" value={activeLine.name} maxLength={100} disabled={isConfirming}
          onChange={event => { setUndoState(null); setEditor({ ...editor, lines: editor.lines.map(line => line.id === activeLine.id ? { ...line, name: event.target.value } : line) }); }} />
          <button type="button" className="branch-text-button" disabled={!activeLine.moves.length || editor.moveIndex !== activeLine.moves.length || isConfirming} onClick={removeLastMove}><Undo2 size={16} /> Undo last move</button></div>}
        {undoState && <div className="branch-undo" role="status">Draft removed.<button type="button" disabled={isConfirming} onClick={() => { update(undoState); setUndoState(null); }}>Undo removal</button></div>}
      </aside>
    </div>
    <footer className="branch-footer">
      {discardPrompt ? <><p>Discard all draft lines?</p><button type="button" className="quiet-action" onClick={() => setDiscardPrompt(false)}>Keep editing</button><button type="button" className="quiet-action" onClick={onClose}>Discard drafts</button></> : <>
        <div><p className="branch-help">Drafts are saved together when you confirm.</p>{error && <p role="alert" className="branch-error">{error}</p>}</div>
        <button type="button" className="primary-action" disabled={!populated.length || isConfirming} onClick={handleConfirm}>{isConfirming ? "Saving..." : "Save all lines"}</button>
      </>}
    </footer>
  </dialog>;
}
