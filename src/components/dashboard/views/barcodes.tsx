// @ts-nocheck
"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  barcodesApi,
  jobsApi,
  inventoryApi,
  type BarcodeLabel,
} from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  QrCode,
  Barcode as BarcodeIcon,
  Plus,
  Loader2,
  Trash2,
  Printer,
  Package,
  Briefcase,
  CheckCircle2,
} from "lucide-react";

const TYPES = [
  { value: "qr", label: "QR Code", icon: QrCode },
  { value: "barcode", label: "Barcode", icon: BarcodeIcon },
];

const TYPE_TINTS: Record<string, string> = {
  qr: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  barcode: "bg-sky-500/15 text-sky-700 border-sky-500/30",
};

interface JobLite {
  id: string;
  orderNumber: string;
  title: string;
}
interface ItemLite {
  id: string;
  name: string;
  code: string | null;
}

/**
 * Deterministic pseudo-QR pattern: builds a N×N grid of black/white modules
 * based on a simple hash of the code string + finder patterns in 3 corners.
 * Purely cosmetic — not a real scannable QR code, but visually similar.
 */
function QrSvg({ value, size = 120 }: { value: string; size?: number }) {
  const N = 21; // module grid size
  const cells: boolean[] = [];
  // Simple deterministic PRNG seeded from the string
  let seed = 0;
  for (let i = 0; i < value.length; i++) {
    seed = (seed * 31 + value.charCodeAt(i)) >>> 0;
  }
  function rand() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }
  for (let i = 0; i < N * N; i++) cells.push(rand() > 0.5);

  // Helper to mark a finder pattern (7×7) at top-left corner (r0, c0)
  const finder = (grid: boolean[][], r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const innerSquare = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[r0 + r][c0 + c] = onBorder || innerSquare;
      }
    }
    // separator (clear ring around finder)
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const onRing = r === -1 || r === 7 || c === -1 || c === 7;
        if (onRing && r0 + r >= 0 && r0 + r < N && c0 + c >= 0 && c0 + c < N) {
          grid[r0 + r][c0 + c] = false;
        }
      }
    }
  };

  const grid: boolean[][] = [];
  for (let r = 0; r < N; r++) grid.push(cells.slice(r * N, r * N + N));
  finder(grid, 0, 0);
  finder(grid, 0, N - 7);
  finder(grid, N - 7, 0);

  const cellSize = size / N;
  const rects: React.ReactNode[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c]) {
        rects.push(
          <rect
            key={`${r}-${c}`}
            x={c * cellSize}
            y={r * cellSize}
            width={cellSize}
            height={cellSize}
            fill="#000"
          />
        );
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rounded bg-white"
      role="img"
      aria-label={`QR pattern for ${value}`}
    >
      <rect width={size} height={size} fill="#fff" />
      {rects}
    </svg>
  );
}

/** Simple text barcode: vertical lines whose widths vary by char codes. */
function BarcodeSvg({ value, width = 240, height = 60 }: { value: string; width?: number; height?: number }) {
  const bars: React.ReactNode[] = [];
  let x = 4;
  const pad = 4;
  for (let i = 0; i < value.length && x < width - pad; i++) {
    const code = value.charCodeAt(i);
    const w = 1 + (code % 4); // 1..4
    const gap = 1 + ((code >> 2) % 3); // 1..3
    bars.push(
      <rect key={`b-${i}`} x={x} y={pad} width={w} height={height - pad * 2} fill="#000" />
    );
    x += w + gap;
  }
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="rounded bg-white"
      role="img"
      aria-label={`Barcode pattern for ${value}`}
    >
      <rect width={width} height={height} fill="#fff" />
      {bars}
      <text
        x={width / 2}
        y={height - 4}
        textAnchor="middle"
        style={{ fontSize: 10, fontFamily: "monospace", fill: "#000" }}
      >
        {value}
      </text>
    </svg>
  );
}

function printLabel(label: BarcodeLabel) {
  const w = window.open("", "_blank", "width=480,height=480");
  if (!w) {
    toast.error("Pop-up blocked. Allow pop-ups to print.");
    return;
  }
  const isQr = label.type === "qr";
  const codeSvg = isQr
    ? renderQrToString(label.code)
    : renderBarcodeToString(label.code);
  w.document.write(`<html><head><title>Label ${label.code}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; text-align: center; }
      .label { border: 1px dashed #999; padding: 16px; display: inline-block; }
      .code { font-family: monospace; font-size: 16px; margin-top: 8px; letter-spacing: 2px; }
      .meta { font-size: 11px; color: #666; margin-top: 4px; }
    </style>
  </head><body>
    <div class="label">
      ${codeSvg}
      <div class="code">${label.code}</div>
      ${label.label ? `<div class="meta">${label.label}</div>` : ""}
    </div>
    <script>window.onload = () => { window.print(); };<\/script>
  </body></html>`);
  w.document.close();
}

