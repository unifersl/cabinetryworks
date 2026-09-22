"use client";

import * as React from "react";
import type { CuttingListItem } from "@/lib/types";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Layers, Printer, X, GitBranch, Scissors } from "lucide-react";
import {
  STANDARD_SHEETS,
  cutLength,
  cutWidth,
  parseDim,
  totalPieces,
} from "@/lib/cutting";

/* ────────────────────────────────────────────────────────────────────────
 * Nesting engine — guillotine (shelf-based) bin packing.
 *
 * Real-world behaviour:
 *  - Uses CUT dimensions (substrate size), not nominal finished size, so
 *    edge-banded parts nest at their true saw size.
 *  - Respects grain direction: grain-locked parts cannot be rotated.
 *  - Applies saw-blade kerf between adjacent cuts.
 *  - Optional trim allowance on each sheet edge (factory offcut).
 *  - Each sheet is filled shelf-by-shelf (guillotine cuts): a shelf is a
 *    horizontal band of fixed height; parts sit on the shelf left-to-right.
 *    This mirrors how a panel saw actually cuts.
 * ──────────────────────────────────────────────────────────────────────── */

export interface NestPart {
  id: number;
  part: string;
  length: number;       // cut length (mm) — along sheet X
  width: number;        // cut width (mm)  — along sheet Y
  qty: number;
  x: number;
  y: number;
  rotated: boolean;
  sheetIndex: number;
  sourceLength: number;  // original cut length (pre-rotation)
  sourceWidth: number;   // original cut width (pre-rotation)
  grain: boolean;
}

export interface Sheet {
  index: number;
  length: number;
  width: number;
  parts: NestPart[];
  usedArea: number;
}

interface ExpandedPart {
  id: number;
  part: string;
  length: number;
  width: number;
  grain: boolean;
}

function runNesting(
  items: CuttingListItem[],
  sheetLength: number,
  sheetWidth: number,
  sawBlade: number,
  trimEdge: number,
): { sheets: Sheet[]; unplaced: ExpandedPart[] } {
  // Expand quantities into individual parts (using CUT dimensions)
  const allParts: ExpandedPart[] = [];
  let id = 0;
  for (const item of items) {
    const l = cutLength(item);
    const w = cutWidth(item);
    for (let q = 0; q < (Number(item.qty) || 1); q++) {
      allParts.push({
        id: id++,
        part: item.part,
        length: l,
        width: w,
        grain: !!item.grain,
      });
    }
  }

  // Sort by area descending (largest first) — classic FFD heuristic
  allParts.sort((a, b) => b.length * b.width - a.length * a.width);

  // Usable area inside trim
  const usableL = sheetLength - 2 * trimEdge;
  const usableW = sheetWidth - 2 * trimEdge;
  const blade = sawBlade;

  const sheets: Sheet[] = [];
  const unplaced: ExpandedPart[] = [];

  // Guillotine shelf packing per sheet
  function tryFitSheet(part: ExpandedPart, sheet: Sheet): NestPart | null {
    // Try orientations (respect grain)
    const tries: Array<{ l: number; w: number; rotated: boolean }> = [];
    if (part.grain) {
      // Grain-locked: no rotation
      tries.push({ l: part.length, w: part.width, rotated: false });
    } else {
      tries.push({ l: part.length, w: part.width, rotated: false });
      tries.push({ l: part.width, w: part.length, rotated: true });
    }

    for (const t of tries) {
      if (t.l > usableL || t.w > usableW) continue;
      // Shelf-based placement: scan existing shelves (rows), find one that fits.
      // Shelves are defined by their y position and height (max part width on that shelf).
      const shelves = new Map<number, number>(); // y → shelf height
      for (const p of sheet.parts) {
        const shelfBottom = p.y;
        const shelfTop = p.y + p.width + blade;
        // extend shelf height if needed
        const cur = shelves.get(p.y) ?? 0;
        shelves.set(p.y, Math.max(cur, p.width));
      }

      // Try to place on an existing shelf (its y is fixed, height = max)
      let placed = false;
      const sortedShelves = Array.from(shelves.entries()).sort((a, b) => a[0] - b[0]);
      for (const [shelfY, shelfH] of sortedShelves) {
        if (t.w > shelfH + blade * 0.5 && t.w > shelfH) {
          // part taller than shelf — would need to grow shelf; skip if it collides
          // (we allow growing the shelf only if no part above within t.w - shelfH)
        }
        if (t.w > shelfH + 1) continue; // doesn't fit this shelf height
        // find rightmost x on this shelf
        let maxX = trimEdge;
        for (const p of sheet.parts) {
          if (Math.abs(p.y - shelfY) < 1) {
            maxX = Math.max(maxX, p.x + p.length + blade);
          }
        }
        if (maxX + t.l <= sheetLength - trimEdge) {
          return {
            id: part.id,
            part: part.part,
            length: t.l,
            width: t.w,
            qty: 1,
            x: maxX,
            y: shelfY,
            rotated: t.rotated,
            sheetIndex: sheet.index,
            sourceLength: part.length,
            sourceWidth: part.width,
            grain: part.grain,
          };
        }
      }

      // Start a new shelf below the lowest existing part
      let nextY = trimEdge;
      for (const p of sheet.parts) {
        nextY = Math.max(nextY, p.y + p.width + blade);
      }
      if (nextY + t.w <= sheetWidth - trimEdge) {
        return {
          id: part.id,
          part: part.part,
          length: t.l,
          width: t.w,
          qty: 1,
          x: trimEdge,
          y: nextY,
          rotated: t.rotated,
          sheetIndex: sheet.index,
          sourceLength: part.length,
          sourceWidth: part.width,
          grain: part.grain,
        };
      }
    }
    return null;
  }

  for (const part of allParts) {
    let placed = false;
    for (const sheet of sheets) {
      const result = tryFitSheet(part, sheet);
      if (result) {
        sheet.parts.push(result);
        sheet.usedArea += result.length * result.width;
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Create a new sheet
      const newSheet: Sheet = {
        index: sheets.length,
        length: sheetLength,
        width: sheetWidth,
        parts: [],
        usedArea: 0,
      };
      const result = tryFitSheet(part, newSheet);
      if (result) {
        newSheet.parts.push(result);
        newSheet.usedArea += result.length * result.width;
        sheets.push(newSheet);
        placed = true;
      }
    }
    if (!placed) {
      unplaced.push(part);
    }
  }

  return { sheets, unplaced };
}

interface NestingDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: CuttingListItem[];
  panelName: string;
}

