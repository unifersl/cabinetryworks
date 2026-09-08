// Site Notebook types — practical elevation & cutting list builder for cabinetry site technicians

export interface CuttingListEntry {
  id: string;
  length: number; // mm
  width: number; // mm
  qty: number;
  material: MaterialTag;
  note?: string; // component type: Side Panel, Shelf, Top/Bottom, Divider, Door Front
}

export interface CabinetModule {
  id: string;
  code: string; // "01", "02", "03"
  type: CabinetType;
  width: number; // mm
  height: number; // mm (visual height on canvas, default = overall height)
  openingStyle: OpeningStyle;
  cuttingList: CuttingListEntry[];
  // Position on the drag-drop canvas (in mm coordinates)
  x: number; // mm from left
  y: number; // mm from top (0 = ceiling level)
  // Drawer configuration — individual front-face heights in mm, ordered TOP to BOTTOM.
  // Only rendered when openingStyle === "Drawers".
  drawerHeights: number[];
  // Shelf configuration — positions in mm measured FROM THE BOTTOM of the cabinet.
  // Rendered as horizontal lines for cabinets with shelves (any non-drawer opening).
  shelfHeights: number[];
}

export interface HardwareSpecs {
  carcaseBoard: string;
  doorFinish: string;
  edgeBanding: string;
  hinges: string;
  drawerRunners: string;
  handleStyle: string;
}

export interface SignatureData {
  clientName: string;
  technicianName: string;
  signatureDataUrl: string | null;
  signedAt: string | null;
}

export interface SiteJobData {
  siteName: string;
  jobNumber: string;
  jobDate: string;
  section: SectionType;
  overallDimensions: {
    width: number; // mm
    height: number; // mm
    depth: number; // mm
  };
  modules: CabinetModule[];
  hardwareSpecs: HardwareSpecs;
  signature: SignatureData;
}

export type SectionType =
  | "Wall A / Base Units"
  | "Wall Units"
  | "Tall Unit / Appliance Tower"
  | "Island / Ceiling";

export type CabinetType =
  | "Base Cabinet"
  | "Wall Cabinet"
  | "Sink Unit (Zink)"
  | "Hob Unit"
  | "Cooker Hood Space"
  | "Up-Lift Flap Cabinet"
  | "Appliance Tower"
  | "Fridge Space"
  | "Window Clearance"
  | "Oven Housing"
  | "Microwave Housing"
  | "Dishwasher Space"
  | "Washing Machine Space"
  | "Wine Rack Unit"
  | "Spice Rack Pull-out"
  | "Corner Base Unit"
  | "Corner Wall Unit"
  | "Pantry Tall Unit"
  | "Open Shelving Unit"
  | "Plinth / Kickboard"
  | "Cornice / Crown Moulding"
  | "End Panel / Bullnose"
  | "Glass Display Cabinet"
  | "Bin Pull-out Unit"
  | "Appliance Garage"
  | "Plate Rack Unit"
  | "Tray Divider Unit";

export type OpeningStyle =
  | "Single Door"
  | "Double Door"
  | "Drawers"
  | "Open Housing"
  | "Up-Lift Flap";

export type MaterialTag =
  | "Standard Board"
  | "PVC Board"
  | "Glass Door"
  | "Backing";

export const CABINET_TYPES: { value: CabinetType; label: string; icon: string }[] = [
  { value: "Base Cabinet", label: "Base Cabinet", icon: "▣" },
  { value: "Wall Cabinet", label: "Wall Cabinet", icon: "▤" },
  { value: "Sink Unit (Zink)", label: "Sink Unit", icon: "⬛" },
  { value: "Hob Unit", label: "Hob Unit", icon: "⬢" },
  { value: "Cooker Hood Space", label: "Cooker Hood", icon: "⬡" },
  { value: "Up-Lift Flap Cabinet", label: "Up-Lift Flap", icon: "◭" },
  { value: "Appliance Tower", label: "Appliance Tower", icon: "▮" },
  { value: "Fridge Space", label: "Fridge Space", icon: "▯" },
  { value: "Window Clearance", label: "Window Clearance", icon: "♽" },
  { value: "Oven Housing", label: "Oven Housing", icon: "⬚" },
  { value: "Microwave Housing", label: "Microwave Housing", icon: "⛶" },
  { value: "Dishwasher Space", label: "Dishwasher Space", icon: "▭" },
  { value: "Washing Machine Space", label: "Washing Machine", icon: "▱" },
  { value: "Wine Rack Unit", label: "Wine Rack Unit", icon: "◆" },
  { value: "Spice Rack Pull-out", label: "Spice Rack Pull-out", icon: "◇" },
  { value: "Corner Base Unit", label: "Corner Base Unit", icon: "◐" },
  { value: "Corner Wall Unit", label: "Corner Wall Unit", icon: "◑" },
  { value: "Pantry Tall Unit", label: "Pantry Tall Unit", icon: "▮" },
  { value: "Open Shelving Unit", label: "Open Shelving", icon: "☰" },
  { value: "Plinth / Kickboard", label: "Plinth / Kickboard", icon: "▬" },
  { value: "Cornice / Crown Moulding", label: "Cornice / Crown", icon: "▭" },
  { value: "End Panel / Bullnose", label: "End Panel / Bullnose", icon: "▯" },
  { value: "Glass Display Cabinet", label: "Glass Display Cabinet", icon: "◈" },
  { value: "Bin Pull-out Unit", label: "Bin Pull-out", icon: "◉" },
  { value: "Appliance Garage", label: "Appliance Garage", icon: "◌" },
  { value: "Plate Rack Unit", label: "Plate Rack Unit", icon: "≡" },
  { value: "Tray Divider Unit", label: "Tray Divider", icon: "⋙" },
];

