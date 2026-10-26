// app/dashboard/page.tsx
"use client";

import { useState, useMemo, useCallback, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  Plus,
  Upload,
  Settings,
  LogOut,
  RefreshCw,
  Save,
  ChevronLeft,
  ChevronRight,
  Palette,
  GitBranch,
  Undo2,
  Trash2,
  X,
} from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { supabaseBrowser } from "@/lib/supabase/client";
import { signOutUser } from "@/lib/auth/supabase-auth";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { BranchModal, type BranchLine } from "@/components/branch-modal";

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
  variation_name: string | null;
  isSaved: boolean;
};

type Opening = {
  id: string;
  name: string;
  created_at: string;
};

type SavedVariation = {
  id: string;
  opening_id: string;
  variation_name: string;
  parent_node_id: string | null;
  parent_variation_id: string | null;
};

type VariationAncestorNode = {
  id: string;
  parent_node_id: string | null;
  variation_name: string | null;
};

type PendingNavigation =
  | { type: "opening"; opening: Opening; startVariation: boolean }
  | { type: "variation"; opening: Opening; variation: SavedVariation }
  | { type: "new-opening" }
  | { type: "delete-opening"; opening: Opening }
  | { type: "sign-out" };

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

function findParentVariationId(
  parentNodeId: string | null,
  nodes: VariationAncestorNode[]
) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  let currentId = parentNodeId;

  while (currentId) {
    if (visited.has(currentId)) return null;
    visited.add(currentId);
    const ancestor = nodesById.get(currentId);
    if (!ancestor) return null;
    if (ancestor.variation_name) return ancestor.id;
    currentId = ancestor.parent_node_id;
  }

  return null;
}

function groupSavedVariations(nodes: (VariationAncestorNode & { opening_id: string })[]) {
  return nodes.reduce<Record<string, SavedVariation[]>>((grouped, node) => {
    if (!node.variation_name) return grouped;
    grouped[node.opening_id] ??= [];
    grouped[node.opening_id].push({
      id: node.id,
      opening_id: node.opening_id,
      variation_name: node.variation_name,
      parent_node_id: node.parent_node_id,
      parent_variation_id: findParentVariationId(node.parent_node_id, nodes),
    });
    return grouped;
  }, {});
}

