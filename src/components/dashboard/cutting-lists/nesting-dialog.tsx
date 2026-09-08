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
import { toast } from "sonner";
import { Layers, Printer, X } from "lucide-react";

// Standard sheet sizes
const SHEET_SIZES = [
  { label: "2440 × 1220 mm (8×4 ft)", length: 2440, width: 1220 },
  { label: "2440 × 1830 mm (8×6 ft)", length: 2440, width: 1830 },
  { label: "1830 × 1220 mm (6×4 ft)", length: 1830, width: 1220 },
  { label: "3660 × 1830 mm (12×6 ft)", length: 3660, width: 1830 },
];

// Parse dimension string like "580mm" or "580 mm" → 580
function parseDim(s: string | number): number {
  if (typeof s === "number") return s;
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

interface NestPart {
  id: number;
  part: string;
  length: number;
  width: number;
  qty: number;
  x: number;
  y: number;
  rotated: boolean;
  sheetIndex: number;
}

interface Sheet {
  index: number;
  length: number;
  width: number;
  parts: NestPart[];
  usedArea: number;
}

// Simple first-fit decreasing (FFD) bin packing algorithm
function runNesting(items: CuttingListItem[], sheetLength: number, sheetWidth: number, sawBlade: number): Sheet[] {
  // Expand items by quantity into individual parts
  const allParts: Array<{ id: number; part: string; length: number; width: number }> = [];
  let id = 0;
  for (const item of items) {
    const l = parseDim(item.length);
    const w = parseDim(item.width);
    for (let q = 0; q < (item.qty || 1); q++) {
      allParts.push({ id: id++, part: item.part, length: l, width: w });
    }
  }

  // Sort parts by area descending (largest first)
  allParts.sort((a, b) => (b.length * b.width) - (a.length * a.width));

  const sheets: Sheet[] = [];
  const blade = sawBlade;

  for (const part of allParts) {
    let placed = false;

    // Try to fit in existing sheets
    for (const sheet of sheets) {
      const result = tryPlace(part, sheet, blade);
      if (result) {
        sheet.parts.push(result);
        sheet.usedArea += result.length * result.width;
        placed = true;
        break;
      }
    }

    // If not placed, create a new sheet
    if (!placed) {
      const newSheet: Sheet = {
        index: sheets.length,
        length: sheetLength,
        width: sheetWidth,
        parts: [],
        usedArea: 0,
      };
      const result = tryPlace(part, newSheet, blade);
      if (result) {
        newSheet.parts.push(result);
        newSheet.usedArea += result.length * result.width;
        sheets.push(newSheet);
      }
    }
  }

  return sheets;
}

// Try to place a part on a sheet using a simple shelf/guillotine approach
function tryPlace(
  part: { id: number; part: string; length: number; width: number },
  sheet: Sheet,
  blade: number,
): NestPart | null {
  const { length: pl, width: pw } = part;
  const sl = sheet.length;
  const sw = sheet.width;

  // Try both orientations
  for (const rotated of [false, true]) {
    const l = rotated ? pw : pl;
    const w = rotated ? pl : pw;

    if (l > sl || w > sw) continue;

    // Simple shelf packing: scan for available space
    // Start from top-left, move right then down
    let bestX = -1;
    let bestY = -1;

    for (let y = 0; y <= sw - w; y += 5) {
      for (let x = 0; x <= sl - l; x += 5) {
        if (!overlaps(sheet, x, y, l, w, blade)) {
          bestX = x;
          bestY = y;
          break;
        }
      }
      if (bestX >= 0) break;
    }

    if (bestX >= 0) {
      return {
        id: part.id,
        part: part.part,
        length: l,
        width: w,
        qty: 1,
        x: bestX,
        y: bestY,
        rotated,
        sheetIndex: sheet.index,
      };
    }
  }

  return null;
}

function overlaps(sheet: Sheet, x: number, y: number, l: number, w: number, blade: number): boolean {
  for (const p of sheet.parts) {
    const px = p.x;
    const py = p.y;
    const pl = p.length;
    const pw = p.width;
    // Check if rectangles overlap (with blade gap)
    if (x < px + pl + blade && x + l + blade > px && y < py + pw + blade && y + w + blade > py) {
      return true;
    }
  }
  return false;
}

interface NestingDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: CuttingListItem[];
  panelName: string;
}

