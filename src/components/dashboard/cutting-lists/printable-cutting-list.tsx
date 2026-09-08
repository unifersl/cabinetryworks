"use client";

import * as React from "react";
import type { CuttingListItem } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  Calendar,
} from "lucide-react";

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

  const totalPieces = data.items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const totalArea = data.items.reduce((s, i) => {
    const l = parseFloat(i.length) || 0;
    const w = parseFloat(i.width) || 0;
    return s + l * w * (Number(i.qty) || 0);
  }, 0);

  function handlePrint() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="no-print sm:max-w-[800px]">
        <DialogTitle className="sr-only">Print cutting list</DialogTitle>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Cutting List Preview</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
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
        <div className="max-h-[70vh] overflow-y-auto scrollbar-warm rounded-lg border border-border p-6">
          <PrintContent data={data} totalPieces={totalPieces} totalArea={totalArea} />
        </div>
      </DialogContent>

      {/* Print-only version — renders at top level when printing */}
      <div className="print-only">
        <PrintContent data={data} totalPieces={totalPieces} totalArea={totalArea} />
      </div>
    </Dialog>
  );
}

function PrintContent({
  data,
  totalPieces,
  totalArea,
}: {
  data: PrintableCuttingListProps["data"];
  totalPieces: number;
  totalArea: number;
}) {
  if (!data) return null;

  return (
    <div className="print-page mx-auto max-w-2xl space-y-4 p-4">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-primary pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Hammer className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">CabinetryWorks</h1>
            <p className="text-xs text-muted-foreground">
              Kitchen &amp; Cabinetry Manufacturing
            </p>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p className="font-mono text-sm font-bold text-foreground">
            CUTTING LIST
          </p>
          <p>
            {new Date(data.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Job info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[10px] font-medium uppercase text-muted-foreground">
            Job Order
          </p>
          <p className="font-mono text-sm font-bold text-primary">
            {data.jobOrderNumber}
          </p>
          <p className="text-sm">{data.jobTitle}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[10px] font-medium uppercase text-muted-foreground">
            Customer
          </p>
          <p className="text-sm font-medium">{data.customerName}</p>
          <p className="text-xs text-muted-foreground">
            Created by {data.createdBy}
          </p>
        </div>
      </div>

      {/* Panel info */}
      <div className="flex items-center gap-4 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{data.panelName}</span>
        </div>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-sm text-muted-foreground">
          Material: <span className="font-medium text-foreground">{data.material}</span>
        </span>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-sm text-muted-foreground">
          {data.items.length} part types · {totalPieces} pieces total
        </span>
      </div>

      {/* Parts table */}
      <Table>
        <TableHeader>
          <TableRow className="border-2 border-primary bg-primary/5">
            <TableHead className="w-10 text-center">#</TableHead>
            <TableHead>Part Name</TableHead>
            <TableHead className="text-center">Qty</TableHead>
            <TableHead>Length</TableHead>
            <TableHead>Width</TableHead>
            <TableHead>Thickness</TableHead>
            <TableHead>Edge Banding</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((item, i) => (
            <TableRow key={i} className="border-border">
              <TableCell className="text-center text-xs text-muted-foreground">
                {i + 1}
              </TableCell>
              <TableCell className="font-medium">{item.part}</TableCell>
              <TableCell className="text-center font-bold tabular-nums">
                {item.qty}
              </TableCell>
              <TableCell className="tabular-nums">{item.length}</TableCell>
              <TableCell className="tabular-nums">{item.width}</TableCell>
              <TableCell className="tabular-nums">{item.thickness}</TableCell>
              <TableCell>{item.edge ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Summary footer */}
      <div className="flex items-center justify-between border-t-2 border-border pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>
            Total parts:{" "}
            <span className="font-bold text-foreground">{data.items.length}</span>
          </span>
          <span>
            Total pieces:{" "}
            <span className="font-bold text-foreground">{totalPieces}</span>
          </span>
          {totalArea > 0 && (
            <span>
              Total area:{" "}
              <span className="font-bold text-foreground">
                {(totalArea / 1_000_000).toFixed(2)} m²
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
          {new Date(data.createdAt).toLocaleString()}
        </div>
      </div>

      {/* Signature lines */}
      <div className="grid grid-cols-2 gap-8 pt-12">
        <div>
          <div className="border-t border-foreground pt-1">
            <p className="text-[10px] uppercase text-muted-foreground">
              Prepared by
            </p>
            <p className="text-sm font-medium">{data.createdBy}</p>
          </div>
        </div>
        <div>
          <div className="border-t border-foreground pt-1">
            <p className="text-[10px] uppercase text-muted-foreground">
              Cutting station — received
            </p>
            <p className="text-sm">&nbsp;</p>
          </div>
        </div>
      </div>

      <p className="pt-4 text-center text-[10px] text-muted-foreground">
        CabinetryWorks · Internal Manufacturing Document · Generated{" "}
        {new Date().toLocaleString()}
      </p>
    </div>
  );
}
