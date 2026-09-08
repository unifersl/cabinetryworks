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
} from "lucide-react";
import { PrintableCuttingList } from "../cutting-lists/printable-cutting-list";
import { NestingDialog } from "../cutting-lists/nesting-dialog";

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            Factory Cutting Lists
          </h1>
          <p className="text-sm text-muted-foreground">
            Generate factory-ready cut lists for the production line.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          New Cutting List
        </Button>
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
                            <TableHead className="min-w-[90px]">Length</TableHead>
                            <TableHead className="min-w-[90px]">Width</TableHead>
                            <TableHead className="min-w-[90px]">Thickness</TableHead>
                            <TableHead className="min-w-[110px]">Edge Banding</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((it, i) => (
                            <TableRow key={i} className={`hover:bg-muted/50 ${i % 2 === 1 ? "bg-muted/40" : ""}`}>
                              <TableCell className="font-medium">
                                {it.part}
                              </TableCell>
                              <TableCell className="text-center tabular-nums">
                                {it.qty}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {it.length}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {it.width}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {it.thickness}
                              </TableCell>
                              <TableCell>{it.edge ?? "—"}</TableCell>
                            </TableRow>
                          ))}
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
    { part: "", qty: 1, length: "", width: "", thickness: "18mm", edge: "" },
  ]);

  function updateItem(i: number, patch: Partial<CuttingListItem>) {
    setItems((arr) =>
      arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
    );
  }
  function addItem() {
    setItems((arr) => [
      ...arr,
      { part: "", qty: 1, length: "", width: "", thickness: "18mm", edge: "" },
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
        { part: "", qty: 1, length: "", width: "", thickness: "18mm", edge: "" },
      ]);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["cutting-lists"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[640px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>New Cutting List</DialogTitle>
              <DialogDescription>
                Define panel parts for the factory cutting station.
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label>
                Job <span className="text-destructive">*</span>
              </Label>
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select job" />
                </SelectTrigger>
                <SelectContent>
                  {(jobsData?.jobs ?? []).map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.orderNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cl-panel">Panel Name</Label>
              <Input
                id="cl-panel"
                placeholder="e.g. Base cabinets"
                value={panelName}
                onChange={(e) => setPanelName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Material</Label>
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Parts</Label>
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
            <div className="max-h-56 space-y-1.5 overflow-y-auto scrollbar-warm rounded-md border p-2">
              {/* Column headers */}
              <div className="grid grid-cols-[28px_1fr_52px_1fr_1fr_1fr_28px] items-center gap-1.5 px-1 pb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>#</span>
                <span>Part Name</span>
                <span className="text-center">Qty</span>
                <span>Length</span>
                <span>Width</span>
                <span>Thk</span>
                <span></span>
              </div>
              {items.map((it, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[28px_1fr_52px_1fr_1fr_1fr_28px] items-center gap-1.5 rounded border border-border/60 p-1 hover:border-primary/30 transition-colors"
                >
                  <span className="text-center font-mono text-xs font-semibold text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Part name"
                    value={it.part}
                    onChange={(e) =>
                      updateItem(i, { part: e.target.value })
                    }
                  />
                  <Input
                    className="h-8 text-center text-xs tabular-nums"
                    type="number"
                    min={1}
                    value={it.qty}
                    onChange={(e) =>
                      updateItem(i, { qty: Number(e.target.value) })
                    }
                  />
                  <Input
                    className="h-8 text-xs tabular-nums"
                    placeholder="L mm"
                    value={it.length}
                    onChange={(e) =>
                      updateItem(i, { length: e.target.value })
                    }
                  />
                  <Input
                    className="h-8 text-xs tabular-nums"
                    placeholder="W mm"
                    value={it.width}
                    onChange={(e) =>
                      updateItem(i, { width: e.target.value })
                    }
                  />
                  <Input
                    className="h-8 text-xs tabular-nums"
                    placeholder="Thk"
                    value={it.thickness}
                    onChange={(e) =>
                      updateItem(i, { thickness: e.target.value })
                    }
                  />
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
              ))}
            </div>
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
