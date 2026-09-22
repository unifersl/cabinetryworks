"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cuttingListsApi, jobsApi } from "@/lib/api";
import type { CuttingListItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus,
  Scissors,
  Loader2,
  X,
  Trash2,
  FileText,
  Package,
  Calendar,
  Printer,
  Layers,
  GitBranch,
} from "lucide-react";
import { PrintableCuttingList } from "../cutting-lists/printable-cutting-list";
import { NestingDialog } from "../cutting-lists/nesting-dialog";
import { EdgeBandingSelector } from "../cutting-lists/edge-banding-selector";
import {
  cutLength,
  cutWidth,
  bandingDeltaLength,
  bandingDeltaWidth,
  hasBanding,
  edgeThickness,
  fmtMm,
} from "@/lib/cutting";

const MATERIALS = ["MDF", "Plywood", "Particle Board", "Solid Wood", "Acrylic"];
const STATUS_BADGE: Record<string, string> = {
  Draft: "bg-zinc-500/15 text-zinc-600 border-zinc-500/30",
  Submitted: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  "In Cutting": "bg-rose-500/15 text-rose-700 border-rose-500/30",
  Done: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
};

export function CuttingListsView() {
  const { data, isLoading } = useQuery({
    queryKey: ["cutting-lists"],
    queryFn: () => cuttingListsApi.list(),
  });
  const [printData, setPrintData] = React.useState<{
    panelName: string;
    material: string;
    jobOrderNumber: string;
    jobTitle: string;
    customerName: string;
    items: import("@/lib/types").CuttingListItem[];
    createdAt: string;
    createdBy: string;
  } | null>(null);
  const [printOpen, setPrintOpen] = React.useState(false);
  const [nestingOpen, setNestingOpen] = React.useState(false);
  const [nestingItems, setNestingItems] = React.useState<CuttingListItem[]>([]);
  const [nestingPanelName, setNestingPanelName] = React.useState("");

  function exportCuttingListCsv(items: CuttingListItem[], panelName: string) {
    const headers = ["Part", "Qty", "Length", "Width", "Thickness", "Edge Banding"];
    const rows = items.map((i) => [
      i.part,
      i.qty,
      i.length,
      i.width,
      i.thickness,
      i.edge ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cutting-list-${panelName ?? "list"}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Cutting list exported as CSV");
  }
  const [open, setOpen] = React.useState(false);
  const lists = data?.cuttingLists ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Scissors className="h-5 w-5 text-primary" />
            Factory Cutting Lists
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generate factory-ready cut lists for the production line.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={() => setOpen(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            New Cutting List
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading cutting lists…
        </div>
      ) : lists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <Scissors className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No cutting lists yet</p>
              <p className="text-sm text-muted-foreground">
                Create a cutting list for a job order.
              </p>
            </div>
            <Button onClick={() => setOpen(true)} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              New Cutting List
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {lists.map((cl) => {
            let items: CuttingListItem[] = [];
            try {
              items = cl.items ? JSON.parse(cl.items) : [];
            } catch {
              items = [];
            }
            const totalParts = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
            return (
              <Card key={cl.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Package className="h-4 w-4 text-primary" />
                        {cl.panelName ?? "Cutting List"} ·{" "}
                        <span className="font-mono text-xs text-primary">
                          {cl.job?.orderNumber}
                        </span>
                      </CardTitle>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-3">
                        <span>{cl.job?.title}</span>
                        {cl.material && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {cl.material}
                          </span>
                        )}
                        {cl.createdAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(cl.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPrintData({
                            panelName: cl.panelName ?? "Cutting List",
                            material: cl.material ?? "Unspecified",
                            jobOrderNumber: cl.job?.orderNumber ?? "",
                            jobTitle: cl.job?.title ?? "",
                            customerName: "",
                            items,
                            createdAt: cl.createdAt ?? new Date().toISOString(),
                            createdBy: cl.createdBy?.fullName ?? "Unknown",
                          });
                          setPrintOpen(true);
                        }}
                        disabled={items.length === 0}
                      >
                        <Printer className="mr-1.5 h-3.5 w-3.5" />
                        Print
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNestingItems(items);
                          setNestingPanelName(cl.panelName ?? "Cutting List");
                          setNestingOpen(true);
                        }}
                        disabled={items.length === 0}
                      >
                        <Layers className="mr-1.5 h-3.5 w-3.5" />
                        Nesting
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          exportCuttingListCsv(items, cl.panelName ?? "list")
                        }
                        disabled={items.length === 0}
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        CSV
                      </Button>
                      <Badge variant="outline" className={STATUS_BADGE[cl.status]}>
                        {cl.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No line items recorded.
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-auto scrollbar-warm rounded-md border">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                          <TableRow>
                            <TableHead className="min-w-[160px]">Part</TableHead>
                            <TableHead className="text-center min-w-[60px]">Qty</TableHead>
                            <TableHead className="min-w-[90px]">Finish L×W</TableHead>
                            <TableHead className="min-w-[100px]">Cut L×W</TableHead>
                            <TableHead className="min-w-[80px]">Thk</TableHead>
                            <TableHead className="min-w-[130px]">Edge Banding</TableHead>
                            <TableHead className="min-w-[60px] text-center">Grain</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((it, i) => {
                            const cL = cutLength(it);
                            const cW = cutWidth(it);
                            const hasBand = hasBanding(it);
                            const dL = bandingDeltaLength(it);
                            const dW = bandingDeltaWidth(it);
                            const differs = dL > 0 || dW > 0;
                            return (
                              <TableRow key={i} className={`hover:bg-muted/50 transition-colors ${i % 2 === 1 ? "bg-muted/40" : ""}`}>
                                <TableCell className="font-medium">
                                  {it.part}
                                  {it.note ? (
                                    <span className="block text-[10px] text-muted-foreground">
                                      {it.note}
                                    </span>
                                  ) : null}
                                </TableCell>
                                <TableCell className="text-center tabular-nums">
                                  {it.qty}
                                </TableCell>
                                <TableCell className="tabular-nums text-xs">
                                  {it.length} × {it.width}
                                </TableCell>
                                <TableCell className="tabular-nums text-xs">
                                  <span className={differs ? "font-semibold text-primary" : ""}>
                                    {fmtMm(cL)} × {fmtMm(cW)}
                                  </span>
                                  {differs && (
                                    <span className="block text-[9px] text-amber-600 dark:text-amber-400">
                                      −{dL}/{dW}mm banding
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="tabular-nums text-xs">
                                  {it.thickness}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {hasBand ? (
                                    <span className="inline-flex items-center gap-1">
                                      <span className="font-mono text-[10px] text-primary">
                                        {edgeThickness(it)}mm
                                      </span>
                                      <span className="font-mono text-[9px] text-muted-foreground">
                                        [
                                        {[
                                          it.edgeLong1 ? "L1" : "",
                                          it.edgeLong2 ? "L2" : "",
                                          it.edgeShort1 ? "S1" : "",
                                          it.edgeShort2 ? "S2" : "",
                                        ].filter(Boolean).join(" ") || "—"}
                                        ]
                                      </span>
                                    </span>
                                  ) : it.edge && it.edge !== "—" ? (
                                    <span className="text-muted-foreground">{it.edge}</span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {it.grain ? (
                                    <GitBranch className="h-3.5 w-3.5 inline text-amber-600" />
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {items.length} part types · {totalParts} total pieces
                    </span>
                    <span>Created by {cl.createdBy?.fullName ?? "—"}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateCuttingListDialog open={open} onOpenChange={setOpen} />

      <PrintableCuttingList
        open={printOpen}
        onOpenChange={setPrintOpen}
        data={printData}
      />

      <NestingDialog
        open={nestingOpen}
        onOpenChange={setNestingOpen}
        items={nestingItems}
        panelName={nestingPanelName}
      />
    </div>
  );
}

function CreateCuttingListDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: jobsData } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => jobsApi.list(),
  });
  const [jobId, setJobId] = React.useState("");
  const [panelName, setPanelName] = React.useState("");
  const [material, setMaterial] = React.useState("MDF");
  const [items, setItems] = React.useState<CuttingListItem[]>([
    { part: "", qty: 1, length: "", width: "", thickness: "18mm", edgeThk: 1 },
  ]);

  function updateItem(i: number, patch: Partial<CuttingListItem>) {
    setItems((arr) =>
      arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    );
  }
  function addItem() {
    setItems((arr) => [
      ...arr,
      { part: "", qty: 1, length: "", width: "", thickness: "18mm", edgeThk: 1 },
    ]);
  }
  function removeItem(i: number) {
    setItems((arr) => arr.filter((_, idx) => idx !== i));
  }

  const create = useMutation({
    mutationFn: () =>
      cuttingListsApi.create({
        jobId,
        panelName: panelName || undefined,
        material,
        items: items.filter((i) => i.part.trim()),
        status: "Submitted",
      }),
    onSuccess: () => {
      toast.success("Cutting list created");
      setJobId("");
      setPanelName("");
      setMaterial("MDF");
      setItems([
        { part: "", qty: 1, length: "", width: "", thickness: "18mm", edgeThk: 1 },
      ]);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["cutting-lists"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Live totals
  const livePieces = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const liveAreaM2 =
    items.reduce((s, i) => {
      const l = cutLength(i);
      const w = cutWidth(i);
      return s + (l * w * (Number(i.qty) || 0)) / 1_000_000;
    }, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[920px] max-h-[92vh] overflow-y-auto scrollbar-warm">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Scissors className="h-4 w-4 text-primary" />
                New Cutting List
              </DialogTitle>
              <DialogDescription>
                Define panel parts for the factory cutting station. Cut dimensions
                auto-calculate from edge banding.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!jobId) {
              toast.error("Please select a job");
              return;
            }
            if (!items.some((i) => i.part.trim())) {
              toast.error("Add at least one part");
              return;
            }
            create.mutate();
          }}
          className="space-y-4"
        >
          {/* Header row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Job <span className="text-destructive">*</span>
              </Label>
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select job" />
                </SelectTrigger>
                <SelectContent>
                  {(jobsData?.jobs ?? []).map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.orderNumber} — {j.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-panel" className="text-xs">Panel Name</Label>
              <Input
                id="cl-panel"
                className="h-9"
                placeholder="e.g. Base cabinets"
                value={panelName}
                onChange={(e) => setPanelName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Material</Label>
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATERIALS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Parts table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                Parts
                <span className="ml-2 text-muted-foreground font-normal">
                  (enter finished sizes — cut size auto-reduces by banding)
                </span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add part
              </Button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[28px_1.6fr_44px_0.8fr_0.8fr_0.55fr_0.95fr_28px] items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="text-center">#</span>
              <span>Part Name</span>
              <span className="text-center">Qty</span>
              <span className="text-center">Finish L</span>
              <span className="text-center">Finish W</span>
              <span className="text-center">Thk</span>
              <span className="text-center">Edge Banding</span>
              <span></span>
            </div>

            <div className="max-h-[44vh] space-y-1.5 overflow-y-auto scrollbar-warm rounded-md border p-2">
              {items.map((it, i) => {
                const cL = cutLength(it);
                const cW = cutWidth(it);
                const dL = bandingDeltaLength(it);
                const dW = bandingDeltaWidth(it);
                const differs = dL > 0 || dW > 0;
                return (
                  <div
                    key={i}
                    className="rounded border border-border/60 p-2 hover:border-primary/30 transition-colors"
                  >
                    {/* Main row */}
                    <div className="grid grid-cols-[28px_1.6fr_44px_0.8fr_0.8fr_0.55fr_0.95fr_28px] items-center gap-1.5">
                      <span className="text-center font-mono text-xs font-semibold text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Part name (e.g. Side panel LH)"
                        value={it.part}
                        onChange={(e) => updateItem(i, { part: e.target.value })}
                      />
                      <Input
                        className="h-8 text-center text-xs tabular-nums"
                        type="number"
                        min={1}
                        value={it.qty}
                        onChange={(e) => updateItem(i, { qty: Number(e.target.value) })}
                      />
                      <Input
                        className="h-8 text-xs tabular-nums"
                        placeholder="720mm"
                        value={it.length}
                        onChange={(e) => updateItem(i, { length: e.target.value })}
                      />
                      <Input
                        className="h-8 text-xs tabular-nums"
                        placeholder="580mm"
                        value={it.width}
                        onChange={(e) => updateItem(i, { width: e.target.value })}
                      />
                      <Input
                        className="h-8 text-xs tabular-nums"
                        placeholder="18mm"
                        value={it.thickness}
                        onChange={(e) => updateItem(i, { thickness: e.target.value })}
                      />
                      <div className="flex items-center justify-center">
                        <EdgeBandingMini
                          value={it}
                          onChange={(patch) => updateItem(i, patch)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => removeItem(i)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Cut-dimension preview row */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-9 text-[10px]">
                      <span className="text-muted-foreground">
                        Cut size:
                      </span>
                      <span className={`font-mono font-semibold ${differs ? "text-primary" : "text-foreground"}`}>
                        {fmtMm(cL)} × {fmtMm(cW)}
                      </span>
                      {differs && (
                        <span className="text-amber-600 dark:text-amber-400">
                          (−{dL}L / −{dW}W banding)
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => updateItem(i, { grain: !it.grain })}
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
                          it.grain
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : "bg-muted text-muted-foreground hover:bg-muted/70"
                        }`}
                        title="Grain direction matters — disable rotation in nesting"
                      >
                        <GitBranch className="h-2.5 w-2.5" />
                        {it.grain ? "Grain locked" : "Grain: any"}
                      </button>
                      <input
                        type="text"
                        placeholder="note (optional)"
                        value={it.note ?? ""}
                        onChange={(e) => updateItem(i, { note: e.target.value })}
                        className="h-5 flex-1 min-w-[80px] rounded border border-border/60 bg-transparent px-1.5 text-[10px] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
            <div className="flex items-center gap-4">
              <span>
                <span className="text-muted-foreground">Parts:</span>{" "}
                <span className="font-bold">{items.filter((i) => i.part.trim()).length}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Total pieces:</span>{" "}
                <span className="font-bold">{livePieces}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Material area:</span>{" "}
                <span className="font-bold">{liveAreaM2.toFixed(2)} m²</span>
              </span>
            </div>
            <span className="text-muted-foreground">
              Cut size = finish size − (banded edges × banding thickness)
            </span>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Scissors className="mr-2 h-4 w-4" />
              )}
              Generate List
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Compact inline edge-banding selector for the parts table. */
function EdgeBandingMini({
  value,
  onChange,
}: {
  value: CuttingListItem;
  onChange: (patch: Partial<CuttingListItem>) => void;
}) {
  const thk = value.edgeThk ?? 1;
  const any =
    value.edgeLong1 || value.edgeLong2 || value.edgeShort1 || value.edgeShort2;
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-[9px] font-mono font-semibold transition-colors ${
          any
            ? "bg-primary/15 text-primary hover:bg-primary/25"
            : "bg-muted text-muted-foreground hover:bg-muted/70"
        }`}
      >
        {any ? (
          <>
            <span className="inline-flex h-2 w-2 rotate-45 rounded-sm border border-primary bg-primary/40" />
            {thk}mm
          </>
        ) : (
          "—"
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover p-3 shadow-lg">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Edge Banding
          </div>
          <EdgeBandingSelector
            value={value}
            onChange={(v) => onChange(v)}
          />
          <div className="mt-2 flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Tap edges to toggle</span>
            <button
              type="button"
              onClick={() =>
                onChange({
                  edgeLong1: false,
                  edgeLong2: false,
                  edgeShort1: false,
                  edgeShort2: false,
                  edgeThk: 1,
                })
              }
              className="text-destructive hover:underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
