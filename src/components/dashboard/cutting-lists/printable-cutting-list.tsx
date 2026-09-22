"use client";

import * as React from "react";
import type { CuttingListItem } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  X,
  Printer,
  Hammer,
  Package,
  Scissors,
  GitBranch,
} from "lucide-react";
import {
  cutLength,
  cutWidth,
  bandingDeltaLength,
  bandingDeltaWidth,
  hasBanding,
  edgeThickness,
  bandedLongCount,
  bandedShortCount,
  totalPieces,
  totalAreaM2,
  totalBandingLinearM,
  fmtMm,
} from "@/lib/cutting";

interface PrintableCuttingListProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: {
    panelName: string;
    material: string;
    jobOrderNumber: string;
    jobTitle: string;
    customerName: string;
    items: CuttingListItem[];
    createdAt: string;
    createdBy: string;
  } | null;
}

export function PrintableCuttingList({
  open,
  onOpenChange,
  data,
}: PrintableCuttingListProps) {
  if (!data) return null;

  const pieces = totalPieces(data.items);
  const areaM2 = totalAreaM2(data.items);
  const bandingM = totalBandingLinearM(data.items);

  function handlePrint() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="no-print sm:max-w-[900px] max-h-[92vh] overflow-y-auto scrollbar-warm">
        <DialogTitle className="sr-only">Print cutting list</DialogTitle>
        <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10 pb-2 -mt-2 pt-1 border-b">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Printer className="h-4 w-4 text-primary" />
            Cutting List Preview
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print / Save PDF
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-white p-6 text-black print-area">
          <PrintContent data={data} pieces={pieces} areaM2={areaM2} bandingM={bandingM} />
        </div>
      </DialogContent>

      {/* Print-only version — renders at top level when printing */}
      <div className="print-only">
        <PrintContent data={data} pieces={pieces} areaM2={areaM2} bandingM={bandingM} />
      </div>
    </Dialog>
  );
}

