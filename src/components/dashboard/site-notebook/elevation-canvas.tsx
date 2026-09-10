"use client";

import * as React from "react";
import type { CabinetModule, SiteJobData } from "@/lib/site-notebook-types";
import {
  CABINET_TYPES, OPENING_STYLES, createEmptyModule,
  distributeEvenly, ensureDrawersShelves, safeNum,
  APPLIANCE_TYPES, OPEN_SHELVING_TYPES, TALL_UNIT_TYPES,
} from "@/lib/site-notebook-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ZoomIn, ZoomOut, Maximize2, Minimize, Expand, Trash2, Copy, Lock, Unlock,
  HelpCircle, Plus, Minus, GripVertical, Magnet, Grid3x3, Ruler, RotateCcw,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, Undo2, Redo2,
  Hand, AlertTriangle, MoreHorizontal,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Square, SquareStack, CookingPot, Wind, Refrigerator,
  ArrowUpFromLine, PanelTopOpen, ArrowLeftRight,
  Microwave, WashingMachine, Wine, Columns3,
  DoorOpen, Utensils, Archive, Frame, LayoutGrid, Layers,
  DoorClosed, Disc3, GripHorizontal,
  ChevronDown, ChevronRight, X,
} from "lucide-react";

type PaletteIcon = React.ComponentType<{ className?: string }>;

const PALETTE: { type: string; label: string; w: number; h: number; icon: PaletteIcon; hint: string }[] = [
  // Base & Wall Cabinets
  { type: "Base Cabinet", label: "Base", w: 600, h: 720, icon: Square, hint: "Floor-standing base cabinet (720mm tall)" },
  { type: "Wall Cabinet", label: "Wall", w: 600, h: 720, icon: SquareStack, hint: "Wall-mounted upper cabinet" },
  { type: "Corner Base Unit", label: "Corner B", w: 900, h: 720, icon: DoorOpen, hint: "L-shaped corner base cabinet (900mm)" },
  { type: "Corner Wall Unit", label: "Corner W", w: 900, h: 720, icon: DoorOpen, hint: "L-shaped corner wall cabinet (900mm)" },
  // Appliances
  { type: "Sink Unit (Zink)", label: "Sink", w: 800, h: 720, icon: CookingPot, hint: "Sink unit with basin cut-out (800mm)" },
  { type: "Hob Unit", label: "Hob", w: 600, h: 720, icon: CookingPot, hint: "Hob / cooktop unit with 4 burner markers" },
  { type: "Cooker Hood Space", label: "Hood", w: 600, h: 400, icon: Wind, hint: "Cooker hood canopy space (400mm)" },
  { type: "Fridge Space", label: "Fridge", w: 900, h: 1800, icon: Refrigerator, hint: "Fridge / freezer housing (900×1800mm)" },
  { type: "Oven Housing", label: "Oven", w: 600, h: 720, icon: Microwave, hint: "Built-in oven housing unit (600×720mm)" },
  { type: "Microwave Housing", label: "Micro", w: 600, h: 720, icon: Microwave, hint: "Microwave housing unit (600×720mm)" },
  { type: "Dishwasher Space", label: "D/W", w: 600, h: 720, icon: WashingMachine, hint: "Dishwasher space (600×720mm)" },
  { type: "Washing Machine Space", label: "W/M", w: 600, h: 850, icon: WashingMachine, hint: "Washing machine space (600×850mm)" },
  { type: "Appliance Garage", label: "Garage", w: 600, h: 300, icon: DoorClosed, hint: "Appliance garage — counter-top retractable door (600×300mm)" },
  // Tall Units
  { type: "Appliance Tower", label: "Tower", w: 600, h: 1800, icon: ArrowUpFromLine, hint: "Tall appliance tower (1800mm) for ovens/microwaves" },
  { type: "Pantry Tall Unit", label: "Pantry", w: 600, h: 2100, icon: Archive, hint: "Tall pantry unit with internal shelves (600×2100mm)" },
  // Specialty Units
  { type: "Up-Lift Flap Cabinet", label: "Up-Lift", w: 900, h: 720, icon: PanelTopOpen, hint: "Up-lift flap door cabinet (900mm wide)" },
  { type: "Wine Rack Unit", label: "Wine", w: 300, h: 720, icon: Wine, hint: "Wine bottle rack unit (300×720mm)" },
  { type: "Spice Rack Pull-out", label: "Spice", w: 150, h: 720, icon: GripVertical, hint: "Pull-out spice rack (150×720mm)" },
  { type: "Bin Pull-out Unit", label: "Bin", w: 300, h: 720, icon: Disc3, hint: "Pull-out bin/waste unit (300×720mm)" },
  { type: "Plate Rack Unit", label: "Plate", w: 400, h: 720, icon: Utensils, hint: "Plate rack with vertical dividers (400×720mm)" },
  { type: "Tray Divider Unit", label: "Tray", w: 300, h: 720, icon: GripHorizontal, hint: "Tray divider with horizontal slots (300×720mm)" },
  // Open & Display
  { type: "Open Shelving Unit", label: "Open Shelf", w: 600, h: 720, icon: Grid3x3, hint: "Open shelving unit — no doors, just shelves (600×720mm)" },
  { type: "Glass Display Cabinet", label: "Glass", w: 600, h: 720, icon: Frame, hint: "Glass-front display cabinet with shelves (600×720mm)" },
  // Architectural / Trim
  { type: "Window Clearance", label: "Window", w: 1200, h: 600, icon: ArrowLeftRight, hint: "Window clearance zone — no cabinetry (amber tinted)" },
  { type: "Plinth / Kickboard", label: "Plinth", w: 600, h: 150, icon: LayoutGrid, hint: "Plinth / kickboard at floor level (600×150mm)" },
  { type: "Cornice / Crown Moulding", label: "Cornice", w: 600, h: 80, icon: Layers, hint: "Cornice / crown moulding at top (600×80mm)" },
  { type: "End Panel / Bullnose", label: "End Panel", w: 18, h: 720, icon: Columns3, hint: "End panel / bullnose trim (18×720mm)" },
];

interface ElevationCanvasProps {
  data: SiteJobData;
  height?: number;
  onUpdateModules?: (modules: CabinetModule[]) => void;
}

// ---- helpers (module-array level) --------------------------------------------

function cloneModules(mods: CabinetModule[]): CabinetModule[] {
  return mods.map((m) => ({
    ...m,
    cuttingList: m.cuttingList.map((c) => ({ ...c })),
    drawerHeights: [...m.drawerHeights],
    shelfHeights: [...m.shelfHeights],
  }));
}

interface GapPair { a: CabinetModule; b: CabinetModule; gap: number; midX: number; midY: number; vertical: boolean }

function findAdjacentGaps(mods: CabinetModule[]): GapPair[] {
  const out: GapPair[] = [];
  // Horizontal gaps (a is to the LEFT of b)
  for (let i = 0; i < mods.length; i++) {
    for (let j = 0; j < mods.length; j++) {
      if (i === j) continue;
      const a = mods[i], b = mods[j];
      if (a.x + a.width > b.x + 1) continue; // a must be left of b
      const yOverlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (yOverlap < 50) continue;
      const gap = b.x - (a.x + a.width);
      if (gap < 0 || gap > 100) continue;
      out.push({
        a, b, gap,
        midX: (a.x + a.width + b.x) / 2,
        midY: (Math.max(a.y, b.y) + Math.min(a.y + a.height, b.y + b.height)) / 2,
        vertical: false,
      });
    }
  }
  // Vertical gaps (a is ABOVE b)
  for (let i = 0; i < mods.length; i++) {
    for (let j = 0; j < mods.length; j++) {
      if (i === j) continue;
      const a = mods[i], b = mods[j];
      if (a.y + a.height > b.y + 1) continue;
      const xOverlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      if (xOverlap < 50) continue;
      const gap = b.y - (a.y + a.height);
      if (gap < 0 || gap > 100) continue;
      out.push({
        a, b, gap,
        midX: (Math.max(a.x, b.x) + Math.min(a.x + a.width, b.x + b.width)) / 2,
        midY: (a.y + a.height + b.y) / 2,
        vertical: true,
      });
    }
  }
  return out;
}

function findOverlaps(mods: CabinetModule[]): { ids: Set<string>; pairs: [string, string][] } {
  const ids = new Set<string>();
  const pairs: [string, string][] = [];
  for (let i = 0; i < mods.length; i++) {
    for (let j = i + 1; j < mods.length; j++) {
      const a = mods[i], b = mods[j];
      if (a.x < b.x + b.width && a.x + a.width > b.x &&
          a.y < b.y + b.height && a.y + a.height > b.y) {
        ids.add(a.id); ids.add(b.id);
        pairs.push([a.id, b.id]);
      }
    }
  }
  return { ids, pairs };
}

const WIDTH_PRESETS = [300, 400, 500, 600, 800, 900, 1000, 1200];
const HEIGHT_PRESETS = [720, 900, 1800, 2100];

// First 8 most-common palette items shown on mobile (rest behind "More" dropdown)
const MOBILE_PALETTE_COUNT = 8;
const MOBILE_PALETTE = PALETTE.slice(0, MOBILE_PALETTE_COUNT);

// ---- component ---------------------------------------------------------------