export default function DashboardPage() {
  const { theme, toggleTheme } = useTheme();
  const colors = THEMES[theme];

  const [openings, setOpenings] = useState<Opening[]>([]);
  const [variationsByOpening, setVariationsByOpening] = useState<Record<string, SavedVariation[]>>({});
  const [isLoadingOpenings, setIsLoadingOpenings] = useState(true);
  const [openingListError, setOpeningListError] = useState("");
  const [loadingOpeningId, setLoadingOpeningId] = useState<string | null>(null);
  const [expandedOpeningId, setExpandedOpeningId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingOpeningId, setDeletingOpeningId] = useState<string | null>(null);
  const [deleteOpeningError, setDeleteOpeningError] = useState("");
  const [activeOpening, setActiveOpening] = useState("");
  const [activeOpeningId, setActiveOpeningId] = useState<string | null>(null);
  const [openingName, setOpeningName] = useState("");
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [isNewOpeningOpen, setIsNewOpeningOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [newOpeningName, setNewOpeningName] = useState("");
  const [newOpeningError, setNewOpeningError] = useState("");
  const [isCreatingOpening, setIsCreatingOpening] = useState(false);
  const [activeVariationName, setActiveVariationName] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [isUnsavedVariationOpen, setIsUnsavedVariationOpen] = useState(false);
  const [isNamingBeforeNavigation, setIsNamingBeforeNavigation] = useState(false);
  const [navigationVariationName, setNavigationVariationName] = useState("");
  const allowUnloadRef = useRef(false);

  const game = useMemo(() => new Chess(), []);
  const [position, setPosition] = useState(game.fen());
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchInitialPosition, setBranchInitialPosition] = useState(game.fen());
  const [branchParentNodeId, setBranchParentNodeId] = useState<string | null>(null);
  const [branchContextLabel, setBranchContextLabel] = useState("starting position");
  const [sessionNodes, setSessionNodes] = useState<SessionNode[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [activeLineStartIndex, setActiveLineStartIndex] = useState(0);
  const [isUntitledVariation, setIsUntitledVariation] = useState(false);
  const [isVariationLine, setIsVariationLine] = useState(false);
  const [isNamingVariation, setIsNamingVariation] = useState(false);
  const [variationNameDraft, setVariationNameDraft] = useState("");
  const [isSavingLine, setIsSavingLine] = useState(false);
  const [lineError, setLineError] = useState("");
  const [viewedMoveCount, setViewedMoveCount] = useState<number | null>(null);

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

        const openingIds = (data ?? []).map((opening) => opening.id);
        const groupedVariations: Record<string, SavedVariation[]> = {};

        if (openingIds.length > 0) {
          const { data: nodeRows, error: nodesError } = await supabaseBrowser
            .from("opening_nodes")
            .select("id, opening_id, parent_node_id, variation_name")
            .in("opening_id", openingIds);

          if (nodesError) throw nodesError;

          const nodes = (nodeRows ?? []) as (VariationAncestorNode & { opening_id: string })[];
          Object.assign(groupedVariations, groupSavedVariations(nodes));
        }

        if (isMounted) setVariationsByOpening(groupedVariations);
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
  const sanMoves = currentPathNodes.slice(activeLineStartIndex).map((node) => node.move_san);
  const pendingNodeCount = sessionNodes.filter((node) => !node.isSaved).length;
  const lastPathNode = currentPathNodes.at(-1);
  const visibleMoveCount = viewedMoveCount ?? sanMoves.length;
  const isViewingHistory = viewedMoveCount !== null;

  useEffect(() => {
    if (!isUntitledVariation || sanMoves.length === 0) return;

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      if (allowUnloadRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [isUntitledVariation, sanMoves.length]);

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
      if (!targetSquare || viewedMoveCount !== null) return false;
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
          variation_name: null,
          isSaved: false,
        };
        setSessionNodes((nodes) => [...nodes, node]);
        setCurrentPath((path) => [...path, node.id]);
        setPosition(game.fen());
        setViewedMoveCount(null);
        if (isVariationLine) setIsVariationLine(false);
        setLineError("");
        return true;
      } catch {
        return false;
      }
    },
    [currentPath, game, isVariationLine, viewedMoveCount]
  );

  function handleNavigateMove(step: number) {
    const nextMoveCount = Math.max(
      0,
      Math.min(sanMoves.length, visibleMoveCount + step)
    );
    const replayGame = new Chess();

    try {
      for (const node of currentPathNodes.slice(0, activeLineStartIndex + nextMoveCount)) {
        const move = replayGame.move(node.move_san);
        if (!move || replayGame.fen() !== node.fen_after) {
          throw new Error(`Could not replay saved move ${node.move_san}.`);
        }
      }

      setPosition(replayGame.fen());
      setViewedMoveCount(nextMoveCount === sanMoves.length ? null : nextMoveCount);
      setLineError("");
    } catch (error) {
      setLineError(error instanceof Error ? error.message : "Could not navigate this line.");
    }
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
    setViewedMoveCount(null);
    setIsVariationLine(!lastPathNode.is_mainline);
    setLineError("");
  }

  async function handleSaveLine(variationName?: string) {
    if (!activeOpeningId || !supabaseBrowser || pendingNodeCount === 0) return false;

    const name = variationName?.trim();
    if (isUntitledVariation && !name) return false;

    const variationRootId = isUntitledVariation
      ? currentPath[activeLineStartIndex]
      : null;
    const activeVariationNodeIds = new Set(currentPath.slice(activeLineStartIndex));
    const pendingNodes = sessionNodes.filter(
      (node) => !node.isSaved && (!isUntitledVariation || activeVariationNodeIds.has(node.id))
    );

    if (isUntitledVariation && (!variationRootId || !pendingNodes.some((node) => node.id === variationRootId))) {
      setLineError("The variation has no unsaved starting move to save.");
      return false;
    }

    setIsSavingLine(true);
    setLineError("");

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
          variation_name: node.id === variationRootId ? name : node.variation_name,
        }))
      );

      if (error) throw error;

      const savedIds = new Set(pendingNodes.map((node) => node.id));
      setSessionNodes((nodes) =>
        nodes.map((node) => savedIds.has(node.id)
          ? {
              ...node,
              isSaved: true,
              variation_name: node.id === variationRootId ? name ?? null : node.variation_name,
            }
          : node)
      );
      const savedVariations = pendingNodes.filter(
        (node) => node.id === variationRootId && name
      );
      if (savedVariations.length > 0) {
        setVariationsByOpening((current) => {
          const next = { ...current };
          const openingVariations = [...(next[activeOpeningId] ?? [])];
          for (const variation of savedVariations) {
            if (!openingVariations.some((item) => item.id === variation.id)) {
              openingVariations.push({
                id: variation.id,
                opening_id: activeOpeningId,
                variation_name: name as string,
                parent_node_id: variation.parent_node_id,
                parent_variation_id: findParentVariationId(variation.parent_node_id, sessionNodes),
              });
            }
          }
          next[activeOpeningId] = openingVariations;
          return next;
        });
      }
      if (isUntitledVariation && name) {
        setActiveVariationName(name);
        setIsUntitledVariation(false);
        setIsVariationLine(false);
        setIsNamingVariation(false);
        setVariationNameDraft("");
      }
      return true;
    } catch (error) {
      setLineError(error instanceof Error ? error.message : "Could not save this line.");
      return false;
    } finally {
      setIsSavingLine(false);
    }
  }

  async function handleSaveNamedVariation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = variationNameDraft.trim();
    if (!name) {
      setLineError("Enter a name for this variation.");
      return;
    }
    await handleSaveLine(name);
  }

  function discardUntitledVariation() {
    const basePath = currentPath.slice(0, activeLineStartIndex);
    const baseNodes = basePath
      .map((nodeId) => sessionNodes.find((node) => node.id === nodeId))
      .filter((node): node is SessionNode => node !== undefined);

    game.reset();
    for (const node of baseNodes) game.move(node.move_san);

    setSessionNodes((nodes) => nodes.filter((node) => node.isSaved));
    setCurrentPath(basePath);
    setActiveLineStartIndex(basePath.length);
    setPosition(game.fen());
    setViewedMoveCount(null);
    setIsUntitledVariation(false);
    setIsVariationLine(false);
    setIsNamingVariation(false);
    setVariationNameDraft("");
    setActiveVariationName(null);
    setLineError("");
  }

  function runPendingNavigation(action: PendingNavigation) {
    switch (action.type) {
      case "opening":
        void handleLoadOpening(action.opening, action.startVariation);
        break;
      case "variation":
        void handleLoadVariation(action.opening, action.variation);
        break;
      case "new-opening":
        setNewOpeningName("");
        setNewOpeningError("");
        setIsNewOpeningOpen(true);
        break;
      case "delete-opening":
        void performDeleteOpening(action.opening);
        break;
      case "sign-out":
        void performSignOut();
        break;
    }
  }

  function requestNavigation(action: PendingNavigation) {
    if (isUntitledVariation && sanMoves.length > 0) {
      setPendingNavigation(action);
      setIsUnsavedVariationOpen(true);
      setIsNamingBeforeNavigation(false);
      setNavigationVariationName(variationNameDraft);
      setLineError("");
      return;
    }

    if (isUntitledVariation) discardUntitledVariation();
    runPendingNavigation(action);
  }

  function discardAndContinue() {
    if (!pendingNavigation) return;
    const action = pendingNavigation;
    discardUntitledVariation();
    setPendingNavigation(null);
    setIsUnsavedVariationOpen(false);
    setIsNamingBeforeNavigation(false);
    setNavigationVariationName("");
    if (action.type === "sign-out") allowUnloadRef.current = true;
    runPendingNavigation(action);
  }

  async function saveAndContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = navigationVariationName.trim();
    if (!name) {
      setLineError("Enter a name for this variation.");
      return;
    }
    if (!pendingNavigation) return;

    const saved = await handleSaveLine(name);
    if (!saved) return;

    const action = pendingNavigation;
    setPendingNavigation(null);
    setIsUnsavedVariationOpen(false);
    setIsNamingBeforeNavigation(false);
    setNavigationVariationName("");
    if (action.type === "sign-out") allowUnloadRef.current = true;
    runPendingNavigation(action);
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
      setActiveLineStartIndex(0);
      setIsUntitledVariation(false);
      setViewedMoveCount(null);
      setIsVariationLine(false);
      setActiveVariationName(null);
      setLineError("");
      setOpenings((current) => [data, ...current.filter((opening) => opening.id !== data.id)]);
      setActiveOpening(data.name);
      setActiveOpeningId(data.id);
      setOpeningName(data.name);
      setExpandedOpeningId(data.id);
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

  async function handleLoadOpening(opening: Opening, startVariation = false) {
    if (!supabaseBrowser) return;

    setLoadingOpeningId(opening.id);
    setLineError("");

    try {
      const { data, error } = await supabaseBrowser
        .from("opening_nodes")
        .select("id, parent_node_id, move_san, fen_after, move_number, is_mainline, variation_name")
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
      setActiveLineStartIndex(startVariation ? mainline.length : 0);
      setIsUntitledVariation(startVariation);
      setViewedMoveCount(null);
      setIsVariationLine(startVariation);
      setActiveVariationName(null);
      setActiveOpening(opening.name);
      setActiveOpeningId(opening.id);
      setOpeningName(opening.name);
      setExpandedOpeningId(opening.id);
    } catch (error) {
      setLineError(error instanceof Error ? error.message : "Could not load this opening.");
    } finally {
      setLoadingOpeningId(null);
    }
  }

  async function handleLoadVariation(opening: Opening, variation: SavedVariation) {
    if (!supabaseBrowser) return;

    setLoadingOpeningId(opening.id);
    setLineError("");

    try {
      const { data, error } = await supabaseBrowser
        .from("opening_nodes")
        .select("id, parent_node_id, move_san, fen_after, move_number, is_mainline, variation_name")
        .eq("opening_id", opening.id);

      if (error) throw error;

      const savedNodes: SessionNode[] = (data ?? []).map((node) => ({
        ...node,
        isSaved: true,
      }));
      const root = savedNodes.find(
        (node) => node.id === variation.id && node.variation_name
      );
      if (!root) throw new Error("This saved variation could not be found.");

      const ancestorPath: SessionNode[] = [];
      const visitedNodeIds = new Set([root.id]);
      let ancestorId = root.parent_node_id;
      while (ancestorId) {
        if (visitedNodeIds.has(ancestorId)) {
          throw new Error(`The variation "${root.variation_name}" contains a cycle.`);
        }
        const ancestor = savedNodes.find((node) => node.id === ancestorId);
        if (!ancestor) throw new Error(`The variation "${root.variation_name}" has a missing parent move.`);
        ancestorPath.unshift(ancestor);
        visitedNodeIds.add(ancestor.id);
        ancestorId = ancestor.parent_node_id;
      }

      const variationPath = [...ancestorPath, root];
      let parentNodeId = root.id;
      while (true) {
        const children = savedNodes.filter((node) => node.parent_node_id === parentNodeId);
        const mainlineChildren = children.filter((node) => node.is_mainline);
        if (mainlineChildren.length > 1) {
          throw new Error(`The variation "${root.variation_name}" has multiple mainline continuations.`);
        }
        const nextNode = mainlineChildren[0] ?? (children.length === 1 ? children[0] : undefined);
        if (!nextNode) break;
        if (visitedNodeIds.has(nextNode.id)) {
          throw new Error(`The variation "${root.variation_name}" contains a cycle.`);
        }
        variationPath.push(nextNode);
        visitedNodeIds.add(nextNode.id);
        parentNodeId = nextNode.id;
      }

      const validationGame = new Chess();
      for (const node of variationPath) {
        const move = validationGame.move(node.move_san);
        if (!move || validationGame.fen() !== node.fen_after) {
          throw new Error(`Could not validate saved move ${node.move_san}.`);
        }
      }

      game.reset();
      for (const node of variationPath) game.move(node.move_san);

      setPosition(game.fen());
      setSessionNodes(savedNodes);
      setCurrentPath(variationPath.map((node) => node.id));
      setActiveLineStartIndex(ancestorPath.length);
      setIsUntitledVariation(false);
      setViewedMoveCount(null);
      setIsVariationLine(false);
      setActiveOpening(opening.name);
      setActiveOpeningId(opening.id);
      setOpeningName(opening.name);
      setActiveVariationName(root.variation_name);
      setExpandedOpeningId(opening.id);
    } catch (error) {
      setLineError(error instanceof Error ? error.message : "Could not load this variation.");
    } finally {
      setLoadingOpeningId(null);
    }
  }

  function handleDeleteOpening(opening: Opening) {
    requestNavigation({ type: "delete-opening", opening });
  }

  async function performDeleteOpening(opening: Opening) {
    if (!supabaseBrowser) {
      setDeleteOpeningError("Supabase is not configured.");
      return;
    }

    setDeletingOpeningId(opening.id);
    setDeleteOpeningError("");

    try {
      const { error } = await supabaseBrowser
        .from("openings")
        .delete()
        .eq("id", opening.id)
        .select("id")
        .single();

      if (error) throw error;

      setOpenings((current) => current.filter((item) => item.id !== opening.id));
      setVariationsByOpening((current) => {
        const next = { ...current };
        delete next[opening.id];
        return next;
      });
      setConfirmingDeleteId(null);

      if (activeOpeningId === opening.id) {
        game.reset();
        setPosition(game.fen());
        setSessionNodes([]);
        setCurrentPath([]);
        setActiveLineStartIndex(0);
        setIsUntitledVariation(false);
        setViewedMoveCount(null);
        setIsVariationLine(false);
        setActiveVariationName(null);
        setActiveOpening("");
        setActiveOpeningId(null);
        setExpandedOpeningId(null);
        setOpeningName("");
        setLineError("");
      }
    } catch (error) {
      setDeleteOpeningError(
        error instanceof Error ? error.message : "Could not delete this opening."
      );
    } finally {
      setDeletingOpeningId(null);
    }
  }

  const handleFlipBoard = () => {
    setOrientation((prev) => (prev === "white" ? "black" : "white"));
  };

  function handleOpenBranchModal() {
    const parentIndex = activeLineStartIndex + visibleMoveCount - 1;
    const parentNode = parentIndex >= 0 ? currentPathNodes[parentIndex] : undefined;
    setBranchInitialPosition(position);
    setBranchParentNodeId(parentNode?.id ?? null);
    setBranchContextLabel(
      parentNode ? `move ${parentNode.move_number} (${parentNode.move_san})` : "starting position"
    );
    setIsBranchModalOpen(true);
  }

  async function handleConfirmBranchLines(lines: BranchLine[]) {
    if (!activeOpeningId || !supabaseBrowser) {
      throw new Error("Select an opening before saving branch lines.");
    }

    const populatedLines = lines.filter((line) => line.moves.length > 0);
    const modalMoves = populatedLines.flatMap((line) => line.moves);
    const modalMoveIds = new Set(modalMoves.map((move) => move.id));
    const pendingAncestors = new Map<string, SessionNode>();
    const collectingAncestors = new Set<string>();

    function collectPendingAncestors(nodeId: string | null) {
      if (!nodeId || modalMoveIds.has(nodeId)) return;
      const node = sessionNodes.find((item) => item.id === nodeId);
      if (!node || node.isSaved || pendingAncestors.has(node.id)) return;
      if (collectingAncestors.has(node.id)) {
        throw new Error("A parent cycle was found in the current line.");
      }

      collectingAncestors.add(node.id);
      collectPendingAncestors(node.parent_node_id);
      collectingAncestors.delete(node.id);
      pendingAncestors.set(node.id, node);
    }

    for (const line of populatedLines) collectPendingAncestors(line.parentNodeId);

    const orderedModalMoves: { line: BranchLine; move: BranchLine["moves"][number] }[] = [];
    const remainingMoves = populatedLines.flatMap((line) =>
      line.moves.map((move) => ({ line, move }))
    );
    const resolvedNodeIds = new Set(pendingAncestors.keys());

    while (remainingMoves.length > 0) {
      const nextIndex = remainingMoves.findIndex(({ move }) =>
        !move.parentNodeId ||
        resolvedNodeIds.has(move.parentNodeId) ||
        !modalMoveIds.has(move.parentNodeId)
      );
      if (nextIndex < 0) {
        throw new Error("The branch lines contain a missing parent or a cycle.");
      }

      const [next] = remainingMoves.splice(nextIndex, 1);
      orderedModalMoves.push(next);
      resolvedNodeIds.add(next.move.id);
    }

    const variationNameByRootId = new Map(
      populatedLines.map((line) => [line.moves[0].id, line.name])
    );
    const ancestorRows = [...pendingAncestors.values()].map((node) => ({
      id: node.id,
      opening_id: activeOpeningId,
      parent_node_id: node.parent_node_id,
      move_san: node.move_san,
      fen_after: node.fen_after,
      move_number: node.move_number,
      is_mainline: node.is_mainline,
      variation_name: node.variation_name,
    }));
    const branchRows = orderedModalMoves.map(({ move }) => ({
      id: move.id,
      opening_id: activeOpeningId,
      parent_node_id: move.parentNodeId,
      move_san: move.moveSan,
      fen_after: move.fenAfter,
      move_number: move.moveNumber,
      is_mainline: move.isMainline,
      variation_name: variationNameByRootId.get(move.id) ?? null,
    }));

    for (const line of populatedLines) {
      const validationGame = new Chess(line.startFen);
      let expectedParentId = line.parentNodeId;
      for (const move of line.moves) {
        if (move.parentNodeId !== expectedParentId) {
          throw new Error(`${line.name} contains an invalid parent chain.`);
        }
        const validatedMove = validationGame.move(move.moveSan);
        if (!validatedMove || validationGame.fen() !== move.fenAfter) {
          throw new Error(`${line.name} contains an invalid chess move: ${move.moveSan}.`);
        }
        expectedParentId = move.id;
      }
    }

    if (branchRows.length !== modalMoveIds.size) {
      throw new Error("Not every move from the modal was included in the save batch.");
    }

    const { error } = await supabaseBrowser
      .from("opening_nodes")
      .insert([...ancestorRows, ...branchRows]);
    if (error) throw error;

    const savedAncestorIds = new Set(pendingAncestors.keys());

    const { data: refreshedRows, error: refreshError } = await supabaseBrowser
      .from("opening_nodes")
      .select("id, opening_id, parent_node_id, move_san, fen_after, move_number, is_mainline, variation_name")
      .eq("opening_id", activeOpeningId);

    if (!refreshError) {
      const refreshedNodes: SessionNode[] = (refreshedRows ?? []).map((node) => ({
        id: node.id,
        parent_node_id: node.parent_node_id,
        move_san: node.move_san,
        fen_after: node.fen_after,
        move_number: node.move_number,
        is_mainline: node.is_mainline,
        variation_name: node.variation_name,
        isSaved: true,
      }));
      setSessionNodes((current) => {
        const savedIds = new Set(refreshedNodes.map((node) => node.id));
        const remainingDrafts = current.filter((node) => !node.isSaved && !savedIds.has(node.id));
        return [...refreshedNodes, ...remainingDrafts];
      });
      setVariationsByOpening((current) => ({
        ...current,
        ...groupSavedVariations(
          (refreshedRows ?? []) as (VariationAncestorNode & { opening_id: string })[]
        ),
      }));
    } else {
      const localNodes: SessionNode[] = branchRows.map((row) => ({
        id: row.id,
        parent_node_id: row.parent_node_id,
        move_san: row.move_san,
        fen_after: row.fen_after,
        move_number: row.move_number,
        is_mainline: row.is_mainline,
        variation_name: row.variation_name,
        isSaved: true,
      }));
      setSessionNodes((current) => {
        const updated = current.map((node) =>
          savedAncestorIds.has(node.id) ? { ...node, isSaved: true } : node
        );
        const knownIds = new Set(updated.map((node) => node.id));
        return [...updated, ...localNodes.filter((node) => !knownIds.has(node.id))];
      });
      const localAncestorRows = [
        ...sessionNodes.map((node) => ({ ...node, opening_id: activeOpeningId })),
        ...branchRows,
      ] as (VariationAncestorNode & { opening_id: string })[];
      setVariationsByOpening((current) => ({
        ...current,
        ...groupSavedVariations(localAncestorRows),
      }));
      setLineError("Branch lines were saved, but the sidebar refresh failed. Reload the opening to refresh its tree.");
    }
  }

  function handleSignOut() {
    requestNavigation({ type: "sign-out" });
  }

  async function performSignOut() {
    setIsSigningOut(true);
    setSignOutError("");

    try {
      const { error } = await signOutUser();
      if (error) throw error;
      window.location.replace("/login/success?mode=logout&next=/");
    } catch (error) {
      allowUnloadRef.current = false;
      setSignOutError(error instanceof Error ? error.message : "Could not sign out.");
      setIsSigningOut(false);
    }
  }

  const moveRows = groupMoves(sanMoves);

  const chessboardOptions = {
    position,
    onPieceDrop,
    allowDragging: !isViewingHistory,
    boardOrientation: orientation,
    darkSquareStyle: { backgroundColor: colors.boardDark },
    lightSquareStyle: { backgroundColor: colors.boardLight },
    boardStyle: { borderRadius: "0px" },
    allowDrawingArrows: true,
  };

  function renderSavedVariation(
    opening: Opening,
    variation: SavedVariation,
    allVariations: SavedVariation[],
    ancestors = new Set<string>()
  ): ReactNode {
    if (ancestors.has(variation.id)) return null;
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(variation.id);
    const children = allVariations.filter((item) => item.parent_variation_id === variation.id);

    return (
      <div key={variation.id}>
        <button
          type="button"
          onClick={() => requestNavigation({ type: "variation", opening, variation })}
          disabled={loadingOpeningId !== null || deletingOpeningId !== null}
          className="flex w-full min-w-0 items-center rounded-md px-2 py-1.5 text-left text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-wait disabled:opacity-60"
        >
          <span className="min-w-0 flex-1 truncate">{variation.variation_name}</span>
        </button>
        {children.length > 0 && (
          <div className="ml-3 border-l border-white/10 pl-2">
            {children.map((child) => renderSavedVariation(opening, child, allVariations, nextAncestors))}
          </div>
        )}
      </div>
    );
  }

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
            onClick={() => requestNavigation({ type: "new-opening" })}
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
                const isExpanded = opening.id === expandedOpeningId;
                const openingVariations = variationsByOpening[opening.id] ?? [];
                const variationIds = new Set(openingVariations.map((variation) => variation.id));
                const roots = openingVariations.filter(
                  (variation) => !variation.parent_variation_id || !variationIds.has(variation.parent_variation_id)
                );
                const displayRoots = roots.length > 0 ? roots : openingVariations;

                return (
                  <div key={opening.id}>
                    <div
                      className={`group flex items-center gap-0.5 rounded-md ${
                        isActive ? "bg-white/5" : ""
                      }`}
                    >
                      <button
                        onClick={() => requestNavigation({ type: "opening", opening, startVariation: false })}
                        disabled={loadingOpeningId !== null || deletingOpeningId !== null}
                        aria-expanded={isExpanded}
                        className={`flex min-w-0 flex-1 items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-wait disabled:opacity-60 ${
                          isActive ? "text-white" : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <span className="truncate">
                          {loadingOpeningId === opening.id ? "Loading..." : opening.name}
                        </span>
                        <ChevronRight
                          size={14}
                          className={`shrink-0 transition-transform ${
                            isExpanded ? "rotate-90 opacity-60" : "opacity-0 group-hover:opacity-100"
                          }`}
                        />
                      </button>
                      {isActive && confirmingDeleteId !== opening.id && (
                        <button
                          type="button"
                          onClick={handleOpenBranchModal}
                          disabled={isSavingLine || isUntitledVariation || loadingOpeningId !== null}
                          aria-label={`Branch ${opening.name}`}
                          title="Create conditional branch lines from the current position"
                          className="mr-0.5 shrink-0 rounded p-1 text-zinc-500 opacity-0 transition-colors hover:bg-white/10 hover:text-white focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <GitBranch size={14} />
                        </button>
                      )}
                      {confirmingDeleteId === opening.id ? (
                        <div className="flex shrink-0 items-center gap-1 pr-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteOpening(opening)}
                            disabled={deletingOpeningId !== null}
                            className="rounded px-1.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                          >
                            {deletingOpeningId === opening.id ? "Deleting..." : "Delete"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteId(null)}
                            disabled={deletingOpeningId !== null}
                            aria-label={`Cancel deleting ${opening.name}`}
                            className="rounded p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteOpeningError("");
                            setConfirmingDeleteId(opening.id);
                          }}
                          disabled={loadingOpeningId !== null || deletingOpeningId !== null}
                          aria-label={`Delete ${opening.name}`}
                          title={`Delete ${opening.name}`}
                          className="mr-1 shrink-0 rounded p-1 text-zinc-500 opacity-0 transition-colors hover:bg-red-500/10 hover:text-red-400 focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="ml-3 border-l border-white/10 py-1 pl-2">
                        {openingVariations.length === 0 ? (
                          <p className="px-2 py-1 text-xs text-zinc-500">No saved variations</p>
                        ) : (
                          displayRoots.map((variation) =>
                            renderSavedVariation(opening, variation, openingVariations)
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </nav>
          {deleteOpeningError && (
            <p role="alert" className="px-2 py-2 text-sm text-red-400">
              {deleteOpeningError}
            </p>
          )}
        </div>

        <div className="border-t border-white/5 p-3">
          <div className="flex flex-col gap-0.5">
            <button className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">
              <Upload size={16} />
              Import PGN
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Settings size={16} />
              Settings
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-red-400 disabled:cursor-wait disabled:opacity-50"
            >
              <LogOut size={16} />
              {isSigningOut ? "Signing Out..." : "Sign Out"}
            </button>
            {signOutError && (
              <p role="alert" className="px-2.5 py-1 text-xs text-red-400">
                {signOutError}
              </p>
            )}
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
              disabled={!lastPathNode || lastPathNode.isSaved || isViewingHistory}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              title="Undo the last unsaved move"
            >
              <Undo2 size={15} />
              Cancel
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
              onClick={() => handleSaveLine()}
              disabled={!activeOpeningId || pendingNodeCount === 0 || isSavingLine || isUntitledVariation}
              className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: colors.accent, color: colors.accentText }}
              onMouseEnter={(e) => {
                if (activeOpeningId && pendingNodeCount > 0 && !isSavingLine && !isUntitledVariation) {
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
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">Move History</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleNavigateMove(-1)}
                    disabled={visibleMoveCount === 0}
                    aria-label="Previous move"
                    title="Previous move"
                    className="rounded p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="min-w-10 text-center text-xs tabular-nums text-zinc-500">
                    {visibleMoveCount}/{sanMoves.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleNavigateMove(1)}
                    disabled={visibleMoveCount === sanMoves.length}
                    aria-label="Next move"
                    title="Next move"
                    className="rounded p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {lineError && (
                <p role="alert" className="px-2 py-2 text-sm text-red-400">
                  {lineError}
                </p>
              )}
              {moveRows.length === 0 ? (
                <p className="px-2 py-2 text-sm text-zinc-500">
                  Play a move on the board to start recording the line.
                </p>
              ) : (
                moveRows.map((move) => (
                  <div
                    key={move.no}
                    className="group/move grid grid-cols-[28px_1fr_1fr] items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/5"
                  >
                    <span className="text-zinc-500">{move.no}.</span>
                    <div className="flex min-w-0 items-center gap-0.5">
                      <span className="truncate text-white">{move.white}</span>
                    </div>
                    <div className="flex min-w-0 items-center gap-0.5">
                      <span className="truncate text-zinc-300">{move.black ?? ""}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-white/5 px-4 py-3">
              <p className="text-xs text-zinc-500">
                {sanMoves.length} {sanMoves.length === 1 ? "move" : "moves"} &middot; {activeOpening}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Line: {activeVariationName ?? (isUntitledVariation ? "Untitled variation" : "Main line")}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {pendingNodeCount} unsaved {pendingNodeCount === 1 ? "move" : "moves"}
              </p>
              {isUntitledVariation && sanMoves.length > 0 && (
                <div className="mt-3 border-t border-white/10 pt-3">
                  {isNamingVariation ? (
                    <form onSubmit={handleSaveNamedVariation} className="space-y-2">
                      <label htmlFor="variation-save-name" className="sr-only">
                        Variation name
                      </label>
                      <input
                        id="variation-save-name"
                        autoFocus
                        value={variationNameDraft}
                        onChange={(event) => setVariationNameDraft(event.target.value)}
                        placeholder="Variation name"
                        maxLength={100}
                        className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/25"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsNamingVariation(false);
                            setVariationNameDraft("");
                            setLineError("");
                          }}
                          disabled={isSavingLine}
                          className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/5 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!variationNameDraft.trim() || isSavingLine}
                          className="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ backgroundColor: colors.accent, color: colors.accentText }}
                        >
                          {isSavingLine ? "Saving..." : "Confirm Save"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsNamingVariation(true);
                        setVariationNameDraft("");
                        setLineError("");
                      }}
                      disabled={isSavingLine}
                      className="w-full rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                      style={{ backgroundColor: colors.accent, color: colors.accentText }}
                    >
                      Save
                    </button>
                  )}
                </div>
              )}
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

      {isBranchModalOpen && activeOpeningId && (
        <BranchModal
          openingName={activeOpening}
          initialPosition={branchInitialPosition}
          parentNodeId={branchParentNodeId}
          branchContextLabel={branchContextLabel}
          colors={colors}
          onClose={() => setIsBranchModalOpen(false)}
          onConfirm={handleConfirmBranchLines}
        />
      )}

      {isUnsavedVariationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-variation-title"
            className="w-full max-w-md rounded-lg border border-white/10 p-5 shadow-2xl"
            style={{ backgroundColor: colors.sidebarBg }}
          >
            <h2 id="unsaved-variation-title" className="text-lg font-semibold text-white">
              Unsaved Variation
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              You have an unsaved variation with {sanMoves.length} {sanMoves.length === 1 ? "move" : "moves"}.
              Save it before continuing?
            </p>
            {lineError && (
              <p role="alert" className="mt-3 text-sm text-red-400">
                {lineError}
              </p>
            )}
            {isNamingBeforeNavigation ? (
              <form onSubmit={saveAndContinue} className="mt-4 space-y-3">
                <label htmlFor="navigation-variation-name" className="sr-only">
                  Variation name
                </label>
                <input
                  id="navigation-variation-name"
                  autoFocus
                  value={navigationVariationName}
                  onChange={(event) => setNavigationVariationName(event.target.value)}
                  placeholder="Variation name"
                  maxLength={100}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/25"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsNamingBeforeNavigation(false);
                      setLineError("");
                    }}
                    disabled={isSavingLine}
                    className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={!navigationVariationName.trim() || isSavingLine}
                    className="rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: colors.accent, color: colors.accentText }}
                  >
                    {isSavingLine ? "Saving..." : "Save and Continue"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPendingNavigation(null);
                    setIsUnsavedVariationOpen(false);
                    setLineError("");
                  }}
                  className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5"
                >
                  Stay
                </button>
                <button
                  type="button"
                  onClick={discardAndContinue}
                  disabled={isSavingLine}
                  className="rounded-lg border border-red-500/30 px-3.5 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsNamingBeforeNavigation(true);
                    setNavigationVariationName(variationNameDraft);
                    setLineError("");
                  }}
                  className="rounded-lg px-3.5 py-2 text-sm font-medium transition-colors"
                  style={{ backgroundColor: colors.accent, color: colors.accentText }}
                >
                  Save and Continue
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            className="w-full max-w-lg rounded-lg border border-white/10 p-5 shadow-2xl"
            style={{ backgroundColor: colors.sidebarBg }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="settings-title" className="text-lg font-semibold text-white">
                  Settings
                </h2>
                <p className="mt-1 text-sm text-zinc-400">Account management</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                aria-label="Close settings"
                className="rounded p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={17} />
              </button>
            </div>
            <div className="mt-5 border-t border-white/10 pt-4">
              <h3 className="text-sm font-medium text-red-400">Danger Zone</h3>
              <p className="mt-1 mb-4 text-sm text-zinc-400">
                Permanently delete your account and its associated data.
              </p>
              <DeleteAccountButton />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}