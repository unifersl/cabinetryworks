"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobsApi, inventoryApi, warehousesApi, stockRequestsApi } from "@/lib/api";
import { useAuth } from "@/components/providers";
import {
  type SiteJobData,
  type CabinetModule,
  type CabinetType,
  type OpeningStyle,
  type MaterialTag,
  type SectionType,
  type HardwareSpecs,
  CABINET_TYPES,
  OPENING_STYLES,
  MATERIAL_TAGS,
  SECTION_TYPES,
  COMPONENT_NOTES,
  CARCASE_BOARD_OPTIONS,
  DOOR_FINISH_OPTIONS,
  EDGE_BANDING_OPTIONS,
  HINGES_OPTIONS,
  DRAWER_RUNNERS_OPTIONS,
  HANDLE_STYLE_OPTIONS,
  createEmptyModule,
  createEmptySiteData,
} from "@/lib/site-notebook-types";
import { ElevationCanvas } from "../site-notebook/elevation-canvas";
import { ImageMarkupModal } from "../site-notebook/image-markup-modal";
import { BlueprintSketchpad } from "../site-notebook/blueprint-sketchpad";
import { SignaturePad } from "../site-notebook/signature-pad";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ClipboardList,
  Plus,
  Trash2,
  Download,
  Upload,
  Copy,
  Ruler,
  Layers,
  Pencil,
  FileJson,
  Camera,
  X,
  ChevronDown,
  ChevronRight,
  Package,
  PackageCheck,
  Settings2,
  PenTool,
  PenLine,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Loader2,
} from "lucide-react";

// Sheet area = 2440mm × 1220mm = 2.977 m² (matches the Site Notebook estimator)
const STANDARD_SHEET_AREA_SQM = (2440 * 1220) / 1_000_000;

/** Compute the sheets required for a given total area in m² (with 15% wastage). */
function sheetsNeededFor(areaSqm: number): number {
  return Math.ceil((areaSqm * 1.15) / STANDARD_SHEET_AREA_SQM);
}

/** Fuzzy-match a Site Notebook MaterialTag to inventory items. */
function matchInventoryItems(
  tag: string,
  items: Array<{ id: string; name: string; material: string; stockLevel?: number | string }>
) {
  const tagLower = tag.toLowerCase().trim();
  if (!tagLower) return [];
  // 1. Exact material match
  const exact = items.filter((i) => i.material.toLowerCase() === tagLower);
  if (exact.length > 0) return exact;
  // 2. Substring match on material (either direction)
  const contains = items.filter(
    (i) =>
      i.material.toLowerCase().includes(tagLower) ||
      tagLower.includes(i.material.toLowerCase())
  );
  if (contains.length > 0) return contains;
  // 3. Substring match on item name
  return items.filter((i) => i.name.toLowerCase().includes(tagLower));
}

