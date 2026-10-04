// app/dashboard/page.tsx
"use client";

import { useState, useMemo, useCallback, useEffect, type FormEvent } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  Plus,
  Upload,
  Settings,
  LogOut,
  RefreshCw,
  Save,
  ChevronRight,
  Palette,
  GitBranch,
  Undo2,
} from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { supabaseBrowser } from "@/lib/supabase/client";

const THEMES = {
  classic: {
    appBg: "#21201d",
    sidebarBg: "#262421",
    accent: "#81b64c",
    accentHover: "#8bc255",
    accentText: "#1b2a0f",
    boardLight: "#ebecd0",
    boardDark: "#739552",
  },
  wood: {
    appBg: "#3e2f23",
    sidebarBg: "#4a3626",
    accent: "#c9a06a",
    accentHover: "#d6b280",
    accentText: "#2a1c10",
    boardLight: "#f0d9b5",
    boardDark: "#b58863",
  },
} as const;

type SessionNode = {
  id: string;
  parent_node_id: string | null;
  move_san: string;
  fen_after: string;
  move_number: number;
  is_mainline: boolean;
  isSaved: boolean;
};

type Opening = {
  id: string;
  name: string;
  created_at: string;
};

function groupMoves(sanMoves: string[]) {
  const rows: {
    no: number;
    white: string;
    whiteIndex: number;
    black?: string;
    blackIndex?: number;
  }[] = [];
  for (let i = 0; i < sanMoves.length; i += 2) {
    rows.push({
      no: i / 2 + 1,
      white: sanMoves[i],
      whiteIndex: i,
      black: sanMoves[i + 1],
      blackIndex: i + 1,
    });
  }
  return rows;
}