function PrintContent({
  data,
  pieces,
  areaM2,
  bandingM,
}: {
  data: PrintableCuttingListProps["data"];
  pieces: number;
  areaM2: number;
  bandingM: number;
}) {
  if (!data) return null;

  const numBandedParts = data.items.filter(hasBanding).length;

  return (
    <div className="print-page mx-auto max-w-3xl space-y-5 p-2 text-[11px] leading-relaxed text-black">
      {/* ── Header ── */}
      <header className="flex items-start justify-between border-b-2 border-black pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-black text-white">
            <Hammer className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">CABINETRYWORKS</h1>
            <p className="text-[9px] uppercase tracking-wider text-gray-600">
              Kitchen &amp; Cabinetry Manufacturing
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="rounded bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white inline-block">
            Cutting List
          </p>
          <p className="mt-1 font-mono text-[10px] text-gray-700">
            {data.jobOrderNumber}
          </p>
          <p className="text-[9px] text-gray-600">
            Issued {new Date(data.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </header>

      {/* ── Job & material info ── */}
      <section className="grid grid-cols-2 gap-2">
        <div className="rounded border border-gray-300 bg-gray-50 p-2.5">
          <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-500">
            Job Order
          </p>
          <p className="font-mono text-xs font-bold">{data.jobOrderNumber}</p>
          <p className="text-[11px]">{data.jobTitle}</p>
          {data.customerName && (
            <p className="mt-0.5 text-[10px] text-gray-700">
              Customer: <span className="font-medium">{data.customerName}</span>
            </p>
          )}
        </div>
        <div className="rounded border border-gray-300 bg-gray-50 p-2.5">
          <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-500">
            Panel Group
          </p>
          <p className="text-xs font-bold">{data.panelName}</p>
          <p className="mt-0.5 text-[10px] text-gray-700">
            Material: <span className="font-medium">{data.material}</span>
          </p>
          <p className="text-[10px] text-gray-700">
            Prepared by {data.createdBy}
          </p>
        </div>
      </section>

      {/* ── Parts table ── */}
      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
            <Scissors className="h-3.5 w-3.5" />
            Parts Schedule
          </h2>
          <p className="text-[9px] text-gray-600">
            {data.items.length} part types · {pieces} pieces
          </p>
        </div>
        <Table className="border-collapse text-[10px]">
          <TableHeader>
            <TableRow className="border border-black bg-black text-white">
              <TableHead className="w-7 border-r border-gray-700 px-1.5 py-1 text-center text-[9px] font-bold text-white">
                #
              </TableHead>
              <TableHead className="border-r border-gray-700 px-2 py-1 text-[9px] font-bold uppercase text-white">
                Part Name
              </TableHead>
              <TableHead className="w-8 border-r border-gray-700 px-1 py-1 text-center text-[9px] font-bold text-white">
                Qty
              </TableHead>
              <TableHead className="w-20 border-r border-gray-700 px-1.5 py-1 text-center text-[9px] font-bold uppercase text-white">
                Finish L × W
              </TableHead>
              <TableHead className="w-24 border-r border-gray-700 px-1.5 py-1 text-center text-[9px] font-bold uppercase text-white">
                Cut L × W
              </TableHead>
              <TableHead className="w-14 border-r border-gray-700 px-1.5 py-1 text-center text-[9px] font-bold uppercase text-white">
                Thk
              </TableHead>
              <TableHead className="w-28 border-r border-gray-700 px-1.5 py-1 text-center text-[9px] font-bold uppercase text-white">
                Edge Banding
              </TableHead>
              <TableHead className="w-10 px-1 py-1 text-center text-[9px] font-bold uppercase text-white">
                Grain
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((it, i) => {
              const cL = cutLength(it);
              const cW = cutWidth(it);
              const dL = bandingDeltaLength(it);
              const dW = bandingDeltaWidth(it);
              const differs = dL > 0 || dW > 0;
              const band = hasBanding(it);
              const t = edgeThickness(it);
              const lg = bandedLongCount(it);
              const sh = bandedShortCount(it);
              return (
                <TableRow key={i} className={`border border-gray-400 ${i % 2 === 1 ? "bg-gray-50" : "bg-white"}`}>
                  <TableCell className="border-r border-gray-300 px-1.5 py-1 text-center font-mono font-bold text-gray-700">
                    {i + 1}
                  </TableCell>
                  <TableCell className="border-r border-gray-300 px-2 py-1 font-medium">
                    {it.part}
                    {it.note && (
                      <span className="block text-[9px] italic text-gray-500">
                        {it.note}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="border-r border-gray-300 px-1 py-1 text-center font-bold tabular-nums">
                    {it.qty}
                  </TableCell>
                  <TableCell className="border-r border-gray-300 px-1.5 py-1 text-center font-mono tabular-nums text-gray-700">
                    {it.length} × {it.width}
                  </TableCell>
                  <TableCell className="border-r border-gray-300 px-1.5 py-1 text-center font-mono tabular-nums">
                    <span className={differs ? "font-bold" : ""}>
                      {fmtMm(cL)} × {fmtMm(cW)}
                    </span>
                    {differs && (
                      <span className="block text-[8px] text-gray-500">
                        −{dL}L/−{dW}W
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="border-r border-gray-300 px-1.5 py-1 text-center tabular-nums">
                    {it.thickness}
                  </TableCell>
                  <TableCell className="border-r border-gray-300 px-1.5 py-1 text-center">
                    {band ? (
                      <span className="font-mono text-[9px]">
                        <span className="font-bold">{t}mm</span>
                        <span className="ml-1 text-gray-600">
                          [
                          {[
                            ["L1", it.edgeLong1],
                            ["L2", it.edgeLong2],
                            ["S1", it.edgeShort1],
                            ["S2", it.edgeShort2],
                          ]
                            .filter(([, v]) => v)
                            .map(([k]) => k)
                            .join(" ")}
                          ]
                        </span>
                        <span className="block text-[8px] text-gray-500">
                          {lg > 0 ? `${lg} long` : ""}
                          {lg > 0 && sh > 0 ? " · " : ""}
                          {sh > 0 ? `${sh} short` : ""}
                        </span>
                      </span>
                    ) : it.edge && it.edge !== "—" ? (
                      <span className="text-gray-500">{it.edge}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-1 py-1 text-center">
                    {it.grain ? (
                      <GitBranch className="mx-auto h-3 w-3 text-amber-700" />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      {/* ── Engineering note ── */}
      <section className="rounded border border-gray-300 bg-amber-50 p-2 text-[9px] leading-snug text-gray-800">
        <p className="font-semibold uppercase tracking-wider text-amber-800">
          Cutting Notes
        </p>
        <ul className="mt-1 ml-3 list-disc space-y-0.5">
          <li>
            <span className="font-medium">Cut size</span> = finished size minus
            edge banding thickness on each banded edge. The saw operator cuts to
            the <span className="font-mono">Cut L × W</span> column, not the
            finish column.
          </li>
          <li>
            Long-edge banding (L1, L2) reduces the cut <span className="font-mono">width</span>;
            short-edge banding (S1, S2) reduces the cut <span className="font-mono">length</span>.
          </li>
          <li>
            Grain-locked parts (<GitBranch className="inline h-2.5 w-2.5" />) must
            not be rotated during nesting — follow the grain direction.
          </li>
          <li>
            Saw blade kerf allowance and sheet trim are applied at the nesting
            stage, not here.
          </li>
        </ul>
      </section>

      {/* ── Summary bar ── */}
      <section className="grid grid-cols-4 gap-2 border-y-2 border-black py-2 text-center">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-500">
            Part Types
          </p>
          <p className="text-base font-bold">{data.items.length}</p>
        </div>
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-500">
            Total Pieces
          </p>
          <p className="text-base font-bold">{pieces}</p>
        </div>
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-500">
            Material Area
          </p>
          <p className="text-base font-bold">{areaM2.toFixed(2)} m²</p>
        </div>
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-500">
            Banding Length
          </p>
          <p className="text-base font-bold">{bandingM.toFixed(1)} m</p>
        </div>
      </section>

      {/* ── Signatures ── */}
      <section className="grid grid-cols-3 gap-6 pt-10">
        <div>
          <div className="border-t border-black pt-1">
            <p className="text-[8px] uppercase tracking-wider text-gray-600">
              Prepared by
            </p>
            <p className="text-[11px] font-medium">{data.createdBy}</p>
          </div>
        </div>
        <div>
          <div className="border-t border-black pt-1">
            <p className="text-[8px] uppercase tracking-wider text-gray-600">
              Cutting station — received
            </p>
            <p className="text-[11px]">&nbsp;</p>
          </div>
        </div>
        <div>
          <div className="border-t border-black pt-1">
            <p className="text-[8px] uppercase tracking-wider text-gray-600">
              QC — checked
            </p>
            <p className="text-[11px]">&nbsp;</p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="flex items-center justify-between border-t border-gray-300 pt-2 text-[8px] text-gray-500">
        <span>
          CabinetryWorks · Internal Manufacturing Document · {numBandedParts} banded part(s)
        </span>
        <span>
          Generated {new Date().toLocaleString()}
        </span>
      </footer>
    </div>
  );
}
