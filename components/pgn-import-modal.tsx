"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Upload, X } from "lucide-react";
import { parsePgn, PGN_MAX_BYTES, type ImportedGame } from "@/lib/pgn-import";
import { supabaseBrowser } from "@/lib/supabase/client";

export type ImportedOpening = { id: string; name: string; created_at: string };

export function PgnImportModal({ onClose, onImported }: {
  onClose: () => void;
  onImported: (openings: ImportedOpening[]) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const readVersion = useRef({ version: 0 });
  const [source, setSource] = useState("");
  const [filename, setFilename] = useState("");
  const [games, setGames] = useState<ImportedGame[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [saved, setSaved] = useState<ImportedOpening[] | null>(null);

  useEffect(() => {
    const element = dialog.current;
    const readState = readVersion.current;
    element?.showModal();
    return () => { readState.version++; element?.close(); };
  }, []);

  async function readFile(file?: File) {
    if (!file) return;
    const version = ++readVersion.current.version;
    setError("");
    setSource("");
    setFilename("");
    setGames(null);
    if (file.size > PGN_MAX_BYTES) {
      setError("Choose a PGN file smaller than 1 MB.");
      setReading(false);
      return;
    }
    setReading(true);
    try {
      const text = await file.text();
      if (version !== readVersion.current.version) return;
      setSource(text);
      setFilename(file.name);
      setGames(null);
    } catch {
      if (version === readVersion.current.version) setError("Could not read this file. Try another file or paste the PGN.");
    } finally {
      if (version === readVersion.current.version) setReading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || reading) return;
    setError("");
    if (!games) {
      try { setGames(parsePgn(source)); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read the PGN."); }
      return;
    }
    if (games.some(game => !game.name.trim() || game.name.trim().length > 100)) {
      setError("Give every opening a name between 1 and 100 characters.");
      return;
    }
    if (!supabaseBrowser) {
      setError("Import is unavailable on this server. Please try again later.");
      return;
    }
    setBusy(true);
    try {
      const { data: { user }, error: authError } = await supabaseBrowser.auth.getUser();
      if (authError || !user) throw new Error("Sign in before importing PGN. Your preview is still here.");
      const { data, error: saveError } = await supabaseBrowser.rpc("import_pgn_repertoires", {
        p_games: games.map(game => ({ name: game.name.trim(), nodes: game.nodes })),
      });
      if (saveError) {
        if (saveError.code === "PGRST202" || saveError.code === "42883") {
          throw new Error("PGN import is not enabled on this server yet. Contact the site administrator, then retry.");
        }
        throw new Error(saveError.message || "Could not import the PGN. Your preview is still here.");
      }
      const imported = data as ImportedOpening[];
      // Mark the committed batch before refreshing the library, so a refresh failure cannot cause a duplicate import.
      setSaved(imported);
      await onImported(imported);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import the PGN.");
    } finally { setBusy(false); }
  }

  return (
    <dialog ref={dialog} className="pgn-dialog" aria-labelledby="pgn-title"
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form onSubmit={submit} aria-busy={busy || reading}>
        <header className="pgn-header">
          <div><h2 id="pgn-title">{saved ? "Added to your library" : "Import PGN"}</h2><p>{saved ? "Your existing repertoire is unchanged." : "Bring your games and opening lines together."}</p></div>
          <button type="button" className="pgn-icon" aria-label="Close import" disabled={busy} onClick={onClose}><X size={20} /></button>
        </header>
        <div className="pgn-content">
          {saved ? (
            <div role="status"><Check size={28} className="text-accent" /><p className="mt-3">Imported {saved.length} {saved.length === 1 ? "opening" : "openings"}. Select an opening in your library to study it.</p><ul className="pgn-saved-list">{saved.map(opening => <li key={opening.id}>{opening.name}</li>)}</ul></div>
          ) : games ? (
            <>
              <p className="pgn-summary">{games.length} {games.length === 1 ? "opening" : "openings"}, {games.reduce((sum, game) => sum + game.nodes.length, 0)} moves, {games.reduce((sum, game) => sum + game.variationCount, 0)} {games.reduce((sum, game) => sum + game.variationCount, 0) === 1 ? "variation" : "variations"}. Each game becomes a new opening.</p>
              <div className="pgn-review">{games.map((game, index) => (
                <section className="pgn-game" key={index}>
                  <label htmlFor={`pgn-name-${index}`}>Opening {index + 1} name</label>
                  <input id={`pgn-name-${index}`} value={game.name} maxLength={100} disabled={busy} onChange={event => setGames(current => current!.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
                  <p className="pgn-notation">{game.mainline.slice(0, 12).map((move, ply) => `${ply % 2 === 0 ? `${ply / 2 + 1}. ` : ""}${move}`).join(" ")}{game.mainline.length > 12 ? " …" : ""}</p>
                </section>
              ))}</div>
            </>
          ) : (
            <>
              <label className="pgn-upload" htmlFor="pgn-file"><Upload size={22} /><span>Choose a PGN file<span className="pgn-help">.pgn or .txt, up to 1 MB</span></span></label>
              <input id="pgn-file" className="pgn-file" type="file" accept=".pgn,.txt,text/plain,application/x-chess-pgn" disabled={reading} onChange={event => { void readFile(event.target.files?.[0]); event.target.value = ""; }} />
              {filename && <p className="pgn-help">Loaded: {filename}</p>}
              <label className="pgn-paste-label" htmlFor="pgn-source">Or paste PGN</label>
              <textarea id="pgn-source" value={source} disabled={reading} spellCheck={false} aria-invalid={Boolean(error)} aria-describedby="pgn-help pgn-error" placeholder={'[Opening "Sicilian Defense"]\n\n1. e4 c5 2. Nf3 d6 *'} onChange={event => { readVersion.current.version++; setSource(event.target.value); setFilename(""); setError(""); }} />
              <p id="pgn-help" className="pgn-help">Up to 50 games and 5,000 moves. Main lines and nested variations are saved. Comments and annotations are omitted. Standard starting position only.</p>
            </>
          )}
          <p id="pgn-error" className="pgn-error" role="alert">{error}</p>
        </div>
        <footer className="pgn-footer">
          {saved ? <button type="button" className="primary-action" onClick={onClose}>Done</button> : <>
            <button type="button" className="quiet-action" disabled={busy} onClick={() => { if (games) { setGames(null); setError(""); } else onClose(); }}>{games ? "Edit PGN" : "Cancel"}</button>
            <button type="submit" className="primary-action" disabled={busy || reading}>{busy ? "Importing…" : reading ? "Reading…" : games ? "Import openings" : "Preview import"}</button>
          </>}
        </footer>
      </form>
    </dialog>
  );
}
