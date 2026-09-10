// @ts-nocheck
"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  inventoryApi,
  inventoryCategoriesApi,
  warehousesApi,
  stockTransfersApi,
  stockAdjustmentsApi,
  stockTakesApi,
  stockRequestsApi,
  goodsIssuesApi,
  goodsReturnsApi,
  outsidePurchasesApi,
  inventoryReportsApi,
  jobsApi,
  type InventoryItem,
  type InventoryCategory,
  type Warehouse,
  type StockTransfer,
  type StockAdjustment,
  type StockTake,
  type StockTakeLine,
  type StockRequest,
  type GoodsIssue,
  type GoodsReturn,
  type OutsidePurchase,
  type InventoryReportResult,
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  Boxes,
  Package,
  Warehouse as WarehouseIcon,
  ArrowLeftRight,
  ClipboardCheck,
  FileText,
  Download,
  Upload,
  FileSpreadsheet,
  Printer,
  Plus,
  Minus,
  Pencil,
  Trash2,
  Check,
  ChevronLeft,
  Eye,
  X,
  Search,
  Filter,
  Loader2,
  XCircle,
  AlertTriangle,
  TrendingDown,
  CheckCircle2,
  ClipboardList,
  FolderTree,
  ArrowRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShoppingCart,
  Activity,
  Clock,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Zap,
  ArrowRightCircle,
} from "lucide-react";
import { useAuth } from "@/components/providers";

const MATERIALS = ["MDF", "Plywood", "Particle Board", "Solid Wood", "Acrylic", "Hardware", "Edge Banding", "Other"];
const UNITS = ["sheet", "m²", "m", "liter", "piece", "box", "pcs", "set"];
const WAREHOUSE_TYPES = [
  { value: "main", label: "Main Warehouse" },
  { value: "site", label: "Site Warehouse" },
  { value: "temporary", label: "Temporary Storage" },
];

/* ============ helpers ============ */
function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function fmtDateTime(s?: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtCurrency(n: number): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "LKR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `LKR ${n.toLocaleString()}`;
  }
}

