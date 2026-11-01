"use client";

import { useEffect, useRef } from "react";

export function TrimContinuationDialog({ count, variationNames, label, busy, error, onCancel, onConfirm }: {
  count: number; variationNames: string[]; label: string; busy: boolean; error: string;
  onCancel: () => void; onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} role="dialog" className="trim-dialog" aria-labelledby="trim-title"
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id="trim-title">Remove the continuation?</h2>
    <p>Keep the line through <strong>{label.replace(/^After /, "")}</strong> and remove {count} saved {count === 1 ? "move" : "moves"} after it.</p>
    {variationNames.length > 0 ? <><p>These dependent variations will also be removed:</p><ul>{variationNames.map((name, index) => <li key={index}>{name}</li>)}</ul></> : <p>Your other saved variations will stay.</p>}
    <p>You can undo this removal before making another change.</p>
    {error && <p role="alert" className="text-error">{error}</p>}
    <div className="trim-actions"><button type="button" className="quiet-action" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="primary-action" disabled={busy} onClick={onConfirm}>{busy ? "Removing..." : "Remove continuation"}</button></div>
  </dialog>;
}
