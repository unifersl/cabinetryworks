// @ts-nocheck
"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { jobsApi, costApi, materialPricesApi, quotesApi } from "@/lib/api";
import type { MaterialPrice } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  DollarSign,
  Loader2,
  Printer,
  X,
  Plus,
  Pencil,
  Trash2,
  Package,
  Hammer,
  Calculator,
  TrendingUp,
  FileText,
} from "lucide-react";

const MATERIALS = ["MDF", "Plywood", "Particle Board", "Solid Wood", "Acrylic"];

export function QuotesView() {
  const [selectedJobId, setSelectedJobId] = React.useState<string>("");
  const [quoteOpen, setQuoteOpen] = React.useState(false);
  const [priceModalOpen, setPriceModalOpen] = React.useState(false);
  const [editingPrice, setEditingPrice] = React.useState<MaterialPrice | null>(null);

  const { data: jobsData } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => jobsApi.list(),
  });
  const { data: pricesData } = useQuery({
    queryKey: ["material-prices"],
    queryFn: materialPricesApi.list,
  });

  const jobs = (jobsData?.jobs ?? []).filter((j) => !j.archived);
  const prices = pricesData?.prices ?? [];

  const { data: costData, isLoading: costLoading } = useQuery({
    queryKey: ["job-cost", selectedJobId],
    queryFn: () => costApi.get(selectedJobId),
    enabled: !!selectedJobId,
  });

  function handleViewQuote(jobId: string) {
    setSelectedJobId(jobId);
    setQuoteOpen(true);
  }

  function handleEditPrice(price: MaterialPrice) {
    setEditingPrice(price);
    setPriceModalOpen(true);
  }

  function handleAddPrice() {
    setEditingPrice(null);
    setPriceModalOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <DollarSign className="h-5 w-5 text-primary" />
            Quotes &amp; Costing
          </h1>
          <p className="text-sm text-muted-foreground">
            Estimate job costs and generate printable quotes.
          </p>
        </div>
        <Button onClick={handleAddPrice}>
          <Plus className="mr-2 h-4 w-4" />
          Add Material Price
        </Button>
      </div>

      {/* Material prices table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-primary" />
            Material Price List
          </CardTitle>
          <CardDescription>
            Pricing used for automatic cost calculations ({prices.length} materials)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {prices.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No material prices yet</p>
                <p className="text-sm text-muted-foreground">
                  Add material pricing to enable automatic cost calculations.
                </p>
              </div>
              <Button onClick={handleAddPrice} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add First Material
              </Button>
            </div>
          ) : (
            <div className="max-h-[40vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[140px]">Material</TableHead>
                    <TableHead className="min-w-[90px]">Type</TableHead>
                    <TableHead className="hidden sm:table-cell min-w-[90px]">Thickness</TableHead>
                    <TableHead className="text-right min-w-[90px]">Price/m²</TableHead>
                    <TableHead className="hidden md:table-cell text-right min-w-[90px]">Edge/m</TableHead>
                    <TableHead className="hidden md:table-cell text-right min-w-[90px]">Labor/hr</TableHead>
                    <TableHead className="text-right min-w-[52px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prices.map((p, idx) => (
                    <TableRow key={p.id} className={`hover:bg-muted/50 ${idx % 2 === 1 ? "bg-muted/40" : ""}`}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {p.material}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {p.thickness ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        ${Number(p.pricePerSqm).toFixed(2)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">
                        ${Number(p.edgeBandingPricePerM).toFixed(2)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">
                        ${Number(p.laborRatePerHour).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditPrice(p)}
                          >
                            <Pencil className="h-4 w-4" />
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

      {/* Jobs with cost summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4 text-primary" />
            Job Cost Estimates
          </CardTitle>
          <CardDescription>
            Select a job to view its calculated cost breakdown
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <div className="rounded-full bg-muted p-3">
                <Calculator className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No active jobs</p>
              <p className="text-xs text-muted-foreground">
                Create jobs with cutting lists to see cost estimates here.
              </p>
            </div>
          ) : (
            <div className="max-h-[45vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[160px]">Job</TableHead>
                    <TableHead className="hidden sm:table-cell min-w-[140px]">Customer</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[100px]">Status</TableHead>
                    <TableHead className="text-right min-w-[110px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job, idx) => (
                    <TableRow key={job.id} className={`hover:bg-muted/50 ${idx % 2 === 1 ? "bg-muted/40" : ""}`}>
                      <TableCell>
                        <div>
                          <p className="font-mono text-xs text-primary">
                            {job.orderNumber}
                          </p>
                          <p className="text-sm font-medium">{job.title}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {job.customer?.name ?? "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewQuote(job.id)}
                        >
                          <DollarSign className="mr-1.5 h-3.5 w-3.5" />
                          View Quote
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quote dialog */}
      <QuoteDialog
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        costData={costData}
        isLoading={costLoading}
      />

      {/* Material price modal */}
      <MaterialPriceDialog
        open={priceModalOpen}
        onOpenChange={setPriceModalOpen}
        price={editingPrice}
      />
    </div>
  );
}