export default function DashboardPage() {
  const { theme, toggleTheme } = useTheme();
  const colors = THEMES[theme];

  const [openings, setOpenings] = useState<Opening[]>([]);
  const [isLoadingOpenings, setIsLoadingOpenings] = useState(true);
  const [openingListError, setOpeningListError] = useState("");
  const [loadingOpeningId, setLoadingOpeningId] = useState<string | null>(null);
  const [activeOpening, setActiveOpening] = useState("");
  const [activeOpeningId, setActiveOpeningId] = useState<string | null>(null);
  const [openingName, setOpeningName] = useState("");
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [isNewOpeningOpen, setIsNewOpeningOpen] = useState(false);
  const [newOpeningName, setNewOpeningName] = useState("");
  const [newOpeningError, setNewOpeningError] = useState("");
  const [isCreatingOpening, setIsCreatingOpening] = useState(false);

  const game = useMemo(() => new Chess(), []);
  const [position, setPosition] = useState(game.fen());
  const [sessionNodes, setSessionNodes] = useState<SessionNode[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [isVariationLine, setIsVariationLine] = useState(false);
  const [isChoosingVariation, setIsChoosingVariation] = useState(false);
  const [isSavingLine, setIsSavingLine] = useState(false);
  const [lineError, setLineError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadOpenings() {
      if (!supabaseBrowser) {
        setOpeningListError("Supabase is not configured.");
        setIsLoadingOpenings(false);
        return;
      }

      try {
        const { data: { user }, error: userError } = await supabaseBrowser.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("Sign in to view your openings.");

        const { data, error } = await supabaseBrowser
          .from("openings")
          .select("id, name, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (isMounted) setOpenings(data ?? []);
      } catch (error) {
        if (isMounted) {
          setOpeningListError(
            error instanceof Error ? error.message : "Could not load openings."
          );
        }
      } finally {
        if (isMounted) setIsLoadingOpenings(false);
      }
    }

    void loadOpenings();
    return () => {
      isMounted = false;
    };
  }, []);

  const currentPathNodes = currentPath
    .map((nodeId) => sessionNodes.find((node) => node.id === nodeId))
    .filter((node): node is SessionNode => node !== undefined);
  const sanMoves = currentPathNodes.map((node) => node.move_san);
  const pendingNodeCount = sessionNodes.filter((node) => !node.isSaved).length;
  const lastPathNode = currentPathNodes.at(-1);

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
      if (!targetSquare || isChoosingVariation) return false;
      try {
        const move = game.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
        if (move === null) return false;
        const node: SessionNode = {
          id: crypto.randomUUID(),
          parent_node_id: currentPath.at(-1) ?? null,
          move_san: move.san,
          fen_after: game.fen(),
          move_number: Math.floor(currentPath.length / 2) + 1,
          is_mainline: !isVariationLine,
          isSaved: false,
        };
        setSessionNodes((nodes) => [...nodes, node]);
        setCurrentPath((path) => [...path, node.id]);
        setPosition(game.fen());
        setLineError("");
        return true;
      } catch {
        return false;
      }
    },
    [currentPath, game, isChoosingVariation, isVariationLine]
  );

  function handleSelectVariationPoint(moveIndex: number | null) {
    const selectedPath = moveIndex === null ? [] : currentPath.slice(0, moveIndex + 1);
    const selectedNodes = selectedPath
      .map((nodeId) => sessionNodes.find((node) => node.id === nodeId))
      .filter((node): node is SessionNode => node !== undefined);

    game.reset();
    for (const node of selectedNodes) game.move(node.move_san);

    setCurrentPath(selectedPath);
    setPosition(game.fen());
    setIsVariationLine(true);
    setIsChoosingVariation(false);
    setLineError("");
  }

  function handleCancelMove() {
    if (!lastPathNode || lastPathNode.isSaved) return;

    game.undo();
    const removedIds = new Set([lastPathNode.id]);
    let hasNewDescendant = true;
    while (hasNewDescendant) {
      hasNewDescendant = false;
      for (const node of sessionNodes) {
        if (node.parent_node_id && removedIds.has(node.parent_node_id) && !removedIds.has(node.id)) {
          removedIds.add(node.id);
          hasNewDescendant = true;
        }
      }
    }

    const nextPath = currentPath.slice(0, -1);
    setSessionNodes((nodes) => nodes.filter((node) => !removedIds.has(node.id)));
    setCurrentPath(nextPath);
    setPosition(game.fen());
    setIsChoosingVariation(false);
    setLineError("");
  }

  async function handleSaveLine() {
    if (!activeOpeningId || !supabaseBrowser || pendingNodeCount === 0) return;

    setIsSavingLine(true);
    setLineError("");

    const pendingNodes = sessionNodes.filter((node) => !node.isSaved);
    try {
      const { error } = await supabaseBrowser.from("opening_nodes").insert(
        pendingNodes.map((node) => ({
          id: node.id,
          opening_id: activeOpeningId,
          parent_node_id: node.parent_node_id,
          move_san: node.move_san,
          fen_after: node.fen_after,
          move_number: node.move_number,
          is_mainline: node.is_mainline,
        }))
      );

      if (error) throw error;

      const savedIds = new Set(pendingNodes.map((node) => node.id));
      setSessionNodes((nodes) =>
        nodes.map((node) => savedIds.has(node.id) ? { ...node, isSaved: true } : node)
      );
    } catch (error) {
      setLineError(error instanceof Error ? error.message : "Could not save this line.");
    } finally {
      setIsSavingLine(false);
    }
  }

  async function handleCreateOpening(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newOpeningName.trim();

    if (!name) {
      setNewOpeningError("Enter an opening name.");
      return;
    }

    if (!supabaseBrowser) {
      setNewOpeningError("Supabase is not configured.");
      return;
    }

    setIsCreatingOpening(true);
    setNewOpeningError("");

    try {
      const { data: { user }, error: userError } = await supabaseBrowser.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Sign in before creating an opening.");

      const { data, error } = await supabaseBrowser
        .from("openings")
        .insert({ name, user_id: user.id })
        .select("id, name, created_at")
        .single();

      if (error) throw error;

      game.reset();
      setPosition(game.fen());
      setSessionNodes([]);
      setCurrentPath([]);
      setIsVariationLine(false);
      setIsChoosingVariation(false);
      setLineError("");
      setOpenings((current) => [data, ...current.filter((opening) => opening.id !== data.id)]);
      setActiveOpening(data.name);
      setActiveOpeningId(data.id);
      setOpeningName(data.name);
      setNewOpeningName("");
      setIsNewOpeningOpen(false);
    } catch (error) {
      setNewOpeningError(
        error instanceof Error ? error.message : "Could not create the opening."
      );
    } finally {
      setIsCreatingOpening(false);
    }
  }

  async function handleLoadOpening(opening: Opening) {
    if (!supabaseBrowser) return;
    if (pendingNodeCount > 0 && !window.confirm("Discard your unsaved moves and open this repertoire?")) {
      return;
    }

    setLoadingOpeningId(opening.id);
    setLineError("");

    try {
      const { data, error } = await supabaseBrowser
        .from("opening_nodes")
        .select("id, parent_node_id, move_san, fen_after, move_number, is_mainline")
        .eq("opening_id", opening.id);

      if (error) throw error;

      const savedNodes: SessionNode[] = (data ?? []).map((node) => ({
        ...node,
        isSaved: true,
      }));
      const mainline: SessionNode[] = [];
      let parentNodeId: string | null = null;

      while (true) {
        const nextNode = savedNodes.find(
          (node) => node.parent_node_id === parentNodeId && node.is_mainline
        );
        if (!nextNode) break;
        if (mainline.some((node) => node.id === nextNode.id)) {
          throw new Error("This opening contains a cycle in its main line.");
        }
        mainline.push(nextNode);
        parentNodeId = nextNode.id;
      }

      const validationGame = new Chess();
      for (const node of mainline) {
        const move = validationGame.move(node.move_san);
        if (!move || validationGame.fen() !== node.fen_after) {
          throw new Error(`Could not validate saved move ${node.move_san}.`);
        }
      }

      game.reset();
      for (const node of mainline) game.move(node.move_san);

      setPosition(game.fen());
      setSessionNodes(savedNodes);
      setCurrentPath(mainline.map((node) => node.id));
      setIsVariationLine(false);
      setIsChoosingVariation(false);
      setActiveOpening(opening.name);
      setActiveOpeningId(opening.id);
      setOpeningName(opening.name);
    } catch (error) {
      setLineError(error instanceof Error ? error.message : "Could not load this opening.");
    } finally {
      setLoadingOpeningId(null);
    }
  }

  const handleFlipBoard = () => {
    setOrientation((prev) => (prev === "white" ? "black" : "white"));
  };

  const moveRows = groupMoves(sanMoves);

  const chessboardOptions = {
    position,
    onPieceDrop,
    boardOrientation: orientation,
    darkSquareStyle: { backgroundColor: colors.boardDark },
    lightSquareStyle: { backgroundColor: colors.boardLight },
    boardStyle: { borderRadius: "0px" },
    allowDrawingArrows: true,
  };

  return (
    <div
      className="flex h-screen w-full overflow-hidden text-white transition-colors duration-300"
      style={{ backgroundColor: colors.appBg }}
    >
      <aside
        className="flex w-72 shrink-0 flex-col border-r border-white/5 transition-colors duration-300"
        style={{ backgroundColor: colors.sidebarBg }}
      >
        <div className="p-3">
          <button
            onClick={() => {
              setNewOpeningName("");
              setNewOpeningError("");
              setIsNewOpeningOpen(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ backgroundColor: colors.accent, color: colors.accentText }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.accentHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.accent)}
          >
            <Plus size={17} strokeWidth={2.5} />
            New Opening
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <p className="px-2 pb-2 pt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Saved Openings
          </p>
          <nav className="flex flex-col gap-0.5">
            {isLoadingOpenings ? (
              <p className="px-2 py-2 text-sm text-zinc-500">Loading openings...</p>
            ) : openingListError ? (
              <p role="alert" className="px-2 py-2 text-sm text-red-400">
                {openingListError}
              </p>
            ) : openings.length === 0 ? (
              <p className="px-2 py-2 text-sm text-zinc-500">No openings yet.</p>
            ) : (
              openings.map((opening) => {
                const isActive = opening.id === activeOpeningId;
                return (
                  <button
                    key={opening.id}
                    onClick={() => handleLoadOpening(opening)}
                    disabled={loadingOpeningId !== null}
                    className={`group flex items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-wait disabled:opacity-60 ${
                      isActive ? "bg-white/5 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="truncate">
                      {loadingOpeningId === opening.id ? "Loading..." : opening.name}
                    </span>
                    <ChevronRight
                      size={14}
                      className={`shrink-0 opacity-0 transition-opacity group-hover:opacity-100 ${
                        isActive ? "opacity-60" : ""
                      }`}
                    />
                  </button>
                );
              })
            )}
          </nav>
        </div>

        <div className="border-t border-white/5 p-3">
          <div className="flex flex-col gap-0.5">
            <button className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">
              <Upload size={16} />
              Import PGN
            </button>
            <button className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">
              <Settings size={16} />
              Settings
            </button>
            <button className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-red-400">
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header
          className="flex shrink-0 items-center gap-4 border-b border-white/5 px-6 py-3.5 transition-colors duration-300"
          style={{ backgroundColor: colors.appBg }}
        >
          <input
            type="text"
            value={openingName}
            onChange={(e) => setOpeningName(e.target.value)}
            placeholder="Name your opening..."
            className="flex-1 bg-transparent text-lg font-medium text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancelMove}
              disabled={!lastPathNode || lastPathNode.isSaved || isChoosingVariation}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              title="Undo the last unsaved move"
            >
              <Undo2 size={15} />
              Cancel
            </button>
            <button
              onClick={() => setIsChoosingVariation((choosing) => !choosing)}
              disabled={!activeOpeningId || isSavingLine}
              className={`flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-sm transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 ${
                isChoosingVariation ? "bg-white/10 text-white" : "text-zinc-300"
              }`}
              title="Choose a move in the current line to branch from"
            >
              <GitBranch size={15} />
              {isChoosingVariation ? "Choose Move" : "Add Variation"}
            </button>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Palette size={15} />
              Theme
            </button>
            <button
              onClick={handleFlipBoard}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <RefreshCw size={15} />
              Flip Board
            </button>
            <button
              onClick={handleSaveLine}
              disabled={!activeOpeningId || pendingNodeCount === 0 || isSavingLine}
              className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors"
              style={{ backgroundColor: colors.accent, color: colors.accentText }}
              onMouseEnter={(e) => {
                if (activeOpeningId && pendingNodeCount > 0 && !isSavingLine) {
                  e.currentTarget.style.backgroundColor = colors.accentHover;
                }
              }}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.accent)}
            >
              <Save size={15} />
              {isSavingLine ? "Saving..." : "Save Line"}
            </button>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center gap-8 overflow-auto p-8">
          <div className="flex w-full max-w-[560px] items-center justify-center overflow-hidden rounded-md border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <Chessboard options={chessboardOptions} />
          </div>

          <div
            className="hidden h-[560px] w-72 shrink-0 flex-col rounded-lg border border-white/10 transition-colors duration-300 lg:flex"
            style={{ backgroundColor: colors.sidebarBg }}
          >
            <div className="border-b border-white/5 px-4 py-3">
              <p className="text-sm font-medium text-white">Move History</p>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {lineError && (
                <p role="alert" className="px-2 py-2 text-sm text-red-400">
                  {lineError}
                </p>
              )}
              {isChoosingVariation && (
                <div className="mb-2 flex items-center justify-between px-2 py-1 text-xs text-zinc-400">
                  <span>Select a move to branch from.</span>
                  <button
                    type="button"
                    onClick={() => handleSelectVariationPoint(null)}
                    className="text-white underline decoration-white/30 underline-offset-2 hover:text-zinc-300"
                  >
                    Start
                  </button>
                </div>
              )}
              {moveRows.length === 0 ? (
                <p className="px-2 py-2 text-sm text-zinc-500">
                  {isChoosingVariation ? "Choose the starting position for this variation." : "Play a move on the board to start recording the line."}
                </p>
              ) : (
                moveRows.map((move) => (
                  <div
                    key={move.no}
                    className="grid grid-cols-[28px_1fr_1fr] items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/5"
                  >
                    <span className="text-zinc-500">{move.no}.</span>
                    {isChoosingVariation ? (
                      <button
                        type="button"
                        onClick={() => handleSelectVariationPoint(move.whiteIndex)}
                        className="rounded px-1 text-left text-white hover:bg-white/10"
                      >
                        {move.white}
                      </button>
                    ) : (
                      <span className="text-white">{move.white}</span>
                    )}
                    {move.black && isChoosingVariation ? (
                      <button
                        type="button"
                        onClick={() => handleSelectVariationPoint(move.blackIndex ?? move.whiteIndex)}
                        className="rounded px-1 text-left text-zinc-300 hover:bg-white/10"
                      >
                        {move.black}
                      </button>
                    ) : (
                      <span className="text-zinc-300">{move.black ?? ""}</span>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-white/5 px-4 py-3">
              <p className="text-xs text-zinc-500">
                {sanMoves.length} {sanMoves.length === 1 ? "move" : "moves"} &middot; {activeOpening}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {pendingNodeCount} unsaved {pendingNodeCount === 1 ? "move" : "moves"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {isNewOpeningOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-opening-title"
            className="w-full max-w-md rounded-lg border border-white/10 p-5 shadow-2xl"
            style={{ backgroundColor: colors.sidebarBg }}
          >
            <h2 id="new-opening-title" className="text-lg font-semibold text-white">
              New Opening
            </h2>
            <form onSubmit={handleCreateOpening} className="mt-4 space-y-4">
              <div>
                <label htmlFor="new-opening-name" className="mb-1.5 block text-sm text-zinc-300">
                  Opening name
                </label>
                <input
                  id="new-opening-name"
                  autoFocus
                  value={newOpeningName}
                  onChange={(event) => setNewOpeningName(event.target.value)}
                  placeholder="e.g. Sicilian Defense"
                  maxLength={100}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/25"
                />
              </div>
              {newOpeningError && (
                <p role="alert" className="text-sm text-red-400">
                  {newOpeningError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewOpeningOpen(false)}
                  disabled={isCreatingOpening}
                  className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingOpening || !newOpeningName.trim()}
                  className="rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: colors.accent, color: colors.accentText }}
                  onMouseEnter={(event) => {
                    if (!isCreatingOpening && newOpeningName.trim()) {
                      event.currentTarget.style.backgroundColor = colors.accentHover;
                    }
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.backgroundColor = colors.accent;
                  }}
                >
                  {isCreatingOpening ? "Creating..." : "Create Opening"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}