export function NestingDialog({ open, onOpenChange, items, panelName }: NestingDialogProps) {
  const [sheetSize, setSheetSize] = React.useState(SHEET_SIZES[0]);
  const [sawBlade, setSawBlade] = React.useState("3");
  const [sheets, setSheets] = React.useState<Sheet[]>([]);

  React.useEffect(() => {
    if (open && items.length > 0) {
      const blade = Number(sawBlade) || 3;
      const result = runNesting(items, sheetSize.length, sheetSize.width, blade);
      setSheets(result);
    }
  }, [open, items, sheetSize, sawBlade]);

  function printNesting() {
    const w = window.open("", "_blank");
    if (!w) return;
    const sheetsHtml = sheets.map((sheet, si) => {
      const parts = sheet.parts.map((p) => {
        const xPct = (p.x / sheet.length) * 100;
        const yPct = (p.y / sheet.width) * 100;
        const wPct = (p.length / sheet.length) * 100;
        const hPct = (p.width / sheet.width) * 100;
        return `<div style="position:absolute;left:${xPct}%;top:${yPct}%;width:${wPct}%;height:${hPct}%;border:1px solid #1e293b;background:${p.rotated ? "#dbeafe" : "#e0e7ff"};display:flex;align-items:center;justify-content:center;font-size:7pt;color:#1e293b;font-family:monospace;overflow:hidden;">
          ${p.part}<br>${p.length}×${p.width}
        </div>`;
      }).join("");
      const usedPct = ((sheet.usedArea / (sheet.length * sheet.width)) * 100).toFixed(1);
      return `<div style="page-break-after:always;margin-bottom:20px;">
        <h3 style="font-size:11pt;">Sheet ${si + 1} — Used: ${usedPct}%</h3>
        <div style="position:relative;width:100%;aspect-ratio:${sheet.length}/${sheet.width};border:2px solid #475569;background:#f8fafc;">
          ${parts}
        </div>
      </div>`;
    }).join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Nesting Layout — ${panelName}</title>
      <style>@page{size:A4 landscape;margin:10mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial;padding:16px}h1{font-size:14pt}h3{font-size:11pt;margin:8px 0 4px}</style>
      </head><body>
      <h1>Nesting Layout — ${panelName}</h1>
      <p style="font-size:9pt;color:#666">Sheet: ${sheetSize.label} | Saw Blade: ${sawBlade}mm | Parts: ${items.reduce((s,i)=>s+(i.qty||1),0)} | Sheets: ${sheets.length}</p>
      ${sheetsHtml}
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  const totalParts = items.reduce((s, i) => s + (i.qty || 1), 0);
  const totalSheetArea = sheets.length * sheetSize.length * sheetSize.width;
  const totalUsedArea = sheets.reduce((s, sh) => s + sh.usedArea, 0);
  const wastePct = totalSheetArea > 0 ? ((1 - totalUsedArea / totalSheetArea) * 100).toFixed(1) : "0";
  const unplaced = totalParts - sheets.reduce((s, sh) => s + sh.parts.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogTitle className="flex items-center gap-2 text-lg font-bold">
          <Layers className="h-5 w-5 text-primary" />
          Nesting Layout — {panelName}
        </DialogTitle>
        <DialogDescription>
          Auto-arrange cutting parts on standard sheet sizes to minimize waste.
        </DialogDescription>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Sheet Size</Label>
            <Select value={sheetSize.label} onValueChange={(v) => {
              const s = SHEET_SIZES.find((s) => s.label === v);
              if (s) setSheetSize(s);
            }}>
              <SelectTrigger className="h-9 w-64 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SHEET_SIZES.map((s) => <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Saw Blade (mm)</Label>
            <Input type="number" min="0" step="0.5" value={sawBlade} onChange={(e) => setSawBlade(e.target.value)} className="h-9 w-24 text-xs" />
          </div>
          <Button variant="outline" size="sm" onClick={printNesting} disabled={sheets.length === 0} className="ml-auto">
            <Printer className="mr-1.5 h-4 w-4" /> Print Layout
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-lg border border-border p-2.5 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Parts</p>
            <p className="text-lg font-bold">{totalParts}</p>
          </div>
          <div className="rounded-lg border border-border p-2.5 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Sheets</p>
            <p className="text-lg font-bold">{sheets.length}</p>
          </div>
          <div className="rounded-lg border border-border p-2.5 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Material Used</p>
            <p className="text-lg font-bold text-emerald-600">{(100 - Number(wastePct)).toFixed(1)}%</p>
          </div>
          <div className="rounded-lg border border-border p-2.5 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Waste</p>
            <p className="text-lg font-bold text-amber-600">{wastePct}%</p>
          </div>
          <div className="rounded-lg border border-border p-2.5 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Unplaced</p>
            <p className={`text-lg font-bold ${unplaced > 0 ? "text-red-600" : "text-emerald-600"}`}>{unplaced}</p>
          </div>
        </div>

        {unplaced > 0 && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-400">
            ⚠ {unplaced} part(s) could not fit on the selected sheet size. Try a larger sheet or check part dimensions.
          </div>
        )}

        <Separator />

        {/* Sheet layouts */}
        <div className="space-y-4">
          {sheets.map((sheet, si) => {
            const usedPct = ((sheet.usedArea / (sheet.length * sheet.width)) * 100).toFixed(1);
            const scaleX = 700 / sheet.length;
            const scaleY = 350 / sheet.width;
            const scale = Math.min(scaleX, scaleY);

            return (
              <div key={si} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Sheet {si + 1}</h4>
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
                    {sheet.parts.map((p) => (
                      <g key={p.id}>
                        <rect
                          x={p.x * scale}
                          y={p.y * scale}
                          width={p.length * scale}
                          height={p.width * scale}
                          fill={p.rotated ? "#dbeafe" : "#e0e7ff"}
                          stroke="#1e293b"
                          strokeWidth="1"
                        />
                        <text
                          x={(p.x + p.length / 2) * scale}
                          y={(p.y + p.width / 2) * scale}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={Math.max(6, Math.min(10, scale * 8))}
                          fill="#1e293b"
                          fontFamily="monospace"
                        >
                          {p.part.slice(0, 12)} {p.length}×{p.width}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
                {/* Part list for this sheet */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {sheet.parts.map((p) => (
                    <span key={p.id} className={`rounded px-1.5 py-0.5 text-[9px] ${p.rotated ? "bg-blue-100 text-blue-700" : "bg-indigo-100 text-indigo-700"}`}>
                      {p.part} ({p.length}×{p.width}{p.rotated ? " ↻" : ""})
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