function QuoteDialog({
  open,
  onOpenChange,
  costData,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  costData: ReturnType<typeof useQuery>["data"] extends infer T
    ? T
    : never;
  isLoading: boolean;
}) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="no-print sm:max-w-[800px]">
        <DialogTitle className="sr-only">Job quote</DialogTitle>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Cost Estimate &amp; Quote</h2>
          <div className="flex gap-2">
            {costData && (
              <>
                <SaveQuoteButton jobId={selectedJobId} costData={costData} onSaved={() => onOpenChange(false)} />
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
              </>
            )}
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
        <div className="max-h-[70vh] overflow-y-auto scrollbar-warm rounded-lg border border-border p-3 sm:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !costData ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No cost data available.
            </div>
          ) : (
            <QuoteContent costData={costData} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuoteContent({ costData }: { costData: NonNullable<ReturnType<typeof useQuery>["data"]> }) {
  const cd = costData as any;
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
            <p className="text-xs text-muted-foreground">Cost Estimate &amp; Quote</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-bold text-primary">
            {cd.job.orderNumber}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Job info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[10px] font-medium uppercase text-muted-foreground">Job</p>
          <p className="text-sm font-medium">{cd.job.title}</p>
          <p className="text-xs text-muted-foreground">{cd.job.orderNumber}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[10px] font-medium uppercase text-muted-foreground">Customer</p>
          <p className="text-sm font-medium">{cd.job.customer.name}</p>
          {cd.job.deliveryDate && (
            <p className="text-xs text-muted-foreground">
              Delivery: {new Date(cd.job.deliveryDate).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Cost lines */}
      {cd.lines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No cutting list items found. Add cutting lists to this job to calculate costs.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-warm">
        <Table>
          <TableHeader>
            <TableRow className="border-2 border-primary bg-primary/5">
              <TableHead className="min-w-[120px]">Part</TableHead>
              <TableHead className="text-center min-w-[60px]">Qty</TableHead>
              <TableHead className="text-right min-w-[90px]">Area (m²)</TableHead>
              <TableHead className="text-right min-w-[90px]">Material</TableHead>
              <TableHead className="text-right min-w-[80px]">Edge</TableHead>
              <TableHead className="text-right min-w-[90px]">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cd.lines.map((line: any, i: number) => (
              <TableRow key={i} className="border-border">
                <TableCell className="text-xs">
                  <p className="font-medium">{line.partName}</p>
                  <p className="text-muted-foreground">{line.material}</p>
                </TableCell>
                <TableCell className="text-center text-xs tabular-nums">{line.qty}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{line.areaSqm}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  ${line.materialCost.toFixed(2)}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  ${line.edgeCost.toFixed(2)}
                </TableCell>
                <TableCell className="text-right text-xs font-bold tabular-nums">
                  ${(line.materialCost + line.edgeCost).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}

      {/* Summary */}
      <div className="ml-auto max-w-xs space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Material cost</span>
          <span className="font-medium tabular-nums">{cd.formatted.materialCost}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Edge banding</span>
          <span className="font-medium tabular-nums">{cd.formatted.edgeCost}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Labor</span>
          <span className="font-medium tabular-nums">{cd.formatted.laborCost}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-sm">
          <span className="font-medium">Subtotal</span>
          <span className="font-bold tabular-nums">{cd.formatted.subtotal}</span>
        </div>
        {cd.summary.taxAmount > 0 && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({cd.taxRate}%)</span>
              <span className="font-medium tabular-nums">{cd.formatted.taxAmount}</span>
            </div>
            <div className="flex justify-between border-t-2 border-primary pt-2 text-base">
              <span className="font-bold">Total</span>
              <span className="font-bold tabular-nums text-primary">{cd.formatted.total}</span>
            </div>
          </>
        )}
        {cd.summary.taxAmount === 0 && (
          <div className="flex justify-between border-t-2 border-primary pt-2 text-base">
            <span className="font-bold">Total</span>
            <span className="font-bold tabular-nums text-primary">{cd.formatted.total}</span>
          </div>
        )}
      </div>

      {/* Totals summary */}
      <div className="grid grid-cols-3 gap-3 border-t border-border pt-4">
        <div className="text-center">
          <p className="text-[10px] uppercase text-muted-foreground">Total Area</p>
          <p className="text-sm font-bold">{cd.summary.totalAreaSqm} m²</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] uppercase text-muted-foreground">Edge Length</p>
          <p className="text-sm font-bold">{cd.summary.totalEdgeLengthM} m</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] uppercase text-muted-foreground">Currency</p>
          <p className="text-sm font-bold">{cd.currency}</p>
        </div>
      </div>

      <p className="pt-4 text-center text-[10px] text-muted-foreground">
        CabinetryWorks · Quote valid 30 days · Generated{" "}
        {new Date().toLocaleString()}
      </p>
    </div>
  );
}

function MaterialPriceDialog({
  open,
  onOpenChange,
  price,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  price: MaterialPrice | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [material, setMaterial] = React.useState("MDF");
  const [thickness, setThickness] = React.useState("");
  const [pricePerSqm, setPricePerSqm] = React.useState("");
  const [edgeBandingPricePerM, setEdgeBandingPricePerM] = React.useState("");
  const [laborRatePerHour, setLaborRatePerHour] = React.useState("");
  const [estimatedHours, setEstimatedHours] = React.useState("");

  React.useEffect(() => {
    if (price) {
      setName(price.name);
      setMaterial(price.material);
      setThickness(price.thickness ?? "");
      setPricePerSqm(String(price.pricePerSqm));
      setEdgeBandingPricePerM(String(price.edgeBandingPricePerM));
      setLaborRatePerHour(String(price.laborRatePerHour));
      setEstimatedHours(String(price.estimatedHours));
    } else {
      setName("");
      setMaterial("MDF");
      setThickness("");
      setPricePerSqm("");
      setEdgeBandingPricePerM("");
      setLaborRatePerHour("");
      setEstimatedHours("");
    }
  }, [price]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const payload = {
      name: name.trim(),
      material,
      thickness: thickness || null,
      pricePerSqm: Number(pricePerSqm) || 0,
      edgeBandingPricePerM: Number(edgeBandingPricePerM) || 0,
      laborRatePerHour: Number(laborRatePerHour) || 0,
      estimatedHours: Number(estimatedHours) || 0,
    };
    try {
      if (price) {
        await materialPricesApi.update(price.id, payload);
        toast.success("Material price updated");
      } else {
        await materialPricesApi.create(payload);
        toast.success("Material price added");
      }
      queryClient.invalidateQueries({ queryKey: ["material-prices"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="sm:max-w-[480px]">
        <DialogTitle className="sr-only">Material price</DialogTitle>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Package className="h-5 w-5 text-primary" />
            {price ? "Edit Material Price" : "Add Material Price"}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mp-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="mp-name"
              placeholder="e.g. MDF 18mm Premium"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Material Type</Label>
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
            <div className="space-y-2">
              <Label htmlFor="mp-thickness">Thickness</Label>
              <Input
                id="mp-thickness"
                placeholder="18mm"
                value={thickness}
                onChange={(e) => setThickness(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mp-price">Price per m² (USD)</Label>
            <Input
              id="mp-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="25.00"
              value={pricePerSqm}
              onChange={(e) => setPricePerSqm(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="mp-edge">Edge Banding /m</Label>
              <Input
                id="mp-edge"
                type="number"
                step="0.01"
                min="0"
                placeholder="1.50"
                value={edgeBandingPricePerM}
                onChange={(e) => setEdgeBandingPricePerM(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mp-labor">Labor Rate /hr</Label>
              <Input
                id="mp-labor"
                type="number"
                step="0.01"
                min="0"
                placeholder="45.00"
                value={laborRatePerHour}
                onChange={(e) => setLaborRatePerHour(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mp-hours">Estimated Labor Hours</Label>
            <Input
              id="mp-hours"
              type="number"
              step="0.5"
              min="0"
              placeholder="8"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {price ? "Save Changes" : "Add Material"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SaveQuoteButton({
  jobId,
  costData,
  onSaved,
}: {
  jobId: string;
  costData: any;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await quotesApi.create({
        jobId,
        materialCost: costData.summary.materialCost,
        edgeCost: costData.summary.edgeCost,
        laborCost: costData.summary.laborCost,
        subtotal: costData.summary.subtotal,
        taxRate: costData.taxRate,
        taxAmount: costData.summary.taxAmount,
        total: costData.summary.total,
        currency: costData.currency,
      });
      toast.success("Quote saved! View it in Saved Quotes.");
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save quote");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button size="sm" onClick={handleSave} disabled={saving}>
      {saving ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileText className="mr-2 h-4 w-4" />
      )}
      Save Quote
    </Button>
  );
}