export const OPENING_STYLES: { value: OpeningStyle; label: string; symbol: string }[] = [
  { value: "Single Door", label: "Single Door", symbol: "|" },
  { value: "Double Door", label: "Double Door", symbol: "||" },
  { value: "Drawers", label: "Drawers", symbol: "=" },
  { value: "Open Housing", label: "Open Housing", symbol: "Open" },
  { value: "Up-Lift Flap", label: "Up-Lift Flap", symbol: "Up Lift" },
];

export const MATERIAL_TAGS: MaterialTag[] = [
  "Standard Board",
  "PVC Board",
  "Glass Door",
  "Backing",
];

export const SECTION_TYPES: SectionType[] = [
  "Wall A / Base Units",
  "Wall Units",
  "Tall Unit / Appliance Tower",
  "Island / Ceiling",
];

export const COMPONENT_NOTES = [
  "Side Panel",
  "Shelf",
  "Top/Bottom",
  "Divider",
  "Door Front",
  "Back Panel",
  "Plinth",
  "Cornice",
];

// Hardware & material specification options
export const CARCASE_BOARD_OPTIONS = [
  "18mm Melamine",
  "18mm Plywood",
  "18mm PVC Board",
  "MDF",
];

export const DOOR_FINISH_OPTIONS = [
  "Acrylic",
  "Lacquer Spray",
  "Melamine",
  "Glass Profile",
];

export const EDGE_BANDING_OPTIONS = [
  "1mm PVC",
  "2mm PVC",
  "Aluminium Edge",
];

export const HINGES_OPTIONS = [
  "Soft-Close Hydraulic",
  "Blum",
  "DTC",
  "Standard 35mm",
];

export const DRAWER_RUNNERS_OPTIONS = [
  "Soft-Close Tandembox",
  "Undermount Slide",
  "Telescopic",
];

export const HANDLE_STYLE_OPTIONS = [
  "Gola Profile",
  "J-Pull",
  "Surface Handle",
  "Push-to-Open",
];

export function createEmptyModule(code: string): CabinetModule {
  return {
    id: crypto.randomUUID(),
    code,
    type: "Base Cabinet",
    width: 600,
    height: 720,
    openingStyle: "Single Door",
    cuttingList: [],
    x: 0,
    y: 0,
    // Default 3 drawers of 200mm each (600mm used, 120mm top gap for a 720 cabinet)
    drawerHeights: [200, 200, 200],
    // Default 2 shelves at 240mm and 480mm from the bottom
    shelfHeights: [240, 480],
  };
}

/**
 * Coerce a value to a finite number, falling back to `def` when it is NaN,
 * Infinity, or not a number. Prevents NaN from leaking into SVG/CSS attributes.
 */
export function safeNum(v: unknown, def: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : def;
}

/**
 * Evenly distribute `count` sections across `totalHeight` mm, reserving `topGap` mm
 * at the top (e.g. for a counter / plinth). Returns an array of section heights
 * ordered TOP to BOTTOM (matching the storage convention).
 */
export function distributeEvenly(count: number, totalHeight: number, topGap = 0): number[] {
  const safeCount = Math.max(1, Math.floor(safeNum(count, 1)));
  const safeTotal = Math.max(0, safeNum(totalHeight, 0));
  const usable = Math.max(0, safeTotal - safeNum(topGap, 0));
  const each = Math.round(usable / safeCount);
  return Array.from({ length: safeCount }, () => each);
}