export function NestingDialog({ open, onOpenChange, items, panelName }: NestingDialogProps) {
  const [sheetSize, setSheetSize] = React.useState(STANDARD_SHEETS[0]);
  const [sawBlade, setSawBlade] = React.useState("3");
  const [trimEdge, setTrimEdge] = React.useState("10");
  const [result, setResult] = React.useState<{ sheets: Sheet[]; unplaced: ExpandedPart[] }>({ sheets: [], unplaced: [] });

  React.useEffect(() => {
    if (open && items.length > 0) {
      const blade = Number(sawBlade) || 3;
      const trim = Number(trimEdge) || 0;
      setResult(runNesting(items, sheetSize.length, sheetSize.width, blade, trim));
    }
  }, [open, items, sheetSize, sawBlade, trimEdge]);

  const { sheets, unplaced } = result;
  const totalPartsCount = totalPieces(items);
  const totalSheetArea = sheets.length * sheetSize.length * sheetSize.width;
  const totalUsedArea = sheets.reduce((s, sh) => s + sh.usedArea, 0);
  const wastePct = totalSheetArea > 0 ? ((1 - totalUsedArea / totalSheetArea) * 100).toFixed(1) : "0";

  function printNesting() {
    const w = window.open("", "_blank");
    if (!w) return;
    const sheetsHtml = sheets.map((sheet, si) => {
      const parts = sheet.parts.map((p) => {
        const xPct = (p.x / sheet.length) * 100;
        const yPct = (p.y / sheet.width) * 100;
        const wPct = (p.length / sheet.length) * 100;
        const hPct = (p.width / sheet.width) * 100;
        const color = p.grain ? "#fde68a" : p.rotated ? "#bfdbfe" : "#ddd6fe";
        return `<div style="position:absolute;left:${xPct}%;top:${yPct}%;width:${wPct}%;height:${hPct}%;border:1px solid #1e293b;background:${color};display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:6pt;color:#1e293b;font-family:monospace;overflow:hidden;line-height:1.1;">
          <strong>${escapeHtml(p.part).slice(0, 14)}</strong>
          <span>${p.length}×${p.width}</span>
          ${p.rotated ? '<span style="color:#1d4ed8;">ROT</span>' : ""}
          ${p.grain ? '<span style="color:#b45309;">GRAIN</span>' : ""}
        </div>`;
      }).join("");
      const usedPct = ((sheet.usedArea / (sheet.length * sheet.width)) * 100).toFixed(1);
      return `<div style="page-break-after:always;margin-bottom:14px;">
        <h3 style="font-size:10pt;margin:6px 0 2px;">Sheet ${si + 1} — ${sheet.parts.length} parts · ${usedPct}% used</h3>
        <div style="position:relative;width:100%;aspect-ratio:${sheet.length}/${sheet.width};border:2px solid #475569;background:#f8fafc;">
          ${parts}
        </div>
      </div>`;
    }).join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Nesting Layout — ${escapeHtml(panelName)}</title>
      <style>
        @page{size:A4 landscape;margin:8mm}
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;padding:12px;color:#1e293b}
        h1{font-size:13pt;border-bottom:2px solid #1e293b;padding-bottom:4px}
        h3{font-size:10pt;margin:6px 0 2px}
        .meta{font-size:8pt;color:#64748b;margin:4px 0 10px}
        .legend{font-size:8pt;margin:6px 0;display:flex;gap:14px}
        .legend span{display:inline-flex;align-items:center;gap:4px}
        .swatch{display:inline-block;width:10px;height:10px;border:1px solid #1e293b}
      </style></head><body>
      <h1>Nesting Layout — ${escapeHtml(panelName)}</h1>
      <p class="meta">Sheet: ${sheetSize.label} · Saw blade: ${sawBlade}mm · Trim: ${trimEdge}mm · Parts: ${totalPartsCount} · Sheets: ${sheets.length} · Yield: ${(100 - Number(wastePct)).toFixed(1)}% · Waste: ${wastePct}%</p>
      <div class="legend">
        <span><span class="swatch" style="background:#ddd6fe"></span>Normal</span>
        <span><span class="swatch" style="background:#bfdbfe"></span>Rotated</span>
        <span><span class="swatch" style="background:#fde68a"></span>Grain-locked</span>
      </div>
      ${sheetsHtml}
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[960px] max-h-[92vh] overflow-y-auto scrollbar-warm">
        <DialogTitle className="flex items-center gap-2 text-base font-bold">
          <Layers className="h-4 w-4 text-primary" />
          Nesting Layout — {panelName}
        </DialogTitle>
        <DialogDescription>
          Guillotine shelf packing using cut dimensions. Respects grain direction.
        </DialogDescription>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3 py-2 border-b pb-3">
          <div className="space-y-1">
            <Label className="text-xs">Sheet Size</Label>
            <Select value={sheetSize.label} onValueChange={(v) => {
              const s = STANDARD_SHEETS.find((s) => s.label === v);
              if (s) setSheetSize(s);
            }}>
              <SelectTrigger className="h-9 w-56 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STANDARD_SHEETS.map((s) => <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Saw Blade (mm)</Label>
            <Input type="number" min="0" step="0.5" value={sawBlade} onChange={(e) => setSawBlade(e.target.value)} className="h-9 w-24 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Trim Edge (mm)</Label>
            <Input type="number" min="0" step="1" value={trimEdge} onChange={(e) => setTrimEdge(e.target.value)} className="h-9 w-24 text-xs" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={printNesting} disabled={sheets.length === 0}>
              <Printer className="mr-1.5 h-4 w-4" /> Print Layout
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Parts" value={String(totalPartsCount)} />
          <Stat label="Sheets" value={String(sheets.length)} />
          <Stat label="Yield" value={`${(100 - Number(wastePct)).toFixed(1)}%`} tone="good" />
          <Stat label="Waste" value={`${wastePct}%`} tone="warn" />
          <Stat label="Unplaced" value={String(unplaced.length)} tone={unplaced.length > 0 ? "bad" : "good"} />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-violet-400 bg-violet-200" />
            Normal
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-blue-400 bg-blue-200" />
            Rotated
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-amber-500 bg-amber-200" />
            Grain-locked
          </span>
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
            <GitBranch className="h-3 w-3" /> No rotation
          </span>
        </div>

        {unplaced.length > 0 && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-400">
            ⚠ {unplaced.length} part(s) could not fit on the selected sheet size:
            {" "}
            {unplaced.slice(0, 6).map((p) => `${p.part} (${p.length}×${p.width})`).join(", ")}
            {unplaced.length > 6 && ` … +${unplaced.length - 6} more`}
            . Try a larger sheet or reduce part count.
          </div>
        )}

        <Separator />

        {/* Sheet layouts */}
        <div className="space-y-4">
          {sheets.map((sheet, si) => {
            const usedPct = ((sheet.usedArea / (sheet.length * sheet.width)) * 100).toFixed(1);
            const maxW = 760;
            const scale = Math.min(maxW / sheet.length, 360 / sheet.width);
            const trimEdgeNum = Number(trimEdge) || 0;

            return (
              <div key={si} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-semibold">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">
                      Sheet {si + 1}
                    </span>
                    <Scissors className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono text-xs text-muted-foreground">
                      {sheet.length} × {sheet.width} mm
                    </span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{sheet.parts.length} parts</Badge>
                    <Badge variant="outline" className="text-[10px] text-emerald-600">{usedPct}% used</Badge>
                  </div>
                </div>
                {/* SVG layout */}
                <div className="overflow-x-auto">
                  <svg
                    width={sheet.length * scale}
                    height={sheet.width * scale}
                    style={{ border: "2px solid #475569", background: "#f8fafc" }}
                  >
                    {/* Trim area (hatched) */}
                    {trimEdgeNum > 0 && (
                      <>
                        <rect x={0} y={0} width={sheet.length * scale} height={trimEdgeNum * scale} fill="#fee2e2" opacity={0.4} />
                        <rect x={0} y={(sheet.width - trimEdgeNum) * scale} width={sheet.length * scale} height={trimEdgeNum * scale} fill="#fee2e2" opacity={0.4} />
                        <rect x={0} y={0} width={trimEdgeNum * scale} height={sheet.width * scale} fill="#fee2e2" opacity={0.4} />
                        <rect x={(sheet.length - trimEdgeNum) * scale} y={0} width={trimEdgeNum * scale} height={sheet.width * scale} fill="#fee2e2" opacity={0.4} />
                      </>
                    )}
                    {sheet.parts.map((p) => {
                      const fill = p.grain ? "#fde68a" : p.rotated ? "#bfdbfe" : "#ddd6fe";
                      const stroke = p.grain ? "#b45309" : p.rotated ? "#1d4ed8" : "#6d28d9";
                      return (
                        <g key={p.id}>
                          <rect
                            x={p.x * scale}
                            y={p.y * scale}
                            width={p.length * scale}
                            height={p.width * scale}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth="1"
                          />
                          {scale * Math.min(p.length, p.width) > 30 && (
                            <text
                              x={(p.x + p.length / 2) * scale}
                              y={(p.y + p.width / 2) * scale - 4}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={Math.max(7, Math.min(10, scale * 7))}
                              fill="#1e293b"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {p.part.slice(0, 14)}
                            </text>
                          )}
                          {scale * Math.min(p.length, p.width) > 30 && (
                            <text
                              x={(p.x + p.length / 2) * scale}
                              y={(p.y + p.width / 2) * scale + 6}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={Math.max(6, Math.min(8, scale * 6))}
                              fill="#475569"
                              fontFamily="monospace"
                            >
                              {p.length}×{p.width}{p.rotated ? " ↻" : p.grain ? " ⧈" : ""}
                            </text>
                          )}
                        </g>
                      );
                    })}
                    {/* Dimension labels */}
                    <text x={(sheet.length * scale) / 2} y={11} textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="monospace">
                      ← {sheet.length} mm →
                    </text>
                    <text x={9} y={(sheet.width * scale) / 2} textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="monospace" transform={`rotate(-90 9 ${(sheet.width * scale) / 2})`}>
                      ← {sheet.width} mm →
                    </text>
                  </svg>
                </div>
                {/* Part list for this sheet */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {sheet.parts.map((p) => (
                    <span key={p.id} className={`rounded px-1.5 py-0.5 text-[9px] font-mono ${
                      p.grain
                        ? "bg-amber-100 text-amber-800"
                        : p.rotated
                          ? "bg-blue-100 text-blue-800"
                          : "bg-violet-100 text-violet-800"
                    }`}>
                      {p.part} ({p.length}×{p.width}{p.rotated ? " ↻" : p.grain ? " ⧈" : ""})
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  const color =
    tone === "good" ? "text-emerald-600" :
    tone === "warn" ? "text-amber-600" :
    tone === "bad" ? "text-red-600" :
    "text-foreground";
  return (
    <div className="rounded-lg border border-border p-2.5 text-center">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