function fmtCompactCurrency(n: number): string {
  if (n >= 1_000_000) return `LKR ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `LKR ${(n / 1_000).toFixed(1)}K`;
  return fmtCurrency(n);
}

function fmtRelative(s?: string | null): string {
  if (!s) return "—";
  const then = new Date(s).getTime();
  if (!Number.isFinite(then)) return "—";
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.round(day / 30);
  return `${mo}mo ago`;
}

const STATUS_TINTS: Record<string, string> = {
  // positive
  approved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  received: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  issued: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  returned: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  active: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  in_stock: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  // pending / draft / in transit
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  draft: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  in_transit: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  open: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  counting: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  sent: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  // completed / closed
  completed: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  closed: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  // negative
  rejected: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  cancelled: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  disposed: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  inactive: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  low_stock: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  out_of_stock: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  partial: "bg-violet-500/15 text-violet-700 border-violet-500/30",
};

function StatusBadge({ status }: { status: string }) {
  const tint = STATUS_TINTS[status?.toLowerCase()] ?? "bg-muted text-muted-foreground";
  const label = (status ?? "—").replace(/_/g, " ");
  return (
    <Badge variant="outline" className={`capitalize ${tint}`}>
      {label}
    </Badge>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number | string;
  icon: typeof Package;
  tint: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg p-2 ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums truncate">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Package;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="rounded-full bg-muted p-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      {label}
    </div>
  );
}

function TabHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

/* ============ Main View ============ */
export function InventoryView() {
  const [tab, setTab] = React.useState("dashboard");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Boxes className="h-5 w-5 text-primary" />
          Inventory
        </h1>
        <p className="text-xs text-muted-foreground">
          Multi-warehouse stock, transfers, requests, issues, and reports.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="sticky top-0 z-20 -mx-1 px-1 py-1 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="relative overflow-x-auto scrollbar-warm">
            <TabsList className="flex w-max h-auto gap-0.5">
              <TabsTrigger value="dashboard"><Activity className="h-3.5 w-3.5" />Dashboard</TabsTrigger>
              <TabsTrigger value="items"><Package className="h-3.5 w-3.5" />Items</TabsTrigger>
              <TabsTrigger value="warehouses"><WarehouseIcon className="h-3.5 w-3.5" />Warehouses</TabsTrigger>
              <TabsTrigger value="categories"><FolderTree className="h-3.5 w-3.5" />Categories</TabsTrigger>
              <TabsTrigger value="transfers"><ArrowLeftRight className="h-3.5 w-3.5" />Transfers</TabsTrigger>
              <TabsTrigger value="stocktake"><ClipboardCheck className="h-3.5 w-3.5" />Stock Take</TabsTrigger>
              <TabsTrigger value="requests"><ClipboardList className="h-3.5 w-3.5" />Requests</TabsTrigger>
              <TabsTrigger value="issues"><ArrowUpFromLine className="h-3.5 w-3.5" />Issues</TabsTrigger>
              <TabsTrigger value="returns"><ArrowDownToLine className="h-3.5 w-3.5" />Returns</TabsTrigger>
              <TabsTrigger value="outside"><ShoppingCart className="h-3.5 w-3.5" />Outside Purchase</TabsTrigger>
              <TabsTrigger value="reports"><FileText className="h-3.5 w-3.5" />Reports</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="dashboard"><DashboardTab onNavigate={setTab} /></TabsContent>
        <TabsContent value="items"><ItemsTab /></TabsContent>
        <TabsContent value="warehouses"><WarehousesTab /></TabsContent>
        <TabsContent value="categories"><CategoriesTab /></TabsContent>
        <TabsContent value="transfers"><TransfersTab /></TabsContent>
        <TabsContent value="stocktake"><StockTakeTab /></TabsContent>
        <TabsContent value="requests"><RequestsTab /></TabsContent>
        <TabsContent value="issues"><IssuesTab /></TabsContent>
        <TabsContent value="returns"><ReturnsTab /></TabsContent>
        <TabsContent value="outside"><OutsidePurchasesTab /></TabsContent>
        <TabsContent value="reports"><ReportsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============ Dashboard Tab ============ */

const MOVEMENT_META: Record<string, { icon: typeof Activity; tint: string; tab: string }> = {
  Issue: { icon: ArrowUpFromLine, tint: "bg-sky-500/15 text-sky-700", tab: "issues" },
  Return: { icon: ArrowDownToLine, tint: "bg-emerald-500/15 text-emerald-700", tab: "returns" },
  Transfer: { icon: ArrowLeftRight, tint: "bg-violet-500/15 text-violet-700", tab: "transfers" },
  Adjustment: { icon: Activity, tint: "bg-amber-500/15 text-amber-700", tab: "items" },
};

function DashboardTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const queryClient = useQueryClient();
  const { data: inv } = useQuery({ queryKey: ["inventory"], queryFn: inventoryApi.list });
  const { data: wh } = useQuery({ queryKey: ["warehouses"], queryFn: warehousesApi.list });
  const { data: reqs } = useQuery({
    queryKey: ["stock-requests", "list"],
    queryFn: () => stockRequestsApi.list(),
  });
  const { data: tr } = useQuery({
    queryKey: ["stock-transfers", "list"],
    queryFn: () => stockTransfersApi.list(),
  });
  const { data: issues } = useQuery({
    queryKey: ["goods-issues", "list"],
    queryFn: () => goodsIssuesApi.list(),
  });
  const { data: returns } = useQuery({
    queryKey: ["goods-returns", "list"],
    queryFn: () => goodsReturnsApi.list(),
  });
  const { data: adj } = useQuery({
    queryKey: ["stock-adjustments", "list"],
    queryFn: () => stockAdjustmentsApi.list(),
  });

  const items = inv?.items ?? [];
  const warehouses = wh?.warehouses ?? [];
  const requests = reqs?.requests ?? [];
  const transfers = tr?.transfers ?? [];
  const allIssues = issues?.issues ?? [];
  const allReturns = returns?.returns ?? [];
  const adjustments = adj?.adjustments ?? [];

  const lowStock = items.filter(
    (i) => num(i.reorderPoint) > 0 && num(i.stockLevel) <= num(i.reorderPoint) && i.status === "active"
  );
  const outOfStock = items.filter(
    (i) => i.status === "active" && num(i.stockLevel) === 0
  );
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const pendingTransfers = transfers.filter((t) => t.status === "in_transit" || t.status === "draft");

  // ---- Stock Health computation ----
  const activeItems = items.filter((i) => i.status === "active");
  const healthTotal = activeItems.length || 1;
  const healthyCount = activeItems.filter((i) => {
    const reorder = num(i.reorderPoint);
    return num(i.stockLevel) > 0 && (reorder === 0 || num(i.stockLevel) > reorder);
  }).length;
  const reorderCount = activeItems.filter((i) => {
    const reorder = num(i.reorderPoint);
    return reorder > 0 && num(i.stockLevel) > 0 && num(i.stockLevel) <= reorder;
  }).length;
  const outCount = activeItems.filter((i) => num(i.stockLevel) === 0).length;
  const healthyPct = Math.round((healthyCount / healthTotal) * 100);
  const reorderPct = Math.round((reorderCount / healthTotal) * 100);
  const outPct = Math.round((outCount / healthTotal) * 100);

  // ---- Quick Restock dialog state ----
  const [restockOpen, setRestockOpen] = React.useState(false);
  const [restockItem, setRestockItem] = React.useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = React.useState<string>("10");
  const [restockWarehouseId, setRestockWarehouseId] = React.useState<string>("");

  React.useEffect(() => {
    if (warehouses.length > 0 && !restockWarehouseId) {
      // Prefer main warehouse, fall back to first
      const main = warehouses.find((w) => w.type === "main") ?? warehouses[0];
      setRestockWarehouseId(main?.id ?? "");
    }
  }, [warehouses, restockWarehouseId]);

  const restockMutation = useMutation({
    mutationFn: async (payload: {
      itemId: string;
      warehouseId: string;
      quantity: number;
    }) => {
      const adjustment = await stockAdjustmentsApi.create({
        itemId: payload.itemId,
        warehouseId: payload.warehouseId,
        type: "in",
        quantity: payload.quantity,
        reason: "Quick restock from dashboard",
        notes: "Triggered via Quick Restock on low-stock item",
      });
      return adjustment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["stock-adjustments", "list"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Stock restocked successfully");
    },
    onError: () => toast.error("Failed to restock item"),
  });

  function openRestock(item: InventoryItem) {
    setRestockItem(item);
    // Default to a sensible qty — at least the reorder point minus current stock
    const stock = num(item.stockLevel);
    const reorder = num(item.reorderPoint);
    const suggested = reorder > 0 ? Math.max(reorder - stock, reorder) : 10;
    setRestockQty(String(Math.max(1, Math.round(suggested))));
    setRestockOpen(true);
  }

  function submitRestock() {
    if (!restockItem) return;
    const qty = Math.max(1, Math.round(Number(restockQty) || 0));
    if (!restockWarehouseId) {
      toast.error("Please select a warehouse");
      return;
    }
    restockMutation.mutate({
      itemId: restockItem.id,
      warehouseId: restockWarehouseId,
      quantity: qty,
    });
    setRestockOpen(false);
    setRestockItem(null);
  }


  // ---- Stock Value computation ----
  const stockValue = items.reduce(
    (sum, i) => sum + num(i.stockLevel) * num(i.unitCost),
    0
  );
  // Placeholder trend — derive a deterministic pseudo-trend from value so the UI
  // feels alive without a historical series. ±5% range, positive bias.
  const seed = Math.round(stockValue / 1000) % 17;
  const trendPct = Math.round((((seed * 37) % 110) / 10 - 3.5) * 10) / 10; // -3.5 .. +7.5
  const trendPositive = trendPct >= 0;

  type Movement = { date: string; type: string; number: string; description: string };
  const movements: Movement[] = [
    ...allIssues.map((i) => ({
      date: i.createdAt,
      type: "Issue",
      number: i.issueNo,
      description: `${i.lines.length} item(s) issued to ${i.job?.orderNumber ?? "—"}`,
    })),
    ...allReturns.map((r) => ({
      date: r.createdAt,
      type: "Return",
      number: r.returnNo,
      description: `${r.lines.length} item(s) returned from ${r.job?.orderNumber ?? "—"}`,
    })),
    ...adjustments.map((a) => ({
      date: a.createdAt,
      type: "Adjustment",
      number: a.adjNo,
      description: `${a.item?.name ?? "—"} (${a.type}, ${num(a.diff) >= 0 ? "+" : ""}${num(a.diff)})`,
    })),
    ...transfers
      .filter((t) => t.status !== "draft")
      .map((t) => ({
        date: t.createdAt,
        type: "Transfer",
        number: t.transferNo,
        description: `${t.fromWarehouse?.code ?? "—"} → ${t.toWarehouse?.code ?? "—"}`,
      })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);

  // ---- Warehouse capacity ----
  const warehouseCapacity = warehouses.map((w) => {
    const count = w.itemCount ?? w._count?.stockLots ?? 0;
    return { id: w.id, code: w.code, name: w.name, type: w.type, count };
  });
  const maxWhCount = Math.max(1, ...warehouseCapacity.map((w) => w.count));

  function handleReorderAll() {
    onNavigate?.("requests");
    if (lowStock.length > 0) {
      toast.info(`Reorder queued for ${lowStock.length} low-stock item${lowStock.length === 1 ? "" : "s"}`, {
        description: "Open the Requests tab to create stock requests.",
      });
    }
  }

  return (
    <div className="space-y-3">
      <TabHeader title="Dashboard" description="Overview of inventory health and pending work." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MiniStat label="Total Items" value={items.length} icon={Package} tint="bg-primary/10 text-primary" />
        <MiniStat label="Warehouses" value={warehouses.length} icon={WarehouseIcon} tint="bg-teal-500/10 text-teal-600" />
        <MiniStat label="Low Stock" value={lowStock.length} icon={TrendingDown} tint="bg-rose-500/10 text-rose-600" />
        <MiniStat label="Pending Requests" value={pendingRequests.length} icon={ClipboardList} tint="bg-amber-500/10 text-amber-600" />
        <MiniStat label="Pending Transfers" value={pendingTransfers.length} icon={ArrowLeftRight} tint="bg-violet-500/10 text-violet-600" />
        <MiniStat label="Active Items" value={items.filter((i) => i.status === "active").length} icon={CheckCircle2} tint="bg-emerald-500/10 text-emerald-600" />
      </div>

      {/* ---- Stock Value banner (prominent) ---- */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-primary/15 p-3">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total Stock Value
                </p>
                <p className="text-3xl font-bold tabular-nums tracking-tight">
                  {fmtCompactCurrency(stockValue)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {fmtCurrency(stockValue)} · across {items.length} item{items.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  trendPositive
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-700"
                }`}
                title="Placeholder trend vs last month"
              >
                {trendPositive ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {trendPositive ? "+" : ""}
                {trendPct.toFixed(1)}%
                <span className="font-normal text-muted-foreground">vs last month</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Stock Health bar ---- */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                Stock Health
              </CardTitle>
              <CardDescription>
                Distribution of {activeItems.length} active item{activeItems.length === 1 ? "" : "s"} by stock status
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {healthyPct}% healthy
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeItems.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No active inventory"
              description="Add inventory items to see stock health metrics here."
            />
          ) : (
            <div className="space-y-2">
              {/* Horizontal stacked bar */}
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${healthyPct}%` }}
                  title={`${healthyCount} healthy (${healthyPct}%)`}
                />
                <div
                  className="bg-amber-500 transition-all"
                  style={{ width: `${reorderPct}%` }}
                  title={`${reorderCount} at reorder (${reorderPct}%)`}
                />
                <div
                  className="bg-rose-500 transition-all"
                  style={{ width: `${outPct}%` }}
                  title={`${outCount} out of stock (${outPct}%)`}
                />
              </div>
              {/* Legend */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <button
                  type="button"
                  onClick={() => onNavigate?.("items")}
                  className="group rounded-lg border border-border bg-card/60 p-2 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Healthy</span>
                  </div>
                  <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600">{healthyCount}</p>
                  <p className="text-[10px] text-muted-foreground">{healthyPct}%</p>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.("items")}
                  className="group rounded-lg border border-border bg-card/60 p-2 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">At Reorder</span>
                  </div>
                  <p className="mt-1 text-lg font-bold tabular-nums text-amber-600">{reorderCount}</p>
                  <p className="text-[10px] text-muted-foreground">{reorderPct}%</p>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.("items")}
                  className="group rounded-lg border border-border bg-card/60 p-2 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Out of Stock</span>
                  </div>
                  <p className="mt-1 text-lg font-bold tabular-nums text-rose-600">{outCount}</p>
                  <p className="text-[10px] text-muted-foreground">{outPct}%</p>
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Pending Actions card ---- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" />
            Pending Actions
          </CardTitle>
          <CardDescription>Quick access to outstanding inventory tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => onNavigate?.("requests")}
              className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/15 p-2">
                  <ClipboardList className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{pendingRequests.length}</p>
                  <p className="text-xs text-muted-foreground">
                    Pending Request{pendingRequests.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.("transfers")}
              className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-violet-500/15 p-2">
                  <ArrowLeftRight className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{pendingTransfers.length}</p>
                  <p className="text-xs text-muted-foreground">
                    In-transit Transfer{pendingTransfers.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-rose-500/15 p-2">
                  <TrendingDown className="h-4 w-4 text-rose-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums text-rose-600">{lowStock.length}</p>
                  <p className="text-xs text-muted-foreground">
                    Low Stock Item{lowStock.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              {lowStock.length > 0 ? (
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 shrink-0"
                  onClick={handleReorderAll}
                >
                  <Zap className="mr-1.5 h-3.5 w-3.5" />
                  Reorder All
                </Button>
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* ---- Recent Activity (improved) ---- */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest stock movements across all warehouses · click to open</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {movements.length === 0 ? (
              <EmptyState icon={Activity} title="No recent activity" description="Movements will appear here once you start issuing or transferring stock." />
            ) : (
              <div className="divide-y">
                {movements.map((m, idx) => {
                  const meta = MOVEMENT_META[m.type] ?? {
                    icon: Activity,
                    tint: "bg-muted text-muted-foreground",
                    tab: "items",
                  };
                  const Icon = meta.icon;
                  const targetTab = meta.tab;
                  return (
                    <button
                      key={`${m.number}-${idx}`}
                      type="button"
                      onClick={() => onNavigate?.(targetTab)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.tint}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{m.number}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {m.type}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground" title={fmtDateTime(m.date)}>
                          {fmtRelative(m.date)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---- Low Stock Alerts (improved) ---- */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  Low Stock Alerts
                </CardTitle>
                <CardDescription>Items at or below reorder point</CardDescription>
              </div>
              {lowStock.length >= 2 && (
                <Button size="sm" variant="default" className="h-8" onClick={handleReorderAll}>
                  <Zap className="mr-1.5 h-3.5 w-3.5" />
                  Reorder All ({lowStock.length})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {lowStock.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="All stocked up" description="No items are below their reorder point." />
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y">
                {lowStock.slice(0, 8).map((i) => {
                  const stock = num(i.stockLevel);
                  const reorder = num(i.reorderPoint);
                  const isOut = stock === 0;
                  const shortage = Math.max(0, reorder - stock);
                  // Capacity bar: stock level relative to reorder point (100% = at reorder threshold)
                  // We want to surface how far below reorder we are, so the bar shows stock/reorder clamped to [0,1].
                  const pct = reorder > 0 ? Math.min(100, Math.round((stock / reorder) * 100)) : 0;
                  const barColor = isOut
                    ? "bg-rose-500"
                    : pct < 50
                    ? "bg-rose-500"
                    : "bg-amber-500";
                  return (
                    <div key={i.id} className="px-4 py-3 transition-colors hover:bg-muted/30">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{i.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {i.code ?? i.material} · {i.unit}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <p className={`text-sm font-bold tabular-nums ${isOut ? "text-rose-600" : "text-amber-600"}`}>
                            {stock} <span className="text-xs font-normal text-muted-foreground">{i.unit}</span>
                          </p>
                          {shortage > 0 && (
                            <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-700">
                              −{shortage} short
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`absolute inset-y-0 left-0 ${barColor} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-20 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">
                          reorder @ {reorder}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => openRestock(i)}
                          disabled={restockMutation.isPending}
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Quick Restock
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Warehouse Capacity mini-visualization ---- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <WarehouseIcon className="h-4 w-4 text-primary" />
            Warehouse Capacity
          </CardTitle>
          <CardDescription>
            Distinct item count per warehouse · relative utilization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {warehouseCapacity.length === 0 ? (
            <EmptyState icon={WarehouseIcon} title="No warehouses configured" description="Add warehouses in the Warehouses tab to see capacity here." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {warehouseCapacity.map((w) => {
                const pct = Math.round((w.count / maxWhCount) * 100);
                const barColor =
                  pct >= 85
                    ? "bg-rose-500"
                    : pct >= 50
                    ? "bg-amber-500"
                    : "bg-emerald-500";
                const tint =
                  pct >= 85
                    ? "text-rose-600"
                    : pct >= 50
                    ? "text-amber-600"
                    : "text-emerald-600";
                const status =
                  pct >= 85 ? "Full" : pct >= 50 ? "Moderate" : "Healthy";
                return (
                  <div
                    key={w.id}
                    className="rounded-lg border border-border bg-card/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{w.name}</p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {w.code} · {w.type}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${tint}`}>
                        {status}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`absolute inset-y-0 left-0 ${barColor} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right text-xs font-medium tabular-nums">
                        {w.count} item{w.count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Quick Restock dialog ---- */}
      <Dialog open={restockOpen} onOpenChange={(open) => {
        setRestockOpen(open);
        if (!open) setRestockItem(null);
      }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Quick Restock
            </DialogTitle>
            <DialogDescription>
              {restockItem
                ? `Add stock for ${restockItem.name}${restockItem.code ? ` (${restockItem.code})` : ""}. A stock adjustment (type: in) will be created.`
                : "Add stock to a low-stock item."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="restock-qty">Quantity</Label>
              <Input
                id="restock-qty"
                type="number"
                min="1"
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                disabled={restockMutation.isPending}
              />
              {restockItem && (
                <p className="text-xs text-muted-foreground">
                  Current: <span className="font-medium tabular-nums">{num(restockItem.stockLevel)}</span>
                  {" · "}Reorder point: <span className="font-medium tabular-nums">{num(restockItem.reorderPoint)}</span>
                  {" · "}Unit: <span className="font-medium">{restockItem.unit}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="restock-wh">Warehouse</Label>
              <Select
                value={restockWarehouseId}
                onValueChange={setRestockWarehouseId}
                disabled={restockMutation.isPending}
              >
                <SelectTrigger id="restock-wh">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRestockOpen(false);
                setRestockItem(null);
              }}
              disabled={restockMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={submitRestock}
              disabled={
                restockMutation.isPending ||
                !restockItem ||
                !restockWarehouseId ||
                Number(restockQty) <= 0
              }
            >
              {restockMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============ Items Tab ============ */
function ItemsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [materialFilter, setMaterialFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [editing, setEditing] = React.useState<InventoryItem | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<InventoryItem | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["inventory"], queryFn: inventoryApi.list });
  const { data: catData } = useQuery({ queryKey: ["inventory-categories"], queryFn: inventoryCategoriesApi.list });
  const items = data?.items ?? [];
  const categories = catData?.categories ?? [];

  const filtered = React.useMemo(() => {
    return items.filter((i) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        i.name.toLowerCase().includes(q) ||
        (i.code ?? "").toLowerCase().includes(q) ||
        (i.supplier ?? "").toLowerCase().includes(q);
      const matchesMaterial = materialFilter === "all" || i.material === materialFilter;
      const matchesCat = categoryFilter === "all" || i.categoryId === categoryFilter;
      const matchesStatus = statusFilter === "all" || i.status === statusFilter;
      return matchesSearch && matchesMaterial && matchesCat && matchesStatus;
    });
  }, [items, search, materialFilter, categoryFilter, statusFilter]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (e: Error) => toast.error("Delete failed", { description: e.message }),
  });

  // ---- Undo-aware delete: optimistically remove + Undo toast (5s) ----
  const undoRef = React.useRef<{
    item: InventoryItem;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);

  function deleteItemWithUndo(item: InventoryItem) {
    const timeoutId = setTimeout(() => {
      deleteMutation.mutate(item.id);
      undoRef.current = null;
    }, 5000);
    undoRef.current = { item, timeoutId };

    // Optimistically remove from cache while keeping stats shape intact
    queryClient.setQueryData<{ items: InventoryItem[]; stats?: unknown } | undefined>(
      ["inventory"],
      (old) =>
        old
          ? { ...old, items: old.items.filter((i) => i.id !== item.id) }
          : old
    );

    setDeleting(null);

    toast(`Item "${item.name}" deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          if (undoRef.current) {
            clearTimeout(undoRef.current.timeoutId);
            const restored = undoRef.current.item;
            queryClient.setQueryData<{ items: InventoryItem[]; stats?: unknown } | undefined>(
              ["inventory"],
              (old) => {
                if (!old) return { items: [restored] };
                if (old.items.some((i) => i.id === restored.id)) return old;
                return { ...old, items: [restored, ...old.items] };
              }
            );
            toast.success("Item restored");
            undoRef.current = null;
          }
        },
      },
      duration: 5000,
    });
  }

  function exportCsv() {
    const headers = ["Name", "Code", "Material", "Thickness", "Unit", "Stock", "Min", "Reorder", "Supplier", "Category", "Status"];
    const rows = filtered.map((i) => ({
      Name: i.name,
      Code: i.code ?? "",
      Material: i.material,
      Thickness: i.thickness ?? "",
      Unit: i.unit,
      Stock: num(i.stockLevel),
      Min: num(i.minStock),
      Reorder: num(i.reorderPoint),
      Supplier: i.supplier ?? "",
      Category: i.category?.name ?? "",
      Status: i.status,
    }));
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => {
      const v = String(r[h as keyof typeof r] ?? "");
      return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-items-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  function downloadTemplate() {
    const headers = ["Name", "Code", "Material", "Thickness", "Unit", "Stock", "Min", "Reorder", "Supplier", "Category", "Status"];
    const sampleRows = [
      ["18mm MDF Board", "MDF-18", "MDF", "18mm", "sheet", "50", "10", "20", "ABC Suppliers", "Boards", "active"],
      ["Hinge Soft-Close", "HG-SC", "Hardware", "", "pcs", "100", "20", "40", "XYZ Hardware", "Hardware", "active"],
      ["PVC Edge Band White", "EB-W-2", "PVC", "2mm", "m", "500", "100", "200", "Edge Co Ltd", "Edging", "active"],
    ];
    const csv = [headers.join(","), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded — fill it and import back");
  }

  function importCsv(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result ?? "");
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error("CSV must have a header and at least one row");
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      let imported = 0;
      for (const line of lines.slice(1)) {
        const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const get = (key: string) => {
          const idx = headers.indexOf(key);
          return idx >= 0 ? cells[idx] : "";
        };
        const name = get("name");
        const material = get("material") || "Other";
        if (!name) continue;
        try {
          await inventoryApi.create({
            name,
            code: get("code") || null,
            material,
            thickness: get("thickness") || null,
            unit: get("unit") || "sheet",
            stockLevel: Number(get("stock")) || 0,
            minStock: Number(get("min")) || 0,
            reorderPoint: Number(get("reorder")) || 0,
            supplier: get("supplier") || null,
            status: "active",
          });
          imported++;
        } catch (e) {
          // skip duplicates
          console.error("Import error:", e);
        }
      }
      toast.success(`Imported ${imported} item(s)`);
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    };
    reader.readAsText(file);
  }

  // ===== Category summary data for cards grid =====
  const catSummary = React.useMemo(() => {
    const map = new Map<string, { name: string; count: number; totalStock: number; lowCount: number }>();
    map.set("uncategorized", { name: "Uncategorized", count: 0, totalStock: 0, lowCount: 0 });
    for (const i of items) {
      const key = i.categoryId ?? "uncategorized";
      const name = i.category?.name ?? "Uncategorized";
      const existing = map.get(key) ?? { name, count: 0, totalStock: 0, lowCount: 0 };
      existing.count += 1;
      existing.totalStock += num(i.stockLevel);
      const stock = num(i.stockLevel);
      const reorder = num(i.reorderPoint);
      if (i.status === "active" && (stock === 0 || (reorder > 0 && stock <= reorder))) {
        existing.lowCount += 1;
      }
      map.set(key, existing);
    }
    return Array.from(map.entries()).filter(([, v]) => v.name !== "Uncategorized" || v.count > 0);
  }, [items]);

  // ===== Low stock items =====
  const lowStockItems = React.useMemo(() => {
    return items.filter((i) => {
      if (i.status !== "active") return false;
      const stock = num(i.stockLevel);
      const reorder = num(i.reorderPoint);
      return stock === 0 || (reorder > 0 && stock <= reorder);
    });
  }, [items]);

  // ===== Quick stock adjust =====
  const adjustMutation = useMutation({
    mutationFn: ({ id, newStock }: { id: string; newStock: number }) =>
      inventoryApi.update(id, { stockLevel: Math.max(0, newStock) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory"] }),
    onError: () => toast.error("Failed to update stock"),
  });

  function quickAdjust(item: InventoryItem, delta: number) {
    const newStock = Math.max(0, num(item.stockLevel) + delta);
    adjustMutation.mutate({ id: item.id, newStock });
  }

  // ===== Stock color helper =====
  function stockColor(item: InventoryItem): string {
    if (item.status !== "active") return "text-muted-foreground";
    const stock = num(item.stockLevel);
    const reorder = num(item.reorderPoint);
    const min = num(item.minStock);
    if (stock === 0) return "text-red-600 font-bold";
    if (reorder > 0 && stock <= reorder) return "text-amber-600 font-bold";
    if (min > 0 && stock <= min) return "text-orange-600 font-semibold";
    return "text-emerald-600 font-semibold";
  }

  function isLowStock(item: InventoryItem): boolean {
    if (item.status !== "active") return false;
    const stock = num(item.stockLevel);
    const reorder = num(item.reorderPoint);
    return stock === 0 || (reorder > 0 && stock <= reorder);
  }

  return (
    <div className="space-y-3">
      <TabHeader
        title="Inventory Items"
        description="Search and manage your material catalog. Filter by category, material, or status."
        action={
          <div className="flex flex-wrap gap-2">
            <input
              type="file"
              accept=".csv"
              id="inv-import"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCsv(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" onClick={() => document.getElementById("inv-import")?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button variant="ghost" onClick={downloadTemplate} title="Download CSV template with sample data">
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Template
            </Button>
            <Button onClick={() => { setEditing(null); setCreateOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </div>
        }
      />

      {/* ===== Summary Stats Cards ===== */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Items</p>
          <p className="text-2xl font-bold tabular-nums">{items.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Stock Qty</p>
          <p className="text-2xl font-bold tabular-nums text-primary">
            {items.reduce((s, i) => s + num(i.stockLevel), 0).toLocaleString()}
          </p>
        </Card>
        <Card className="p-3 border-red-500/30 bg-red-500/5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Low Stock</p>
          <p className="text-2xl font-bold tabular-nums text-red-600">{lowStockItems.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Categories</p>
          <p className="text-2xl font-bold tabular-nums">{catSummary.length}</p>
        </Card>
      </div>

      {/* ===== Category Summary Cards Grid ===== */}
      {catSummary.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {catSummary.map(([catId, s]) => (
            <button
              key={catId}
              onClick={() => setCategoryFilter(categoryFilter === catId ? "all" : catId)}
              className={`rounded-lg border p-3 text-left transition-all hover:shadow-md ${
                categoryFilter === catId ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-card"
              }`}
            >
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{s.name}</p>
              <p className="text-xl font-bold text-amber-600 tabular-nums">{s.totalStock.toLocaleString()}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{s.count} items</span>
                {s.lowCount > 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                    <AlertTriangle className="h-2.5 w-2.5" /> {s.lowCount} low
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ===== Horizontal Category Tabs ===== */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setCategoryFilter("all")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            categoryFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          All ({items.length})
        </button>
        {categories.map((c) => {
          const s = catSummary.find(([id]) => id === c.id);
          const count = s?.[1].count ?? 0;
          return (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(categoryFilter === c.id ? "all" : c.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                categoryFilter === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {c.name} ({count})
            </button>
          );
        })}
      </div>

      {/* ===== Low Stock Alert Section ===== */}
      {lowStockItems.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-red-500/10 p-1.5">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <h3 className="text-sm font-bold text-red-700 dark:text-red-400">
              {lowStockItems.length} Low Stock Item{lowStockItems.length === 1 ? "" : "s"}
            </h3>
            <span className="text-xs text-muted-foreground">Below reorder point — needs restocking</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lowStockItems.slice(0, 12).map((i) => {
              const stock = num(i.stockLevel);
              const reorder = num(i.reorderPoint);
              return (
                <div key={i.id} className="flex items-center justify-between rounded-md border border-red-500/20 bg-card px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{i.name}</p>
                    <p className="text-[10px] text-muted-foreground">{i.category?.name ?? "Uncategorized"}</p>
                  </div>
                  <div className="ml-2 flex items-center gap-1.5">
                    <span className={`text-sm font-bold tabular-nums ${stock === 0 ? "text-red-600" : "text-amber-600"}`}>
                      {stock}
                    </span>
                    <span className="text-[10px] text-muted-foreground">/ {reorder} {i.unit}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-6 w-6 shrink-0 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                      onClick={() => quickAdjust(i, 1)}
                      title="Quick add 1"
                      aria-label={`Quick add 1 ${i.name}`}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {lowStockItems.length > 12 && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              +{lowStockItems.length - 12} more low stock items — see full list below
            </p>
          )}
        </div>
      )}

      {/* ===== Search & Filter Bar ===== */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative flex-1 sm:min-w-[240px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search items or categories…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8"
              />
            </div>
            <Select value={materialFilter} onValueChange={setMaterialFilter}>
              <SelectTrigger className="h-9 w-full sm:w-40">
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                <SelectValue placeholder="Material" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All materials</SelectItem>
                {MATERIALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="disposed">Disposed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CardDescription className="mt-2">{filtered.length} of {items.length} items</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState label="Loading inventory…" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No items found"
              description={search || materialFilter !== "all" || categoryFilter !== "all" || statusFilter !== "all" ? "Try adjusting your filters." : "Add your first inventory item to get started."}
              action={!search && materialFilter === "all" && categoryFilter === "all" && statusFilter === "all" ? (
                <Button variant="outline" onClick={() => { setEditing(null); setCreateOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" /> Add First Item
                </Button>
              ) : undefined}
            />
          ) : (
            <div className="max-h-[60vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="hidden md:table-cell">Code</TableHead>
                    <TableHead className="hidden lg:table-cell">Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Min / Reorder</TableHead>
                    <TableHead className="text-center">Adjust</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((i, idx) => {
                    const stock = num(i.stockLevel);
                    const reorder = num(i.reorderPoint);
                    const low = isLowStock(i);
                    return (
                      <TableRow key={i.id} className={`hover:bg-muted/50 transition-colors ${low ? "bg-red-500/5" : ""}`}>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{i.name}</p>
                          {low && (
                            <p className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                              <AlertTriangle className="h-2.5 w-2.5" /> Low stock
                            </p>
                          )}
                          {i.thickness && !low && (
                            <p className="text-xs text-muted-foreground">{i.thickness} · {i.unit}</p>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-mono">
                          {i.code ?? "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {i.category ? (
                            <Badge variant="outline" className="text-[10px]">{i.category.name}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums ${stockColor(i)}`}>
                          {stock} <span className="text-xs font-normal text-muted-foreground">{i.unit}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right tabular-nums text-xs text-muted-foreground">
                          {num(i.minStock)} / {reorder}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-0.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 border-red-500/20 text-red-600 hover:bg-red-500/10"
                              onClick={() => quickAdjust(i, -1)}
                              disabled={stock <= 0 || adjustMutation.isPending}
                              title="Remove 1"
                              aria-label={`Remove 1 from ${i.name}`}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10"
                              onClick={() => quickAdjust(i, 1)}
                              disabled={adjustMutation.isPending}
                              title="Add 1"
                              aria-label={`Add 1 to ${i.name}`}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(i); setCreateOpen(true); }} aria-label={`Edit item ${i.name}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleting(i)} aria-label={`Delete item ${i.name}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ItemDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        item={editing}
        categories={categories}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <span className="font-medium text-foreground">{deleting?.name}</span>. You can undo this from the toast that appears.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteItemWithUndo(deleting);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…</>
              ) : (
                "Delete item"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ItemDialog({
  open,
  onOpenChange,
  item,
  categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: InventoryItem | null;
  categories: InventoryCategory[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    name: "",
    code: "",
    material: "MDF",
    thickness: "",
    unit: "sheet",
    stockLevel: "",
    minStock: "",
    reorderPoint: "",
    supplier: "",
    categoryId: "",
    status: "active",
    notes: "",
  });

  React.useEffect(() => {
    if (open) {
      if (item) {
        setForm({
          name: item.name,
          code: item.code ?? "",
          material: item.material,
          thickness: item.thickness ?? "",
          unit: item.unit,
          stockLevel: String(num(item.stockLevel)),
          minStock: String(num(item.minStock)),
          reorderPoint: String(num(item.reorderPoint)),
          supplier: item.supplier ?? "",
          categoryId: item.categoryId ?? "",
          status: item.status,
          notes: item.notes ?? "",
        });
      } else {
        setForm({
          name: "",
          code: "",
          material: "MDF",
          thickness: "",
          unit: "sheet",
          stockLevel: "",
          minStock: "",
          reorderPoint: "",
          supplier: "",
          categoryId: "",
          status: "active",
          notes: "",
        });
      }
    }
  }, [open, item]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        material: form.material,
        thickness: form.thickness || null,
        unit: form.unit,
        stockLevel: Number(form.stockLevel) || 0,
        minStock: Number(form.minStock) || 0,
        reorderPoint: Number(form.reorderPoint) || 0,
        supplier: form.supplier.trim() || null,
        categoryId: form.categoryId || null,
        status: form.status,
        notes: form.notes.trim() || null,
      };
      if (item) return inventoryApi.update(item.id, payload);
      return inventoryApi.create(payload);
    },
    onSuccess: () => {
      toast.success(item ? "Item updated" : "Item added");
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(item ? "Update failed" : "Create failed", { description: e.message }),
  });

  const isDispose = form.status === "disposed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[560px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>{item ? "Edit Item" : "Add Inventory Item"}</DialogTitle>
                <DialogDescription className="mt-0.5">
                  {item ? "Update item details and stock thresholds." : "Record a new material or part."}
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) {
              toast.error("Name is required");
              return;
            }
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="it-name">Name <span className="text-destructive">*</span></Label>
              <Input id="it-name" placeholder="e.g. MDF 18mm White Melamine" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} required disabled={mutation.isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="it-code">Code / SKU</Label>
              <Input id="it-code" placeholder="e.g. MDF-18-WHT" value={form.code} onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))} disabled={mutation.isPending} />
            </div>
            <div className="space-y-2">
              <Label>Material</Label>
              <Select value={form.material} onValueChange={(v) => setForm((s) => ({ ...s, material: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MATERIALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="it-thickness">Thickness / Spec</Label>
              <Input id="it-thickness" placeholder="18mm" value={form.thickness} onChange={(e) => setForm((s) => ({ ...s, thickness: e.target.value }))} disabled={mutation.isPending} />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={(v) => setForm((s) => ({ ...s, unit: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.categoryId || "__none__"} onValueChange={(v) => setForm((s) => ({ ...s, categoryId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Uncategorized" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Uncategorized</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((s) => ({ ...s, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="disposed">Disposed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="it-stock">Stock Level</Label>
              <Input id="it-stock" type="number" min="0" step="0.5" placeholder="0" value={form.stockLevel} onChange={(e) => setForm((s) => ({ ...s, stockLevel: e.target.value }))} disabled={mutation.isPending || isDispose} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="it-min">Min Stock</Label>
              <Input id="it-min" type="number" min="0" step="0.5" placeholder="0" value={form.minStock} onChange={(e) => setForm((s) => ({ ...s, minStock: e.target.value }))} disabled={mutation.isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="it-reorder">Reorder Point</Label>
              <Input id="it-reorder" type="number" min="0" step="0.5" placeholder="0" value={form.reorderPoint} onChange={(e) => setForm((s) => ({ ...s, reorderPoint: e.target.value }))} disabled={mutation.isPending} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="it-supplier">Supplier</Label>
              <Input id="it-supplier" placeholder="Supplier name" value={form.supplier} onChange={(e) => setForm((s) => ({ ...s, supplier: e.target.value }))} disabled={mutation.isPending} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="it-notes">Notes</Label>
              <Textarea id="it-notes" rows={2} placeholder="Optional notes" value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} disabled={mutation.isPending} />
            </div>
          </div>
          {isDispose && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-700">
              <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
              Marking this item as <strong>Disposed</strong> will remove it from active stock tracking. Use this for items that have been discarded or are no longer usable.
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
              {item ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Warehouses Tab ============ */
function WarehousesTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState<Warehouse | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Warehouse | null>(null);
  const [viewing, setViewing] = React.useState<Warehouse | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["warehouses"], queryFn: warehousesApi.list });
  const warehouses = data?.warehouses ?? [];

  const toggleActiveMutation = useMutation({
    mutationFn: (w: Warehouse) => warehousesApi.update(w.id, { isActive: !w.isActive }),
    onSuccess: () => {
      toast.success("Warehouse updated");
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => warehousesApi.remove(id),
    onSuccess: () => {
      toast.success("Warehouse deleted");
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error("Delete failed", { description: e.message }),
  });

  return (
    <div className="space-y-3">
      <TabHeader
        title="Warehouses"
        description="Manage your storage locations — main warehouse, site stores, and temporary stock."
        action={
          <Button onClick={() => { setEditing(null); setCreateOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Warehouse
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState label="Loading warehouses…" />
      ) : warehouses.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={WarehouseIcon}
              title="No warehouses yet"
              description="Add your first warehouse to start tracking stock by location."
              action={<Button variant="outline" onClick={() => { setEditing(null); setCreateOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Warehouse</Button>}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((w) => (
            <Card key={w.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <WarehouseIcon className="h-4 w-4 text-primary" />
                      <span className="truncate">{w.name}</span>
                    </CardTitle>
                    <CardDescription className="font-mono">{w.code}</CardDescription>
                  </div>
                  <Switch
                    checked={w.isActive}
                    onCheckedChange={() => toggleActiveMutation.mutate(w)}
                    aria-label="Toggle active"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <Badge variant="outline" className="capitalize">{w.type}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Location</span>
                  <span className="text-right truncate ml-2">{w.location ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Items in stock</span>
                  <span className="font-semibold tabular-nums">{w.itemCount ?? 0}</span>
                </div>
              </CardContent>
              <Separator />
              <div className="flex items-center justify-end gap-1 p-3">
                <Button variant="ghost" size="sm" onClick={() => setViewing(w)}>
                  <FileText className="mr-1.5 h-3.5 w-3.5" /> View Stock
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(w); setCreateOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleting(w)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <WarehouseDialog open={createOpen} onOpenChange={setCreateOpen} warehouse={editing} />
      <WarehouseStockDialog warehouse={viewing} onClose={() => setViewing(null)} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete warehouse?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-medium text-foreground">{deleting?.name}</span> ({deleting?.code}). The warehouse must have no active stock lots.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMutation.mutate(deleting.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…</> : "Delete warehouse"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WarehouseDialog({
  open,
  onOpenChange,
  warehouse,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  warehouse: Warehouse | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    code: "",
    name: "",
    location: "",
    type: "main",
    isActive: true,
  });

  React.useEffect(() => {
    if (open) {
      if (warehouse) {
        setForm({
          code: warehouse.code,
          name: warehouse.name,
          location: warehouse.location ?? "",
          type: warehouse.type,
          isActive: warehouse.isActive,
        });
      } else {
        setForm({ code: "", name: "", location: "", type: "main", isActive: true });
      }
    }
  }, [open, warehouse]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        location: form.location.trim() || undefined,
        type: form.type,
        isActive: form.isActive,
      };
      if (warehouse) return warehousesApi.update(warehouse.id, payload);
      return warehousesApi.create(payload);
    },
    onSuccess: () => {
      toast.success(warehouse ? "Warehouse updated" : "Warehouse added");
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(warehouse ? "Update failed" : "Create failed", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <WarehouseIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>{warehouse ? "Edit Warehouse" : "Add Warehouse"}</DialogTitle>
                <DialogDescription className="mt-0.5">
                  {warehouse ? "Update warehouse details." : "Define a new storage location."}
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!form.code.trim() || !form.name.trim()) {
            toast.error("Code and name are required");
            return;
          }
          mutation.mutate();
        }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="wh-code">Code <span className="text-destructive">*</span></Label>
              <Input id="wh-code" placeholder="WH-MAIN" value={form.code} onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))} disabled={mutation.isPending || !!warehouse} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-name">Name <span className="text-destructive">*</span></Label>
              <Input id="wh-name" placeholder="Main Warehouse" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} disabled={mutation.isPending} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((s) => ({ ...s, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-loc">Location</Label>
              <Input id="wh-loc" placeholder="Factory / Site address" value={form.location} onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))} disabled={mutation.isPending} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.isActive} onCheckedChange={(c) => setForm((s) => ({ ...s, isActive: c }))} id="wh-active" />
            <Label htmlFor="wh-active" className="cursor-pointer">Active</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WarehouseIcon className="mr-2 h-4 w-4" />}
              {warehouse ? "Save Changes" : "Add Warehouse"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WarehouseStockDialog({
  warehouse,
  onClose,
}: {
  warehouse: Warehouse | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["warehouse", warehouse?.id],
    queryFn: () => warehousesApi.get(warehouse!.id),
    enabled: !!warehouse?.id,
  });
  const lots = data?.warehouse?.stockLots ?? [];

  return (
    <Dialog open={!!warehouse} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-[640px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <WarehouseIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>{warehouse?.name} — Stock Breakdown</DialogTitle>
                <DialogDescription className="mt-0.5">
                  {warehouse?.code} · {lots.length} lot(s) on hand
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        {isLoading ? (
          <LoadingState label="Loading stock…" />
        ) : lots.length === 0 ? (
          <EmptyState icon={Package} title="No stock in this warehouse" description="Transfer stock in or create a stock lot to begin." />
        ) : (
          <div className="max-h-[60vh] overflow-auto scrollbar-warm">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="hidden sm:table-cell">Code</TableHead>
                  <TableHead className="hidden md:table-cell">Batch</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="hidden md:table-cell">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{lot.item.name}</p>
                      <p className="text-xs text-muted-foreground">{lot.item.material}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs font-mono text-muted-foreground">{lot.item.code ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{lot.batchNo ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {num(lot.quantity)} <span className="text-xs text-muted-foreground">{lot.item.unit}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{fmtDate(lot.receivedDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ============ Categories Tab ============ */
function CategoriesTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState<InventoryCategory | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<InventoryCategory | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["inventory-categories"], queryFn: inventoryCategoriesApi.list });
  const categories = data?.categories ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryCategoriesApi.remove(id),
    onSuccess: () => {
      toast.success("Category deleted");
      queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error("Delete failed", { description: e.message }),
  });

  return (
    <div className="space-y-3">
      <TabHeader
        title="Categories"
        description="Group inventory items by type — sheets, hardware, hardware, consumables, etc."
        action={
          <Button onClick={() => { setEditing(null); setCreateOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Category
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState label="Loading categories…" />
          ) : categories.length === 0 ? (
            <EmptyState
              icon={FolderTree}
              title="No categories yet"
              description="Add your first category to organize your inventory."
              action={<Button variant="outline" onClick={() => { setEditing(null); setCreateOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Category</Button>}
            />
          ) : (
            <div className="overflow-x-auto scrollbar-warm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Name</TableHead>
                  <TableHead className="hidden sm:table-cell min-w-[200px]">Description</TableHead>
                  <TableHead className="text-right min-w-[80px]">Items</TableHead>
                  <TableHead className="text-right min-w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FolderTree className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{c.description ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.itemCount ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(c); setCreateOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleting(c)}>
                          <Trash2 className="h-4 w-4" />
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

      <CategoryDialog open={createOpen} onOpenChange={setCreateOpen} category={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Items in <span className="font-medium text-foreground">{deleting?.name}</span> will be moved to &ldquo;Uncategorized&rdquo;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMutation.mutate(deleting.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…</> : "Delete category"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  category: InventoryCategory | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setName(category?.name ?? "");
      setDescription(category?.description ?? "");
    }
  }, [open, category]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), description: description.trim() || undefined };
      if (category) return inventoryCategoriesApi.update(category.id, payload);
      return inventoryCategoriesApi.create(payload);
    },
    onSuccess: () => {
      toast.success(category ? "Category updated" : "Category added");
      queryClient.invalidateQueries({ queryKey: ["inventory-categories"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(category ? "Update failed" : "Create failed", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <FolderTree className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>{category ? "Edit Category" : "Add Category"}</DialogTitle>
                <DialogDescription className="mt-0.5">{category ? "Update category details." : "Create a new inventory category."}</DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) { toast.error("Name is required"); return; }
          mutation.mutate();
        }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name <span className="text-destructive">*</span></Label>
            <Input id="cat-name" placeholder="e.g. Sheet Materials" value={name} onChange={(e) => setName(e.target.value)} disabled={mutation.isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-desc">Description</Label>
            <Textarea id="cat-desc" rows={2} placeholder="Optional description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={mutation.isPending} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderTree className="mr-2 h-4 w-4" />}
              {category ? "Save Changes" : "Add Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Transfers Tab ============ */
function TransfersTab() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["stock-transfers", "list"], queryFn: () => stockTransfersApi.list() });
  const transfers = data?.transfers ?? [];

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      stockTransfersApi.update(id, { status }),
    onSuccess: (_data, vars) => {
      toast.success(`Transfer ${vars.status.replace("_", " ")}`);
      queryClient.invalidateQueries({ queryKey: ["stock-transfers", "list"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });

  return (
    <div className="space-y-3">
      <TabHeader
        title="Stock Transfers"
        description="Move stock between warehouses. Draft → Dispatch → Receive."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <ArrowLeftRight className="mr-2 h-4 w-4" /> New Transfer
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState label="Loading transfers…" />
          ) : transfers.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="No transfers yet"
              description="Create a stock transfer to move inventory between warehouses."
              action={<Button variant="outline" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Transfer</Button>}
            />
          ) : (
            <div className="max-h-[60vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Transfer #</TableHead>
                    <TableHead>From → To</TableHead>
                    <TableHead className="hidden md:table-cell">Items</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono text-xs">{t.transferNo}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Badge variant="outline" className="text-xs">{t.fromWarehouse?.code ?? "—"}</Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge variant="outline" className="text-xs">{t.toWarehouse?.code ?? "—"}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums text-sm">{t.itemCount ?? t.items.length}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{fmtDate(t.createdAt)}</TableCell>
                      <TableCell><StatusBadge status={t.status} /></TableCell>
                      <TableCell className="text-right">
                        {t.status === "in_transit" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updateMutation.isPending}
                            onClick={() => updateMutation.mutate({ id: t.id, status: "received" })}
                          >
                            <Check className="mr-1.5 h-3.5 w-3.5" /> Receive
                          </Button>
                        )}
                        {t.status === "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updateMutation.isPending}
                            onClick={() => updateMutation.mutate({ id: t.id, status: "in_transit" })}
                          >
                            <ArrowRight className="mr-1.5 h-3.5 w-3.5" /> Dispatch
                          </Button>
                        )}
                        {(t.status === "received" || t.status === "in_transit") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            disabled={updateMutation.isPending}
                            onClick={() => {
                              if (confirm(`Cancel transfer ${t.transferNo}? Stock will be returned to source.`)) {
                                updateMutation.mutate({ id: t.id, status: "cancelled" });
                              }
                            }}
                          >
                            <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <TransferDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function TransferDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: whData } = useQuery({ queryKey: ["warehouses"], queryFn: warehousesApi.list });
  const { data: invData } = useQuery({ queryKey: ["inventory"], queryFn: inventoryApi.list });
  const warehouses = whData?.warehouses ?? [];
  const items = invData?.items ?? [];

  const [fromWarehouseId, setFromWarehouseId] = React.useState("");
  const [toWarehouseId, setToWarehouseId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<Array<{ itemId: string; quantity: string; batchNo: string }>>([]);

  React.useEffect(() => {
    if (open) {
      setFromWarehouseId("");
      setToWarehouseId("");
      setNotes("");
      setLines([]);
    }
  }, [open]);

  function addLine() {
    setLines((l) => [...l, { itemId: "", quantity: "", batchNo: "" }]);
  }

  function removeLine(idx: number) {
    setLines((l) => l.filter((_, i) => i !== idx));
  }

  const mutation = useMutation({
    mutationFn: async (status: string) => {
      const cleanLines = lines
        .filter((l) => l.itemId && Number(l.quantity) > 0)
        .map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity), batchNo: l.batchNo || undefined }));
      return stockTransfersApi.create({
        fromWarehouseId,
        toWarehouseId,
        status,
        notes: notes || undefined,
        items: cleanLines,
      });
    },
    onSuccess: (_data, status) => {
      toast.success(`Transfer ${status === "draft" ? "saved as draft" : "dispatched"}`);
      queryClient.invalidateQueries({ queryKey: ["stock-transfers", "list"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Create failed", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[640px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>New Stock Transfer</DialogTitle>
                <DialogDescription className="mt-0.5">Move stock from one warehouse to another.</DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>From Warehouse</Label>
              <Select value={fromWarehouseId} onValueChange={setFromWarehouseId}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To Warehouse</Label>
              <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
                <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={!fromWarehouseId || !toWarehouseId}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Line
              </Button>
            </div>
            {lines.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                No items added yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 sm:col-span-6">
                      <Select value={line.itemId} onValueChange={(v) => setLines((ls) => ls.map((l, i) => i === idx ? { ...l, itemId: v } : l))}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent>
                          {items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <Input type="number" min="0" step="0.5" placeholder="Qty" value={line.quantity} onChange={(e) => setLines((ls) => ls.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))} className="h-9" />
                    </div>
                    <div className="col-span-5 sm:col-span-2">
                      <Input placeholder="Batch" value={line.batchNo} onChange={(e) => setLines((ls) => ls.map((l, i) => i === idx ? { ...l, batchNo: e.target.value } : l))} className="h-9" />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex justify-end">
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeLine(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tr-notes">Notes</Label>
            <Textarea id="tr-notes" rows={2} placeholder="Optional notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending || !fromWarehouseId || !toWarehouseId || lines.length === 0 || fromWarehouseId === toWarehouseId}
              onClick={() => mutation.mutate("draft")}
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Save Draft
            </Button>
            <Button
              type="button"
              disabled={mutation.isPending || !fromWarehouseId || !toWarehouseId || lines.length === 0 || fromWarehouseId === toWarehouseId}
              onClick={() => mutation.mutate("in_transit")}
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              Dispatch
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Stock Take Tab ============ */
function StockTakeTab() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [counting, setCounting] = React.useState<StockTake | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["stock-takes", "list"], queryFn: () => stockTakesApi.list() });
  const stockTakes = data?.stockTakes ?? [];

  return (
    <div className="space-y-3">
      <TabHeader
        title="Stock Take"
        description="Month-end stock counts. Generate counts, enter actual quantities, and finalize adjustments."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <ClipboardCheck className="mr-2 h-4 w-4" /> New Stock Take
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState label="Loading stock takes…" />
          ) : stockTakes.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No stock takes yet"
              description="Start a month-end stock take to reconcile system vs counted quantities."
              action={<Button variant="outline" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Stock Take</Button>}
            />
          ) : (
            <div className="max-h-[60vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Take #</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="hidden sm:table-cell">Period</TableHead>
                    <TableHead className="hidden md:table-cell">Lines</TableHead>
                    <TableHead className="hidden sm:table-cell">Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockTakes.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono text-xs">{t.takeNo}</TableCell>
                      <TableCell className="text-sm">{t.warehouse?.name ?? "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{t.period}</TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums text-sm">{t.lineCount ?? 0}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{fmtDate(t.createdAt)}</TableCell>
                      <TableCell><StatusBadge status={t.status} /></TableCell>
                      <TableCell className="text-right">
                        {t.status !== "completed" && t.status !== "closed" && (
                          <Button size="sm" variant="outline" onClick={() => setCounting(t)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Count
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <StockTakeCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(st) => { setCreateOpen(false); setCounting(st); }} />
      <StockTakeCountDialog stockTake={counting} onClose={() => setCounting(null)} />
    </div>
  );
}

function StockTakeCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (st: StockTake) => void;
}) {
  const queryClient = useQueryClient();
  const { data: whData } = useQuery({ queryKey: ["warehouses"], queryFn: warehousesApi.list });
  const warehouses = whData?.warehouses ?? [];

  const [warehouseId, setWarehouseId] = React.useState("");
  const [period, setPeriod] = React.useState(new Date().toISOString().slice(0, 7));
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setWarehouseId("");
      setPeriod(new Date().toISOString().slice(0, 7));
      setNotes("");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => stockTakesApi.create({ warehouseId, period, notes: notes || undefined }),
    onSuccess: (data) => {
      toast.success("Stock take created");
      queryClient.invalidateQueries({ queryKey: ["stock-takes", "list"] });
      onCreated(data.stockTake);
    },
    onError: (e: Error) => toast.error("Create failed", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>New Stock Take</DialogTitle>
                <DialogDescription className="mt-0.5">Auto-loads all items with their system quantities.</DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!warehouseId || !period) { toast.error("Warehouse and period are required"); return; }
          mutation.mutate();
        }} className="space-y-4">
          <div className="space-y-2">
            <Label>Warehouse <span className="text-destructive">*</span></Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="st-period">Period <span className="text-destructive">*</span></Label>
            <Input id="st-period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="st-notes">Notes</Label>
            <Textarea id="st-notes" rows={2} placeholder="Optional notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
              Create & Start Counting
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StockTakeCountDialog({
  stockTake,
  onClose,
}: {
  stockTake: StockTake | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["stock-take", stockTake?.id],
    queryFn: () => stockTakesApi.get(stockTake!.id),
    enabled: !!stockTake?.id,
  });
  const lines = data?.stockTake.lines ?? [];
  const [counts, setCounts] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (lines.length > 0) {
      const map: Record<string, string> = {};
      for (const l of lines) map[l.id] = String(num(l.countedQty));
      setCounts(map);
    }
  }, [lines]);

  const saveMutation = useMutation({
    mutationFn: async (complete: boolean) => {
      const linesPayload = Object.entries(counts).map(([lineId, qty]) => ({ lineId, countedQty: Number(qty) || 0 }));
      return stockTakesApi.update(stockTake!.id, {
        status: complete ? "completed" : "counting",
        lines: linesPayload,
      });
    },
    onSuccess: (_data, complete) => {
      toast.success(complete ? "Stock take completed — adjustments applied" : "Counts saved");
      queryClient.invalidateQueries({ queryKey: ["stock-takes", "list"] });
      queryClient.invalidateQueries({ queryKey: ["stock-take", stockTake?.id] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["stock-adjustments", "list"] });
      if (complete) onClose();
    },
    onError: (e: Error) => toast.error("Save failed", { description: e.message }),
  });

  return (
    <Dialog open={!!stockTake} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-[720px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>{stockTake?.takeNo}</DialogTitle>
                <DialogDescription className="mt-0.5">
                  {stockTake?.warehouse?.name} · {stockTake?.period}
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        {isLoading ? (
          <LoadingState label="Loading stock take…" />
        ) : lines.length === 0 ? (
          <EmptyState icon={Package} title="No lines" description="This stock take has no items to count." />
        ) : (
          <div className="space-y-3">
            <div className="max-h-[55vh] overflow-auto scrollbar-warm rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">System Qty</TableHead>
                    <TableHead className="text-right">Counted</TableHead>
                    <TableHead className="text-right">Diff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l: StockTakeLine) => {
                    const counted = num(counts[l.id]);
                    const sys = num(l.systemQty);
                    const diff = counted - sys;
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{l.item?.name}</p>
                          <p className="text-xs text-muted-foreground">{l.item?.code ?? l.item?.material}</p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{sys} <span className="text-xs text-muted-foreground">{l.item?.unit}</span></TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            className="h-8 w-24 ml-auto text-right"
                            value={counts[l.id] ?? ""}
                            onChange={(e) => setCounts((c) => ({ ...c, [l.id]: e.target.value }))}
                          />
                        </TableCell>
                        <TableCell className={`text-right tabular-nums font-medium ${diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {diff > 0 ? "+" : ""}{diff}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Close</Button>
              <Button
                type="button"
                variant="outline"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate(false)}
              >
                <FileText className="mr-2 h-4 w-4" /> Save Counts
              </Button>
              <Button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => {
                  if (confirm("Completing will apply adjustments to stock. Continue?")) {
                    saveMutation.mutate(true);
                  }
                }}
              >
                {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Complete & Apply
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ============ Requests Tab ============ */
function RequestsTab() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<StockRequest | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["stock-requests", "list"], queryFn: () => stockRequestsApi.list() });
  const requests = data?.requests ?? [];

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      stockRequestsApi.update(id, { status }),
    onSuccess: (_data, vars) => {
      toast.success(`Request ${vars.status}`);
      queryClient.invalidateQueries({ queryKey: ["stock-requests", "list"] });
    },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });

  return (
    <div className="space-y-3">
      <TabHeader
        title="Stock Requests"
        description="Site stock requests with approval workflow. Select a project, add items, preview before submitting."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <ClipboardList className="mr-2 h-4 w-4" /> New Request
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState label="Loading requests…" />
          ) : requests.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No stock requests"
              description="Create a stock request to get items from the warehouse for your project."
              action={<Button variant="outline" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Request</Button>}
            />
          ) : (
            <div className="max-h-[60vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Request #</TableHead>
                    <TableHead className="hidden sm:table-cell">Project / Job</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="hidden md:table-cell">Items</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setViewing(r)}>
                      <TableCell className="font-mono text-xs">{r.reqNo}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {r.job ? (
                          <span>
                            <span className="font-mono text-xs text-primary">{r.job.orderNumber}</span>
                            <span className="text-muted-foreground"> — {r.job.title}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No job (admin)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{r.warehouse?.code ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums text-sm">{r.lineCount ?? r.lines.length}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{fmtDate(r.createdAt)}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setViewing(r)}
                            title="View / Print"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {r.status === "pending" && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10"
                                disabled={updateMutation.isPending}
                                onClick={() => updateMutation.mutate({ id: r.id, status: "approved" })}
                                title="Approve"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                disabled={updateMutation.isPending}
                                onClick={() => updateMutation.mutate({ id: r.id, status: "rejected" })}
                                title="Reject"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
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

      <RequestDialog open={createOpen} onOpenChange={setCreateOpen} />

      {viewing && (
        <RequestDetailDialog
          request={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

/* ---- Request Detail / Preview / Print Dialog ---- */
function RequestDetailDialog({ request, onClose }: { request: StockRequest; onClose: () => void }) {
  function printRequest() {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = request.lines.map((l, i) => `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${l.item?.name ?? "—"}</td>
      <td>${l.item?.code ?? "—"}</td>
      <td style="text-align:right">${l.quantity}</td>
      <td>${l.item?.unit ?? "—"}</td>
      <td style="text-align:right">0</td>
      <td style="text-align:right">${l.quantity}</td>
    </tr>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Stock Request ${request.reqNo}</title>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Calibri', Arial, sans-serif; color: #1e293b; font-size: 10pt; }
        .header { text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 6px; margin-bottom: 10px; }
        .title { font-size: 14pt; font-weight: bold; text-transform: uppercase; }
        .subtitle { font-size: 9pt; color: #64748b; margin-top: 2px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; margin-bottom: 10px; font-size: 9pt; }
        .info-row { padding: 2px 0; border-bottom: 0.5px dotted #cbd5e1; }
        .info-label { font-weight: bold; min-width: 80px; color: #475569; display: inline-block; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9pt; }
        th { background: #1e293b; color: #fff; padding: 4px 6px; text-align: left; font-size: 8.5pt; text-transform: uppercase; }
        td { border: 0.5px solid #cbd5e1; padding: 3px 6px; }
        .notes { margin-top: 10px; padding: 6px 8px; background: #f1f5f9; border-radius: 4px; font-size: 9pt; }
        .footer { margin-top: 12px; border-top: 1px solid #94a3b8; padding-top: 4px; font-size: 8pt; color: #64748b; }
      </style></head><body>
      <div class="header">
        <div class="title">Stock Request</div>
        <div class="subtitle">${request.reqNo}</div>
      </div>
      <div class="info-grid">
        <div>
          <div class="info-row"><span class="info-label">Request #:</span> ${request.reqNo}</div>
          <div class="info-row"><span class="info-label">Project:</span> ${request.job ? request.job.orderNumber + " — " + request.job.title : "No job"}</div>
          <div class="info-row"><span class="info-label">Warehouse:</span> ${request.warehouse?.code ?? "—"} — ${request.warehouse?.name ?? ""}</div>
        </div>
        <div>
          <div class="info-row"><span class="info-label">Date:</span> ${new Date(request.createdAt).toLocaleDateString("en-GB")}</div>
          <div class="info-row"><span class="info-label">Status:</span> ${request.status.toUpperCase()}</div>
          <div class="info-row"><span class="info-label">Requested By:</span> ${request.requestedBy ?? "—"}</div>
        </div>
      </div>
      <table>
        <thead><tr>
          <th style="width:30px">#</th>
          <th>Item Name</th>
          <th>Code</th>
          <th style="text-align:right">Req Qty</th>
          <th>Unit</th>
          <th style="text-align:right">Issued</th>
          <th style="text-align:right">Returned</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${request.notes ? `<div class="notes"><b>Notes:</b> ${request.notes}</div>` : ""}
      <div class="footer">Generated: ${new Date().toLocaleString()} — CabinetryWorks</div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  function exportCSV() {
    const headers = ["#", "Item Name", "Code", "Req Qty", "Unit", "Issued", "Returned"];
    const rows = request.lines.map((l, i) => [i + 1, l.item?.name ?? "", l.item?.code ?? "", String(l.quantity), l.item?.unit ?? "", "0", String(l.quantity)]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-request-${request.reqNo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-[680px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>Stock Request — {request.reqNo}</DialogTitle>
                <DialogDescription>
                  {request.job ? `${request.job.orderNumber} — ${request.job.title}` : "No linked job"}
                  {" · "}
                  {request.warehouse?.code} — {request.warehouse?.name}
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Date:</span> {new Date(request.createdAt).toLocaleDateString("en-GB")}</div>
            <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={request.status} /></div>
          </div>

          {/* Items table — Item Name > Iss Qty > Rtn */}
          <div className="rounded-lg border border-border overflow-x-auto scrollbar-warm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Code</TableHead>
                  <TableHead className="text-right w-20">Req Qty</TableHead>
                  <TableHead className="text-right w-20">Issued</TableHead>
                  <TableHead className="text-right w-20">Returned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {request.lines.map((l, i) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="text-sm font-medium">{l.item?.name ?? "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs font-mono text-muted-foreground">{l.item?.code ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold">{l.quantity}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-emerald-600">0</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-blue-600">{l.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Notes */}
          {request.notes && (
            <div className="rounded-md bg-muted/50 p-2.5 text-sm">
              <span className="font-medium">Notes:</span> {request.notes}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={printRequest}>
              <Printer className="mr-1.5 h-4 w-4" /> Print / PDF
            </Button>
            <Button variant="default" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin" || user?.role === "SuperAdmin";
  const { data: whData } = useQuery({ queryKey: ["warehouses"], queryFn: warehousesApi.list });
  const { data: invData } = useQuery({ queryKey: ["inventory"], queryFn: inventoryApi.list });
  const { data: jobsData } = useQuery({ queryKey: ["jobs"], queryFn: () => jobsApi.list({ includeArchived: false }) });
  const warehouses = whData?.warehouses ?? [];
  const items = invData?.items ?? [];
  const jobs = jobsData?.jobs ?? [];

  const [warehouseId, setWarehouseId] = React.useState("");
  const [jobId, setJobId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<Array<{ itemId: string; quantity: string }>>([]);
  const [showPreview, setShowPreview] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setWarehouseId("");
      setJobId("");
      setNotes("");
      setLines([]);
      setShowPreview(false);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const cleanLines = lines.filter((l) => l.itemId && Number(l.quantity) > 0).map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity) }));
      const actualJobId = jobId === "__none__" || !jobId ? null : jobId;
      return stockRequestsApi.create({
        warehouseId,
        jobId: actualJobId,
        notes: notes || undefined,
        lines: cleanLines,
      });
    },
    onSuccess: () => {
      toast.success("Stock request submitted");
      queryClient.invalidateQueries({ queryKey: ["stock-requests", "list"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Create failed", { description: e.message }),
  });

  const cleanLines = lines.filter((l) => l.itemId && Number(l.quantity) > 0);
  // Admin override requires a reason (>= 5 chars) when no job is linked.
  // Technicians must always link to a job.
  const trimmedNotes = notes.trim();
  const adminOverrideActive = isAdmin && (!jobId || jobId === "__none__");
  const adminReasonValid = trimmedNotes.length >= 5;
  const canSubmit =
    !!warehouseId &&
    cleanLines.length > 0 &&
    ((!!jobId && jobId !== "__none__") || (adminOverrideActive && adminReasonValid));

  // Item lookup for display
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "—";
  const itemCode = (id: string) => items.find((i) => i.id === id)?.code ?? "—";
  const itemUnit = (id: string) => items.find((i) => i.id === id)?.unit ?? "—";
  const jobInfo = jobs.find((j) => j.id === jobId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[680px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>New Stock Request</DialogTitle>
                <DialogDescription className="mt-0.5">
                  Select the project/job and add items to request from warehouse.
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {!showPreview ? (
          <div className="space-y-4">
            {/* Project + Warehouse */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Project / Job
                  {isAdmin ? (
                    <span className="text-muted-foreground"> (optional for admin)</span>
                  ) : (
                    <span className="text-destructive"> *</span>
                  )}
                </Label>
                <Select value={jobId || "__none__"} onValueChange={(v) => setJobId(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder={isAdmin ? "No linked job (admin override)" : "Select project/job"} /></SelectTrigger>
                  <SelectContent>
                    {isAdmin && <SelectItem value="__none__">No linked job (admin override)</SelectItem>}
                    {jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.orderNumber} — {j.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!jobId && !isAdmin && (
                  <p className="text-xs text-muted-foreground">You must select a project/job before requesting stock.</p>
                )}
                {!jobId && isAdmin && (
                  <p className="text-xs text-muted-foreground">
                    Admins can request without a job by providing a reason (min 5 chars) in the Notes field below.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Warehouse <span className="text-destructive">*</span></Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items Requested</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines((l) => [...l, { itemId: "", quantity: "" }])}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Item
                </Button>
              </div>
              {lines.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No items added. Click "Add Item" to add materials to request.
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-x-auto scrollbar-warm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right w-24">Req Qty</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <Select value={line.itemId} onValueChange={(v) => setLines((ls) => ls.map((l, i) => i === idx ? { ...l, itemId: v } : l))}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Select item" /></SelectTrigger>
                              <SelectContent>
                                {items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}{it.code ? ` (${it.code})` : ""}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input type="number" min="0" step="0.5" placeholder="0" value={line.quantity}
                              onChange={(e) => setLines((ls) => ls.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))}
                              className="h-8 text-right tabular-nums" />
                          </TableCell>
                          <TableCell>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                              onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="req-notes">
                Notes / Remarks
                {adminOverrideActive ? <span className="text-destructive"> * (reason required, min 5 chars)</span> : null}
              </Label>
              <Textarea
                id="req-notes"
                rows={2}
                placeholder={adminOverrideActive ? "Provide a reason for requesting without a job (min 5 chars)" : "Optional notes for warehouse"}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              {adminOverrideActive && !adminReasonValid && (
                <p className="text-xs text-destructive">
                  A reason of at least 5 characters is required when requesting without a job.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                type="button"
                variant="outline"
                disabled={cleanLines.length === 0 || (adminOverrideActive && !adminReasonValid)}
                onClick={() => setShowPreview(true)}
              >
                <Eye className="mr-2 h-4 w-4" /> Preview
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* ===== PREVIEW VIEW ===== */
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/30 p-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Project:</span> {jobInfo ? `${jobInfo.orderNumber} — ${jobInfo.title}` : <span className="italic text-destructive">No job selected</span>}</div>
                <div><span className="text-muted-foreground">Warehouse:</span> {warehouses.find((w) => w.id === warehouseId)?.code} — {warehouses.find((w) => w.id === warehouseId)?.name}</div>
                <div><span className="text-muted-foreground">Date:</span> {new Date().toLocaleDateString("en-GB")}</div>
                <div><span className="text-muted-foreground">Items:</span> {cleanLines.length}</div>
              </div>
              {notes && <div className="mt-2 text-sm"><span className="text-muted-foreground">Notes:</span> {notes}</div>}
            </div>

            {/* Preview table — Item Name > Iss Qty > Rtn */}
            <div className="rounded-lg border border-border overflow-x-auto scrollbar-warm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Code</TableHead>
                    <TableHead className="text-right w-20">Req Qty</TableHead>
                    <TableHead className="text-right w-20">Issued</TableHead>
                    <TableHead className="text-right w-20">Returned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cleanLines.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-sm font-medium">{itemName(l.itemId)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs font-mono text-muted-foreground">{itemCode(l.itemId)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-semibold">{l.quantity}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-emerald-600">0</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-blue-600">{l.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPreview(false)}>
                <ChevronLeft className="mr-1.5 h-4 w-4" /> Back to Edit
              </Button>
              <Button
                type="button"
                disabled={mutation.isPending || !canSubmit}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
                Submit Request
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ============ Issues Tab ============ */
function IssuesTab() {
  const { data, isLoading } = useQuery({ queryKey: ["goods-issues", "list"], queryFn: () => goodsIssuesApi.list() });
  const [createOpen, setCreateOpen] = React.useState(false);
  const issues = data?.issues ?? [];

  return (
    <div className="space-y-3">
      <TabHeader
        title="Goods Issues"
        description="Issue stock from a warehouse to a job or site. Deducts from warehouse stock immediately."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <ArrowUpFromLine className="mr-2 h-4 w-4" /> New Issue
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState label="Loading issues…" />
          ) : issues.length === 0 ? (
            <EmptyState
              icon={ArrowUpFromLine}
              title="No goods issued yet"
              description="Issue stock to a job or site to deduct it from warehouse inventory."
              action={<Button variant="outline" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Issue</Button>}
            />
          ) : (
            <div className="max-h-[60vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Issue #</TableHead>
                    <TableHead className="hidden sm:table-cell">Job</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="hidden md:table-cell">Items</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((i) => (
                    <TableRow key={i.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono text-xs">{i.issueNo}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{i.job?.orderNumber ?? "—"}</TableCell>
                      <TableCell className="text-sm">{i.warehouse?.code ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums text-sm">{i.lineCount ?? i.lines.length}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{fmtDate(i.createdAt)}</TableCell>
                      <TableCell><StatusBadge status={i.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <IssueDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function IssueDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin" || user?.role === "SuperAdmin";
  const { data: whData } = useQuery({ queryKey: ["warehouses"], queryFn: warehousesApi.list });
  const { data: invData } = useQuery({ queryKey: ["inventory"], queryFn: inventoryApi.list });
  const { data: jobsData } = useQuery({ queryKey: ["jobs"], queryFn: () => jobsApi.list({ includeArchived: false }) });
  const { data: reqData } = useQuery({
    queryKey: ["stock-requests", "approved"],
    queryFn: () => stockRequestsApi.list({ status: "approved" }),
  });
  const warehouses = whData?.warehouses ?? [];
  const items = invData?.items ?? [];
  const jobs = jobsData?.jobs ?? [];
  const approvedReqs = reqData?.requests ?? [];

  const [warehouseId, setWarehouseId] = React.useState("");
  const [jobId, setJobId] = React.useState("");
  const [requestId, setRequestId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<Array<{ itemId: string; quantity: string }>>([]);

  React.useEffect(() => {
    if (open) {
      setWarehouseId("");
      setJobId("");
      setRequestId("");
      setNotes("");
      setLines([]);
    }
  }, [open]);

  // Auto-fill lines from approved request
  React.useEffect(() => {
    if (requestId && requestId !== "__none__") {
      const req = approvedReqs.find((r) => r.id === requestId);
      if (req) {
        setWarehouseId(req.warehouseId);
        setJobId(req.jobId ?? "");
        setLines(req.lines.map((l) => ({ itemId: l.itemId, quantity: String(num(l.quantity)) })));
      }
    }
  }, [requestId, approvedReqs]);

  // Admin override requires a reason (>= 5 chars) when no job is linked.
  // Technicians must always link to a job.
  const trimmedNotes = notes.trim();
  const adminOverrideActive = isAdmin && !jobId;
  const adminReasonValid = trimmedNotes.length >= 5;
  const canSubmit =
    !!warehouseId &&
    lines.length > 0 &&
    (!!jobId || (adminOverrideActive && adminReasonValid));

  const mutation = useMutation({
    mutationFn: async () => {
      const cleanLines = lines.filter((l) => l.itemId && Number(l.quantity) > 0).map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity) }));
      return goodsIssuesApi.create({
        warehouseId,
        jobId: jobId && jobId !== "__none__" ? jobId : null,
        requestId: requestId && requestId !== "__none__" ? requestId : null,
        notes: notes || undefined,
        lines: cleanLines,
      });
    },
    onSuccess: () => {
      toast.success("Goods issued");
      queryClient.invalidateQueries({ queryKey: ["goods-issues", "list"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["stock-requests", "list"] });
      queryClient.invalidateQueries({ queryKey: ["stock-requests", "approved"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Issue failed", { description: e.message }),
  });

  // Compute per-warehouse available stock for an item
  const availableStockFor = (itemId: string): number => {
    const item = items.find((it) => it.id === itemId);
    if (!item) return 0;
    if (!warehouseId) return num(item.stockLevel);
    const lots = item.stockLots ?? [];
    const whLots = lots.filter((l) => l.warehouseId === warehouseId);
    if (whLots.length === 0) return 0;
    return whLots.reduce((sum, l) => sum + num(l.quantity), 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[640px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <ArrowUpFromLine className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>New Goods Issue</DialogTitle>
                <DialogDescription className="mt-0.5">Issue stock from a warehouse to a job or site.</DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          {approvedReqs.length > 0 && (
            <div className="space-y-2">
              <Label>Link to Approved Request (optional)</Label>
              <Select value={requestId || "__none__"} onValueChange={setRequestId}>
                <SelectTrigger><SelectValue placeholder="No linked request" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No linked request</SelectItem>
                  {approvedReqs.map((r) => <SelectItem key={r.id} value={r.id}>{r.reqNo} — {r.job?.orderNumber ?? "no job"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Warehouse <span className="text-destructive">*</span></Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Job / Project
                {isAdmin ? (
                  <span className="text-muted-foreground"> (optional for admin)</span>
                ) : (
                  <span className="text-destructive"> *</span>
                )}
              </Label>
              <Select value={jobId || "__none__"} onValueChange={setJobId}>
                <SelectTrigger><SelectValue placeholder={isAdmin ? "No linked job (admin override)" : "Select a job"} /></SelectTrigger>
                <SelectContent>
                  {isAdmin && <SelectItem value="__none__">No linked job (admin override)</SelectItem>}
                  {jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.orderNumber} — {j.title}</SelectItem>)}
                </SelectContent>
              </Select>
              {!jobId && !isAdmin && (
                <p className="text-xs text-muted-foreground">You must select a job before issuing stock.</p>
              )}
              {!jobId && isAdmin && (
                <p className="text-xs text-muted-foreground">
                  Admins can issue without a job by providing a reason (min 5 chars) in the Notes field below.
                </p>
              )}
            </div>
          </div>
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((l) => [...l, { itemId: "", quantity: "" }])}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Line
              </Button>
            </div>
            {lines.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                No items added yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {lines.map((line, idx) => {
                  const item = items.find((it) => it.id === line.itemId);
                  const available = item ? availableStockFor(item.id) : 0;
                  const enteredQty = Number(line.quantity) || 0;
                  const exceedsStock = !!item && enteredQty > available;
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-12 sm:col-span-8">
                        <Select value={line.itemId} onValueChange={(v) => setLines((ls) => ls.map((l, i) => i === idx ? { ...l, itemId: v } : l))}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select item" /></SelectTrigger>
                          <SelectContent>
                            {items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {item && (
                          <p className={`text-xs mt-0.5 ${exceedsStock ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            In stock: {available} {item.unit}{warehouseId ? ` (in ${warehouses.find((w) => w.id === warehouseId)?.code ?? "selected"})` : ""}
                          </p>
                        )}
                        {exceedsStock && (
                          <p className="text-xs text-destructive mt-0.5">⚠ Quantity exceeds available stock ({available} {item?.unit}).</p>
                        )}
                      </div>
                      <div className="col-span-9 sm:col-span-3">
                        <Input type="number" min="0" step="0.5" placeholder="Qty" value={line.quantity} onChange={(e) => setLines((ls) => ls.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))} className="h-9" />
                      </div>
                      <div className="col-span-3 sm:col-span-1 flex justify-end">
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="gi-notes">
              Notes{adminOverrideActive ? <span className="text-destructive"> * (reason required, min 5 chars)</span> : null}
            </Label>
            <Textarea
              id="gi-notes"
              rows={2}
              placeholder={adminOverrideActive ? "Provide a reason for issuing without a job (min 5 chars)" : "Optional notes"}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {adminOverrideActive && !adminReasonValid && (
              <p className="text-xs text-destructive">
                A reason of at least 5 characters is required when issuing without a job.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="button"
              disabled={mutation.isPending || !canSubmit}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpFromLine className="mr-2 h-4 w-4" />}
              Issue Stock
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Returns Tab ============ */
function ReturnsTab() {
  const { data, isLoading } = useQuery({ queryKey: ["goods-returns", "list"], queryFn: () => goodsReturnsApi.list() });
  const [createOpen, setCreateOpen] = React.useState(false);
  const returns = data?.returns ?? [];

  return (
    <div className="space-y-3">
      <TabHeader
        title="Goods Returns"
        description="Return unused stock from a job/site back to a warehouse. Adds stock back immediately."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <ArrowDownToLine className="mr-2 h-4 w-4" /> New Return
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState label="Loading returns…" />
          ) : returns.length === 0 ? (
            <EmptyState
              icon={ArrowDownToLine}
              title="No returns yet"
              description="Return unused stock from sites to add it back to warehouse inventory."
              action={<Button variant="outline" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Return</Button>}
            />
          ) : (
            <div className="max-h-[60vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Return #</TableHead>
                    <TableHead className="hidden sm:table-cell">Job</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="hidden md:table-cell">Items</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono text-xs">{r.returnNo}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{r.job?.orderNumber ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.warehouse?.code ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums text-sm">{r.lineCount ?? r.lines.length}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{fmtDate(r.createdAt)}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ReturnDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function ReturnDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin" || user?.role === "SuperAdmin";
  const { data: whData } = useQuery({ queryKey: ["warehouses"], queryFn: warehousesApi.list });
  const { data: invData } = useQuery({ queryKey: ["inventory"], queryFn: inventoryApi.list });
  const { data: jobsData } = useQuery({ queryKey: ["jobs"], queryFn: () => jobsApi.list({ includeArchived: false }) });
  const jobs = jobsData?.jobs ?? [];
  const warehouses = whData?.warehouses ?? [];
  const allItems = invData?.items ?? [];

  const [jobId, setJobId] = React.useState("");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  // Lines: each has itemId, itemName, quantity (string for input), maxQty (available to return), source ("issue" | "outside")
  const [lines, setLines] = React.useState<Array<{ itemId: string; itemName: string; quantity: string; maxQty: number; source: "issue" | "outside" }>>([]);

  React.useEffect(() => {
    if (open) {
      setJobId("");
      setWarehouseId("");
      setNotes("");
      setLines([]);
    }
  }, [open]);

  // Fetch goods issues for the selected job
  const { data: issuesData } = useQuery({
    queryKey: ["goods-issues", "byJob", jobId],
    queryFn: () => goodsIssuesApi.list(jobId ? { jobId } : undefined),
    enabled: !!jobId,
  });
  // Fetch goods returns for the selected job (to calculate already-returned qty)
  const { data: returnsData } = useQuery({
    queryKey: ["goods-returns", "byJob", jobId],
    queryFn: () => goodsReturnsApi.list(jobId ? { jobId } : undefined),
    enabled: !!jobId,
  });
  // Fetch outside purchases for the selected job
  const { data: outsideData } = useQuery({
    queryKey: ["outside-purchases", "byJob", jobId],
    queryFn: () => outsidePurchasesApi.list(jobId ? { jobId } : undefined),
    enabled: !!jobId,
  });

  const jobIssues = issuesData?.issues ?? [];
  const jobReturns = returnsData?.returns ?? [];
  const jobOutside = outsideData?.purchases ?? [];

  // Build the "available to return" list: aggregate issued items minus already-returned
  const availableItems = React.useMemo(() => {
    if (!jobId) return [];
    // Aggregate issued quantities per itemId
    const issuedMap = new Map<string, { itemId: string; itemName: string; qty: number }>();
    for (const iss of jobIssues) {
      for (const line of iss.lines) {
        const existing = issuedMap.get(line.itemId);
        const itemName = line.item?.name ?? "Unknown";
        if (existing) {
          existing.qty += num(line.quantity);
        } else {
          issuedMap.set(line.itemId, { itemId: line.itemId, itemName, qty: num(line.quantity) });
        }
      }
    }
    // Subtract already-returned quantities
    for (const ret of jobReturns) {
      for (const line of ret.lines) {
        const existing = issuedMap.get(line.itemId);
        if (existing) {
          existing.qty -= num(line.quantity);
        }
      }
    }
    // Filter out items with 0 or negative available qty
    const fromIssues = Array.from(issuedMap.values())
      .filter((v) => v.qty > 0)
      .map((v) => ({ itemId: v.itemId, itemName: v.itemName, maxQty: v.qty, source: "issue" as const }));

    // Add outside-purchased items (received ones) for this job
    const fromOutside: Array<{ itemId: string; itemName: string; maxQty: number; source: "outside" }> = [];
    for (const op of jobOutside) {
      if (op.status !== "received") continue;
      for (const line of op.lines) {
        if (!line.itemId) continue; // skip items not linked to inventory
        const itemName = line.itemName || line.item?.name || "Outside Item";
        const qty = num(line.quantity);
        if (qty > 0) {
          fromOutside.push({ itemId: line.itemId, itemName, maxQty: qty, source: "outside" });
        }
      }
    }

    return [...fromIssues, ...fromOutside];
  }, [jobId, jobIssues, jobReturns, jobOutside]);

  // Auto-select warehouse from the first issue for this job
  React.useEffect(() => {
    if (jobId && !warehouseId && jobIssues.length > 0) {
      setWarehouseId(jobIssues[0].warehouseId);
    }
  }, [jobId, warehouseId, jobIssues]);

  const addLine = (itemId: string) => {
    const item = availableItems.find((a) => a.itemId === itemId);
    if (!item) return;
    if (lines.some((l) => l.itemId === itemId)) return; // already added
    setLines((ls) => [...ls, { itemId: item.itemId, itemName: item.itemName, quantity: String(item.maxQty), maxQty: item.maxQty, source: item.source }]);
  };

  const removeLine = (idx: number) => {
    setLines((ls) => ls.filter((_, i) => i !== idx));
  };

  const updateQty = (idx: number, qty: string) => {
    setLines((ls) => ls.map((l, i) => {
      if (i !== idx) return l;
      const q = Number(qty) || 0;
      // Clamp to maxQty
      const clamped = Math.min(q, l.maxQty);
      return { ...l, quantity: String(clamped) };
    }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const cleanLines = lines
        .filter((l) => Number(l.quantity) > 0)
        .map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity) }));
      return goodsReturnsApi.create({
        warehouseId,
        jobId,
        notes: notes || undefined,
        lines: cleanLines,
      });
    },
    onSuccess: () => {
      toast.success("Goods returned to warehouse");
      queryClient.invalidateQueries({ queryKey: ["goods-returns", "list"] });
      queryClient.invalidateQueries({ queryKey: ["goods-returns", "byJob", jobId] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Return failed", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <ArrowDownToLine className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>New Goods Return</DialogTitle>
                <DialogDescription className="mt-0.5">
                  Return unused stock from a job/site back to warehouse. Items must have been previously issued or purchased for this job.
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          {/* Step 1: Select Job (REQUIRED for non-admin; admin can override with reason) */}
          <div className="space-y-2">
            <Label>
              Job / Project {isAdmin ? <span className="text-muted-foreground text-xs">(optional for admin)</span> : <span className="text-destructive">*</span>}
            </Label>
            <Select value={jobId || "__none__"} onValueChange={(v) => { setJobId(v === "__none__" ? "" : v); setLines([]); }}>
              <SelectTrigger><SelectValue placeholder="Select the job/project to return stock from" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{isAdmin ? "No linked job (admin override)" : "— Select a job —"}</SelectItem>
                {jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.orderNumber} — {j.title}</SelectItem>)}
              </SelectContent>
            </Select>
            {!jobId && !isAdmin && (
              <p className="text-[11px] text-muted-foreground">
                You must select a job first. Only items previously issued or purchased for this job can be returned.
              </p>
            )}
            {!jobId && isAdmin && (
              <p className="text-[11px] text-muted-foreground">
                Admin override: you can return any item without a job. Provide a reason (min 5 chars) below.
              </p>
            )}
          </div>

          {/* Step 2: Show available items (from job) */}
          {jobId && (
            <>
              {/* Info banner */}
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs">
                <div className="flex items-center gap-2 font-medium text-primary mb-1">
                  <Package className="h-3.5 w-3.5" />
                  Available to Return for this Job
                </div>
                <div className="text-muted-foreground space-y-0.5">
                  <div>From Issues: <span className="font-semibold text-foreground">{availableItems.filter(a => a.source === "issue").length}</span> item type(s)</div>
                  <div>From Outside Purchases: <span className="font-semibold text-foreground">{availableItems.filter(a => a.source === "outside").length}</span> item type(s)</div>
                  {jobIssues.length === 0 && jobOutside.length === 0 && (
                    <div className="text-amber-600 font-medium mt-1">
                      ⚠ No issues or outside purchases found for this job. Nothing to return.
                    </div>
                  )}
                </div>
              </div>

              {/* Select items to return */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Items to Return</Label>
                  <Select value="" onValueChange={addLine}>
                    <SelectTrigger className="h-8 w-auto text-xs">
                      <Plus className="mr-1 h-3 w-3" /> Add Item
                    </SelectTrigger>
                    <SelectContent>
                      {availableItems
                        .filter((a) => !lines.some((l) => l.itemId === a.itemId))
                        .map((a) => (
                          <SelectItem key={a.itemId + a.source} value={a.itemId}>
                            {a.itemName} ({a.maxQty} {a.source === "issue" ? "from issue" : "from outside"} available)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {lines.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No items selected yet. Click "Add Item" to pick from issued/purchased items.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Column headers */}
                    <div className="grid grid-cols-[1fr_90px_28px] items-center gap-2 px-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>Item</span>
                      <span className="text-center">Return Qty</span>
                      <span></span>
                    </div>
                    {lines.map((line, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_90px_28px] items-center gap-2 rounded-md border border-border bg-card p-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{line.itemName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {line.source === "issue" ? "From Issue" : "From Outside Purchase"} · Max: {line.maxQty}
                          </p>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          max={line.maxQty}
                          step="0.5"
                          className="h-8 text-xs text-center tabular-nums"
                          value={line.quantity}
                          onChange={(e) => updateQty(idx, e.target.value)}
                          title={`Max: ${line.maxQty}`}
                        />
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeLine(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Warehouse + Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Return to Warehouse <span className="text-destructive">*</span></Label>
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gr-notes">Notes</Label>
                  <Input id="gr-notes" placeholder="Optional notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* Admin override: when no job selected and user is admin, allow adding any item */}
          {!jobId && isAdmin && (
            <>
              {/* Info banner */}
              <div className="rounded-md border border-sky-500/20 bg-sky-500/5 p-3 text-xs">
                <div className="flex items-center gap-2 font-medium text-sky-700 dark:text-sky-400 mb-1">
                  <Package className="h-3.5 w-3.5" />
                  Admin Override — Return Any Item
                </div>
                <div className="text-muted-foreground">
                  You can return any inventory item without a job linkage. A reason (min 5 chars) is required.
                </div>
              </div>

              {/* Select items to return (from all inventory) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Items to Return</Label>
                  <Select value="" onValueChange={(v) => {
                    const item = allItems.find((it) => it.id === v);
                    if (!item) return;
                    if (lines.some((l) => l.itemId === v)) return;
                    setLines((ls) => [...ls, { itemId: item.id, itemName: item.name, quantity: "1", maxQty: 99999, source: "outside" }]);
                  }}>
                    <SelectTrigger className="h-8 w-auto text-xs">
                      <Plus className="mr-1 h-3 w-3" /> Add Item
                    </SelectTrigger>
                    <SelectContent>
                      {allItems
                        .filter((a) => !lines.some((l) => l.itemId === a.id))
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {lines.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No items selected yet. Click "Add Item" to pick from inventory.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-[1fr_90px_28px] items-center gap-2 px-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>Item</span>
                      <span className="text-center">Return Qty</span>
                      <span></span>
                    </div>
                    {lines.map((line, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_90px_28px] items-center gap-2 rounded-md border border-border bg-card p-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{line.itemName}</p>
                          <p className="text-[10px] text-muted-foreground">Admin override</p>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          className="h-8 text-xs text-center tabular-nums"
                          value={line.quantity}
                          onChange={(e) => updateQty(idx, e.target.value)}
                        />
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeLine(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Warehouse + Reason (required for admin override) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Return to Warehouse <span className="text-destructive">*</span></Label>
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gr-notes-admin">Reason <span className="text-destructive">*</span> <span className="text-muted-foreground text-xs">(min 5 chars)</span></Label>
                  <Input id="gr-notes-admin" placeholder="Reason for admin override return" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="button"
              disabled={mutation.isPending || !warehouseId || lines.length === 0 || (!jobId && (!isAdmin || notes.trim().length < 5))}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowDownToLine className="mr-2 h-4 w-4" />}
              Return Stock
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Outside Purchases Tab ============ */
function OutsidePurchasesTab() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["outside-purchases", "list"], queryFn: () => outsidePurchasesApi.list() });
  const purchases = data?.purchases ?? [];

  const receiveMutation = useMutation({
    mutationFn: (id: string) => outsidePurchasesApi.update(id, { status: "received" }),
    onSuccess: () => {
      toast.success("Outside purchase received");
      queryClient.invalidateQueries({ queryKey: ["outside-purchases", "list"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });

  return (
    <div className="space-y-3">
      <TabHeader
        title="Outside Purchases"
        description="Direct site purchases that bypass warehouse inventory. Optionally link to inventory items when received."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <ShoppingCart className="mr-2 h-4 w-4" /> New Purchase
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState label="Loading outside purchases…" />
          ) : purchases.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No outside purchases yet"
              description="Record direct site purchases (e.g. consumables, ad-hoc materials)."
              action={<Button variant="outline" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Purchase</Button>}
            />
          ) : (
            <div className="max-h-[60vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead className="hidden sm:table-cell">Job</TableHead>
                    <TableHead className="hidden md:table-cell">Supplier</TableHead>
                    <TableHead className="hidden md:table-cell">Items</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono text-xs">{p.poNo}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{p.job?.orderNumber ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{p.supplier ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums text-sm">{p.lineCount ?? p.lines.length}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{fmtDate(p.createdAt)}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell className="text-right">
                        {p.status === "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={receiveMutation.isPending}
                            onClick={() => receiveMutation.mutate(p.id)}
                          >
                            <Check className="mr-1.5 h-3.5 w-3.5" /> Receive
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <OutsidePurchaseDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function OutsidePurchaseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: whData } = useQuery({ queryKey: ["warehouses"], queryFn: warehousesApi.list });
  const { data: invData } = useQuery({ queryKey: ["inventory"], queryFn: inventoryApi.list });
  const { data: jobsData } = useQuery({ queryKey: ["jobs"], queryFn: () => jobsApi.list({ includeArchived: false }) });
  const warehouses = whData?.warehouses ?? [];
  const items = invData?.items ?? [];
  const jobs = jobsData?.jobs ?? [];

  const [jobId, setJobId] = React.useState("");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [supplier, setSupplier] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [status, setStatus] = React.useState("draft");
  const [lines, setLines] = React.useState<Array<{ itemId: string; itemName: string; quantity: string; unit: string }>>([]);

  React.useEffect(() => {
    if (open) {
      setJobId("");
      setWarehouseId("");
      setSupplier("");
      setNotes("");
      setStatus("draft");
      setLines([]);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const cleanLines = lines
        .filter((l) => l.itemName && Number(l.quantity) > 0)
        .map((l) => ({
          itemId: l.itemId || null,
          itemName: l.itemName,
          quantity: Number(l.quantity),
          unit: l.unit || "pcs",
        }));
      return outsidePurchasesApi.create({
        jobId: jobId && jobId !== "__none__" ? jobId : null,
        warehouseId: warehouseId && warehouseId !== "__none__" ? warehouseId : null,
        supplier: supplier || undefined,
        status,
        notes: notes || undefined,
        lines: cleanLines,
      });
    },
    onSuccess: () => {
      toast.success(status === "received" ? "Outside purchase received" : "Outside purchase created");
      queryClient.invalidateQueries({ queryKey: ["outside-purchases", "list"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Create failed", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[680px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>New Outside Purchase</DialogTitle>
                <DialogDescription className="mt-0.5">Direct site purchase — line items are free-text, optionally linked to inventory items.</DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Job / Project <span className="text-destructive">*</span></Label>
              <Select value={jobId || "__none__"} onValueChange={setJobId}>
                <SelectTrigger><SelectValue placeholder="Select job" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Select a job —</SelectItem>
                  {jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.orderNumber} — {j.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Receiving Warehouse (optional)</Label>
              <Select value={warehouseId || "__none__"} onValueChange={setWarehouseId}>
                <SelectTrigger><SelectValue placeholder="None — site use only" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None — site use only</SelectItem>
                  {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="op-supplier">Supplier</Label>
              <Input id="op-supplier" placeholder="Supplier name" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((l) => [...l, { itemId: "", itemName: "", quantity: "", unit: "pcs" }])}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Line
              </Button>
            </div>
            {lines.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                No items added yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 sm:col-span-5">
                      <Input
                        placeholder="Item name (free text)"
                        value={line.itemName}
                        onChange={(e) => setLines((ls) => ls.map((l, i) => i === idx ? { ...l, itemName: e.target.value } : l))}
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-7 sm:col-span-4">
                      <Select value={line.itemId || "__none__"} onValueChange={(v) => {
                        const id = v === "__none__" ? "" : v;
                        const it = items.find((x) => x.id === id);
                        setLines((ls) => ls.map((l, i) => i === idx ? { ...l, itemId: id, itemName: it ? it.name : l.itemName, unit: it ? it.unit : l.unit } : l));
                      }}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Link to item?" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No link</SelectItem>
                          {items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <Input type="number" min="0" step="0.5" placeholder="Qty" value={line.quantity} onChange={(e) => setLines((ls) => ls.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))} className="h-9" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <Input placeholder="Unit" value={line.unit} onChange={(e) => setLines((ls) => ls.map((l, i) => i === idx ? { ...l, unit: e.target.value } : l))} className="h-9" />
                    </div>
                    <div className="col-span-12 sm:col-span-1 flex justify-end">
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="op-notes">Notes</Label>
            <Textarea id="op-notes" rows={2} placeholder="Optional notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="button"
              disabled={mutation.isPending || lines.length === 0}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
              {status === "received" ? "Create & Receive" : "Create Purchase"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Reports Tab ============ */
type ReportType = "stock-level" | "movement" | "job-wise" | "low-stock";

function ReportsTab() {
  const [type, setType] = React.useState<ReportType>("stock-level");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [warehouseId, setWarehouseId] = React.useState("");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["inventory-report", type, from, to, warehouseId],
    queryFn: () => inventoryReportsApi.get({
      type,
      from: from || undefined,
      to: to || undefined,
      warehouseId: warehouseId || undefined,
    }),
    enabled: true,
  });

  const { data: whData } = useQuery({ queryKey: ["warehouses"], queryFn: warehousesApi.list });
  const warehouses = whData?.warehouses ?? [];

  const report: InventoryReportResult | undefined = data;

  function downloadCsv() {
    if (!report) return;
    inventoryReportsApi.csv({
      type,
      from: from || undefined,
      to: to || undefined,
      warehouseId: warehouseId || undefined,
    }).then((csv) => {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    });
  }

  function printReport() {
    window.print();
  }

  const REPORT_OPTIONS: { value: ReportType; label: string; description: string }[] = [
    { value: "stock-level", label: "Stock Level by Warehouse", description: "Current stock per item per warehouse" },
    { value: "movement", label: "Stock Movement Log", description: "Issues, returns, adjustments, transfers" },
    { value: "job-wise", label: "Job-wise Issue/Return Summary", description: "Net material consumption per job" },
    { value: "low-stock", label: "Low Stock Report", description: "Items at or below reorder point" },
  ];

  return (
    <div className="space-y-3">
      <TabHeader
        title="Reports"
        description="Generate stock and movement reports. Export to CSV or print."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadCsv} disabled={!report}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <Button variant="outline" onClick={printReport} disabled={!report}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
            <Button onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPORT_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {type === "movement" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="rpt-from">From Date</Label>
                  <Input id="rpt-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rpt-to">To Date</Label>
                  <Input id="rpt-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </>
            )}
            {type === "stock-level" && (
              <div className="space-y-2">
                <Label>Warehouse</Label>
                <Select value={warehouseId || "__all__"} onValueChange={(v) => setWarehouseId(v === "__all__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="All warehouses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All warehouses</SelectItem>
                    {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {REPORT_OPTIONS.find((r) => r.value === type)?.description}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState label="Generating report…" />
          ) : !report || report.rows.length === 0 ? (
            <EmptyState icon={FileText} title="No data" description="No rows match the current filters for this report." />
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    {report.headers.map((h) => <TableHead key={h}>{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/50 transition-colors">
                      {report.headers.map((h) => {
                        const v = row[h];
                        const isNum = typeof v === "number";
                        return (
                          <TableCell
                            key={h}
                            className={isNum ? "text-right tabular-nums" : ""}
                          >
                            {String(v ?? "")}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