/**
 * Types that are APPLIANCES or SPECIAL components — they should NOT have shelves or drawers
 * rendered inside them. Each has its own unique visual representation.
 */
export const APPLIANCE_TYPES = new Set<string>([
  "Sink Unit (Zink)",
  "Hob Unit",
  "Cooker Hood Space",
  "Fridge Space",
  "Window Clearance",
  "Oven Housing",
  "Microwave Housing",
  "Dishwasher Space",
  "Washing Machine Space",
  "Wine Rack Unit",
  "Spice Rack Pull-out",
  "Plinth / Kickboard",
  "Cornice / Crown Moulding",
  "End Panel / Bullnose",
  "Bin Pull-out Unit",
  "Appliance Garage",
  "Plate Rack Unit",
  "Tray Divider Unit",
]);

/**
 * Types that are OPEN or SHELVING — they should show shelves but no door lines.
 */
export const OPEN_SHELVING_TYPES = new Set<string>([
  "Open Shelving Unit",
  "Glass Display Cabinet",
]);

/**
 * Types that are TALL units — they should show internal divisions but not shelves/drawers.
 */
export const TALL_UNIT_TYPES = new Set<string>([
  "Appliance Tower",
  "Pantry Tall Unit",
]);

/**
 * Ensure a module has valid drawerHeights / shelfHeights arrays AND valid core
 * numeric fields (width/height/x/y). Migrates legacy modules (loaded from
 * localStorage) that were created before these fields existed, and guards
 * against NaN/undefined values that would otherwise produce NaN SVG attributes.
 *
 * CRITICAL: Appliance types (fridge, oven, dishwasher, etc.) should NOT have
 * shelves or drawers — they render their own unique shapes.
 */
export function ensureDrawersShelves(mod: CabinetModule): CabinetModule {
  const width = safeNum(mod.width, 600);
  const height = safeNum(mod.height, 720);
  const x = safeNum(mod.x, 0);
  const y = safeNum(mod.y, 0);

  // Appliances and special components — NO drawers, NO shelves
  if (APPLIANCE_TYPES.has(mod.type)) {
    return { ...mod, width, height, x, y, drawerHeights: [], shelfHeights: [] };
  }

  // Tall units — NO drawers/shelves (they have their own internal divisions)
  if (TALL_UNIT_TYPES.has(mod.type)) {
    return { ...mod, width, height, x, y, drawerHeights: [], shelfHeights: [] };
  }

  // Open shelving types — shelves YES, drawers NO
  if (OPEN_SHELVING_TYPES.has(mod.type)) {
    const shelfHeights =
      Array.isArray(mod.shelfHeights) && mod.shelfHeights.length > 0
        ? mod.shelfHeights.map((s) => safeNum(s, 240)).filter((s) => s > 0)
        : [Math.round(height * 0.25), Math.round(height * 0.5), Math.round(height * 0.75)];
    return { ...mod, width, height, x, y, drawerHeights: [], shelfHeights };
  }

  // Standard cabinets — normal drawer/shelf logic
  const drawerHeights =
    Array.isArray(mod.drawerHeights) && mod.drawerHeights.length > 0
      ? mod.drawerHeights.map((d) => safeNum(d, 200)).filter((d) => d > 0)
      : mod.openingStyle === "Drawers"
        ? distributeEvenly(3, height, 0)
        : [];

  const shelfHeights =
    Array.isArray(mod.shelfHeights) && mod.shelfHeights.length > 0
      ? mod.shelfHeights.map((s) => safeNum(s, 240)).filter((s) => s > 0)
      : mod.openingStyle !== "Drawers" && mod.openingStyle !== "Up-Lift Flap"
        ? [Math.round(height * 0.33), Math.round(height * 0.66)]
        : [];

  return { ...mod, width, height, x, y, drawerHeights, shelfHeights };
}

export function createEmptySiteData(): SiteJobData {
  return {
    siteName: "",
    jobNumber: "",
    jobDate: new Date().toISOString().slice(0, 10),
    section: "Wall A / Base Units",
    overallDimensions: { width: 3400, height: 2150, depth: 600 },
    modules: [],
    hardwareSpecs: {
      carcaseBoard: "18mm Melamine",
      doorFinish: "Acrylic",
      edgeBanding: "1mm PVC",
      hinges: "Soft-Close Hydraulic",
      drawerRunners: "Soft-Close Tandembox",
      handleStyle: "Gola Profile",
    },
    signature: {
      clientName: "",
      technicianName: "",
      signatureDataUrl: null,
      signedAt: null,
    },
  };
}
