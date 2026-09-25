"use client";

import { useState, useMemo, useCallback } from "react";
import { Chess } from "chess.js";
import dynamic from "next/dynamic";
import {
  Plus,
  Upload,
  Settings,
  LogOut,
  RefreshCw,
  Save,
  ChevronRight,
  Palette,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Dynamically import the chessboard to prevent Next.js server-side crashes
const Chessboard: any = dynamic(
  () => import("react-chessboard").then((mod) => mod.Chessboard),
  { ssr: false }
);

const SAVED_OPENINGS = [
  "Sicilian: Najdorf",
  "Ruy Lopez",
  "Caro-Kann",
  "Queen's Gambit Declined",
  "King's Indian Defense",
  "English Opening",
  "French: Advance Variation",
  "London System",
];

function groupMoves(sanMoves: string[]) {
  const rows = [];
  for (let i = 0; i < sanMoves.length; i += 2) {
    rows.push({
      no: i / 2 + 1,
      white: sanMoves[i],
      black: sanMoves[i + 1],
    });
  }
  return rows;
}

export default function ChessLibraryDashboard() {
  const [activeOpening, setActiveOpening] = useState("Sicilian: Najdorf");
  const [openingName, setOpeningName] = useState("Sicilian: Najdorf");
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [boardTheme, setBoardTheme] = useState<"green" | "brown">("green");

  const game = useMemo(() => new Chess(), []);
  const [position, setPosition] = useState(game.fen());
  const [sanMoves, setSanMoves] = useState<string[]>([]);

  // Bulletproof drop handler that supports both older and newer v5 react-chessboard APIs
  const onDrop = useCallback(
    (...args: any[]) => {
      const sourceSquare = typeof args[0] === "string" ? args[0] : args[0].sourceSquare;
      const targetSquare = typeof args[1] === "string" ? args[1] : args[0].targetSquare;
      
      try {
        const move = game.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });
        if (move === null) return false;

        setPosition(game.fen());
        setSanMoves(game.history());
        return true;
      } catch {
        return false;
      }
    },
    [game]
  );

  const handleFlipBoard = () => {
    setOrientation((prev) => (prev === "white" ? "black" : "white"));
  };

  const handleThemeToggle = () => {
    setBoardTheme((prev) => (prev === "green" ? "brown" : "green"));
  };

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      window.location.replace("/");
      return;
    }

    await supabase.auth.signOut();
    window.location.replace("/login/success?mode=logout&next=/");
  }

  const moveRows = groupMoves(sanMoves);

  const themeColors = {
    green: { light: "#ebecd0", dark: "#739552" },
    brown: { light: "#f0d9b5", dark: "#b58863" },
  };

  return (
    <div
      className="flex h-screen w-full overflow-hidden text-white"
      style={{ backgroundColor: "#21201d" }}
    >
      {/* Sidebar */}
      <aside
        className="flex w-72 shrink-0 flex-col border-r border-white/5"
        style={{ backgroundColor: "#262421" }}
      >
        <div className="p-3">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-[#1b2a0f] transition-colors"
            style={{ backgroundColor: "#81b64c" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#8bc255")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#81b64c")}
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
            {SAVED_OPENINGS.map((opening) => {
              const isActive = opening === activeOpening;
              return (
                <button
                  key={opening}
                  onClick={() => {
                    setActiveOpening(opening);
                    setOpeningName(opening);
                  }}
                  className={`group flex items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                    isActive ? "bg-white/5 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="truncate">{opening}</span>
                  <ChevronRight
                    size={14}
                    className={`shrink-0 opacity-0 transition-opacity group-hover:opacity-100 ${
                      isActive ? "opacity-60" : ""
                    }`}
                  />
                </button>
              );
            })}
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
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-red-400"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header
          className="flex shrink-0 items-center gap-4 border-b border-white/5 px-6 py-3.5"
          style={{ backgroundColor: "#21201d" }}
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
              onClick={handleThemeToggle}
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
              className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-[#1b2a0f] transition-colors"
              style={{ backgroundColor: "#81b64c" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#8bc255")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#81b64c")}
            >
              <Save size={15} />
              Save Line
            </button>
          </div>
        </header>

        {/* Body: board + notation panel */}
        <div className="flex flex-1 items-center justify-center gap-8 overflow-auto p-8">
          <div className="flex w-full max-w-[560px] items-center justify-center overflow-hidden rounded-md border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            {/* @ts-ignore - Safely bypasses React 19 / v5 typing issues */}
            <Chessboard
              key={boardTheme}
              // Standard props for backwards compatibility
              position={position}
              boardOrientation={orientation}
              customDarkSquareStyle={{ backgroundColor: themeColors[boardTheme].dark }}
              customLightSquareStyle={{ backgroundColor: themeColors[boardTheme].light }}
              onPieceDrop={onDrop}
              areArrowsAllowed={true}
              // Options object specifically required for v5+
              options={{
                position: position,
                boardOrientation: orientation,
                customDarkSquareStyle: { backgroundColor: themeColors[boardTheme].dark },
                customLightSquareStyle: { backgroundColor: themeColors[boardTheme].light },
                onPieceDrop: onDrop,
                areArrowsAllowed: true
              }}
            />
          </div>

          {/* Notation panel */}
          <div
            className="hidden h-[560px] w-72 shrink-0 flex-col rounded-lg border border-white/10 lg:flex"
            style={{ backgroundColor: "#262421" }}
          >
            <div className="border-b border-white/5 px-4 py-3">
              <p className="text-sm font-medium text-white">Move History</p>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {moveRows.length === 0 ? (
                <p className="px-2 py-2 text-sm text-zinc-500">
                  Play a move on the board to start recording the line.
                </p>
              ) : (
                moveRows.map((move) => (
                  <div
                    key={move.no}
                    className="grid grid-cols-[28px_1fr_1fr] items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/5"
                  >
                    <span className="text-zinc-500">{move.no}.</span>
                    <span className="text-white">{move.white}</span>
                    <span className="text-zinc-300">{move.black ?? ""}</span>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-white/5 px-4 py-3">
              <p className="text-xs text-zinc-500">
                {sanMoves.length} {sanMoves.length === 1 ? "move" : "moves"} &middot; {activeOpening}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}