export function ElevationCanvas({ data, height = 500, onUpdateModules }: ElevationCanvasProps) {
  const { modules: rawModules, overallDimensions } = data;
  const totalW = safeNum(overallDimensions?.width, 3400);
  const totalH = safeNum(overallDimensions?.height, 2150);

  // --- selection state (multi-select aware) ---
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [primaryId, setPrimaryId] = React.useState<string | null>(null);
  const [lockedIds, setLockedIds] = React.useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = React.useState<{ id: string; x: number; y: number } | null>(null);
  const [inspector, setInspector] = React.useState<{ id: string; x: number; y: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);

  // --- toolbar toggles ---
  const [snapEnabled, setSnapEnabled] = React.useState(true);
  const [snapMode, setSnapMode] = React.useState<"edges" | "grid">("edges");
  const [gridEnabled, setGridEnabled] = React.useState(true);
  const [guidesEnabled, setGuidesEnabled] = React.useState(true);
  const [snapThreshold, setSnapThreshold] = React.useState(50);

  // --- zoom & pan ---
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSpace, setIsSpace] = React.useState(false);
  const [isPanning, setIsPanning] = React.useState(false);
  const panRef = React.useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null);

  // --- marquee selection ---
  const [marquee, setMarquee] = React.useState<{ x0: number; y0: number; x1: number; y1: number; additive: boolean } | null>(null);

  // --- live tooltip while dragging ---
  const [liveTip, setLiveTip] = React.useState<{ px: number; py: number; mmX: number; mmY: number } | null>(null);

  // --- alignment guide lines (snapshot during drag) ---
  const [activeGuides, setActiveGuides] = React.useState<{ xs: number[]; ys: number[] }>({ xs: [], ys: [] });

  // --- history ---
  const undoStack = React.useRef<CabinetModule[][]>([]);
  const redoStack = React.useRef<CabinetModule[][]>([]);
  const dragSnapshot = React.useRef<CabinetModule[] | null>(null);
  const inputSnapshot = React.useRef<CabinetModule[] | null>(null);
  const [undoLen, setUndoLen] = React.useState(0);
  const [redoLen, setRedoLen] = React.useState(0);

  // --- module meta (label / notes), kept in component state so CabinetModule type stays unchanged ---
  const [moduleMeta, setModuleMeta] = React.useState<Record<string, { label?: string; notes?: string }>>({});

  // --- collapsible sections ---
  const [openSections, setOpenSections] = React.useState<Set<string>>(
    () => new Set(["position", "dimensions", "type", "internal", "notes"]),
  );

  // --- responsive: detect touch devices for larger handles ---
  const [isTouch, setIsTouch] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // --- responsive: viewport-based (for toolbar collapse / bottom sheets) ---
  const isMobile = useIsMobile();

  const dragData = React.useRef<{
    id: string; type: "move" | "resize"; edge?: string;
    startPxX: number; startPxY: number;
    origX: number; origY: number; origW: number; origH: number;
    /** Original positions of ALL selected modules at drag start — prevents
     *  compounding delta errors when React re-renders between pointermove events. */
    origPositions?: Map<string, { x: number; y: number; w: number; h: number }>;
  } | null>(null);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const canvasWrapRef = React.useRef<HTMLDivElement>(null);

  // Normalize modules — guarantees finite numbers and drawerHeights/shelfHeights arrays.
  const modules = React.useMemo(
    () => rawModules.map((m) => ensureDrawersShelves(m)),
    [rawModules],
  );

  const basePxPerMm = Math.min(700 / Math.max(totalW, 1), 350 / Math.max(totalH, 1));
  const pxPerMm = safeNum(basePxPerMm * zoom, 0.2);
  const wallPxW = totalW * pxPerMm;
  const wallPxH = totalH * pxPerMm;
  const PAD = 48; // padding around wall (for ruler ticks + labels)
  const innerW = Math.max(wallPxW + PAD * 2, 700);
  const innerH = Math.max(wallPxH + PAD * 2, 400);
  const mm = (v: number) => safeNum(v, 0) * pxPerMm;
  const SNAP_THRESHOLD_MM = snapThreshold;

  // --- selection helpers ---
  function selectOnly(id: string) {
    setSelectedIds(new Set([id]));
    setPrimaryId(id);
  }
  function clearSelection() {
    setSelectedIds(new Set());
    setPrimaryId(null);
  }
  function toggleSelect(id: string) {
    setSelectedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
    setPrimaryId(id);
  }
  function selectAll() {
    setSelectedIds(new Set(modules.map((m) => m.id)));
    if (modules.length > 0) setPrimaryId(modules[modules.length - 1].id);
  }

  // --- history helpers ---
  function commitModules(next: CabinetModule[]) {
    if (!onUpdateModules) return;
    undoStack.current.push(cloneModules(modules));
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    setUndoLen(undoStack.current.length);
    setRedoLen(0);
    onUpdateModules(next);
  }
  function applyModules(next: CabinetModule[]) {
    if (!onUpdateModules) return;
    onUpdateModules(next);
  }
  function beginHistory() {
    dragSnapshot.current = cloneModules(modules);
  }
  function endHistory() {
    if (dragSnapshot.current) {
      undoStack.current.push(dragSnapshot.current);
      if (undoStack.current.length > 50) undoStack.current.shift();
      redoStack.current = [];
      dragSnapshot.current = null;
      setUndoLen(undoStack.current.length);
      setRedoLen(0);
    }
  }
  function beginInputHistory() {
    inputSnapshot.current = cloneModules(modules);
  }
  function endInputHistory() {
    if (inputSnapshot.current) {
      undoStack.current.push(inputSnapshot.current);
      if (undoStack.current.length > 50) undoStack.current.shift();
      redoStack.current = [];
      inputSnapshot.current = null;
      setUndoLen(undoStack.current.length);
      setRedoLen(0);
    }
  }
  function undo() {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push(cloneModules(modules));
    if (redoStack.current.length > 50) redoStack.current.shift();
    setUndoLen(undoStack.current.length);
    setRedoLen(redoStack.current.length);
    onUpdateModules?.(prev);
    toast(`Undo (${undoStack.current.length} left)`);
  }
  function redo() {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(cloneModules(modules));
    if (undoStack.current.length > 50) undoStack.current.shift();
    setUndoLen(undoStack.current.length);
    setRedoLen(redoStack.current.length);
    onUpdateModules?.(next);
    toast(`Redo (${redoStack.current.length} left)`);
  }

  // --- overlap detection (memoized) ---
  const overlaps = React.useMemo(() => findOverlaps(modules), [modules]);
  const gapPairs = React.useMemo(() => findAdjacentGaps(modules), [modules]);

  // --- Accidental close prevention ---
  React.useEffect(() => {
    if (modules.length === 0) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [modules.length]);

  // --- Track Space bar for pan mode ---
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const isTyping = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.code === "Space" && !isTyping && !isSpace) {
        e.preventDefault();
        setIsSpace(true);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") setIsSpace(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [isSpace]);

  // --- Esc to exit fullscreen / deselect / close menu ---
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (contextMenu) { setContextMenu(null); return; }
      if (isFullscreen) { setIsFullscreen(false); return; }
      if (selectedIds.size > 0) { clearSelection(); return; }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen, contextMenu, selectedIds]);

  // --- Main keyboard shortcut handler ---
  // (defined later, after all action functions, so they're in scope)

  // --- Snap helper: returns snapped position based on snap mode ---
  // Modes:
  //   - "off": no snapping at all (FREE MODE) — returns raw position unchanged
  //   - "edges": snap to nearest cabinet edge + wall edges (best candidate per axis)
  //   - "grid": snap to grid increments (snapThreshold mm)
  function getSnappedPos(
    modId: string, newX: number, newY: number, newW: number, newH: number,
  ): { x: number; y: number; guides: { xs: number[]; ys: number[] } } {
    // FREE MODE — no snapping whatsoever
    if (!snapEnabled) {
      return { x: newX, y: newY, guides: { xs: [], ys: [] } };
    }

    // GRID MODE — snap to grid increments
    if (snapMode === "grid") {
      const g = SNAP_THRESHOLD_MM;
      const snapToGrid = (v: number) => Math.round(v / g) * g;
      const sx = snapToGrid(newX);
      const sy = snapToGrid(newY);
      return { x: sx, y: sy, guides: { xs: [sx], ys: [sy] } };
    }

    // EDGES MODE — snap to nearest cabinet edge + wall edges (best candidate per axis)
    type Candidate = { axis: "x" | "y"; diff: number; target: number };
    const candidates: Candidate[] = [];

    const myEdges = {
      left: newX, right: newX + newW, centerX: newX + newW / 2,
      top: newY, bottom: newY + newH, centerY: newY + newH / 2,
    };

    for (const other of modules) {
      if (other.id === modId) continue;
      // Only consider cabinets that overlap (± threshold) on the perpendicular axis
      const xOverlap = !(newX + newW < other.x - SNAP_THRESHOLD_MM || newX > other.x + other.width + SNAP_THRESHOLD_MM);
      const yOverlap = !(newY + newH < other.y - SNAP_THRESHOLD_MM || newY > other.y + other.height + SNAP_THRESHOLD_MM);

      const oEdges = {
        left: other.x, right: other.x + other.width, centerX: other.x + other.width / 2,
        top: other.y, bottom: other.y + other.height, centerY: other.y + other.height / 2,
      };

      if (yOverlap) {
        (["left", "right", "centerX"] as const).forEach((myKey) => {
          const myVal = myEdges[myKey];
          (["left", "right", "centerX"] as const).forEach((oKey) => {
            const oVal = oEdges[oKey];
            const diff = oVal - myVal;
            if (Math.abs(diff) < SNAP_THRESHOLD_MM) {
              candidates.push({ axis: "x", diff, target: oVal });
            }
          });
        });
      }

      if (xOverlap) {
        (["top", "bottom", "centerY"] as const).forEach((myKey) => {
          const myVal = myEdges[myKey];
          (["top", "bottom", "centerY"] as const).forEach((oKey) => {
            const oVal = oEdges[oKey];
            const diff = oVal - myVal;
            if (Math.abs(diff) < SNAP_THRESHOLD_MM) {
              candidates.push({ axis: "y", diff, target: oVal });
            }
          });
        });
      }
    }

    // Wall edges
    if (Math.abs(newX) < SNAP_THRESHOLD_MM) candidates.push({ axis: "x", diff: -newX, target: 0 });
    if (Math.abs(newY) < SNAP_THRESHOLD_MM) candidates.push({ axis: "y", diff: -newY, target: 0 });
    if (Math.abs(newX + newW - totalW) < SNAP_THRESHOLD_MM) candidates.push({ axis: "x", diff: totalW - (newX + newW), target: totalW });
    if (Math.abs(newY + newH - totalH) < SNAP_THRESHOLD_MM) candidates.push({ axis: "y", diff: totalH - (newY + newH), target: totalH });

    // Best candidate per axis (smallest |diff|)
    let bestX: Candidate | null = null;
    let bestY: Candidate | null = null;
    for (const c of candidates) {
      if (c.axis === "x") {
        if (!bestX || Math.abs(c.diff) < Math.abs(bestX.diff)) bestX = c;
      } else {
        if (!bestY || Math.abs(c.diff) < Math.abs(bestY.diff)) bestY = c;
      }
    }

    let snapX = newX, snapY = newY;
    const guideXs: number[] = [];
    const guideYs: number[] = [];
    if (bestX) { snapX = newX + bestX.diff; guideXs.push(bestX.target); }
    if (bestY) { snapY = newY + bestY.diff; guideYs.push(bestY.target); }

    return { x: snapX, y: snapY, guides: { xs: guideXs, ys: guideYs } };
  }

  // --- Drop from palette ---
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const type = e.dataTransfer.getData("text/cabinet-type");
    if (!type || !onUpdateModules) return;
    const item = PALETTE.find((p) => p.type === type);
    if (!item) return;
    const inner = innerRef.current;
    if (!inner) return;
    const rect = inner.getBoundingClientRect();
    const mmX = (e.clientX - rect.left - PAD - pan.x) / pxPerMm;
    const mmY = (e.clientY - rect.top - PAD - pan.y) / pxPerMm;
    const newCode = String(modules.length + 1).padStart(2, "0");
    const newMod = createEmptyModule(newCode);
    newMod.type = type as any;
    newMod.width = item.w;
    newMod.height = item.h;
    newMod.x = Math.round(Math.max(0, Math.min(totalW - item.w, mmX - item.w / 2)));
    newMod.y = Math.round(Math.max(0, Math.min(totalH - item.h, mmY - item.h / 2)));
    commitModules([...modules, newMod]);
    selectOnly(newMod.id);
  }

  // --- Tap-to-add for mobile/touch devices ---
  // HTML5 drag-drop doesn't work on touch devices. Tapping a palette item
  // adds the cabinet to the canvas at the next available position.
  function tapToAdd(type: string) {
    if (!onUpdateModules) return;
    const item = PALETTE.find((p) => p.type === type);
    if (!item) return;
    const newCode = String(modules.length + 1).padStart(2, "0");
    const newMod = createEmptyModule(newCode);
    newMod.type = type as any;
    newMod.width = item.w;
    newMod.height = item.h;
    // Place at next available position (cascade)
    const lastMod = modules[modules.length - 1];
    const offsetX = lastMod ? Math.min(totalW - item.w, lastMod.x + lastMod.width + 20) : 100;
    newMod.x = Math.round(offsetX);
    newMod.y = Math.round(Math.min(totalH - item.h, 100));
    commitModules([...modules, newMod]);
    selectOnly(newMod.id);
    toast.success(`${item.label} added — tap and hold to move`);
  }

  // --- Pointer handlers ---
  function onModuleDown(e: React.PointerEvent, mod: CabinetModule) {
    if (!onUpdateModules) return;
    e.stopPropagation();
    if (isSpace) return; // space+click = pan, not select
    if (e.shiftKey) {
      toggleSelect(mod.id);
    } else if (!selectedIds.has(mod.id)) {
      selectOnly(mod.id);
    } else {
      setPrimaryId(mod.id);
    }
    if (lockedIds.has(mod.id)) return;

    // Long-press detection: if pointer held for >500ms without much movement,
    // open the inspector popup at the pointer position
    const startX = e.clientX, startY = e.clientY;
    const longPressTimer = setTimeout(() => {
      // Verify pointer hasn't moved much (not a drag)
      if (dragData.current && Math.abs(dragData.current.startPxX - startX) < 5 && Math.abs(dragData.current.startPxY - startY) < 5) {
        openInspector(mod.id, startX, startY);
      }
    }, 500);
    // Cancel long-press if pointer moves significantly (it's a drag)
    const cancelLongPress = () => {
      clearTimeout(longPressTimer);
      window.removeEventListener("pointermove", cancelLongPress);
    };
    window.addEventListener("pointermove", cancelLongPress);
    // Also cancel on pointer up (it was just a click)
    const cancelOnUp = () => {
      clearTimeout(longPressTimer);
      window.removeEventListener("pointerup", cancelOnUp);
      window.removeEventListener("pointermove", cancelLongPress);
    };
    window.addEventListener("pointerup", cancelOnUp);

    // begin history snapshot for this drag operation
    beginHistory();
    // Store ORIGINAL positions of ALL selected modules — critical for correct
    // delta computation during move. Without this, React re-renders between
    // pointermove events cause compounding position errors.
    const sel = selectedIds.size > 0 ? selectedIds : new Set([mod.id]);
    const origPositions = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const m of modules) {
      if (sel.has(m.id)) {
        origPositions.set(m.id, { x: m.x, y: m.y, w: m.width, h: m.height });
      }
    }
    dragData.current = {
      id: mod.id, type: "move",
      startPxX: e.clientX, startPxY: e.clientY,
      origX: mod.x, origY: mod.y, origW: mod.width, origH: mod.height,
      origPositions,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onResizeDown(e: React.PointerEvent, mod: CabinetModule, edge: string) {
    e.stopPropagation();
    if (!selectedIds.has(mod.id)) selectOnly(mod.id);
    if (lockedIds.has(mod.id)) return;
    beginHistory();
    dragData.current = {
      id: mod.id, type: "resize", edge,
      startPxX: e.clientX, startPxY: e.clientY,
      origX: mod.x, origY: mod.y, origW: mod.width, origH: mod.height,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onCanvasDown(e: React.PointerEvent) {
    // empty-canvas pointerdown: clear selection OR start marquee OR start pan
    if (isSpace) {
      // start panning
      panRef.current = { startX: e.clientX, startY: e.clientY, origPanX: pan.x, origPanY: pan.y };
      setIsPanning(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if (e.shiftKey) {
      // start marquee selection
      const inner = innerRef.current;
      if (!inner) return;
      const rect = inner.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setMarquee({ x0: px, y0: py, x1: px, y1: py, additive: true });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    // plain click on empty canvas — clear selection
    clearSelection();
  }

  function onCanvasMove(e: React.PointerEvent) {
    // Panning
    if (isPanning && panRef.current) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setPan({ x: panRef.current.origPanX + dx, y: panRef.current.origPanY + dy });
      return;
    }

    // Marquee drag
    if (marquee) {
      const inner = innerRef.current;
      if (!inner) return;
      const rect = inner.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setMarquee({ ...marquee, x1: px, y1: py });
      return;
    }

    const dd = dragData.current;
    if (!dd || !onUpdateModules) return;
    const dxMm = (e.clientX - dd.startPxX) / pxPerMm;
    const dyMm = (e.clientY - dd.startPxY) / pxPerMm;

    if (dd.type === "move") {
      // Move ALL selected modules together (delta-based)
      const primary = modules.find((m) => m.id === dd.id);
      if (!primary) return;
      // Compute the new raw position — NO clamping here at all.
      // When snap is OFF, the cabinet follows the cursor exactly (free movement).
      // When snap is ON, getSnappedPos applies the best snap candidate.
      // Wall-bound clamping is only done as a safety net when snap is ON.
      let newX = Math.round(dd.origX + dxMm);
      let newY = Math.round(dd.origY + dyMm);
      const snapped = getSnappedPos(dd.id, newX, newY, dd.origW, dd.origH);
      const deltaX = snapped.x - dd.origX;
      const deltaY = snapped.y - dd.origY;
      // Update guides for visual feedback
      if (guidesEnabled && snapEnabled) setActiveGuides(snapped.guides);
      else setActiveGuides({ xs: [], ys: [] });

      // Live tooltip near cursor
      const inner = innerRef.current;
      if (inner) {
        const rect = inner.getBoundingClientRect();
        setLiveTip({
          px: e.clientX - rect.left,
          py: e.clientY - rect.top,
          mmX: Math.round(snapped.x),
          mmY: Math.round(snapped.y),
        });
      }

      const sel = selectedIds.size > 0 ? selectedIds : new Set([dd.id]);
      applyModules(modules.map((m) => {
        if (!sel.has(m.id)) return m;
        // Use the STORED ORIGINAL position (not m.x which changes every frame)
        // to prevent compounding delta errors across React re-renders.
        const orig = dd.origPositions?.get(m.id) ?? { x: dd.origX, y: dd.origY, w: m.width, h: m.height };
        let nx = orig.x + deltaX;
        let ny = orig.y + deltaY;
        // When snap is ON, apply a soft wall-bound so cabinets stay inside.
        // When snap is OFF, NO clamping — cabinets can go anywhere the cursor goes.
        if (snapEnabled) {
          const maxX = Math.max(0, totalW - m.width);
          const maxY = Math.max(0, totalH - m.height);
          nx = Math.max(0, Math.min(maxX, nx));
          ny = Math.max(0, Math.min(maxY, ny));
        }
        return { ...m, x: nx, y: ny };
      }));
    } else if (dd.type === "resize") {
      const min = 100;
      let nw = dd.origW, nh = dd.origH, nx = dd.origX, ny = dd.origY;
      if (dd.edge && dd.edge === "right") nw = Math.max(min, Math.round(dd.origW + dxMm));
      if (dd.edge && dd.edge === "left") { nw = Math.max(min, Math.round(dd.origW - dxMm)); nx = Math.round(dd.origX + (dd.origW - nw)); }
      if (dd.edge && dd.edge === "bottom") nh = Math.max(min, Math.round(dd.origH + dyMm));
      if (dd.edge && dd.edge === "top") { nh = Math.max(min, Math.round(dd.origH - dyMm)); ny = Math.round(dd.origY + (dd.origH - nh)); }
      if (dd.edge && dd.edge === "br") { nw = Math.max(min, Math.round(dd.origW + dxMm)); nh = Math.max(min, Math.round(dd.origH + dyMm)); }
      if (dd.edge && dd.edge === "bl") { nw = Math.max(min, Math.round(dd.origW - dxMm)); nx = Math.round(dd.origX + (dd.origW - nw)); nh = Math.max(min, Math.round(dd.origH + dyMm)); }
      if (dd.edge && dd.edge === "tr") { nw = Math.max(min, Math.round(dd.origW + dxMm)); nh = Math.max(min, Math.round(dd.origH - dyMm)); ny = Math.round(dd.origY + (dd.origH - nh)); }
      if (dd.edge && dd.edge === "tl") { nw = Math.max(min, Math.round(dd.origW - dxMm)); nx = Math.round(dd.origX + (dd.origW - nw)); nh = Math.max(min, Math.round(dd.origH - dyMm)); ny = Math.round(dd.origY + (dd.origH - nh)); }
      // When snap is ON, snap the resize edges to nearby cabinet edges + wall edges
      // When snap is OFF, NO wall-bound clamping — resize is completely free.
      if (snapEnabled) {
        // Soft wall-bound: keep within wall (only when snap is ON)
        nx = Math.max(0, nx);
        ny = Math.max(0, ny);
        nw = Math.min(nw, Math.max(min, totalW - nx));
        nh = Math.min(nh, Math.max(min, totalH - ny));
        // Build a temp module shape to test edge snaps
        const edges = { left: nx, right: nx + nw, top: ny, bottom: ny + nh };
        // Helper: find best snap for a given value among other cabinets + wall
        const snapVal = (val: number, axis: "x" | "y"): number => {
          let best: { diff: number; target: number } | null = null;
          for (const other of modules) {
            if (other.id === dd.id) continue;
            const oEdges = axis === "x"
              ? { left: other.x, right: other.x + other.width, centerX: other.x + other.width / 2 }
              : { left: other.y, right: other.y + other.height, centerY: other.y + other.height / 2 };
            for (const oVal of Object.values(oEdges)) {
              const diff = oVal - val;
              if (Math.abs(diff) < SNAP_THRESHOLD_MM && (!best || Math.abs(diff) < Math.abs(best.diff))) {
                best = { diff, target: oVal };
              }
            }
          }
          // Wall edges
          const wallTargets = axis === "x" ? [0, totalW] : [0, totalH];
          for (const w of wallTargets) {
            const diff = w - val;
            if (Math.abs(diff) < SNAP_THRESHOLD_MM && (!best || Math.abs(diff) < Math.abs(best.diff))) {
              best = { diff, target: w };
            }
          }
          return best ? val + best.diff : val;
        };
        // Snap the edges being dragged
        if (dd.edge?.includes("r") || dd.edge === "right") {
          const snapped = snapVal(edges.right, "x");
          nw = Math.max(min, snapped - nx);
        }
        if (dd.edge?.includes("l") || dd.edge === "left") {
          const snapped = snapVal(edges.left, "x");
          const delta = snapped - edges.left;
          nx = Math.max(0, nx + delta);
          nw = Math.max(min, nw - delta);
        }
        if (dd.edge?.includes("b") || dd.edge === "bottom") {
          const snapped = snapVal(edges.bottom, "y");
          nh = Math.max(min, snapped - ny);
        }
        if (dd.edge?.includes("t") || dd.edge === "top") {
          const snapped = snapVal(edges.top, "y");
          const delta = snapped - edges.top;
          ny = Math.max(0, ny + delta);
          nh = Math.max(min, nh - delta);
        }
      }
      applyModules(modules.map((m) => m.id === dd.id ? { ...m, width: nw, height: nh, x: nx, y: ny } : m));
      // Live tooltip on resize too
      const inner = innerRef.current;
      if (inner) {
        const rect = inner.getBoundingClientRect();
        setLiveTip({
          px: e.clientX - rect.left,
          py: e.clientY - rect.top,
          mmX: Math.round(nx),
          mmY: Math.round(ny),
        });
      }
    }
  }

  function onCanvasUp(e: React.PointerEvent) {
    if (isPanning) {
      setIsPanning(false);
      panRef.current = null;
      return;
    }
    if (marquee) {
      // finish marquee selection — select all modules whose bounds intersect the rect
      const inner = innerRef.current;
      if (inner) {
        const rect = inner.getBoundingClientRect();
        const x0 = Math.min(marquee.x0, marquee.x1);
        const x1 = Math.max(marquee.x0, marquee.x1);
        const y0 = Math.min(marquee.y0, marquee.y1);
        const y1 = Math.max(marquee.y0, marquee.y1);
        // only count as a real marquee if rect has non-zero area
        if (Math.abs(x1 - x0) > 4 || Math.abs(y1 - y0) > 4) {
          const hitIds = new Set<string>();
          modules.forEach((m) => {
            const mx = PAD + mm(m.x) + pan.x;
            const my = PAD + mm(m.y) + pan.y;
            const mw = Math.max(mm(m.width), 15);
            const mh = Math.max(mm(m.height), 15);
            // intersection test (in canvas px coords)
            if (mx < x1 && mx + mw > x0 && my < y1 && my + mh > y0) {
              hitIds.add(m.id);
            }
          });
          if (marquee.additive) {
            setSelectedIds((s) => new Set([...s, ...hitIds]));
          } else {
            setSelectedIds(hitIds);
          }
          if (hitIds.size > 0) {
            const arr = Array.from(hitIds);
            setPrimaryId(arr[arr.length - 1]);
          }
        }
      }
      setMarquee(null);
      return;
    }
    if (dragData.current) {
      endHistory();
      setActiveGuides({ xs: [], ys: [] });
      setLiveTip(null);
    }
    dragData.current = null;
    void e;
  }

  // --- Module CRUD (multi-aware) ---
  function deleteModule(id: string) {
    deleteModules([id]);
  }
  function deleteSelected() {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : (primaryId ? [primaryId] : []);
    if (ids.length === 0) return;
    if (!onUpdateModules) return;
    const remaining = modules.filter((m) => !ids.includes(m.id))
      .map((m, i) => ({ ...m, code: String(i + 1).padStart(2, "0") }));
    commitModules(remaining);
    clearSelection();
    setLockedIds((s) => {
      const n = new Set(s);
      ids.forEach((id) => n.delete(id));
      return n;
    });
    toast(`Deleted ${ids.length} module${ids.length === 1 ? "" : "s"}`);
  }
  function deleteModules(ids: string[]) {
    if (!onUpdateModules) return;
    const remaining = modules.filter((m) => !ids.includes(m.id))
      .map((m, i) => ({ ...m, code: String(i + 1).padStart(2, "0") }));
    commitModules(remaining);
    clearSelection();
    setLockedIds((s) => {
      const n = new Set(s);
      ids.forEach((id) => n.delete(id));
      return n;
    });
  }

  function duplicateModule(id: string) {
    duplicateModules([id]);
  }
  function duplicateSelected() {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : (primaryId ? [primaryId] : []);
    if (ids.length === 0) return;
    duplicateModules(ids);
  }
  function duplicateModules(ids: string[]) {
    if (!onUpdateModules) return;
    const copies: CabinetModule[] = [];
    let nextCode = modules.length + 1;
    for (const id of ids) {
      const mod = modules.find((m) => m.id === id);
      if (!mod) continue;
      const newCode = String(nextCode).padStart(2, "0");
      nextCode += 1;
      copies.push({
        ...mod,
        id: crypto.randomUUID(),
        code: newCode,
        x: mod.x + 50,
        y: mod.y + 50,
        cuttingList: mod.cuttingList.map((c) => ({ ...c, id: crypto.randomUUID() })),
        drawerHeights: [...(mod.drawerHeights ?? [])],
        shelfHeights: [...(mod.shelfHeights ?? [])],
      });
    }
    commitModules([...modules, ...copies]);
    setSelectedIds(new Set(copies.map((c) => c.id)));
    if (copies.length > 0) setPrimaryId(copies[copies.length - 1].id);
    toast(`Duplicated ${copies.length} module${copies.length === 1 ? "" : "s"}`);
  }

  function toggleLock(id: string) {
    toggleLocks([id]);
  }
  function toggleLocks(ids: string[]) {
    setLockedIds((s) => {
      const n = new Set(s);
      // If any unlocked → lock all; if all locked → unlock all
      const anyUnlocked = ids.some((id) => !n.has(id));
      ids.forEach((id) => {
        if (anyUnlocked) n.add(id); else n.delete(id);
      });
      return n;
    });
  }

  function nudgeSelected(dxMm: number, dyMm: number) {
    if (!onUpdateModules) return;
    const sel = selectedIds.size > 0 ? selectedIds : (primaryId ? new Set([primaryId]) : new Set<string>());
    if (sel.size === 0) return;
    beginHistory();
    applyModules(modules.map((m) => {
      if (!sel.has(m.id)) return m;
      let nx = m.x + dxMm;
      let ny = m.y + dyMm;
      // When snap is ON, keep within wall bounds.
      // When snap is OFF, allow free positioning (no clamping).
      if (snapEnabled) {
        const maxX = Math.max(0, totalW - m.width);
        const maxY = Math.max(0, totalH - m.height);
        nx = Math.max(0, Math.min(maxX, nx));
        ny = Math.max(0, Math.min(maxY, ny));
      }
      return { ...m, x: nx, y: ny };
    }));
    endHistory();
  }

  function resizeStepSelected(dwMm: number, dhMm: number) {
    if (!onUpdateModules) return;
    const sel = selectedIds.size > 0 ? selectedIds : (primaryId ? new Set([primaryId]) : new Set<string>());
    if (sel.size === 0) return;
    beginHistory();
    applyModules(modules.map((m) => {
      if (!sel.has(m.id)) return m;
      let nw = m.width + dwMm;
      let nh = m.height + dhMm;
      // When snap is ON, keep within wall bounds.
      // When snap is OFF, allow free resizing (no clamping, just min 100mm).
      if (snapEnabled) {
        nw = Math.min(nw, Math.max(100, totalW - m.x));
        nh = Math.min(nh, Math.max(100, totalH - m.y));
      }
      return { ...m, width: Math.max(100, nw), height: Math.max(100, nh) };
    }));
    endHistory();
  }

  // --- Drawer & shelf management ---
  function patchModule(id: string, patch: Partial<CabinetModule>) {
    if (!onUpdateModules) return;
    commitModules(modules.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function setDrawerCount(id: string, count: number) {
    const c = Math.max(1, Math.min(10, Math.floor(count)));
    const mod = modules.find((m) => m.id === id);
    if (!mod) return;
    patchModule(id, { drawerHeights: distributeEvenly(c, mod.height, 0) });
  }

  function setDrawerHeight(id: string, idx: number, h: number) {
    const mod = modules.find((m) => m.id === id);
    if (!mod) return;
    const next = [...(mod.drawerHeights ?? [])];
    next[idx] = Math.max(50, Math.round(h));
    patchModule(id, { drawerHeights: next });
  }

  function setShelfCount(id: string, count: number) {
    const c = Math.max(0, Math.min(8, Math.floor(count)));
    const mod = modules.find((m) => m.id === id);
    if (!mod) return;
    const positions = Array.from({ length: c }, (_, i) =>
      Math.round((mod.height * (i + 1)) / (c + 1)),
    );
    patchModule(id, { shelfHeights: positions });
  }

  function setShelfHeight(id: string, idx: number, hFromBottom: number) {
    const mod = modules.find((m) => m.id === id);
    if (!mod) return;
    const next = [...(mod.shelfHeights ?? [])];
    next[idx] = Math.max(20, Math.min(mod.height - 20, Math.round(hFromBottom)));
    patchModule(id, { shelfHeights: next });
  }

  // --- Align & distribute ---
  function getSelectedModules(): CabinetModule[] {
    if (selectedIds.size === 0) return [];
    return modules.filter((m) => selectedIds.has(m.id));
  }
  function alignSelected(mode: "left" | "right" | "centerH" | "top" | "bottom" | "centerV") {
    const sel = getSelectedModules();
    if (sel.length < 2) return;
    beginHistory();
    let next: CabinetModule[];
    if (mode === "left") {
      const minX = Math.min(...sel.map((m) => m.x));
      next = modules.map((m) => selectedIds.has(m.id) ? { ...m, x: minX } : m);
    } else if (mode === "right") {
      const maxX = Math.max(...sel.map((m) => m.x + m.width));
      next = modules.map((m) => selectedIds.has(m.id) ? { ...m, x: maxX - m.width } : m);
    } else if (mode === "centerH") {
      const minX = Math.min(...sel.map((m) => m.x));
      const maxX = Math.max(...sel.map((m) => m.x + m.width));
      const cx = (minX + maxX) / 2;
      next = modules.map((m) => selectedIds.has(m.id) ? { ...m, x: Math.round(cx - m.width / 2) } : m);
    } else if (mode === "top") {
      const minY = Math.min(...sel.map((m) => m.y));
      next = modules.map((m) => selectedIds.has(m.id) ? { ...m, y: minY } : m);
    } else if (mode === "bottom") {
      const maxY = Math.max(...sel.map((m) => m.y + m.height));
      next = modules.map((m) => selectedIds.has(m.id) ? { ...m, y: maxY - m.height } : m);
    } else { // centerV
      const minY = Math.min(...sel.map((m) => m.y));
      const maxY = Math.max(...sel.map((m) => m.y + m.height));
      const cy = (minY + maxY) / 2;
      next = modules.map((m) => selectedIds.has(m.id) ? { ...m, y: Math.round(cy - m.height / 2) } : m);
    }
    applyModules(next);
    endHistory();
    toast(`Aligned ${sel.length} modules (${mode})`);
  }
  function distributeSelected(axis: "h" | "v") {
    const sel = getSelectedModules();
    if (sel.length < 3) {
      toast("Need 3+ modules to distribute");
      return;
    }
    beginHistory();
    const sorted = [...sel].sort((a, b) => axis === "h" ? a.x - b.x : a.y - b.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpan = axis === "h"
      ? (last.x + last.width) - first.x
      : (last.y + last.height) - first.y;
    const totalSize = sorted.reduce((s, m) => s + (axis === "h" ? m.width : m.height), 0);
    const gap = (totalSpan - totalSize) / (sorted.length - 1);
    let cursor = axis === "h" ? first.x : first.y;
    const next = modules.map((m) => ({ ...m }));
    for (const mod of sorted) {
      const target = next.find((x) => x.id === mod.id)!;
      if (axis === "h") {
        target.x = Math.round(cursor);
        cursor += target.width + gap;
      } else {
        target.y = Math.round(cursor);
        cursor += target.height + gap;
      }
    }
    applyModules(next);
    endHistory();
    toast(`Distributed ${sel.length} modules ${axis === "h" ? "horizontally" : "vertically"}`);
  }

  function resolveOverlaps() {
    if (overlaps.pairs.length === 0) {
      toast("No overlaps to resolve");
      return;
    }
    beginHistory();
    const next = modules.map((m) => ({ ...m }));
    // For each overlap pair, nudge the SECOND module to the right of the first
    for (const [aId, bId] of overlaps.pairs) {
      const a = next.find((m) => m.id === aId);
      const b = next.find((m) => m.id === bId);
      if (!a || !b) continue;
      // move b to just right of a
      b.x = a.x + a.width + 5;
      if (b.x + b.width > totalW) {
        // doesn't fit to the right — try below
        b.x = a.x;
        b.y = a.y + a.height + 5;
      }
    }
    applyModules(next);
    endHistory();
    toast(`Resolved ${overlaps.pairs.length} overlap pair${overlaps.pairs.length === 1 ? "" : "s"}`);
  }

  function zoomToFit() {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const viewW = scroll.clientWidth - PAD * 2 - 40;
    const viewH = scroll.clientHeight - PAD * 2 - 40;
    if (modules.length === 0) {
      // fit wall
      const zx = viewW / (totalW * basePxPerMm);
      const zy = viewH / (totalH * basePxPerMm);
      setZoom(Math.max(0.25, Math.min(4, Math.min(zx, zy))));
      setPan({ x: 0, y: 0 });
      return;
    }
    // compute bounds of all modules
    const minX = Math.min(...modules.map((m) => m.x));
    const minY = Math.min(...modules.map((m) => m.y));
    const maxX = Math.max(...modules.map((m) => m.x + m.width));
    const maxY = Math.max(...modules.map((m) => m.y + m.height));
    const boundsW = maxX - minX;
    const boundsH = maxY - minY;
    const zx = viewW / Math.max(boundsW * basePxPerMm, 1);
    const zy = viewH / Math.max(boundsH * basePxPerMm, 1);
    const newZoom = Math.max(0.25, Math.min(4, Math.min(zx, zy)));
    setZoom(newZoom);
    // pan so the modules are centered
    const offsetX = (scroll.clientWidth - (boundsW * basePxPerMm * newZoom) - PAD * 2) / 2 - minX * basePxPerMm * newZoom;
    const offsetY = (scroll.clientHeight - (boundsH * basePxPerMm * newZoom) - PAD * 2) / 2 - minY * basePxPerMm * newZoom;
    setPan({ x: Math.round(offsetX), y: Math.round(offsetY) });
  }

  function onModuleContextMenu(e: React.MouseEvent, mod: CabinetModule) {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedIds.has(mod.id)) selectOnly(mod.id);
    setPrimaryId(mod.id);
    setContextMenu({ id: mod.id, x: e.clientX, y: e.clientY });
  }

  // --- Inspector popup: opens on double-click or long-press ---
  function openInspector(id: string, clientX: number, clientY: number) {
    selectOnly(id);
    // Smart positioning: keep popup within viewport
    const POPUP_W = 320;
    const POPUP_H_MAX = 500;
    let x = clientX + 10;
    let y = clientY + 10;
    if (x + POPUP_W > window.innerWidth - 16) x = clientX - POPUP_W - 10;
    if (y + POPUP_H_MAX > window.innerHeight - 16) y = Math.max(16, window.innerHeight - POPUP_H_MAX - 16);
    if (x < 16) x = 16;
    if (y < 16) y = 16;
    setInspector({ id, x, y });
  }

  // Close inspector on Escape or click outside (but NOT when clicking on the
  // cabinet itself or inside the inspector popup)
  React.useEffect(() => {
    if (!inspector) return;
    function close(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside the inspector popup
      if (target.closest("[data-inspector-popup]")) return;
      // Don't close if clicking on a cabinet module (the canvas)
      if (target.closest("[data-cabinet-module]")) return;
      // Don't close if clicking on any interactive control (inputs, buttons, selects)
      if (target.closest("input, select, textarea, button, [role='combobox'], [role='option']")) return;
      setInspector(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setInspector(null); }
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [inspector]);

  // --- Main keyboard shortcut handler ---
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const isTyping = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      const canvasActive = !!(canvasWrapRef.current && canvasWrapRef.current.contains(document.activeElement));
      const hasSelection = selectedIds.size > 0;

      // Ctrl/Cmd+Z — undo (always, even in inputs)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        undo();
        return;
      }
      // Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y — redo
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y" ||
          ((e.shiftKey) && (e.key === "z" || e.key === "Z")))) {
        e.preventDefault();
        redo();
        return;
      }
      // Ctrl/Cmd+A — select all (only when canvas is focused)
      if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A") && canvasActive && !isTyping) {
        e.preventDefault();
        selectAll();
        return;
      }
      // Ctrl/Cmd+D — duplicate (only when selection)
      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D") && hasSelection && !isTyping) {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      // Skip remaining shortcuts when typing in inputs
      if (isTyping) return;

      // Delete / Backspace
      if ((e.key === "Delete" || e.key === "Backspace") && hasSelection) {
        e.preventDefault();
        deleteSelected();
        return;
      }

      // Arrow keys — nudge (only when selection)
      if (hasSelection) {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowLeft") { e.preventDefault(); nudgeSelected(-step, 0); return; }
        if (e.key === "ArrowRight") { e.preventDefault(); nudgeSelected(step, 0); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); nudgeSelected(0, -step); return; }
        if (e.key === "ArrowDown") { e.preventDefault(); nudgeSelected(0, step); return; }
      }

      // Zoom keys (+/-/0)
      if (e.key === "+" || e.key === "=") { e.preventDefault(); setZoom((z) => Math.min(4, z + 0.25)); return; }
      if (e.key === "-" || e.key === "_") { e.preventDefault(); setZoom((z) => Math.max(0.25, z - 0.25)); return; }
      if (e.key === "0") { e.preventDefault(); setZoom(1); return; }

      // F — fullscreen toggle
      if (e.key === "f" || e.key === "F") { e.preventDefault(); setIsFullscreen((f) => !f); return; }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, modules]);

  // Close context menu on any click outside
  React.useEffect(() => {
    function close() { setContextMenu(null); }
    window.addEventListener("click", close);
    window.addEventListener("pointerdown", close);
    return () => { window.removeEventListener("click", close); window.removeEventListener("pointerdown", close); };
  }, []);

  function renderShape(mod: CabinetModule, w: number, h: number) {
    const show = w > 25 && h > 25;
    const drawers = Array.isArray(mod.drawerHeights) ? mod.drawerHeights : [];
    const shelves = Array.isArray(mod.shelfHeights) ? mod.shelfHeights : [];
    const t = mod.type;

    const isAppliance = APPLIANCE_TYPES.has(t);
    const isOpenShelf = OPEN_SHELVING_TYPES.has(t);
    const isTallUnit = TALL_UNIT_TYPES.has(t);

    const showShelves = !isAppliance && !isTallUnit && !isOpenShelf
      ? (mod.openingStyle !== "Drawers" && mod.openingStyle !== "Up-Lift Flap")
      : isOpenShelf;

    const showDoors = !isAppliance && !isOpenShelf && !isTallUnit;

    return (
      <svg width={w} height={h} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}>
        {/* Door split lines — ONLY for standard cabinets */}
        {showDoors && mod.openingStyle === "Single Door" && show && <line x1={w/2} y1={3} x2={w/2} y2={h-3} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />}
        {showDoors && mod.openingStyle === "Double Door" && show && (<><line x1={w*0.33} y1={3} x2={w*0.33} y2={h-3} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" /><line x1={w*0.66} y1={3} x2={w*0.66} y2={h-3} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" /></>)}

        {/* Drawers */}
        {showDoors && mod.openingStyle === "Drawers" && show && (() => {
          let cumY = 0;
          return drawers.map((dh, i) => {
            const drawerPxH = Math.max(2, safeNum(dh, 0) * pxPerMm);
            const top = cumY;
            cumY += drawerPxH;
            if (cumY > h + 50) return null;
            return (
              <g key={`dr-${i}`}>
                {i > 0 && <line x1={2} y1={top} x2={w-2} y2={top} stroke="#64748b" strokeWidth="1" />}
                <line x1={w*0.4} y1={top + drawerPxH*0.5} x2={w*0.6} y2={top + drawerPxH*0.5} stroke="#475569" strokeWidth="1.5" />
                {drawerPxH > 14 && w > 50 && (
                  <text x={w-4} y={top + drawerPxH*0.5 + 2} textAnchor="end" fill="#0e7490" fontSize="6.5" fontWeight="bold" fontFamily="monospace">{dh}</text>
                )}
              </g>
            );
          });
        })()}

        {/* Shelves */}
        {showShelves && show && shelves.map((sh, i) => {
          const y = h - safeNum(sh, 0) * pxPerMm;
          if (!Number.isFinite(y) || y < 3 || y > h - 3) return null;
          return (
            <g key={`sh-${i}`}>
              <line x1={2} y1={y} x2={w-2} y2={y} stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="4 2" />
              {w > 50 && <text x={4} y={y-1.5} fill="#0e7490" fontSize="6.5" fontWeight="bold" fontFamily="monospace">{sh}</text>}
            </g>
          );
        })}

        {/* Up-Lift Flap */}
        {(mod.openingStyle === "Up-Lift Flap" || t === "Up-Lift Flap Cabinet") && show && showDoors && (<><line x1={3} y1={h*0.3} x2={w-3} y2={h*0.3} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 2" /><path d={`M ${w/2-6} ${h*0.2} L ${w/2} ${h*0.08} L ${w/2+6} ${h*0.2}`} fill="none" stroke="#475569" strokeWidth="1.5" /></>)}

        {/* ===== APPLIANCE-SPECIFIC SHAPES ===== */}
        {t === "Sink Unit (Zink)" && show && (<g><rect x={w*0.12} y={h*0.2} width={w*0.76} height={h*0.55} fill="none" stroke="#64748b" strokeWidth="1.5" rx="4" /><rect x={w*0.17} y={h*0.25} width={w*0.66} height={h*0.45} fill="none" stroke="#94a3b8" strokeWidth="0.8" rx="3" /><line x1={w/2} y1={h*0.1} x2={w/2} y2={h*0.2} stroke="#64748b" strokeWidth="2" /><circle cx={w/2} cy={h*0.1} r="3" fill="#64748b" /></g>)}
        {t === "Hob Unit" && show && (<g>{[[0.3,0.3],[0.7,0.3],[0.3,0.65],[0.7,0.65]].map(([cx,cy],i) => (<g key={i}><circle cx={w*cx} cy={h*cy} r={Math.min(w,h)*0.1} fill="none" stroke="#64748b" strokeWidth="1.5" /><circle cx={w*cx} cy={h*cy} r={Math.min(w,h)*0.05} fill="none" stroke="#94a3b8" strokeWidth="0.8" /></g>))}</g>)}
        {t === "Cooker Hood Space" && show && (<g><path d={`M ${w*0.1} ${h*0.9} L ${w*0.25} ${h*0.1} L ${w*0.75} ${h*0.1} L ${w*0.9} ${h*0.9} Z`} fill="none" stroke="#64748b" strokeWidth="1.5" /><line x1={w*0.2} y1={h*0.5} x2={w*0.8} y2={h*0.5} stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2 2" /></g>)}
        {t === "Fridge Space" && show && (<g><line x1={4} y1={h*0.35} x2={w-4} y2={h*0.35} stroke="#64748b" strokeWidth="1.5" /><line x1={w-8} y1={h*0.1} x2={w-8} y2={h*0.3} stroke="#475569" strokeWidth="2" /><line x1={w-8} y1={h*0.4} x2={w-8} y2={h*0.75} stroke="#475569" strokeWidth="2" /></g>)}
        {t === "Oven Housing" && show && (<g><rect x={w*0.15} y={h*0.15} width={w*0.7} height={h*0.55} fill="none" stroke="#64748b" strokeWidth="1.5" rx="2" /><line x1={w*0.15} y1={h*0.7} x2={w*0.85} y2={h*0.7} stroke="#64748b" strokeWidth="1" /><circle cx={w/2} cy={h*0.67} r="2" fill="#64748b" /><rect x={w*0.2} y={h*0.78} width={w*0.6} height={h*0.15} fill="none" stroke="#94a3b8" strokeWidth="0.8" /></g>)}
        {t === "Microwave Housing" && show && (<g><rect x={w*0.15} y={h*0.25} width={w*0.7} height={h*0.35} fill="none" stroke="#64748b" strokeWidth="1.5" rx="2" /><line x1={w*0.2} y1={h*0.35} x2={w*0.65} y2={h*0.35} stroke="#94a3b8" strokeWidth="0.8" /><circle cx={w*0.72} cy={h*0.42} r="1.5" fill="#64748b" /></g>)}
        {t === "Dishwasher Space" && show && (<g><rect x={w*0.1} y={h*0.08} width={w*0.8} height={h*0.12} fill="none" stroke="#64748b" strokeWidth="1" rx="1" /><line x1={w*0.15} y1={h*0.14} x2={w*0.4} y2={h*0.14} stroke="#94a3b8" strokeWidth="0.8" /><circle cx={w*0.7} cy={h*0.14} r="1.5" fill="#64748b" /><rect x={w*0.1} y={h*0.22} width={w*0.8} height={h*0.68} fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2 2" /></g>)}
        {t === "Washing Machine Space" && show && (<g><rect x={w*0.1} y={h*0.08} width={w*0.8} height={h*0.1} fill="none" stroke="#64748b" strokeWidth="1" rx="1" /><circle cx={w*0.72} cy={h*0.13} r="1.5" fill="#64748b" /><circle cx={w/2} cy={h*0.58} r={Math.min(w,h)*0.25} fill="none" stroke="#64748b" strokeWidth="1.5" /><circle cx={w/2} cy={h*0.58} r={Math.min(w,h)*0.15} fill="none" stroke="#94a3b8" strokeWidth="0.8" /></g>)}
        {t === "Appliance Garage" && show && (<g><line x1={3} y1={h*0.5} x2={w-3} y2={h*0.5} stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 2" /><path d={`M ${w*0.3} ${h*0.3} L ${w*0.5} ${h*0.1} L ${w*0.7} ${h*0.3}`} fill="none" stroke="#475569" strokeWidth="1" /></g>)}
        {t === "Appliance Tower" && show && (<g><line x1={4} y1={h*0.33} x2={w-4} y2={h*0.33} stroke="#94a3b8" strokeWidth="0.8" /><line x1={4} y1={h*0.66} x2={w-4} y2={h*0.66} stroke="#94a3b8" strokeWidth="0.8" /><rect x={w*0.2} y={h*0.4} width={w*0.6} height={h*0.22} fill="none" stroke="#64748b" strokeWidth="1" rx="2" /></g>)}
        {t === "Pantry Tall Unit" && show && (<g>{[0.15,0.3,0.45,0.6,0.75,0.9].map((f,i) => (<line key={i} x1={4} y1={h*f} x2={w-4} y2={h*f} stroke="#94a3b8" strokeWidth="0.8" />))}</g>)}
        {t === "Wine Rack Unit" && show && (<g>{Array.from({length: Math.floor(h/40)}, (_, i) => (<g key={i}><circle cx={w*0.5} cy={20+i*40} r={Math.min(w*0.3, 12)} fill="none" stroke="#64748b" strokeWidth="0.8" /></g>))}</g>)}
        {t === "Spice Rack Pull-out" && show && (<g>{Array.from({length: Math.floor(w/25)}, (_, i) => (<line key={i} x1={15+i*25} y1={5} x2={15+i*25} y2={h-5} stroke="#94a3b8" strokeWidth="0.5" />))}</g>)}
        {t === "Bin Pull-out Unit" && show && (<g><circle cx={w*0.3} cy={h*0.5} r={Math.min(w*0.25, h*0.3)} fill="none" stroke="#64748b" strokeWidth="1" /><circle cx={w*0.7} cy={h*0.5} r={Math.min(w*0.25, h*0.3)} fill="none" stroke="#64748b" strokeWidth="1" /></g>)}
        {t === "Plate Rack Unit" && show && (<g>{Array.from({length: Math.floor(w/50)}, (_, i) => (<line key={i} x1={25+i*50} y1={h*0.2} x2={25+i*50} y2={h*0.8} stroke="#94a3b8" strokeWidth="0.8" />))}<line x1={3} y1={h*0.2} x2={w-3} y2={h*0.2} stroke="#64748b" strokeWidth="1" /><line x1={3} y1={h*0.8} x2={w-3} y2={h*0.8} stroke="#64748b" strokeWidth="1" /></g>)}
        {t === "Tray Divider Unit" && show && (<g>{[0.25,0.45,0.65,0.85].map((f,i) => (<line key={i} x1={5} y1={h*f} x2={w-5} y2={h*f} stroke="#94a3b8" strokeWidth="0.8" />))}</g>)}
        {(t === "Corner Base Unit" || t === "Corner Wall Unit") && show && (<g><line x1={0} y1={0} x2={w} y2={h} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 2" /><line x1={w*0.5} y1={3} x2={w*0.5} y2={h-3} stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2 2" /></g>)}
        {t === "Open Shelving Unit" && show && (<line x1={3} y1={3} x2={w-3} y2={3} stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 1" />)}
        {t === "Glass Display Cabinet" && show && (<g><rect x={2} y={2} width={w-4} height={h-4} fill="none" stroke="#64748b" strokeWidth="0.8" strokeDasharray="1 1" /><line x1={2} y1={2} x2={w-4} y2={h-4} stroke="#94a3b8" strokeWidth="0.3" /><line x1={w-4} y1={2} x2={2} y2={h-4} stroke="#94a3b8" strokeWidth="0.3" /></g>)}
        {t === "Plinth / Kickboard" && show && (<g><line x1={3} y1={h*0.3} x2={w-3} y2={h*0.3} stroke="#64748b" strokeWidth="1" /><line x1={3} y1={h*0.7} x2={w-3} y2={h*0.7} stroke="#94a3b8" strokeWidth="0.5" /></g>)}
        {t === "Cornice / Crown Moulding" && show && (<g><path d={`M 0 ${h*0.5} L ${w*0.15} ${h*0.1} L ${w*0.85} ${h*0.1} L ${w} ${h*0.5}`} fill="none" stroke="#64748b" strokeWidth="1" /></g>)}
        {t === "End Panel / Bullnose" && show && (<g><line x1={w*0.3} y1={3} x2={w*0.3} y2={h-3} stroke="#64748b" strokeWidth="0.5" /><line x1={w*0.7} y1={3} x2={w*0.7} y2={h-3} stroke="#94a3b8" strokeWidth="0.3" /></g>)}
        {t === "Window Clearance" && show && (<g><line x1={3} y1={h/2} x2={w-3} y2={h/2} stroke="#64748b" strokeWidth="1" /><line x1={w/2} y1={3} x2={w/2} y2={h-3} stroke="#64748b" strokeWidth="1" /></g>)}
      </svg>
    );
  }

  function renderResizeNodes(mod: CabinetModule, w: number, h: number) {
    if (!selectedIds.has(mod.id) || !onUpdateModules) return null;
    if (lockedIds.has(mod.id)) return null;
    // Touch devices get larger (20px) handles per WCAG/Apple HIG; mouse uses 10px.
    const s = isTouch ? 20 : 10;
    const nodes = [
      { id: "tl", x: -s/2, y: -s/2, cursor: "nwse-resize" },
      { id: "t", x: w/2 - s/2, y: -s/2, cursor: "ns-resize" },
      { id: "tr", x: w - s/2, y: -s/2, cursor: "nesw-resize" },
      { id: "r", x: w - s/2, y: h/2 - s/2, cursor: "ew-resize" },
      { id: "br", x: w - s/2, y: h - s/2, cursor: "nwse-resize" },
      { id: "b", x: w/2 - s/2, y: h - s/2, cursor: "ns-resize" },
      { id: "bl", x: -s/2, y: h - s/2, cursor: "nesw-resize" },
      { id: "l", x: -s/2, y: h/2 - s/2, cursor: "ew-resize" },
    ];
    return nodes.map((n) => (
      <div key={n.id}
        className="absolute z-40 rounded-sm border-2 border-white bg-amber-600 shadow-sm"
        style={{ left: n.x, top: n.y, width: s, height: s, cursor: n.cursor, touchAction: "none" }}
        onPointerDown={(e) => onResizeDown(e, mod, n.id)}
      />
    ));
  }

  const selectedMod = primaryId ? modules.find((m) => m.id === primaryId) : null;
  const multiCount = selectedIds.size;

  // Shared wall content — rendered both inline and in fullscreen.
  function renderWallContent() {
    return (
      <div
        ref={innerRef}
        className="relative shrink-0 bg-white"
        style={{
          width: innerW,
          height: innerH,
          backgroundImage: gridEnabled
            ? "linear-gradient(#f1f5f9 1px, transparent 1px), linear-gradient(90deg, #f1f5f9 1px, transparent 1px)"
            : "none",
          backgroundSize: "20px 20px",
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          cursor: isSpace ? (isPanning ? "grabbing" : "grab") : undefined,
        }}
      >
        {/* Ruler ticks — top */}
        <svg style={{ position: "absolute", left: PAD, top: 0, width: wallPxW, height: PAD, pointerEvents: "none", overflow: "visible" }}>
          {Array.from({ length: Math.floor(totalW / 100) + 1 }, (_, i) => {
            const mmVal = i * 100;
            const x = mmVal * pxPerMm;
            const isMajor = mmVal % 500 === 0;
            return (
              <g key={i}>
                <line x1={x} y1={PAD - (isMajor ? 18 : 8)} x2={x} y2={PAD} stroke="#94a3b8" strokeWidth={isMajor ? 1 : 0.5} />
                {isMajor && (
                  <text x={x} y={PAD - 22} textAnchor="middle" fontSize="9" fill="#475569" fontFamily="monospace">{mmVal}</text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Ruler ticks — left */}
        <svg style={{ position: "absolute", left: 0, top: PAD, width: PAD, height: wallPxH, pointerEvents: "none", overflow: "visible" }}>
          {Array.from({ length: Math.floor(totalH / 100) + 1 }, (_, i) => {
            const mmVal = i * 100;
            const y = mmVal * pxPerMm;
            const isMajor = mmVal % 500 === 0;
            return (
              <g key={i}>
                <line x1={PAD - (isMajor ? 18 : 8)} y1={y} x2={PAD} y2={y} stroke="#94a3b8" strokeWidth={isMajor ? 1 : 0.5} />
                {isMajor && (
                  <text x={PAD - 22} y={y + 3} textAnchor="middle" fontSize="9" fill="#475569" fontFamily="monospace" transform={`rotate(-90, ${PAD - 22}, ${y + 3})`}>{mmVal}</text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Alignment guide lines (red dashed) */}
        {guidesEnabled && snapEnabled && (activeGuides.xs.length > 0 || activeGuides.ys.length > 0) && (
          <svg style={{ position: "absolute", left: 0, top: 0, width: innerW, height: innerH, pointerEvents: "none", overflow: "visible", zIndex: 30 }}>
            {activeGuides.xs.map((x, i) => (
              <line key={`gx-${i}`} x1={PAD + x * pxPerMm} y1={0} x2={PAD + x * pxPerMm} y2={innerH} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
            ))}
            {activeGuides.ys.map((y, i) => (
              <line key={`gy-${i}`} x1={0} y1={PAD + y * pxPerMm} x2={innerW} y2={PAD + y * pxPerMm} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
            ))}
          </svg>
        )}

        {/* Wall outline */}
        <div className="absolute border-2 border-dashed border-slate-300"
          style={{ left: PAD, top: PAD, width: wallPxW, height: wallPxH }}>
          <div className="absolute left-0 right-0 flex justify-center" style={{ top: wallPxH + 4 }}>
            <span className="rounded border border-slate-700 bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-700 font-mono">{totalW}mm</span>
          </div>
          <div className="absolute top-0 bottom-0 flex items-center" style={{ left: -26 }}>
            <span className="rounded border border-slate-700 bg-white px-1 py-0.5 text-[8px] font-bold text-slate-700 font-mono" style={{ writingMode: "vertical-rl" }}>{totalH}mm</span>
          </div>
        </div>

        {/* Gap labels between adjacent modules */}
        {gapPairs.map((g, i) => {
          const gx = PAD + g.midX * pxPerMm;
          const gy = PAD + g.midY * pxPerMm;
          return (
            <div key={`gap-${i}`} className="absolute z-30 pointer-events-none"
              style={{ left: gx, top: gy, transform: "translate(-50%, -50%)" }}>
              <span className="rounded bg-slate-700 px-1 py-0.5 text-[8px] font-bold text-white font-mono whitespace-nowrap">
                {g.gap}mm
              </span>
            </div>
          );
        })}

        {/* Modules */}
        {modules.map((mod) => {
          const left = PAD + mm(mod.x);
          const top = PAD + mm(mod.y);
          const w = Math.max(mm(mod.width), 15);
          const h = Math.max(mm(mod.height), 15);
          const isWindow = mod.type === "Window Clearance";
          const isAppliance = mod.type === "Appliance Tower" || mod.type === "Fridge Space";
          const isSelected = selectedIds.has(mod.id);
          const isLocked = lockedIds.has(mod.id);
          const isOverlap = overlaps.ids.has(mod.id);
          const meta = moduleMeta[mod.id];
          const label = meta?.label && meta.label.trim() ? meta.label.trim() : null;

          let border = "border-slate-700";
          if (isSelected) border = "border-amber-600";
          if (isOverlap) border = "border-red-500";

          return (
            <div key={mod.id}
              className={`absolute select-none border-2 ${border} ${isSelected ? "z-20" : "z-10"} ${isOverlap ? "border-dashed" : ""} ${isWindow ? "bg-amber-50" : isAppliance ? "bg-slate-100" : "bg-white"} ${isLocked ? "cursor-default" : onUpdateModules ? "cursor-grab active:cursor-grabbing" : ""}`}
              style={{ left, top, width: w, height: h, touchAction: "none" }}
              data-cabinet-module=""
              onPointerDown={(e) => onModuleDown(e, mod)}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => { e.stopPropagation(); openInspector(mod.id, e.clientX, e.clientY); }}
              onContextMenu={(e) => onModuleContextMenu(e, mod)}
            >
              {/* Code badge */}
              <div className="absolute left-0.5 top-0.5 z-10 rounded bg-amber-700 px-1 text-[7px] font-bold text-white font-mono">{mod.code}</div>

              {/* Custom label badge (if set) */}
              {label && w > 40 && h > 30 && (
                <div className="absolute left-0.5 right-0.5 z-10 truncate rounded bg-slate-800/80 px-1 text-[7px] font-medium text-white" style={{ top: 12 }}>
                  {label}
                </div>
              )}

              {/* Lock indicator */}
              {isLocked && (
                <div className="absolute right-0.5 top-0.5 z-10 text-[10px]">🔒</div>
              )}

              {/* Overlap warning badge */}
              {isOverlap && (
                <div className="absolute right-0.5 bottom-0.5 z-10 rounded bg-red-500 px-1 text-[7px] font-bold text-white">
                  ⚠ overlap
                </div>
              )}

              {/* 8 resize nodes */}
              {renderResizeNodes(mod, w, h)}

              {/* Shape */}
              {renderShape(mod, w, h)}

              {/* Dimension badge below cabinet */}
              {w > 40 && (
                <div className="absolute left-0 right-0 flex justify-center pointer-events-none" style={{ top: h + 2 }}>
                  <span className="rounded bg-amber-100 border border-amber-400 px-1 text-[8px] font-bold text-amber-800 font-mono whitespace-nowrap">
                    {mod.width}×{mod.height}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Marquee selection rectangle */}
        {marquee && (() => {
          const x = Math.min(marquee.x0, marquee.x1);
          const y = Math.min(marquee.y0, marquee.y1);
          const w = Math.abs(marquee.x1 - marquee.x0);
          const h = Math.abs(marquee.y1 - marquee.y0);
          return (
            <div className="absolute pointer-events-none z-40 border border-amber-500 bg-amber-400/10"
              style={{ left: x, top: y, width: w, height: h }} />
          );
        })()}

        {/* Live tooltip while dragging */}
        {liveTip && (
          <div className="absolute pointer-events-none z-50 rounded bg-slate-900 px-2 py-1 text-[9px] sm:text-[10px] font-mono text-white shadow-lg"
            style={
              isMobile
                ? { top: 8, right: 8 }
                : { left: liveTip.px + 14, top: liveTip.py + 14 }
            }>
            X: {liveTip.mmX}mm, Y: {liveTip.mmY}mm
          </div>
        )}

        {modules.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-slate-400">Drag cabinet elements here →</span>
          </div>
        )}
      </div>
    );
  }

  // --- Toggle pill button (Snap / Grid / Guides) ---
  // (TogglePill component is defined at file bottom — pure presentational)

  return (
    <div className="flex flex-col gap-2" ref={canvasWrapRef} tabIndex={-1}>
      {/* Toolbar — two tidy rows */}
      <div className="rounded-lg border border-border bg-muted/30 p-2 space-y-2">
        {/* Row 1: Drag palette (left) + Zoom controls (right) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto scrollbar-warm pb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0 mr-0.5 hidden sm:inline">Drag</span>
            <div className="flex items-center gap-1 min-w-0 flex-nowrap lg:flex-wrap shrink-0 lg:shrink">
              {(isMobile ? MOBILE_PALETTE : PALETTE).map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.type} draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/cabinet-type", item.type); e.dataTransfer.effectAllowed = "copy"; }}
                    onClick={() => isTouch && tapToAdd(item.type)}
                    title={`${item.label} — ${item.hint}`}
                    aria-label={item.label}
                    className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-amber-500 hover:bg-amber-500/5 hover:text-amber-700 active:cursor-grabbing shrink-0">
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
              {/* "More" dropdown — only on mobile — exposes all 27 cabinet types */}
              {isMobile && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button title="More cabinet types" aria-label="More cabinet types"
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-amber-500 hover:bg-amber-500/5 hover:text-amber-700">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-[60vh] overflow-y-auto w-60">
                    <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">All cabinet types</DropdownMenuLabel>
                    {PALETTE.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.type} draggable
                          onDragStart={(e) => { e.dataTransfer.setData("text/cabinet-type", item.type); e.dataTransfer.effectAllowed = "copy"; }}
                          onClick={() => tapToAdd(item.type)}
                          title={item.hint}
                          className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-grab hover:bg-muted rounded-sm">
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{item.label}</span>
                          <span className="ml-auto text-[9px] text-muted-foreground font-mono">{item.w}×{item.h}</span>
                        </div>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Zoom controls — desktop (full controls) */}
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mr-0.5">Zoom</span>
            <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} title="Zoom out (−)" className="flex h-7 w-7 items-center justify-center rounded border border-border bg-card hover:bg-muted hover:border-amber-500/50"><ZoomOut className="h-3 w-3" /></button>
            <input type="range" min="0.25" max="4" step="0.25" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-20 accent-amber-600" title={`Zoom: ${Math.round(zoom*100)}%`} />
            <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} title="Zoom in (+)" className="flex h-7 w-7 items-center justify-center rounded border border-border bg-card hover:bg-muted hover:border-amber-500/50"><ZoomIn className="h-3 w-3" /></button>
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-10 text-center rounded bg-card border border-border py-1">{Math.round(zoom*100)}%</span>
            <div className="mx-0.5 h-5 w-px bg-border" />
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset zoom to 100% and recenter (0)" className="flex h-7 items-center gap-1 px-2 rounded border border-border bg-card hover:bg-muted hover:border-amber-500/50 text-[10px] font-medium">
              <RotateCcw className="h-3 w-3" />
              <span>100%</span>
            </button>
            <button onClick={zoomToFit} title="Zoom to Fit" className="flex h-7 items-center gap-1 px-2 rounded border border-border bg-card hover:bg-muted hover:border-amber-500/50 text-[10px] font-medium">
              <Maximize2 className="h-3 w-3" />
              <span>Fit</span>
            </button>
          </div>

          {/* Zoom controls — mobile (collapsed into a dropdown) */}
          <div className="sm:hidden shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button title="Zoom controls" aria-label="Zoom controls"
                  className="flex h-7 items-center gap-1 px-2 rounded border border-border bg-card hover:bg-muted hover:border-amber-500/50 text-[10px] font-medium">
                  <ZoomIn className="h-3 w-3" />
                  <span className="font-mono tabular-nums">{Math.round(zoom*100)}%</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Zoom — {Math.round(zoom*100)}%</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setZoom(z => Math.min(4, z + 0.25))}>
                  <ZoomIn className="mr-2 h-3.5 w-3.5" /> Zoom In
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}>
                  <ZoomOut className="mr-2 h-3.5 w-3.5" /> Zoom Out
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
                  <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset to 100%
                </DropdownMenuItem>
                <DropdownMenuItem onClick={zoomToFit}>
                  <Maximize2 className="mr-2 h-3.5 w-3.5" /> Fit
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Row 2: toggles + status chips + align + undo/redo + help/fullscreen (single compact row on mobile) */}
        <div className="flex items-center gap-2 pt-1.5 border-t border-border/60 overflow-x-auto scrollbar-warm">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
            {/* Toggle pills */}
            <TogglePill active={snapEnabled} onClick={() => setSnapEnabled(s => !s)} icon={Magnet} label="Snap" title={snapEnabled ? "Snapping ON — click to turn OFF (free mode)" : "Snapping OFF — click to turn ON"} />
            {/* Snap mode: Edges / Grid */}
            {snapEnabled && (
              <Select value={snapMode} onValueChange={(v) => setSnapMode(v as "edges" | "grid")}>
                <SelectTrigger className="h-7 w-[78px] text-[11px] px-1.5 py-0 border-border bg-card" title="Snap mode: Edges or Grid">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="edges">Edges</SelectItem>
                  <SelectItem value="grid">Grid</SelectItem>
                </SelectContent>
              </Select>
            )}
            {/* Snap threshold dropdown */}
            {snapEnabled && (
              <Select value={String(snapThreshold)} onValueChange={(v) => setSnapThreshold(Number(v))}>
                <SelectTrigger className="h-7 w-[68px] text-[11px] px-1.5 py-0 border-border bg-card" title={snapMode === "grid" ? "Grid size (mm)" : "Snap threshold (mm)"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((v) => (
                    <SelectItem key={v} value={String(v)}>{v}mm</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <TogglePill active={gridEnabled} onClick={() => setGridEnabled(s => !s)} icon={Grid3x3} label="Grid" title="Toggle grid background" />
            <TogglePill active={guidesEnabled} onClick={() => setGuidesEnabled(s => !s)} icon={Ruler} label="Guides" title="Toggle alignment guide lines" />

            <div className="mx-0.5 h-5 w-px bg-border hidden sm:block" />

            {/* Status chips */}
            <span className="inline-flex items-center gap-1 rounded bg-card border border-border px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {modules.length} modules
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded bg-card border border-border px-1.5 py-0.5 text-[10px]">
              {modules.reduce((s, m) => s + m.width, 0)}mm total
            </span>
            {selectedIds.size > 0 && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500 px-1 sm:px-1.5 py-0.5 text-amber-700 text-[9px] sm:text-[10px]">
                {selectedIds.size} selected
              </span>
            )}
            {overlaps.ids.size > 0 && (
              <span className="inline-flex items-center gap-1 rounded bg-red-50 border border-red-300 px-1 sm:px-1.5 py-0.5 text-red-600 text-[9px] sm:text-[10px]">
                <AlertTriangle className="h-2.5 w-2.5" />
                Overlaps: {overlaps.pairs.length}
              </span>
            )}
            {isSpace && (
              <span className="inline-flex items-center gap-1 rounded bg-sky-50 border border-sky-300 px-1 sm:px-1.5 py-0.5 text-sky-700 text-[9px] sm:text-[10px]">
                <Hand className="h-2.5 w-2.5" /> Pan mode
              </span>
            )}
            {isTouch && (
              <span className="inline-flex items-center gap-1 rounded bg-card border border-border px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px]">
                <Hand className="h-2.5 w-2.5" /> Touch
              </span>
            )}
          </div>

          {/* Right-side tools */}
          <div className="flex flex-nowrap items-center gap-1 shrink-0 ml-auto">
            {/* Undo / Redo */}
            <button onClick={undo} disabled={undoLen === 0} title="Undo (Ctrl+Z)"
              className="flex h-7 w-7 items-center justify-center rounded border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
              <Undo2 className="h-3 w-3" />
            </button>
            <button onClick={redo} disabled={redoLen === 0} title="Redo (Ctrl+Shift+Z)"
              className="flex h-7 w-7 items-center justify-center rounded border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
              <Redo2 className="h-3 w-3" />
            </button>

            <div className="mx-0.5 h-5 w-px bg-border" />

            {/* Resolve overlaps */}
            {overlaps.pairs.length > 0 && (
              <button onClick={resolveOverlaps} title="Resolve all overlaps"
                className="flex h-7 items-center gap-1 px-2 rounded border border-red-300 bg-red-50 text-red-600 text-[11px] font-medium hover:bg-red-100">
                <AlertTriangle className="h-3 w-3" />
                <span className="hidden sm:inline">Resolve Overlaps</span>
              </button>
            )}

            {/* Align & distribute dropdown — only when 2+ selected */}
            {selectedIds.size >= 2 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-7 items-center gap-1 px-2 rounded border border-amber-500 bg-amber-500/15 text-amber-700 text-[11px] font-medium hover:bg-amber-500/25">
                    Align
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Align</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => alignSelected("left")}>
                    <AlignStartVertical className="mr-2 h-3.5 w-3.5" /> Align Left
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => alignSelected("centerH")}>
                    <AlignCenterVertical className="mr-2 h-3.5 w-3.5" /> Align Center H
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => alignSelected("right")}>
                    <AlignEndVertical className="mr-2 h-3.5 w-3.5" /> Align Right
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => alignSelected("top")}>
                    <AlignStartHorizontal className="mr-2 h-3.5 w-3.5" /> Align Top
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => alignSelected("centerV")}>
                    <AlignCenterHorizontal className="mr-2 h-3.5 w-3.5" /> Align Center V
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => alignSelected("bottom")}>
                    <AlignEndHorizontal className="mr-2 h-3.5 w-3.5" /> Align Bottom
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Distribute</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => distributeSelected("h")}>
                    <AlignHorizontalDistributeCenter className="mr-2 h-3.5 w-3.5" /> Distribute H
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => distributeSelected("v")}>
                    <AlignVerticalDistributeCenter className="mr-2 h-3.5 w-3.5" /> Distribute V
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <div className="mx-0.5 h-5 w-px bg-border" />

            <button onClick={() => setShowHelp(s => !s)} title="How to use this canvas"
              className={`flex h-7 items-center gap-1 px-2 rounded border text-[11px] font-medium transition-colors ${showHelp ? "bg-amber-500/10 text-amber-700 border-amber-500" : "bg-card text-muted-foreground border-border hover:bg-muted hover:border-amber-500/50"}`}>
              <HelpCircle className="h-3 w-3" />
              <span className="hidden sm:inline">Help</span>
            </button>
            <button onClick={() => setIsFullscreen(f => !f)} title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen mode (F)"}
              className={`flex h-7 items-center gap-1 px-2 rounded border text-[11px] font-medium transition-colors ${isFullscreen ? "bg-amber-500/10 text-amber-700 border-amber-500" : "bg-card text-muted-foreground border-border hover:bg-muted hover:border-amber-500/50"}`}>
              {isFullscreen ? <Minimize className="h-3 w-3" /> : <Expand className="h-3 w-3" />}
              <span className="hidden sm:inline">{isFullscreen ? "Exit" : "Fullscreen"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* How-to-use help panel */}
      {showHelp && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-400">
            <HelpCircle className="h-3.5 w-3.5" /> How to use the Elevation Builder
          </div>
          <ul className="ml-5 list-disc space-y-1 text-muted-foreground">
            <li><b>Add cabinets:</b> Drag any icon from the palette above onto the wall outline, then drop where you want it.</li>
            <li>
              <b>Move:</b> Click a cabinet and drag it.{" "}
              {snapEnabled ? (
                <span>Edges snap to the nearest cabinet or wall edge (within {snapThreshold}mm - adjustable). Toggle Snap off for free movement.</span>
              ) : (
                <span className="font-semibold text-sky-600">Snap is OFF - cabinets move freely.</span>
              )}
            </li>
            <li><b>Resize:</b> Click a cabinet to select it, then drag any of the 8 amber handles (corners + edge midpoints, CorelDRAW-style).</li>
            <li><b>Multi-select:</b> Shift+Click to add/remove from selection. Shift+Drag on empty canvas for marquee selection. Ctrl+A selects all.</li>
            <li><b>Right-click:</b> A cabinet for Duplicate · Lock/Unlock position · Delete.</li>
            <li><b>Align &amp; Distribute:</b> When 2+ modules are selected, the Align dropdown appears with 6 alignment + 2 distribution options.</li>
            <li><b>Pan:</b> Hold <kbd className="px-1 bg-muted rounded">Space</kbd> and drag to pan the canvas.</li>
            <li><b>Zoom:</b> Use the slider, +/− buttons, the +/- keys, or <kbd className="px-1 bg-muted rounded">0</kbd> to reset. <b>Fit</b> button zooms to fit all modules. <b>Reset</b> (↺) returns to 100% + recenters.</li>
            <li className="sm:hidden"><b>Touch / mobile:</b> Pinch-to-zoom is <i>not</i> supported — use the <b>Zoom</b> dropdown (top-right) for Zoom In / Out / Reset / Fit. Drag palette items from the row above (tap <MoreHorizontal className="inline h-2.5 w-2.5 align-middle" /> for the full list of 27 cabinet types). Resize handles are enlarged for easier touch targeting.</li>
            <li><b>Properties panel:</b> Edit exact W/H/X/Y (with nudge ◄►▲▼ buttons &amp; step +/- buttons), type, opening style, presets, custom label &amp; notes.</li>
            <li><b>Drawers / shelves:</b> Set the <b>number</b> of drawers and each <b>drawer height individually</b>. Same for shelves.</li>
            <li><b>Keyboard shortcuts:</b></li>
            <ul className="ml-4 list-[circle] space-y-0.5 text-[10px]">
              <li><kbd className="px-1 bg-muted rounded">Del</kbd>/<kbd className="px-1 bg-muted rounded">⌫</kbd> Delete · <kbd className="px-1 bg-muted rounded">Ctrl+D</kbd> Duplicate</li>
              <li><kbd className="px-1 bg-muted rounded">Ctrl+Z</kbd> Undo · <kbd className="px-1 bg-muted rounded">Ctrl+Shift+Z</kbd>/<kbd className="px-1 bg-muted rounded">Ctrl+Y</kbd> Redo</li>
              <li><kbd className="px-1 bg-muted rounded">↑↓←→</kbd> Nudge 1mm · <kbd className="px-1 bg-muted rounded">Shift+↑↓←→</kbd> Nudge 10mm</li>
              <li><kbd className="px-1 bg-muted rounded">Ctrl+A</kbd> Select all · <kbd className="px-1 bg-muted rounded">Esc</kbd> Deselect</li>
              <li><kbd className="px-1 bg-muted rounded">+</kbd>/<kbd className="px-1 bg-muted rounded">-</kbd> Zoom · <kbd className="px-1 bg-muted rounded">0</kbd> Reset zoom · <kbd className="px-1 bg-muted rounded">F</kbd> Fullscreen</li>
            </ul>
            <li><b>Auto-save:</b> Your work auto-saves to this browser. The browser will warn you before closing the tab if you have unsaved cabinets.</li>
          </ul>
        </div>
      )}

      {/* Canvas — inline (when not fullscreen) */}
      {!isFullscreen && (
        <div
          ref={scrollRef}
          tabIndex={0}
          className="relative w-full overflow-auto scrollbar-warm rounded-lg border border-border bg-white outline-none focus:ring-2 focus:ring-amber-500/30 min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]"
          style={{ maxHeight: height, touchAction: "none" }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onPointerDown={onCanvasDown}
          onPointerMove={onCanvasMove}
          onPointerUp={onCanvasUp}
        >
          {renderWallContent()}
          {/* Mode badge — shows current snap state */}
          <div className="pointer-events-none sticky top-2 left-2 z-50">
            {snapEnabled ? (
              <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-md">
                <Magnet className="h-2.5 w-2.5" />
                {snapMode === "edges" ? "SNAP: EDGES" : `SNAP: GRID ${snapThreshold}mm`}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 rounded-full bg-sky-500/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-md">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                FREE MODE
              </div>
            )}
          </div>
        </div>
      )}

      {/* Canvas — fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-white">
          {/* Fullscreen mini-toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/30 px-2 py-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Elevation — Fullscreen</span>
            <span className="text-[10px] text-muted-foreground hidden md:inline">Drag · Multi-select (Shift) · 8-node resize · Right-click menu · Pan (Space)</span>
            <div className="ml-auto flex items-center gap-1.5">
              <TogglePill active={snapEnabled} onClick={() => setSnapEnabled(s => !s)} icon={Magnet} label="Snap" title="Toggle snap" />
              <TogglePill active={gridEnabled} onClick={() => setGridEnabled(s => !s)} icon={Grid3x3} label="Grid" title="Toggle grid" />
              <TogglePill active={guidesEnabled} onClick={() => setGuidesEnabled(s => !s)} icon={Ruler} label="Guides" title="Toggle guides" />
              <div className="mx-0.5 h-5 w-px bg-border" />
              <button onClick={undo} disabled={undoLen === 0} title="Undo" className="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-muted disabled:opacity-40"><Undo2 className="h-3 w-3" /></button>
              <button onClick={redo} disabled={redoLen === 0} title="Redo" className="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-muted disabled:opacity-40"><Redo2 className="h-3 w-3" /></button>
              <div className="mx-0.5 h-5 w-px bg-border" />
              <span className="text-[11px] text-muted-foreground hidden sm:inline">Zoom:</span>
              <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} title="Zoom out" className="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-muted"><ZoomOut className="h-3 w-3" /></button>
              <input type="range" min="0.25" max="4" step="0.25" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-24 accent-amber-600" title={`Zoom: ${Math.round(zoom*100)}%`} />
              <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} title="Zoom in" className="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-muted"><ZoomIn className="h-3 w-3" /></button>
              <span className="text-[10px] font-mono text-muted-foreground w-9 text-center">{Math.round(zoom*100)}%</span>
              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset zoom to 100% and recenter" className="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-muted"><RotateCcw className="h-3 w-3" /></button>
              <button onClick={zoomToFit} title="Zoom to Fit" className="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-muted"><Maximize2 className="h-3 w-3" /></button>
              <div className="mx-0.5 h-5 w-px bg-border" />
              <button onClick={() => setShowHelp(s => !s)} title="How to use"
                className={`flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-muted ${showHelp ? "bg-amber-500/10 text-amber-700 border-amber-500" : "text-muted-foreground"}`}>
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setIsFullscreen(false)} title="Exit fullscreen (Esc)"
                className="flex h-7 w-7 items-center justify-center rounded border border-amber-500 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20">
                <Minimize className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {showHelp && (
            <div className="border-b border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-muted-foreground">
              <b className="text-amber-800 dark:text-amber-400">Tips:</b> Drag palette icons · click &amp; drag 8 amber handles to resize · Shift+click for multi-select · right-click for menu · set drawer &amp; shelf heights individually · <b>Space+drag</b> to pan · press <b>Esc</b> to exit.
            </div>
          )}

          <div
            ref={scrollRef}
            className="relative flex-1 overflow-auto scrollbar-warm bg-white"
            style={{ touchAction: "none" }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onPointerDown={onCanvasDown}
            onPointerMove={onCanvasMove}
            onPointerUp={onCanvasUp}
          >
            {renderWallContent()}
          </div>
        </div>
      )}

      {/* Context menu (right-click) */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[180px] rounded-lg border border-border bg-card py-1 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] text-muted-foreground border-b border-border mb-1">
            {selectedIds.size > 1 ? `${selectedIds.size} modules selected` : `Module ${modules.find(m => m.id === contextMenu.id)?.code ?? ""}`}
          </div>
          <button className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted"
            onClick={() => { duplicateSelected(); setContextMenu(null); }}>
            <Copy className="h-3.5 w-3.5" /> Duplicate{selectedIds.size > 1 ? ` (${selectedIds.size})` : ""}
            <span className="ml-auto text-[9px] text-muted-foreground">⌘D</span>
          </button>
          <button className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted"
            onClick={() => { toggleLock(contextMenu.id); setContextMenu(null); }}>
            {lockedIds.has(contextMenu.id) ? <><Unlock className="h-3.5 w-3.5" /> Unlock Position</> : <><Lock className="h-3.5 w-3.5" /> Lock Position</>}
          </button>
          <div className="my-1 border-t border-border" />
          <button className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
            onClick={() => { deleteSelected(); setContextMenu(null); }}>
            <Trash2 className="h-3.5 w-3.5" /> Delete{selectedIds.size > 1 ? ` (${selectedIds.size})` : ""}
            <span className="ml-auto text-[9px] text-muted-foreground">Del</span>
          </button>
        </div>
      )}

      {/* Inspector popup (double-click or long-press) */}
      {inspector && (() => {
        const mod = modules.find(m => m.id === inspector.id);
        if (!mod) { setInspector(null); return null; }
        const cabType = CABINET_TYPES.find(t => t.value === mod.type);
        const opening = OPENING_STYLES.find(t => t.value === mod.openingStyle);
        const isLocked = lockedIds.has(mod.id);
        const meta = moduleMeta[mod.id];
        const label = meta?.label ?? "";
        const notes = meta?.notes ?? "";
        return (
          <div
            className="fixed z-[60] w-[320px] max-h-[70vh] overflow-y-auto scrollbar-warm rounded-lg border border-amber-500/40 bg-card shadow-2xl"
            data-inspector-popup=""
            style={{ left: inspector.x, top: inspector.y }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-border bg-amber-500/10 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="rounded bg-amber-700 px-1.5 py-0.5 text-[10px] font-bold text-white font-mono shrink-0">{mod.code}</span>
                <span className="text-xs font-semibold truncate">{cabType?.label ?? mod.type}</span>
              </div>
              <button onClick={() => setInspector(null)} className="shrink-0 rounded p-1 hover:bg-muted" aria-label="Close inspector">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3 p-3">
              {/* Dimensions + Position */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dimensions & Position</p>
                <div className="grid grid-cols-4 gap-1.5">
                  <div>
                    <Label className="text-[9px] text-muted-foreground">W (mm)</Label>
                    <Input type="number" min="100" step="10" className="h-8 text-xs tabular-nums" value={mod.width} disabled={isLocked}
                      onChange={(e) => patchModule(mod.id, { width: Math.max(100, Number(e.target.value) || 100) })} />
                  </div>
                  <div>
                    <Label className="text-[9px] text-muted-foreground">H (mm)</Label>
                    <Input type="number" min="100" step="10" className="h-8 text-xs tabular-nums" value={mod.height} disabled={isLocked}
                      onChange={(e) => patchModule(mod.id, { height: Math.max(100, Number(e.target.value) || 100) })} />
                  </div>
                  <div>
                    <Label className="text-[9px] text-muted-foreground">X (mm)</Label>
                    <Input type="number" className="h-8 text-xs tabular-nums" value={mod.x} disabled={isLocked}
                      onChange={(e) => patchModule(mod.id, { x: Math.max(0, Number(e.target.value) || 0) })} />
                  </div>
                  <div>
                    <Label className="text-[9px] text-muted-foreground">Y (mm)</Label>
                    <Input type="number" className="h-8 text-xs tabular-nums" value={mod.y} disabled={isLocked}
                      onChange={(e) => patchModule(mod.id, { y: Math.max(0, Number(e.target.value) || 0) })} />
                  </div>
                </div>
                {/* Quick dimension presets */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {[300, 400, 500, 600, 800, 900].map(w => (
                    <button key={w} onClick={() => patchModule(mod.id, { width: w })} disabled={isLocked}
                      className="rounded border border-border px-1.5 py-0.5 text-[9px] hover:bg-muted disabled:opacity-40">{w}</button>
                  ))}
                  <span className="text-[9px] text-muted-foreground self-center mx-0.5">|</span>
                  {[720, 900, 1800, 2100].map(h => (
                    <button key={h} onClick={() => patchModule(mod.id, { height: h })} disabled={isLocked}
                      className="rounded border border-border px-1.5 py-0.5 text-[9px] hover:bg-muted disabled:opacity-40">{h}h</button>
                  ))}
                </div>
              </div>

              {/* Type + Opening */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Type & Opening</p>
                <div className="grid grid-cols-1 gap-1.5">
                  <Select value={mod.type} disabled={isLocked} onValueChange={(v) => patchModule(mod.id, { type: v as any })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CABINET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={mod.openingStyle} disabled={isLocked} onValueChange={(v) => patchModule(mod.id, { openingStyle: v as any })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{OPENING_STYLES.map(t => <SelectItem key={t.value} value={t.value}>{t.symbol} — {t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* Drawers (if Drawers opening style) */}
              {mod.openingStyle === "Drawers" && !isLocked && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Drawers ({mod.drawerHeights?.length ?? 0})
                  </p>
                  <div className="flex items-center gap-1 mb-1">
                    <button onClick={() => setDrawerCount(mod.id, (mod.drawerHeights?.length ?? 1) - 1)} className="flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-muted"><Minus className="h-3 w-3" /></button>
                    <span className="flex-1 text-center text-[10px] font-mono">{mod.drawerHeights?.length ?? 0} drawer{(mod.drawerHeights?.length ?? 0) === 1 ? "" : "s"}</span>
                    <button onClick={() => setDrawerCount(mod.id, (mod.drawerHeights?.length ?? 0) + 1)} className="flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-muted"><Plus className="h-3 w-3" /></button>
                    <button onClick={() => setDrawerCount(mod.id, mod.drawerHeights?.length ?? 3)} className="ml-1 rounded border border-border px-1.5 py-0.5 text-[9px] hover:bg-muted">Even</button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(mod.drawerHeights ?? []).map((dh, i) => (
                      <div key={i} className="flex flex-col items-center">
                        <span className="text-[8px] text-muted-foreground">D{i + 1}</span>
                        <Input type="number" min="50" step="10" className="h-7 w-14 text-[10px] text-center tabular-nums" value={dh}
                          onChange={(e) => setDrawerHeight(mod.id, i, Number(e.target.value) || 50)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Label + Notes */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Label & Notes</p>
                <Input className="h-8 text-xs mb-1.5" placeholder="Custom label (optional)" value={label}
                  onChange={(e) => setModuleMeta(prev => ({ ...prev, [mod.id]: { ...prev[mod.id], label: e.target.value } }))} />
                <Input className="h-8 text-xs" placeholder="Notes (optional)" value={notes}
                  onChange={(e) => setModuleMeta(prev => ({ ...prev, [mod.id]: { ...prev[mod.id], notes: e.target.value } }))} />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 border-t border-border pt-2">
                <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => { duplicateModule(mod.id); setInspector(null); }} title="Duplicate (Ctrl+D)">
                  <Copy className="mr-1 h-3 w-3" /> Duplicate
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toggleLock(mod.id)} title="Lock/Unlock">
                  {isLocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                </Button>
                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => { deleteModule(mod.id); setInspector(null); }} title="Delete (Del)">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Properties panel — multi-select aware */}
      {onUpdateModules && (selectedMod || multiCount > 1) && (
        <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/5 p-3">
          {multiCount > 1 ? (
            /* Multi-select properties panel */
            <div>
              <div className="mb-2 flex items-center gap-2 flex-wrap">
                <span className="rounded bg-amber-700 px-2 py-0.5 text-xs font-bold text-white font-mono">{multiCount} modules selected</span>
                <div className="ml-auto flex gap-1 flex-wrap">
                  <button onClick={duplicateSelected} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted" title="Duplicate all (Ctrl+D)">
                    <Copy className="h-3 w-3" /> Duplicate All
                  </button>
                  <button onClick={() => toggleLocks(Array.from(selectedIds))} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted" title="Lock/Unlock all">
                    <Lock className="h-3 w-3" /> Lock All
                  </button>
                  <button onClick={deleteSelected} className="flex items-center gap-1 rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600">
                    <Trash2 className="h-3 w-3" /> Delete All
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground mr-1">Quick actions:</span>
                <button onClick={() => nudgeSelected(-1, 0)} className="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-muted" title="Nudge left (←)"><ArrowLeft className="h-3 w-3" /></button>
                <button onClick={() => nudgeSelected(1, 0)} className="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-muted" title="Nudge right (→)"><ArrowRight className="h-3 w-3" /></button>
                <button onClick={() => nudgeSelected(0, -1)} className="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-muted" title="Nudge up (↑)"><ArrowUp className="h-3 w-3" /></button>
                <button onClick={() => nudgeSelected(0, 1)} className="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-muted" title="Nudge down (↓)"><ArrowDown className="h-3 w-3" /></button>
                <span className="mx-1 text-muted-foreground">·</span>
                <button onClick={() => alignSelected("left")} className="flex h-7 items-center gap-1 px-2 rounded border border-border text-[11px] hover:bg-muted" title="Align left"><AlignStartVertical className="h-3 w-3" /></button>
                <button onClick={() => alignSelected("centerH")} className="flex h-7 items-center gap-1 px-2 rounded border border-border text-[11px] hover:bg-muted" title="Align center H"><AlignCenterVertical className="h-3 w-3" /></button>
                <button onClick={() => alignSelected("right")} className="flex h-7 items-center gap-1 px-2 rounded border border-border text-[11px] hover:bg-muted" title="Align right"><AlignEndVertical className="h-3 w-3" /></button>
                <button onClick={() => alignSelected("top")} className="flex h-7 items-center gap-1 px-2 rounded border border-border text-[11px] hover:bg-muted" title="Align top"><AlignStartHorizontal className="h-3 w-3" /></button>
                <button onClick={() => alignSelected("centerV")} className="flex h-7 items-center gap-1 px-2 rounded border border-border text-[11px] hover:bg-muted" title="Align center V"><AlignCenterHorizontal className="h-3 w-3" /></button>
                <button onClick={() => alignSelected("bottom")} className="flex h-7 items-center gap-1 px-2 rounded border border-border text-[11px] hover:bg-muted" title="Align bottom"><AlignEndHorizontal className="h-3 w-3" /></button>
                <span className="mx-1 text-muted-foreground">·</span>
                <button onClick={() => distributeSelected("h")} className="flex h-7 items-center gap-1 px-2 rounded border border-border text-[11px] hover:bg-muted" title="Distribute horizontally"><AlignHorizontalDistributeCenter className="h-3 w-3" /></button>
                <button onClick={() => distributeSelected("v")} className="flex h-7 items-center gap-1 px-2 rounded border border-border text-[11px] hover:bg-muted" title="Distribute vertically"><AlignVerticalDistributeCenter className="h-3 w-3" /></button>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Shift+Click to add/remove from selection · Click empty canvas to clear · Arrow keys nudge by 1mm (Shift = 10mm)
              </p>
            </div>
          ) : selectedMod ? (
            /* Single-module properties panel */
            <div>
              <div className="mb-2 flex items-center gap-2 flex-wrap">
                <span className="rounded bg-amber-700 px-2 py-0.5 text-xs font-bold text-white font-mono">Module {selectedMod.code}</span>
                <span className="text-xs text-muted-foreground">{CABINET_TYPES.find(t => t.value === selectedMod.type)?.label}</span>
                {lockedIds.has(selectedMod.id) && <span className="text-xs text-amber-600">🔒 Locked</span>}
                <div className="ml-auto flex gap-1">
                  <button onClick={() => duplicateModule(selectedMod.id)} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted" title="Duplicate (Ctrl+D)">
                    <Copy className="h-3 w-3" /> Duplicate
                  </button>
                  <button onClick={() => toggleLock(selectedMod.id)} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted" title="Lock/Unlock">
                    {lockedIds.has(selectedMod.id) ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  </button>
                  <button onClick={() => deleteModule(selectedMod.id)} className="flex items-center gap-1 rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600">
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>

              {/* Collapsible sections */}
              <div className="space-y-1">
                {/* Position section */}
                <CollapsibleSection id="position" title="Position" openSections={openSections} setOpenSections={setOpenSections}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">X Position (mm)</Label>
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { beginInputHistory(); applyModules(modules.map(m => m.id === selectedMod.id ? { ...m, x: Math.max(0, m.x - 1) } : m)); void e; endInputHistory(); }}
                          className="flex h-8 w-6 items-center justify-center rounded border border-border hover:bg-muted shrink-0" title="Nudge left 1mm"><ArrowLeft className="h-3 w-3" /></button>
                        <Input type="number" value={selectedMod.x} disabled={lockedIds.has(selectedMod.id)}
                          onFocus={beginInputHistory}
                          onChange={(e) => applyModules(modules.map(m => m.id === selectedMod.id ? { ...m, x: Math.max(0, Number(e.target.value) || 0) } : m))}
                          onBlur={endInputHistory}
                          className="h-8 text-xs" />
                        <button onClick={(e) => { beginInputHistory(); applyModules(modules.map(m => m.id === selectedMod.id ? { ...m, x: Math.max(0, m.x + 1) } : m)); void e; endInputHistory(); }}
                          className="flex h-8 w-6 items-center justify-center rounded border border-border hover:bg-muted shrink-0" title="Nudge right 1mm"><ArrowRight className="h-3 w-3" /></button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Y Position (mm)</Label>
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { beginInputHistory(); applyModules(modules.map(m => m.id === selectedMod.id ? { ...m, y: Math.max(0, m.y - 1) } : m)); void e; endInputHistory(); }}
                          className="flex h-8 w-6 items-center justify-center rounded border border-border hover:bg-muted shrink-0" title="Nudge up 1mm"><ArrowUp className="h-3 w-3" /></button>
                        <Input type="number" value={selectedMod.y} disabled={lockedIds.has(selectedMod.id)}
                          onFocus={beginInputHistory}
                          onChange={(e) => applyModules(modules.map(m => m.id === selectedMod.id ? { ...m, y: Math.max(0, Number(e.target.value) || 0) } : m))}
                          onBlur={endInputHistory}
                          className="h-8 text-xs" />
                        <button onClick={(e) => { beginInputHistory(); applyModules(modules.map(m => m.id === selectedMod.id ? { ...m, y: Math.max(0, m.y + 1) } : m)); void e; endInputHistory(); }}
                          className="flex h-8 w-6 items-center justify-center rounded border border-border hover:bg-muted shrink-0" title="Nudge down 1mm"><ArrowDown className="h-3 w-3" /></button>
                      </div>
                    </div>
                    <div className="space-y-1 col-span-2 sm:col-span-2">
                      <Label className="text-[10px] text-muted-foreground">Quick position presets</Label>
                      <div className="flex flex-wrap gap-1">
                        <button onClick={() => patchModule(selectedMod.id, { x: 0, y: 0 })} className="rounded border border-border px-2 py-1 text-[10px] hover:bg-muted" disabled={lockedIds.has(selectedMod.id)}>Top-Left</button>
                        <button onClick={() => patchModule(selectedMod.id, { x: Math.max(0, totalW - selectedMod.width), y: 0 })} className="rounded border border-border px-2 py-1 text-[10px] hover:bg-muted" disabled={lockedIds.has(selectedMod.id)}>Top-Right</button>
                        <button onClick={() => patchModule(selectedMod.id, { x: 0, y: Math.max(0, totalH - selectedMod.height) })} className="rounded border border-border px-2 py-1 text-[10px] hover:bg-muted" disabled={lockedIds.has(selectedMod.id)}>Bottom-Left</button>
                        <button onClick={() => patchModule(selectedMod.id, { x: Math.max(0, totalW - selectedMod.width), y: Math.max(0, totalH - selectedMod.height) })} className="rounded border border-border px-2 py-1 text-[10px] hover:bg-muted" disabled={lockedIds.has(selectedMod.id)}>Bottom-Right</button>
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Dimensions section */}
                <CollapsibleSection id="dimensions" title="Dimensions" openSections={openSections} setOpenSections={setOpenSections}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Width (mm)</Label>
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { beginInputHistory(); applyModules(modules.map(m => m.id === selectedMod.id ? { ...m, width: Math.max(100, m.width - 10) } : m)); void e; endInputHistory(); }}
                          className="flex h-8 w-6 items-center justify-center rounded border border-border hover:bg-muted shrink-0" title="− 10mm"><Minus className="h-3 w-3" /></button>
                        <Input type="number" min="100" step="50" value={selectedMod.width} disabled={lockedIds.has(selectedMod.id)}
                          onFocus={beginInputHistory}
                          onChange={(e) => applyModules(modules.map(m => m.id === selectedMod.id ? { ...m, width: Math.max(100, Number(e.target.value) || 100) } : m))}
                          onBlur={endInputHistory}
                          className="h-8 text-xs" />
                        <button onClick={(e) => { beginInputHistory(); applyModules(modules.map(m => m.id === selectedMod.id ? { ...m, width: Math.max(100, m.width + 10) } : m)); void e; endInputHistory(); }}
                          className="flex h-8 w-6 items-center justify-center rounded border border-border hover:bg-muted shrink-0" title="+ 10mm"><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Height (mm)</Label>
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { beginInputHistory(); applyModules(modules.map(m => m.id === selectedMod.id ? { ...m, height: Math.max(100, m.height - 10) } : m)); void e; endInputHistory(); }}
                          className="flex h-8 w-6 items-center justify-center rounded border border-border hover:bg-muted shrink-0" title="− 10mm"><Minus className="h-3 w-3" /></button>
                        <Input type="number" min="100" step="50" value={selectedMod.height} disabled={lockedIds.has(selectedMod.id)}
                          onFocus={beginInputHistory}
                          onChange={(e) => applyModules(modules.map(m => m.id === selectedMod.id ? { ...m, height: Math.max(100, Number(e.target.value) || 100) } : m))}
                          onBlur={endInputHistory}
                          className="h-8 text-xs" />
                        <button onClick={(e) => { beginInputHistory(); applyModules(modules.map(m => m.id === selectedMod.id ? { ...m, height: Math.max(100, m.height + 10) } : m)); void e; endInputHistory(); }}
                          className="flex h-8 w-6 items-center justify-center rounded border border-border hover:bg-muted shrink-0" title="+ 10mm"><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Width presets</Label>
                      <Select value="" onValueChange={(v) => patchModule(selectedMod.id, { width: Number(v) })} disabled={lockedIds.has(selectedMod.id)}>
                        <SelectTrigger className="h-8 text-xs"><span className="text-muted-foreground">Choose…</span></SelectTrigger>
                        <SelectContent>
                          {WIDTH_PRESETS.map((w) => <SelectItem key={w} value={String(w)}>{w}mm</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Height presets</Label>
                      <Select value="" onValueChange={(v) => patchModule(selectedMod.id, { height: Number(v) })} disabled={lockedIds.has(selectedMod.id)}>
                        <SelectTrigger className="h-8 text-xs"><span className="text-muted-foreground">Choose…</span></SelectTrigger>
                        <SelectContent>
                          {HEIGHT_PRESETS.map((h) => <SelectItem key={h} value={String(h)}>{h}mm</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Type section */}
                <CollapsibleSection id="type" title="Type & Opening" openSections={openSections} setOpenSections={setOpenSections}>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Type</Label>
                      <Select value={selectedMod.type} disabled={lockedIds.has(selectedMod.id)}
                        onValueChange={(v) => patchModule(selectedMod.id, { type: v as any })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{CABINET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Opening Style</Label>
                      <Select value={selectedMod.openingStyle} disabled={lockedIds.has(selectedMod.id)}
                        onValueChange={(v) => patchModule(selectedMod.id, { openingStyle: v as any })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{OPENING_STYLES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Internal (drawers/shelves) section */}
                <CollapsibleSection id="internal" title="Internal — Drawers / Shelves" openSections={openSections} setOpenSections={setOpenSections}>
                  {!lockedIds.has(selectedMod.id) && (
                    <div className="space-y-2 rounded-md border border-amber-500/30 bg-white/60 p-2">
                      {selectedMod.openingStyle === "Drawers" ? (
                        <>
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-3.5 w-3.5 text-amber-700" />
                            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-400">Drawers — set each height individually</span>
                            <div className="ml-auto flex items-center gap-1">
                              <button title="Fewer drawers" onClick={() => setDrawerCount(selectedMod.id, (selectedMod.drawerHeights?.length ?? 1) - 1)} className="flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-muted"><Minus className="h-3 w-3" /></button>
                              <span className="w-16 text-center text-[11px] font-mono">{selectedMod.drawerHeights?.length ?? 0} drawer{(selectedMod.drawerHeights?.length ?? 0) === 1 ? "" : "s"}</span>
                              <button title="More drawers" onClick={() => setDrawerCount(selectedMod.id, (selectedMod.drawerHeights?.length ?? 0) + 1)} className="flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-muted"><Plus className="h-3 w-3" /></button>
                              <button title="Distribute evenly across cabinet height" onClick={() => setDrawerCount(selectedMod.id, selectedMod.drawerHeights?.length ?? 3)} className="ml-1 rounded border border-border px-2 py-0.5 text-[10px] hover:bg-muted">Even</button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(selectedMod.drawerHeights ?? []).map((dh, i) => (
                              <div key={i} className="flex flex-col items-center gap-0.5">
                                <span className="text-[9px] text-muted-foreground">D{i + 1}</span>
                                <Input type="number" min="50" step="10" value={dh}
                                  onChange={(e) => setDrawerHeight(selectedMod.id, i, Number(e.target.value) || 50)}
                                  className="h-7 w-16 text-[11px] text-center" />
                              </div>
                            ))}
                            {(selectedMod.drawerHeights?.length ?? 0) === 0 && (
                              <span className="text-[10px] text-muted-foreground italic">No drawers — click + to add one.</span>
                            )}
                          </div>
                          {(() => {
                            const used = (selectedMod.drawerHeights ?? []).reduce((a, b) => a + safeNum(b, 0), 0);
                            const over = used > selectedMod.height;
                            const gap = selectedMod.height - used;
                            return (
                              <p className={`text-[10px] ${over ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                                Sum of drawer heights: {used}mm / cabinet {selectedMod.height}mm
                                {over ? " ⚠ exceeds cabinet height — drawers will overflow"
                                  : gap > 0 ? ` · ${gap}mm gap at top`
                                  : ""}
                              </p>
                            );
                          })()}
                        </>
                      ) : selectedMod.openingStyle !== "Up-Lift Flap" ? (
                        <>
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-3.5 w-3.5 text-amber-700" />
                            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-400">Shelves — set each height from bottom</span>
                            <div className="ml-auto flex items-center gap-1">
                              <button title="Fewer shelves" onClick={() => setShelfCount(selectedMod.id, (selectedMod.shelfHeights?.length ?? 0) - 1)} className="flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-muted"><Minus className="h-3 w-3" /></button>
                              <span className="w-16 text-center text-[11px] font-mono">{selectedMod.shelfHeights?.length ?? 0} shelf{(selectedMod.shelfHeights?.length ?? 0) === 1 ? "" : "s"}</span>
                              <button title="More shelves" onClick={() => setShelfCount(selectedMod.id, (selectedMod.shelfHeights?.length ?? 0) + 1)} className="flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-muted"><Plus className="h-3 w-3" /></button>
                              <button title="Space shelves evenly" onClick={() => setShelfCount(selectedMod.id, selectedMod.shelfHeights?.length ?? 2)} className="ml-1 rounded border border-border px-2 py-0.5 text-[10px] hover:bg-muted">Even</button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(selectedMod.shelfHeights ?? []).map((sh, i) => (
                              <div key={i} className="flex flex-col items-center gap-0.5">
                                <span className="text-[9px] text-muted-foreground">S{i + 1}</span>
                                <Input type="number" min="20" step="10" value={sh}
                                  onChange={(e) => setShelfHeight(selectedMod.id, i, Number(e.target.value) || 20)}
                                  className="h-7 w-16 text-[11px] text-center" />
                              </div>
                            ))}
                            {(selectedMod.shelfHeights?.length ?? 0) === 0 && (
                              <span className="text-[10px] text-muted-foreground italic">No shelves — click + to add one.</span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Each value is the shelf position measured from the cabinet bottom (max {Math.max(0, selectedMod.height - 20)}mm).
                          </p>
                        </>
                      ) : null}
                    </div>
                  )}
                </CollapsibleSection>

                {/* Notes / Label section */}
                <CollapsibleSection id="notes" title="Label & Notes" openSections={openSections} setOpenSections={setOpenSections}>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Custom label (shown on cabinet)</Label>
                      <Input
                        type="text"
                        value={moduleMeta[selectedMod.id]?.label ?? ""}
                        onChange={(e) => setModuleMeta(prev => ({ ...prev, [selectedMod.id]: { ...prev[selectedMod.id], label: e.target.value } }))}
                        placeholder="e.g., Corner sink base"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Notes</Label>
                      <Textarea
                        value={moduleMeta[selectedMod.id]?.notes ?? ""}
                        onChange={(e) => setModuleMeta(prev => ({ ...prev, [selectedMod.id]: { ...prev[selectedMod.id], notes: e.target.value } }))}
                        placeholder="Free-text notes for this cabinet — measurements, hardware, finish, etc."
                        className="text-xs min-h-[60px]"
                      />
                    </div>
                  </div>
                </CollapsibleSection>
              </div>

              <p className="mt-2 text-[10px] text-muted-foreground">
                Drag to move · 8 amber nodes to resize · Right-click for menu · Edges snap to nearby modules · Arrow keys nudge 1mm (Shift = 10mm)
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// --- Collapsible section helper component (lightweight, no external dep) ---
function CollapsibleSection({ id, title, openSections, setOpenSections, children }: {
  id: string;
  title: string;
  openSections: Set<string>;
  setOpenSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  children: React.ReactNode;
}) {
  const isOpen = openSections.has(id);
  return (
    <div className="rounded-md border border-border/60 bg-card/30">
      <button
        type="button"
        onClick={() => setOpenSections(prev => {
          const n = new Set(prev);
          if (n.has(id)) n.delete(id); else n.add(id);
          return n;
        })}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-[11px] font-semibold hover:bg-muted/50"
      >
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className="uppercase tracking-wide text-muted-foreground">{title}</span>
      </button>
      {isOpen && <div className="px-2 pb-2 pt-1">{children}</div>}
    </div>
  );
}

// --- Toggle pill button (Snap / Grid / Guides) ---
function TogglePill({ active, onClick, icon: Icon, label, title }: {
  active: boolean; onClick: () => void;
  icon: React.ComponentType<{ className?: string }>; label: string; title: string;
}) {
  return (
    <button onClick={onClick} title={title}
      className={`flex h-7 items-center gap-1 px-2 rounded border text-[11px] font-medium transition-colors shrink-0 ${
        active
          ? "bg-amber-500/15 text-amber-700 border-amber-500"
          : "bg-card text-muted-foreground border-border hover:bg-muted"
      }`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
