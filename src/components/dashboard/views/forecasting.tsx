"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  inventoryApi,
  goodsIssuesApi,
  type InventoryItem,
  type GoodsIssue,
} from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  PackageX,
  Loader2,
  Search,
  ShoppingCart,
  Clock,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui-helpers";

function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function classify(daysUntil: number): {
  tint: string;
  label: string;
  severity: "critical" | "warn" | "ok";
} {
  if (daysUntil < 7)
    return {
      tint: "bg-rose-500/15 text-rose-700 border-rose-500/30",
      label: "Critical",
      severity: "critical",
    };
  if (daysUntil < 14)
    return {
      tint: "bg-amber-500/15 text-amber-700 border-amber-500/30",
      label: "Watch",
      severity: "warn",
    };
  return {
    tint: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    label: "OK",
    severity: "ok",
  };
}

interface ForecastRow {
  item: InventoryItem;
  stock: number;
  reorderPoint: number;
  minStock: number;
  totalUsed30d: number;
  avgDailyUsage: number;
  daysUntilStockout: number; // Infinity if no usage
  suggestedReorder: number;
  severity: "critical" | "warn" | "ok";
}

export function ForecastingView() {
  const [search, setSearch] = React.useState("");
  const [severityFilter, setSeverityFilter] = React.useState<
    "all" | "critical" | "warn" | "ok"
  >("all");

  const { data: invData, isLoading: invLoading } = useQuery({
    queryKey: ["inventory", "forecast"],
    queryFn: () => inventoryApi.list(),
  });
  const items: InventoryItem[] = invData?.items ?? [];

  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ["goods-issues", "forecast"],
    queryFn: () => goodsIssuesApi.list(),
  });
  const issues: GoodsIssue[] = issuesData?.issues ?? [];

  const isLoading = invLoading || issuesLoading;

  // Compute usage per item over the last 30 days
  const rows: ForecastRow[] = React.useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const usageByItem = new Map<string, number>();
    for (const issue of issues) {
      const issueDate = new Date(issue.createdAt).getTime();
      if (issueDate < cutoff) continue;
      for (const line of issue.lines ?? []) {
        const qty = num(line.quantity);
        usageByItem.set(
          line.itemId,
          (usageByItem.get(line.itemId) ?? 0) + qty
        );
      }
    }

    const out: ForecastRow[] = items.map((item) => {
      const stock = num(item.stockLevel);
      const reorderPoint = num(item.reorderPoint);
      const minStock = num(item.minStock);
      const totalUsed30d = usageByItem.get(item.id) ?? 0;
      const avgDailyUsage = totalUsed30d / 30;
      const daysUntilStockout =
        avgDailyUsage > 0 ? Math.floor(stock / avgDailyUsage) : Infinity;
      // Suggested reorder: cover 30 days of usage at minimum reorderPoint
      const targetStock = Math.max(reorderPoint, avgDailyUsage * 30, minStock);
      const suggestedReorder = Math.max(0, Math.ceil(targetStock - stock));
      const severity =
        daysUntilStockout < 7
          ? "critical"
          : daysUntilStockout < 14
            ? "warn"
            : "ok";
      return {
        item,
        stock,
        reorderPoint,
        minStock,
        totalUsed30d,
        avgDailyUsage,
        daysUntilStockout,
        suggestedReorder,
        severity,
      };
    });

    // Sort by days until stockout (Infinity last)
    out.sort((a, b) => {
      if (a.daysUntilStockout === Infinity && b.daysUntilStockout === Infinity)
        return b.totalUsed30d - a.totalUsed30d;
      if (a.daysUntilStockout === Infinity) return 1;
      if (b.daysUntilStockout === Infinity) return -1;
      return a.daysUntilStockout - b.daysUntilStockout;
    });
    return out;
  }, [items, issues]);

  // Filtered rows
  const filtered = React.useMemo(() => {
    return rows.filter((r) => {
      if (
        severityFilter !== "all" &&
        r.severity !== severityFilter
      )
        return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.item.name.toLowerCase().includes(q) &&
          !(r.item.code ?? "").toLowerCase().includes(q) &&
          !(r.item.material ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [rows, search, severityFilter]);

  const summary = React.useMemo(() => {
    const needingReorder = rows.filter((r) => r.suggestedReorder > 0).length;
    const critical = rows.filter((r) => r.severity === "critical").length;
    const totalReorder = rows.reduce((sum, r) => sum + r.suggestedReorder, 0);
    return { needingReorder, critical, totalReorder };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <TrendingDown className="h-5 w-5 text-primary" />
            Inventory Forecasting
          </h1>
          <p className="text-xs text-muted-foreground">
            Projected stock-out dates from last 30 days of goods-issue usage.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <ShoppingCart className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {summary.needingReorder}
              </p>
              <p className="text-xs text-muted-foreground">Need reorder</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-rose-500/10 p-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {summary.critical}
              </p>
              <p className="text-xs text-muted-foreground">
                Critical (&lt; 7 days)
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <PackageX className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {summary.totalReorder.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Total suggested units
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Forecast by Item</CardTitle>
              <CardDescription className="text-xs">
                {filtered.length} of {rows.length} items · sorted by days to stock-out
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search items…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-8 sm:w-56"
                />
              </div>
              <Select
                value={severityFilter}
                onValueChange={(v) =>
                  setSeverityFilter(v as "all" | "critical" | "warn" | "ok")
                }
              >
                <SelectTrigger className="h-9 w-36 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  <SelectItem value="critical">Critical (&lt; 7d)</SelectItem>
                  <SelectItem value="warn">Watch (&lt; 14d)</SelectItem>
                  <SelectItem value="ok">OK (&gt; 14d)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Computing forecasts…
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No inventory items"
              description="Add inventory items and start issuing stock to see forecasts."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={TrendingDown}
              title="No items match your filters"
              description="Try changing the search or severity filter."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">Item</TableHead>
                    <TableHead className="h-8 text-xs text-right">Stock</TableHead>
                    <TableHead className="h-8 text-xs text-right">
                      Used (30d)
                    </TableHead>
                    <TableHead className="h-8 text-xs text-right">
                      Avg / day
                    </TableHead>
                    <TableHead className="h-8 text-xs text-right">
                      Days to stock-out
                    </TableHead>
                    <TableHead className="h-8 text-xs text-right">
                      Suggested Reorder
                    </TableHead>
                    <TableHead className="h-8 text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const cls = classify(r.daysUntilStockout);
                    const unit = r.item.unit ?? "";
                    return (
                      <TableRow key={r.item.id}>
                        <TableCell className="py-2 text-xs">
                          <div className="font-medium">{r.item.name}</div>
                          <div className="text-muted-foreground">
                            {r.item.code ?? "—"} · {r.item.material ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-right text-xs tabular-nums">
                          {r.stock.toLocaleString()} {unit}
                        </TableCell>
                        <TableCell className="py-2 text-right text-xs tabular-nums">
                          {r.totalUsed30d.toLocaleString()} {unit}
                        </TableCell>
                        <TableCell className="py-2 text-right text-xs tabular-nums">
                          {r.avgDailyUsage > 0
                            ? r.avgDailyUsage.toFixed(2)
                            : "0"}
                        </TableCell>
                        <TableCell className="py-2 text-right text-xs tabular-nums">
                          {r.daysUntilStockout === Infinity ? (
                            <span className="text-muted-foreground inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />∞
                            </span>
                          ) : (
                            <span
                              className={
                                r.severity === "critical"
                                  ? "font-bold text-rose-600"
                                  : r.severity === "warn"
                                    ? "font-semibold text-amber-600"
                                    : ""
                              }
                            >
                              {r.daysUntilStockout} d
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-right text-xs tabular-nums">
                          {r.suggestedReorder > 0 ? (
                            <span className="font-medium">
                              {r.suggestedReorder.toLocaleString()} {unit}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${cls.tint}`}
                          >
                            {cls.label}
                          </Badge>
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

      <p className="text-xs text-muted-foreground">
        Note: Forecast is computed from goods-issue records created in the last
        30 days. Items with no usage history are assumed to have indefinite
        stock-out timelines (∞). This view is read-only.
      </p>
    </div>
  );
}