// Render QR pattern to a standalone SVG string for the print window
function renderQrToString(value: string): string {
  // Reuse the same algorithm as the React component, but as string output
  const N = 21;
  let seed = 0;
  for (let i = 0; i < value.length; i++) seed = (seed * 31 + value.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const cells: boolean[] = [];
  for (let i = 0; i < N * N; i++) cells.push(rand() > 0.5);
  const grid: boolean[][] = [];
  for (let r = 0; r < N; r++) grid.push(cells.slice(r * N, r * N + N));
  const finder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 7; c++) {
        const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[r0 + r][c0 + c] = onBorder || inner;
      }
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const onRing = r === -1 || r === 7 || c === -1 || c === 7;
        if (onRing && r0 + r >= 0 && r0 + r < N && c0 + c >= 0 && c0 + c < N)
          grid[r0 + r][c0 + c] = false;
      }
  };
  finder(0, 0);
  finder(0, N - 7);
  finder(N - 7, 0);
  const size = 160;
  const cs = size / N;
  let rects = "";
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (grid[r][c])
        rects += `<rect x="${c * cs}" y="${r * cs}" width="${cs}" height="${cs}" fill="#000"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#fff"/>${rects}</svg>`;
}

function renderBarcodeToString(value: string): string {
  const width = 280;
  const height = 70;
  const pad = 4;
  let x = 4;
  let bars = "";
  for (let i = 0; i < value.length && x < width - pad; i++) {
    const code = value.charCodeAt(i);
    const w = 1 + (code % 4);
    const gap = 1 + ((code >> 2) % 3);
    bars += `<rect x="${x}" y="${pad}" width="${w}" height="${height - pad * 2}" fill="#000"/>`;
    x += w + gap;
  }
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#fff"/>${bars}<text x="${width / 2}" y="${height - 4}" text-anchor="middle" style="font-size:11px;font-family:monospace;fill:#000">${value}</text></svg>`;
}

interface GenFormState {
  linkType: "none" | "inventory" | "job";
  itemId: string;
  jobId: string;
  type: string;
  label: string;
}

const EMPTY_FORM: GenFormState = {
  linkType: "none",
  itemId: "",
  jobId: "",
  type: "qr",
  label: "",
};

