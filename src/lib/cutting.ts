import type { CuttingListItem } from "@/lib/types";

/**
 * Cutting-list engineering helpers.
 *
 * Real-world logic:
 *  - The NOMINAL size is the finished panel size (after edge banding is applied).
 *  - The CUT size is the substrate size the saw must produce — it is the nominal
 *    size REDUCED by the banding thickness on each banded edge.
 *  - Long edges run along the LENGTH; banding a long edge reduces the CUT WIDTH.
 *  - Short edges run along the WIDTH; banding a short edge reduces the CUT LENGTH.
 *
 *    ┌─────────────────────────────┐ ← long edge 1 (reduces cut W if banded)
 *    │                             │
 *    │                             │
 *  short                          short
 *  edge 1                         edge 2   (reduce cut L if banded)
 *    │                             │
 *    │                             │
 *    └─────────────────────────────┘ ← long edge 2 (reduces cut W if banded)
 */

export function parseDim(s: string | number | undefined | null): number {
  if (typeof s === "number") return s;
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function parseThickness(s: string | undefined | null): number {
  return parseDim(s);
}

/** Number of banded long edges (affects cut width). */
export function bandedLongCount(it: CuttingListItem): number {
  return (it.edgeLong1 ? 1 : 0) + (it.edgeLong2 ? 1 : 0);
}

/** Number of banded short edges (affects cut length). */
export function bandedShortCount(it: CuttingListItem): number {
  return (it.edgeShort1 ? 1 : 0) + (it.edgeShort2 ? 1 : 0);
}

/** Edge banding thickness in mm (default 1mm if any edge is banded). */
export function edgeThickness(it: CuttingListItem): number {
  const hasBand =
    it.edgeLong1 || it.edgeLong2 || it.edgeShort1 || it.edgeShort2;
  if (!hasBand) return 0;
  const t = Number(it.edgeThk);
  return Number.isFinite(t) && t > 0 ? t : 1;
}

/** Total banding thickness removed from the length axis (short edges banded). */
export function bandingDeltaLength(it: CuttingListItem): number {
  return bandedShortCount(it) * edgeThickness(it);
}

/** Total banding thickness removed from the width axis (long edges banded). */
export function bandingDeltaWidth(it: CuttingListItem): number {
  return bandedLongCount(it) * edgeThickness(it);
}

/** Cut (substrate) length in mm — what the saw must produce. */
export function cutLength(it: CuttingListItem): number {
  return Math.max(0, parseDim(it.length) - bandingDeltaLength(it));
}

/** Cut (substrate) width in mm — what the saw must produce. */
export function cutWidth(it: CuttingListItem): number {
  return Math.max(0, parseDim(it.width) - bandingDeltaWidth(it));
}

/** Does this part have any edge banding? */
export function hasBanding(it: CuttingListItem): boolean {
  return Boolean(
    it.edgeLong1 || it.edgeLong2 || it.edgeShort1 || it.edgeShort2,
  );
}

/** Human-readable banding summary, e.g. "2mm · 4 edges" or "1mm · long×2". */
export function bandingSummary(it: CuttingListItem): string {
  if (!hasBanding(it)) return "—";
  const t = edgeThickness(it);
  const lg = bandedLongCount(it);
  const sh = bandedShortCount(it);
  const parts: string[] = [];
  if (lg > 0) parts.push(`long×${lg}`);
  if (sh > 0) parts.push(`short×${sh}`);
  return `${t}mm · ${parts.join(" + ") || "—"} · -L${bandingDeltaLength(it)}/W${bandingDeltaWidth(it)}`;
}

/** Per-edge legend for printable output. */
export function edgeLegend(it: CuttingListItem): string {
  const t = edgeThickness(it);
  if (t === 0) return "—";
  const flags = [
    it.edgeLong1 ? "L1" : "",
    it.edgeLong2 ? "L2" : "",
    it.edgeShort1 ? "S1" : "",
    it.edgeShort2 ? "S2" : "",
  ].filter(Boolean);
  return `${t}mm · ${flags.join(",")}`;
}

/** Format a mm dimension with the unit, trimming trailing .0. */
export function fmtMm(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}mm`;
}

/** Total pieces across all items. */
export function totalPieces(items: CuttingListItem[]): number {
  return items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
}

/** Total panel area in m² using CUT dimensions (actual material used). */
export function totalAreaM2(items: CuttingListItem[]): number {
  const mm2 = items.reduce((s, i) => {
    const l = cutLength(i);
    const w = cutWidth(i);
    return s + l * w * (Number(i.qty) || 0);
  }, 0);
  return mm2 / 1_000_000;
}

/** Total edge-banding linear metres (sum of banded edges × qty). */
export function totalBandingLinearM(items: CuttingListItem[]): number {
  const mm = items.reduce((s, i) => {
    const l = parseDim(i.length);
    const w = parseDim(i.width);
    const lg = bandedLongCount(i); // long edges run along length → each is `l` mm
    const sh = bandedShortCount(i); // short edges run along width → each is `w` mm
    const per = lg * l + sh * w;
    return s + per * (Number(i.qty) || 0);
  }, 0);
  return mm / 1000;
}

/**
 * Estimate sheets needed for a given sheet size (2440×1220 etc.).
 * Uses a simple area-based estimate with a 78% utilization factor (industry
 * average for guillotine nesting of rectangular parts).
 */
export function estimateSheets(
  items: CuttingListItem[],
  sheetL: number,
  sheetW: number,
  utilization = 0.78,
): number {
  const areaNeeded = items.reduce((s, i) => {
    const l = cutLength(i);
    const w = cutWidth(i);
    return s + l * w * (Number(i.qty) || 0);
  }, 0);
  const sheetArea = sheetL * sheetW * utilization;
  return Math.max(1, Math.ceil(areaNeeded / sheetArea));
}

/**
 * Estimate sheets needed from a pre-computed total panel area (m²).
 *
 * This is the area-based variant of `estimateSheets` — used by the Site
 * Notebook and stock-check features that don't carry per-item edge-banding
 * detail, just the total sheet area. Wastage defaults to 15% (industry
 * standard cutting loss). Sheet defaults to the standard 2440×1220 mm
 * (≈ 2.977 m²).
 *
 * Example: areaSqm = 8.93, wastage = 15  → ceil((8.93 * 1.15) / 2.977) = 4 sheets
 */
export function estimateSheetsFromArea(
  areaSqm: number,
  sheetL = 2440,
  sheetW = 1220,
  wastagePct = 15,
): number {
  if (!Number.isFinite(areaSqm) || areaSqm <= 0) return 0;
  const sheetAreaSqm = (sheetL * sheetW) / 1_000_000;
  const withWastage = areaSqm * (1 + wastagePct / 100);
  return Math.max(1, Math.ceil(withWastage / sheetAreaSqm));
}

export const STANDARD_SHEETS = [
  { label: "2440 × 1220 mm (8×4 ft)", length: 2440, width: 1220 },
  { label: "2440 × 1830 mm (8×6 ft)", length: 2440, width: 1830 },
  { label: "1830 × 1220 mm (6×4 ft)", length: 1830, width: 1220 },
  { label: "3660 × 1830 mm (12×6 ft)", length: 3660, width: 1830 },
  { label: "2800 × 2070 mm (oversized)", length: 2800, width: 2070 },
];

export const COMMON_EDGE_THICKNESSES = [0.5, 1, 1.5, 2, 3];