export function SiteNotebookView() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin" || user?.role === "SuperAdmin";
  const [data, setData] = React.useState<SiteJobData>(createEmptySiteData());
  const [expandedModules, setExpandedModules] = React.useState<Set<string>>(new Set());
  const [markupOpen, setMarkupOpen] = React.useState(false);
  const [markupImage, setMarkupImage] = React.useState<string | null>(null);
  const [photos, setPhotos] = React.useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const importInputRef = React.useRef<HTMLInputElement>(null);

  // ---- Stock Check feature ----
  const [stockCheckOpen, setStockCheckOpen] = React.useState(false);
  const [stockCheckLoading, setStockCheckLoading] = React.useState(false);
  const [stockSummary, setStockSummary] = React.useState<StockCheckRow[]>([]);
  const [syncDialogOpen, setSyncDialogOpen] = React.useState(false);
  const [syncWarehouseId, setSyncWarehouseId] = React.useState("");
  const [syncJobId, setSyncJobId] = React.useState("");
  const [syncSubmitting, setSyncSubmitting] = React.useState(false);

  // Load saved data from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem("site-notebook-data");
    if (saved) {
      try {
        setData(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Auto-save to localStorage
  React.useEffect(() => {
    localStorage.setItem("site-notebook-data", JSON.stringify(data));
  }, [data]);

  // Dirty state: any user-entered content (modules, photos, signature, basic info)
  const isDirty = React.useMemo(() => {
    return (
      data.modules.length > 0 ||
      photos.length > 0 ||
      !!data.signature.signatureDataUrl ||
      data.siteName.trim() !== "" ||
      data.jobNumber.trim() !== "" ||
      !!data.signature.clientName ||
      !!data.signature.technicianName
    );
  }, [data, photos]);

  // beforeunload warning: prevent accidental tab close when there's unsaved work.
  // Although data is auto-saved to localStorage, photos and signature data can
  // be large and a tab close can still cause loss if storage is full.
  React.useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  function updateData(patch: Partial<SiteJobData>) {
    setData((d) => ({ ...d, ...patch }));
  }

  function addModule() {
    const code = String(data.modules.length + 1).padStart(2, "0");
    const newMod = createEmptyModule(code);
    setData((d) => ({ ...d, modules: [...d.modules, newMod] }));
    setExpandedModules((s) => new Set([...s, newMod.id]));
    toast.success(`Module ${code} added`);
  }

  function updateModule(id: string, patch: Partial<CabinetModule>) {
    setData((d) => ({
      ...d,
      modules: d.modules.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  }

  function deleteModule(id: string) {
    setData((d) => ({
      ...d,
      modules: d.modules
        .filter((m) => m.id !== id)
        .map((m, i) => ({ ...m, code: String(i + 1).padStart(2, "0") })),
    }));
    toast.success("Module removed");
  }

  function duplicateModule(id: string) {
    const mod = data.modules.find((m) => m.id === id);
    if (!mod) return;
    const idx = data.modules.indexOf(mod);
    const newMod: CabinetModule = {
      ...mod,
      id: crypto.randomUUID(),
      cuttingList: mod.cuttingList.map((c) => ({ ...c, id: crypto.randomUUID() })),
    };
    const newModules = [...data.modules];
    newModules.splice(idx + 1, 0, newMod);
    // Recode
    newModules.forEach((m, i) => (m.code = String(i + 1).padStart(2, "0")));
    setData((d) => ({ ...d, modules: newModules }));
    toast.success(`Module ${mod.code} duplicated`);
  }

  function toggleExpand(id: string) {
    setExpandedModules((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addCuttingEntry(moduleId: string) {
    const mod = data.modules.find((m) => m.id === moduleId);
    if (!mod) return;
    const newEntry = {
      id: crypto.randomUUID(),
      length: 580,
      width: 560,
      qty: 2,
      material: "Standard Board" as MaterialTag,
      note: "Side Panel",
    };
    updateModule(moduleId, { cuttingList: [...mod.cuttingList, newEntry] });
  }

  function updateCuttingEntry(moduleId: string, entryId: string, patch: Partial<{ length: number; width: number; qty: number; material: MaterialTag; note: string }>) {
    const mod = data.modules.find((m) => m.id === moduleId);
    if (!mod) return;
    updateModule(moduleId, {
      cuttingList: mod.cuttingList.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
    });
  }

  function deleteCuttingEntry(moduleId: string, entryId: string) {
    const mod = data.modules.find((m) => m.id === moduleId);
    if (!mod) return;
    updateModule(moduleId, { cuttingList: mod.cuttingList.filter((e) => e.id !== entryId) });
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `site-notebook-${data.siteName || "untitled"}-${data.jobNumber || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Site data exported as JSON");
  }

  function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as SiteJobData;
        if (!parsed.modules) throw new Error("Invalid format");
        setData(parsed);
        toast.success("Site data imported");
      } catch {
        toast.error("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotos((p) => [...p, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function removePhoto(idx: number) {
    setPhotos((p) => p.filter((_, i) => i !== idx));
  }

  // -------- Stock Check feature --------
  // Collects every cutting list entry from every module, groups by material
  // tag, and compares the required sheet count against the total available
  // stock of matching inventory items. Surfaces a "Sync to Inventory"
  // shortcut to create a Stock Request for any shortage.
  async function runStockCheck() {
    setStockCheckLoading(true);
    setStockCheckOpen(true);
    try {
      const inv = await inventoryApi.list();
      const invItems = inv.items;

      // Aggregate per material tag: total area in m² (length × width × qty, mm→m²)
      const areaByMaterial = new Map<string, number>();
      for (const mod of data.modules) {
        for (const entry of mod.cuttingList) {
          const tag = entry.material || "Standard Board";
          const area = (entry.length * entry.width * entry.qty) / 1_000_000;
          areaByMaterial.set(tag, (areaByMaterial.get(tag) ?? 0) + area);
        }
      }

      const rows: StockCheckRow[] = Array.from(areaByMaterial.entries()).map(([tag, area]) => {
        const needed = sheetsNeededFor(area);
        const matches = matchInventoryItems(tag, invItems);
        const available = matches.reduce(
          (sum, it) => sum + Number(it.stockLevel ?? 0),
          0
        );
        const shortage = Math.max(0, needed - available);
        return {
          material: tag,
          neededSheets: needed,
          availableSheets: available,
          shortage,
          matchedItemIds: matches.map((m) => m.id),
          matchedItemNames: matches.map((m) => m.name),
        };
      });

      setStockSummary(rows);
      if (rows.length === 0) {
        toast.info("No cutting list entries to check. Add modules with cutting parts first.");
      } else {
        const shortages = rows.filter((r) => r.shortage > 0).length;
        if (shortages > 0) {
          toast.warning(`Stock check found ${shortages} material(s) with shortages`);
        } else {
          toast.success("Stock check complete — all materials have enough stock");
        }
      }
    } catch (err) {
      console.error("[stock-check] failed:", err);
      toast.error("Failed to run stock check. See console for details.");
    } finally {
      setStockCheckLoading(false);
    }
  }

  // Create a Stock Request covering every shortage that has at least one
  // matched inventory item. Lines without a match are reported to the user.
  async function syncShortagesToInventory() {
    if (!syncWarehouseId) {
      toast.error("Please select a warehouse to fulfil the request from");
      return;
    }
    const shortages = stockSummary.filter((r) => r.shortage > 0 && r.matchedItemIds.length > 0);
    if (shortages.length === 0) {
      toast.info("No syncable shortages — every shortage is missing a matched inventory item.");
      return;
    }

    setSyncSubmitting(true);
    try {
      // Use the first matched inventory item per material to keep the request
      // simple. The user can edit the request afterwards if a different item
      // should be used.
      const lines = shortages.map((r) => ({
        itemId: r.matchedItemIds[0],
        quantity: r.shortage,
      }));

      await stockRequestsApi.create({
        warehouseId: syncWarehouseId,
        jobId: syncJobId || null,
        notes: `Auto-created from Site Notebook (${data.siteName || "untitled"} · ${data.jobNumber || "no job#"})`,
        lines,
      });

      const unmatchable = stockSummary.filter((r) => r.shortage > 0 && r.matchedItemIds.length === 0);
      if (unmatchable.length > 0) {
        toast.warning(
          `Stock request created for ${shortages.length} material(s). ${unmatchable.length} material(s) had no matching inventory item — please add them manually.`,
          { description: unmatchable.map((r) => r.material).join(", ") }
        );
      } else {
        toast.success(`Stock request created for ${shortages.length} material shortage(s)`);
      }
      setSyncDialogOpen(false);
    } catch (err) {
      console.error("[stock-check] sync failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to create stock request");
    } finally {
      setSyncSubmitting(false);
    }
  }

  // Calculate total cutting list entries
  const totalEntries = data.modules.reduce((s, m) => s + m.cuttingList.length, 0);
  const totalPieces = data.modules.reduce(
    (s, m) => s + m.cuttingList.reduce((ms, e) => ms + e.qty, 0),
    0
  );

  return (
    <div className="space-y-3">
      {/* Header — compact */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <ClipboardList className="h-5 w-5 text-primary shrink-0" />
            <span className="truncate">Site Notebook Builder</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Practical elevation &amp; cutting list builder
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            onChange={importJSON}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={runStockCheck}
            className="h-8 px-2.5 border-primary/40 text-primary hover:bg-primary/10"
            title="Check cutting list against current inventory"
          >
            <PackageCheck className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Check Stock</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()} className="h-8 px-2.5">
            <Upload className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportJSON} className="h-8 px-2.5">
            <Download className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="notebook">
        <TabsList className="w-full justify-start overflow-x-auto scrollbar-warm">
          <TabsTrigger value="notebook" className="gap-1.5 text-xs sm:text-sm">
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden xs:inline sm:inline">Notebook</span>
          </TabsTrigger>
          <TabsTrigger value="sketchpad" className="gap-1.5 text-xs sm:text-sm">
            <PenTool className="h-3.5 w-3.5" />
            <span className="hidden xs:inline sm:inline">Sketchpad</span>
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1.5 text-xs sm:text-sm">
            <Camera className="h-3.5 w-3.5" />
            <span>Photos ({photos.length})</span>
          </TabsTrigger>
          <TabsTrigger value="signoff" className="gap-1.5 text-xs sm:text-sm">
            <PenLine className="h-3.5 w-3.5" />
            <span className="hidden xs:inline sm:inline">Sign-off</span>
          </TabsTrigger>
        </TabsList>

        {/* Notebook tab */}
        <TabsContent value="notebook" className="space-y-3">
          {/* Site Information — all fields in a single horizontal row */}
          <Card>
            <CardHeader className="pb-2 px-4 pt-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ClipboardList className="h-4 w-4 text-primary" />
                Site Information
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {/* Single-row form: 4 primary fields + 3 dimensions on one line */}
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-end sm:gap-x-3 sm:gap-y-2 xl:flex-nowrap">
                {/* Primary fields group */}
                <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-1 sm:flex-wrap sm:items-end sm:gap-x-2.5 sm:gap-y-2">
                  <div className="space-y-1 w-full sm:min-w-[140px] sm:flex-1">
                    <Label htmlFor="site-name" className="text-[10px] uppercase tracking-wide text-muted-foreground">Site / Client</Label>
                    <Input
                      id="site-name"
                      placeholder="Polhena - Matara"
                      value={data.siteName}
                      onChange={(e) => updateData({ siteName: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1 w-full sm:min-w-[110px] sm:flex-1">
                    <Label htmlFor="job-number" className="text-[10px] uppercase tracking-wide text-muted-foreground">Job No.</Label>
                    <Input
                      id="job-number"
                      placeholder="KCM-0001"
                      value={data.jobNumber}
                      onChange={(e) => updateData({ jobNumber: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1 w-full sm:min-w-[130px]">
                    <Label htmlFor="job-date" className="text-[10px] uppercase tracking-wide text-muted-foreground">Job Date</Label>
                    <Input
                      id="job-date"
                      type="date"
                      value={data.jobDate}
                      onChange={(e) => updateData({ jobDate: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1 w-full sm:min-w-[150px] sm:flex-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Section / Wall</Label>
                    <Select
                      value={data.section}
                      onValueChange={(v) => updateData({ section: v as SectionType })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SECTION_TYPES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Vertical divider between primary fields and dimensions */}
                <div className="hidden xl:block h-9 w-px bg-border self-center" />

                {/* Dimensions group — inline on the same row */}
                <div className="grid grid-cols-3 gap-2 sm:flex sm:items-end sm:gap-2">
                  <div className="flex items-center gap-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground col-span-3 sm:hidden">
                    <Ruler className="h-3 w-3" />
                    <span>Dims (mm)</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Ruler className="h-3 w-3" />
                    <span>Dims (mm)</span>
                  </div>
                  <div className="space-y-1 sm:w-[88px]">
                    <Label htmlFor="total-width" className="text-[10px] text-muted-foreground">W</Label>
                    <Input
                      id="total-width"
                      type="number"
                      placeholder="3400"
                      value={data.overallDimensions.width}
                      onChange={(e) =>
                        updateData({
                          overallDimensions: {
                            ...data.overallDimensions,
                            width: Number(e.target.value) || 0,
                          },
                        })
                      }
                      className="h-8 text-xs tabular-nums"
                    />
                  </div>
                  <div className="space-y-1 sm:w-[88px]">
                    <Label htmlFor="total-height" className="text-[10px] text-muted-foreground">H</Label>
                    <Input
                      id="total-height"
                      type="number"
                      placeholder="2150"
                      value={data.overallDimensions.height}
                      onChange={(e) =>
                        updateData({
                          overallDimensions: {
                            ...data.overallDimensions,
                            height: Number(e.target.value) || 0,
                          },
                        })
                      }
                      className="h-8 text-xs tabular-nums"
                    />
                  </div>
                  <div className="space-y-1 sm:w-[88px]">
                    <Label htmlFor="total-depth" className="text-[10px] text-muted-foreground">D</Label>
                    <Input
                      id="total-depth"
                      type="number"
                      placeholder="600"
                      value={data.overallDimensions.depth}
                      onChange={(e) =>
                        updateData({
                          overallDimensions: {
                            ...data.overallDimensions,
                            depth: Number(e.target.value) || 0,
                          },
                        })
                      }
                      className="h-8 text-xs tabular-nums"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2/3 + 1/3 split layout: Drawing canvas (2/3) + Module cutting lists (1/3) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* LEFT 2/3: Elevation drawing canvas */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2 px-4 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Layers className="h-4 w-4 text-primary" />
                      Elevation Blueprint
                    </CardTitle>
                    <CardDescription className="text-[11px] truncate">
                      {data.modules.length} modules · {data.modules.reduce((s, m) => s + m.width, 0)}mm · Drag cabinets from palette · Click to edit
                    </CardDescription>
                  </div>
                  <Button size="sm" onClick={addModule} className="h-8 shrink-0">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Add Module</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ElevationCanvas
                  data={data}
                  onUpdateModules={(mods) => updateData({ modules: mods })}
                />
              </CardContent>
            </Card>

            {/* RIGHT 1/3: Module cutting lists */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2 px-4 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-primary" />
                      Module Cutting Lists
                    </CardTitle>
                    <CardDescription className="text-[11px] truncate">
                      {totalEntries} entries · {totalPieces} total pieces
                    </CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={addModule} className="h-8 shrink-0 w-8 p-0">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-warm px-4 pb-4">
              {data.modules.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <Layers className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">No modules yet</p>
                    <p className="text-sm text-muted-foreground">
                      Add modules to start building your elevation and cutting list.
                    </p>
                  </div>
                  <Button onClick={addModule}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Module
                  </Button>
                </div>
              ) : (
                data.modules.map((mod) => {
                  const isExpanded = expandedModules.has(mod.id);
                  const cabType = CABINET_TYPES.find((t) => t.value === mod.type);
                  const opening = OPENING_STYLES.find((t) => t.value === mod.openingStyle);
                  return (
                    <div
                      key={mod.id}
                      className="rounded-lg border border-border overflow-hidden"
                    >
                      {/* Module header */}
                      <div className="flex flex-wrap items-center gap-2 bg-muted/40 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                        <button
                          onClick={() => toggleExpand(mod.id)}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <Badge className="bg-primary text-primary-foreground font-mono shrink-0">
                          {mod.code}
                        </Badge>
                        <span className="text-sm font-medium truncate min-w-0">{cabType?.label ?? mod.type}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {mod.width}mm
                        </Badge>
                        {opening?.symbol && (
                          <Badge variant="outline" className="text-xs font-mono shrink-0">
                            {opening?.symbol}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs shrink-0">
                          {mod.cuttingList.length} parts
                        </Badge>
                        <div className="ml-auto flex gap-1 shrink-0 pl-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => duplicateModule(mod.id)}
                            title="Duplicate module"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => deleteModule(mod.id)}
                            title="Delete module"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Module body (expandable) */}
                      {isExpanded && (
                        <div className="space-y-3 p-4">
                          {/* Module config */}
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Module Width (mm)</Label>
                              <Input
                                type="number"
                                value={mod.width}
                                onChange={(e) =>
                                  updateModule(mod.id, { width: Number(e.target.value) || 0 })
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Cabinet Type</Label>
                              <Select
                                value={mod.type}
                                onValueChange={(v) => updateModule(mod.id, { type: v as CabinetType })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CABINET_TYPES.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                      {t.icon} {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Opening Style</Label>
                              <Select
                                value={mod.openingStyle}
                                onValueChange={(v) =>
                                  updateModule(mod.id, { openingStyle: v as OpeningStyle })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {OPENING_STYLES.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                      {t.symbol} — {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Cutting list entries — improved layout */}
                          <div>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Cutting List Entries
                              </Label>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs shrink-0"
                                onClick={() => addCuttingEntry(mod.id)}
                              >
                                <Plus className="mr-1 h-3 w-3" />
                                Add Entry
                              </Button>
                            </div>

                            {mod.cuttingList.length === 0 ? (
                              <div className="rounded-md border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
                                No cutting list entries yet — click "Add Entry" to start
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {/* Column headers — micro labels */}
                                <div className="grid grid-cols-[28px_1fr_12px_1fr_44px_1.5fr_1fr_28px] items-center gap-1.5 px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  <span>#</span>
                                  <span>Length (mm)</span>
                                  <span></span>
                                  <span>Width (mm)</span>
                                  <span>Qty</span>
                                  <span>Material</span>
                                  <span>Note</span>
                                  <span></span>
                                </div>

                                {/* Entries */}
                                {mod.cuttingList.map((entry, idx) => (
                                  <div
                                    key={entry.id}
                                    className="grid grid-cols-[28px_1fr_12px_1fr_44px_1.5fr_1fr_28px] items-center gap-1.5 rounded-md border border-border bg-card p-1.5 hover:border-primary/30 transition-colors"
                                  >
                                    {/* Entry number */}
                                    <span className="text-center font-mono text-xs font-semibold text-muted-foreground">
                                      {String(idx + 1).padStart(2, "0")}
                                    </span>

                                    {/* Length input */}
                                    <Input
                                      type="number"
                                      className="h-8 text-xs tabular-nums"
                                      value={entry.length}
                                      onChange={(e) =>
                                        updateCuttingEntry(mod.id, entry.id, {
                                          length: Number(e.target.value) || 0,
                                        })
                                      }
                                      placeholder="854"
                                      title="Length in mm"
                                    />

                                    {/* × separator */}
                                    <span className="text-center text-xs text-muted-foreground font-semibold">×</span>

                                    {/* Width input */}
                                    <Input
                                      type="number"
                                      className="h-8 text-xs tabular-nums"
                                      value={entry.width}
                                      onChange={(e) =>
                                        updateCuttingEntry(mod.id, entry.id, {
                                          width: Number(e.target.value) || 0,
                                        })
                                      }
                                      placeholder="560"
                                      title="Width in mm"
                                    />

                                    {/* Qty input */}
                                    <Input
                                      type="number"
                                      className="h-8 text-xs text-center tabular-nums"
                                      value={entry.qty}
                                      onChange={(e) =>
                                        updateCuttingEntry(mod.id, entry.id, {
                                          qty: Number(e.target.value) || 0,
                                        })
                                      }
                                      placeholder="4"
                                      title="Quantity"
                                    />

                                    {/* Material dropdown — wider, no truncation */}
                                    <Select
                                      value={entry.material}
                                      onValueChange={(v) =>
                                        updateCuttingEntry(mod.id, entry.id, {
                                          material: v as MaterialTag,
                                        })
                                      }
                                    >
                                      <SelectTrigger className="h-8 text-xs overflow-hidden" title={entry.material}>
                                        <SelectValue className="truncate" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {MATERIAL_TAGS.map((m) => (
                                          <SelectItem key={m} value={m}>
                                            {m}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                    {/* Note dropdown */}
                                    <Select
                                      value={entry.note ?? ""}
                                      onValueChange={(v) =>
                                        updateCuttingEntry(mod.id, entry.id, { note: v })
                                      }
                                    >
                                      <SelectTrigger className="h-8 text-xs overflow-hidden" title={entry.note ?? "Component note"}>
                                        <SelectValue placeholder="—" className="truncate" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {COMPONENT_NOTES.map((n) => (
                                          <SelectItem key={n} value={n}>
                                            {n}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                    {/* Delete button */}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                                      onClick={() => deleteCuttingEntry(mod.id, entry.id)}
                                      title="Delete entry"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}

                                {/* Summary bar — total area + sheet estimate */}
                                {(() => {
                                  const totalArea = mod.cuttingList.reduce(
                                    (s, e) => s + (e.length * e.width * e.qty) / 1_000_000,
                                    0,
                                  );
                                  const totalQty = mod.cuttingList.reduce((s, e) => s + e.qty, 0);
                                  const sheetArea = 2.97; // standard 2440×1220mm sheet ≈ 2.97 m²
                                  const sheetsNeeded = Math.ceil(totalArea / sheetArea);
                                  return (
                                    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-[10px] text-muted-foreground">
                                      <span>
                                        <span className="font-semibold text-foreground">{totalQty}</span> pieces ·{" "}
                                        <span className="font-semibold text-foreground">{totalArea.toFixed(2)} m²</span> total area
                                      </span>
                                      <span>
                                        ≈ <span className="font-semibold text-amber-700 dark:text-amber-400">{sheetsNeeded} sheet{sheetsNeeded !== 1 ? "s" : ""}</span> needed (2440×1220mm)
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
          </div>

          {/* Hardware Specs Panel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-4 w-4 text-primary" />
                Material &amp; Hardware Specifications
              </CardTitle>
              <CardDescription>
                Board, door finish, edge banding, and fittings specs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">BOARD &amp; PANEL SPECS</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Carcase Board Material</Label>
                    <Select
                      value={data.hardwareSpecs.carcaseBoard}
                      onValueChange={(v) =>
                        updateData({
                          hardwareSpecs: { ...data.hardwareSpecs, carcaseBoard: v },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CARCASE_BOARD_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Door Finish</Label>
                    <Select
                      value={data.hardwareSpecs.doorFinish}
                      onValueChange={(v) =>
                        updateData({
                          hardwareSpecs: { ...data.hardwareSpecs, doorFinish: v },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOOR_FINISH_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Edge Banding Tape</Label>
                    <Select
                      value={data.hardwareSpecs.edgeBanding}
                      onValueChange={(v) =>
                        updateData({
                          hardwareSpecs: { ...data.hardwareSpecs, edgeBanding: v },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EDGE_BANDING_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator className="my-3" />

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">FITTINGS &amp; HARDWARE SPECS</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Hinges</Label>
                    <Select
                      value={data.hardwareSpecs.hinges}
                      onValueChange={(v) =>
                        updateData({
                          hardwareSpecs: { ...data.hardwareSpecs, hinges: v },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HINGES_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Drawer Runners</Label>
                    <Select
                      value={data.hardwareSpecs.drawerRunners}
                      onValueChange={(v) =>
                        updateData({
                          hardwareSpecs: { ...data.hardwareSpecs, drawerRunners: v },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DRAWER_RUNNERS_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Handle Style</Label>
                    <Select
                      value={data.hardwareSpecs.handleStyle}
                      onValueChange={(v) =>
                        updateData({
                          hardwareSpecs: { ...data.hardwareSpecs, handleStyle: v },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HANDLE_STYLE_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Board Sheet Estimator */}
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calculator className="h-4 w-4 text-primary" />
                Automated Board Sheet Estimator
              </CardTitle>
              <CardDescription>
                Real-time calculation from cutting list data (8ft × 4ft / 2440mm × 1220mm sheets)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const totalAreaSqm = data.modules.reduce(
                  (s, m) =>
                    s +
                    m.cuttingList.reduce(
                      (ms, e) => ms + (e.length * e.width * e.qty) / 1_000_000,
                      0
                    ),
                  0
                );
                const sheetAreaSqm = (2440 * 1220) / 1_000_000; // ~2.977 m²
                const withWastage = totalAreaSqm * 1.15; // 15% wastage
                const sheetsNeeded = Math.ceil(withWastage / sheetAreaSqm);
                const totalPieces = data.modules.reduce(
                  (s, m) => s + m.cuttingList.reduce((ms, e) => ms + e.qty, 0),
                  0
                );

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg border border-border bg-card p-3 text-center">
                        <p className="text-[10px] uppercase text-muted-foreground">Total Area</p>
                        <p className="text-lg font-bold tabular-nums">{totalAreaSqm.toFixed(2)} m²</p>
                      </div>
                      <div className="rounded-lg border border-border bg-card p-3 text-center">
                        <p className="text-[10px] uppercase text-muted-foreground">+ 15% Wastage</p>
                        <p className="text-lg font-bold tabular-nums text-amber-600">{withWastage.toFixed(2)} m²</p>
                      </div>
                      <div className="rounded-lg border border-border bg-card p-3 text-center">
                        <p className="text-[10px] uppercase text-muted-foreground">Total Pieces</p>
                        <p className="text-lg font-bold tabular-nums">{totalPieces}</p>
                      </div>
                      <div className="rounded-lg border-2 border-primary bg-primary/5 p-3 text-center">
                        <p className="text-[10px] uppercase text-muted-foreground">Sheets Needed</p>
                        <p className="text-2xl font-bold tabular-nums text-primary">~{sheetsNeeded}</p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
                      <p className="text-sm font-semibold text-primary">
                        Estimated Board Requirement: ~ {sheetsNeeded} Sheets
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Standard 8ft × 4ft / 2440mm × 1220mm (incl. 15% cutting wastage)
                      </p>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* JSON preview — admin only */}
          {isAdmin && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileJson className="h-4 w-4 text-primary" />
                Serialized Site Data (JSON)
              </CardTitle>
              <CardDescription>
                Factory export format — auto-saved locally
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-64 overflow-y-auto scrollbar-warm rounded-md border border-border bg-muted/30 p-3 text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        {/* Assets tab */}
        <TabsContent value="assets" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Camera className="h-4 w-4 text-primary" />
                    Site Photos
                  </CardTitle>
                  <CardDescription>
                    Upload site photos and mark them up with annotations
                  </CardDescription>
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Upload Photos
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {photos.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">No photos uploaded</p>
                    <p className="text-sm text-muted-foreground">
                      Upload site photos to annotate with measurements and notes.
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Upload First Photo
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {photos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="group relative overflow-hidden rounded-lg border border-border"
                    >
                      <img
                        src={photo}
                        alt={`Site photo ${idx + 1}`}
                        className="aspect-square w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setMarkupImage(photo);
                            setMarkupOpen(true);
                          }}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Markup
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-8 w-8"
                          onClick={() => removePhoto(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sketchpad tab */}
        <TabsContent value="sketchpad" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <PenTool className="h-4 w-4 text-primary" />
                Freehand Blueprint Sketchpad
              </CardTitle>
              <CardDescription>
                Draw elevation sketches with dimension line labels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BlueprintSketchpad onSave={(dataUrl) => {
                setPhotos((p) => [...p, dataUrl]);
                toast.success("Sketch saved to Photos tab");
              }} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sign-off tab */}
        <TabsContent value="signoff" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <PenLine className="h-4 w-4 text-primary" />
                Client Digital Sign-off
              </CardTitle>
              <CardDescription>
                Capture client signature to confirm site measurement before factory cutting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SignaturePad
                value={data.signature}
                onChange={(sig) => updateData({ signature: sig })}
              />
            </CardContent>
          </Card>

          {/* Summary card */}
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Site Inspection Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Site</p>
                  <p className="text-sm font-medium truncate">{data.siteName || "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Job #</p>
                  <p className="text-sm font-medium">{data.jobNumber || "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Modules</p>
                  <p className="text-sm font-bold">{data.modules.length}</p>
                </div>
                <div className="rounded-lg border-2 border-primary bg-primary/5 p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Status</p>
                  <p className={`text-sm font-bold ${data.signature.signedAt ? "text-emerald-600" : "text-amber-600"}`}>
                    {data.signature.signedAt ? "✓ Signed" : "Pending"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ImageMarkupModal
        open={markupOpen}
        onOpenChange={setMarkupOpen}
        imageUrl={markupImage}
        onSave={(dataUrl) => {
          setPhotos((p) => p.map((ph) => (ph === markupImage ? dataUrl : ph)));
        }}
      />

      {/* Stock Check Dialog — compares cutting list vs inventory */}
      <StockCheckDialog
        open={stockCheckOpen}
        onOpenChange={setStockCheckOpen}
        loading={stockCheckLoading}
        rows={stockSummary}
        onRefresh={runStockCheck}
        onSync={() => {
          setStockCheckOpen(false);
          setSyncDialogOpen(true);
        }}
      />

      {/* Sync to Inventory Dialog — create a stock request for shortages */}
      <SyncShortagesDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        rows={stockSummary}
        warehouseId={syncWarehouseId}
        onWarehouseChange={setSyncWarehouseId}
        jobId={syncJobId}
        onJobChange={setSyncJobId}
        submitting={syncSubmitting}
        onSubmit={syncShortagesToInventory}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stock Check & Sync sub-components (kept in the same file to minimise the    */
/* surface area of the gap-4 fix — the rest of the Site Notebook stays as-is). */
/* -------------------------------------------------------------------------- */

type StockCheckRow = {
  material: string;
  neededSheets: number;
  availableSheets: number;
  shortage: number;
  matchedItemIds: string[];
  matchedItemNames: string[];
};

function StockCheckDialog({
  open,
  onOpenChange,
  loading,
  rows,
  onRefresh,
  onSync,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  rows: StockCheckRow[];
  onRefresh: () => void;
  onSync: () => void;
}) {
  const shortagesCount = rows.filter((r) => r.shortage > 0).length;
  const hasMatchedShortage = rows.some((r) => r.shortage > 0 && r.matchedItemIds.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[680px] max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-warm">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-primary" />
                Stock Check Summary
              </DialogTitle>
              <DialogDescription>
                Compares every cutting list entry against the current inventory totals. Sheet count uses 2440×1220mm sheets with 15% wastage.
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

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Checking stock…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No cutting list entries found. Add modules and cutting parts in the notebook first.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {rows.length} material(s) ·{" "}
                <span className={shortagesCount > 0 ? "font-semibold text-amber-600" : "font-semibold text-emerald-600"}>
                  {shortagesCount} shortage(s)
                </span>
              </p>
              <Button variant="outline" size="sm" onClick={onRefresh} className="h-8">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>

            <div className="rounded-md border overflow-x-auto scrollbar-warm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Material</TableHead>
                    <TableHead className="text-right min-w-[80px]">Needed</TableHead>
                    <TableHead className="text-right min-w-[80px]">Available</TableHead>
                    <TableHead className="text-right min-w-[80px]">Shortage</TableHead>
                    <TableHead className="text-center min-w-[90px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const ok = r.shortage === 0;
                    const noMatch = r.matchedItemIds.length === 0;
                    return (
                      <TableRow key={r.material}>
                        <TableCell>
                          <p className="font-medium">{r.material}</p>
                          {r.matchedItemNames.length > 0 ? (
                            <p className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                              {r.matchedItemNames.join(", ")}
                            </p>
                          ) : (
                            <p className="text-[11px] text-amber-600">No matching inventory item</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.neededSheets}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.availableSheets}</TableCell>
                        <TableCell className={`text-right tabular-nums font-semibold ${r.shortage > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                          {r.shortage > 0 ? `−${r.shortage}` : "0"}
                        </TableCell>
                        <TableCell className="text-center">
                          {noMatch ? (
                            <AlertTriangle className="h-4 w-4 text-amber-600 inline" />
                          ) : ok ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 inline" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-600 inline" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={onSync}
                disabled={!hasMatchedShortage}
                title={hasMatchedShortage ? "" : "No shortages with a matched inventory item to sync"}
              >
                <Package className="mr-1.5 h-4 w-4" />
                Sync Shortages to Inventory
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SyncShortagesDialog({
  open,
  onOpenChange,
  rows,
  warehouseId,
  onWarehouseChange,
  jobId,
  onJobChange,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: StockCheckRow[];
  warehouseId: string;
  onWarehouseChange: (v: string) => void;
  jobId: string;
  onJobChange: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const { data: warehousesData } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => warehousesApi.list(),
    enabled: open,
  });
  const { data: jobsData } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => jobsApi.list(),
    enabled: open,
  });

  const syncable = rows.filter((r) => r.shortage > 0 && r.matchedItemIds.length > 0);
  const unmatchable = rows.filter((r) => r.shortage > 0 && r.matchedItemIds.length === 0);

  // Pre-select the main warehouse by default once data loads
  React.useEffect(() => {
    if (!warehouseId && (warehousesData?.warehouses ?? []).length > 0) {
      const main = warehousesData?.warehouses.find((w) => w.type === "main" && w.isActive);
      onWarehouseChange(main?.id ?? warehousesData!.warehouses[0].id);
    }
  }, [warehouseId, warehousesData, onWarehouseChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[560px] max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-warm">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Sync Shortages to Inventory
              </DialogTitle>
              <DialogDescription>
                Creates a stock request to fulfil the {syncable.length} matched shortage(s).
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

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Warehouse <span className="text-destructive">*</span></Label>
            <Select value={warehouseId} onValueChange={onWarehouseChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {(warehousesData?.warehouses ?? []).map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Job (optional)</Label>
            <Select value={jobId} onValueChange={onJobChange}>
              <SelectTrigger>
                <SelectValue placeholder="No specific job" />
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

          {syncable.length > 0 && (
            <div className="rounded-md border overflow-x-auto scrollbar-warm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Material</TableHead>
                    <TableHead className="text-right min-w-[80px]">Shortage</TableHead>
                    <TableHead className="min-w-[160px]">Matched Item</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncable.map((r) => (
                    <TableRow key={r.material}>
                      <TableCell className="font-medium">{r.material}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-amber-600">
                        {r.shortage}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {r.matchedItemNames[0]}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {unmatchable.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              <p className="flex items-center gap-1.5 font-semibold text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                {unmatchable.length} material(s) have no matching inventory item
              </p>
              <p className="mt-1 text-muted-foreground">
                These will not be added to the stock request. Add matching inventory items first, then re-run Check Stock.
              </p>
              <ul className="mt-1.5 list-disc pl-5 text-muted-foreground">
                {unmatchable.map((r) => (
                  <li key={r.material}>{r.material} — shortage of {r.shortage}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={submitting || syncable.length === 0}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Package className="mr-2 h-4 w-4" />
            )}
            Create Stock Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