export function BarcodesView() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = React.useState<"all" | string>("all");
  const [printedFilter, setPrintedFilter] = React.useState<"all" | "true" | "false">(
    "all"
  );
  const [createOpen, setCreateOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<BarcodeLabel | null>(null);
  const [form, setForm] = React.useState<GenFormState>(EMPTY_FORM);

  const { data: jobsData } = useQuery({
    queryKey: ["jobs", "for-barcodes"],
    queryFn: () => jobsApi.list(),
  });
  const jobs: JobLite[] = (jobsData as { jobs?: JobLite[] })?.jobs ?? [];

  const { data: invData } = useQuery({
    queryKey: ["inventory", "for-barcodes"],
    queryFn: () => inventoryApi.list(),
  });
  const items: ItemLite[] =
    (invData as { items?: ItemLite[] })?.items ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["barcodes", typeFilter, printedFilter],
    queryFn: () =>
      barcodesApi.list({
        type: typeFilter === "all" ? undefined : typeFilter,
        printed:
          printedFilter === "all" ? undefined : printedFilter === "true",
      }),
  });
  const labels: BarcodeLabel[] = data?.labels ?? [];

  const createMut = useMutation({
    mutationFn: (payload: GenFormState) =>
      barcodesApi.create({
        itemId: payload.linkType === "inventory" ? payload.itemId || null : null,
        jobId: payload.linkType === "job" ? payload.jobId || null : null,
        type: payload.type,
        label: payload.label || undefined,
      }),
    onSuccess: (resp) => {
      toast.success(`Generated ${resp.label.code}`);
      qc.invalidateQueries({ queryKey: ["barcodes"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setPreview(resp.label);
    },
    onError: () => {}, _onError: (e: Error) => toast.error(e.message || "Failed to generate"),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<BarcodeLabel>;
    }) => barcodesApi.update(id, patch),
    onSuccess: () => {
      toast.success("Label updated");
      qc.invalidateQueries({ queryKey: ["barcodes"] });
    },
    onError: () => {}, _onError: (e: Error) => toast.error(e.message || "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => barcodesApi.remove(id),
    onSuccess: () => {
      toast.success("Label deleted");
      qc.invalidateQueries({ queryKey: ["barcodes"] });
      setPreview(null);
    },
    onError: () => {}, _onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  function submit() {
    createMut.mutate(form);
  }

  function linkedName(label: BarcodeLabel): string {
    if (label.itemId) {
      const item = items.find((i) => i.id === label.itemId);
      return item ? `${item.name}${item.code ? ` (${item.code})` : ""}` : "Inventory item";
    }
    if (label.jobId) {
      const job = jobs.find((j) => j.id === label.jobId);
      return job ? `${job.orderNumber} — ${job.title}` : "Job";
    }
    return "Unlinked";
  }

  const stats = React.useMemo(() => {
    return {
      total: labels.length,
      printed: labels.filter((l) => l.printed).length,
      pending: labels.filter((l) => !l.printed).length,
    };
  }, [labels]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <QrCode className="h-5 w-5 text-primary" />
            Barcode / QR Labels
          </h1>
          <p className="text-xs text-muted-foreground">
            Generate and print labels for inventory items or jobs.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setForm(EMPTY_FORM);
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          Generate Label
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <QrCode className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total labels</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.printed}</p>
              <p className="text-xs text-muted-foreground">Printed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Printer className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Not printed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Labels</CardTitle>
              <CardDescription className="text-xs">
                {labels.length} label{labels.length === 1 ? "" : "s"} shown
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-32 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={printedFilter}
                onValueChange={(v) =>
                  setPrintedFilter(v as "all" | "true" | "false")
                }
              >
                <SelectTrigger className="h-9 w-36 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Printed</SelectItem>
                  <SelectItem value="false">Not printed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : labels.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <QrCode className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No labels generated yet</p>
                <p className="text-sm text-muted-foreground">
                  Generate a QR code or barcode for inventory or jobs.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs min-w-[120px]">Preview</TableHead>
                    <TableHead className="h-8 text-xs min-w-[120px]">Code</TableHead>
                    <TableHead className="h-8 text-xs min-w-[160px]">Linked To</TableHead>
                    <TableHead className="h-8 text-xs min-w-[100px]">Type</TableHead>
                    <TableHead className="h-8 text-xs min-w-[100px]">Printed</TableHead>
                    <TableHead className="h-8 text-xs text-right min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labels.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="py-2">
                        {l.type === "qr" ? (
                          <QrSvg value={l.code} size={48} />
                        ) : (
                          <BarcodeSvg value={l.code} width={96} height={32} />
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-xs font-mono font-medium">
                        {l.code}
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        <div className="flex items-center gap-1">
                          {l.itemId ? (
                            <Package className="h-3 w-3 text-muted-foreground" />
                          ) : l.jobId ? (
                            <Briefcase className="h-3 w-3 text-muted-foreground" />
                          ) : null}
                          <span className="truncate max-w-[180px]">
                            {linkedName(l)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={`capitalize text-xs ${
                            TYPE_TINTS[l.type] ?? ""
                          }`}
                        >
                          {l.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={l.printed}
                            onCheckedChange={(v) =>
                              updateMut.mutate({
                                id: l.id,
                                patch: { printed: v },
                              })
                            }
                            className="scale-90"
                          />
                          <span className="text-xs text-muted-foreground">
                            {l.printed ? "Yes" : "No"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => printLabel(l)}
                          >
                            <Printer className="mr-1 h-3 w-3" />
                            Print
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteMut.mutate(l.id)} disabled={deleteMut.isPending}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Label</DialogTitle>
            <DialogDescription>
              A unique code is auto-generated on creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Link To</Label>
              <Select
                value={form.linkType}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    linkType: v as GenFormState["linkType"],
                  }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unlinked</SelectItem>
                  <SelectItem value="inventory">Inventory item</SelectItem>
                  <SelectItem value="job">Job</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.linkType === "inventory" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Inventory Item</Label>
                <Select
                  value={form.itemId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, itemId: v }))
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select item…" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No items available
                      </SelectItem>
                    ) : (
                      items.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name}
                          {i.code ? ` (${i.code})` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.linkType === "job" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Job</Label>
                <Select
                  value={form.jobId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, jobId: v }))
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select job…" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No jobs available
                      </SelectItem>
                    ) : (
                      jobs.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.orderNumber} — {j.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Label (optional)</Label>
              <Input
                placeholder="e.g. Aisle 3, Bin 12"
                className="h-9 text-sm"
                value={form.label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, label: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={createMut.isPending}>
              {createMut.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog after generation */}
      <Dialog
        open={!!preview}
        onOpenChange={(o) => {
          if (!o) setPreview(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Label Generated</DialogTitle>
            <DialogDescription>
              Code <span className="font-mono font-medium">{preview?.code}</span>
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="flex flex-col items-center gap-3 py-2">
              {preview.type === "qr" ? (
                <QrSvg value={preview.code} size={160} />
              ) : (
                <BarcodeSvg value={preview.code} width={240} height={64} />
              )}
              <p className="text-xs text-muted-foreground">
                {preview.label ?? "No label"}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => preview && printLabel(preview)}
                >
                  <Printer className="mr-1 h-3.5 w-3.5" />
                  Print
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (preview)
                      updateMut.mutate({
                        id: preview.id,
                        patch: { printed: true },
                        onError: () => {}, _onError: (e: Error) => toast.error(e.message || "Operation failed"),
                      });
                    setPreview(null);
                  }}
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  Mark as Printed
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
