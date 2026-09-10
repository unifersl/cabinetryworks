"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/lib/api";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Package,
  Scissors,
  ClipboardList,
  Printer,
  Loader2,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui-helpers";

const MATERIAL_COLORS = [
  "#b45309",
  "#0d9488",
  "#7c3aed",
  "#be123c",
  "#0369a1",
  "#ca8a04",
];

export function ReportsView() {
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [from, setFrom] = React.useState(
    thirtyDaysAgo.toISOString().slice(0, 10)
  );
  const [to, setTo] = React.useState(today.toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "consumption", from, to],
    queryFn: () =>
      reportsApi.consumption({
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
      }),
  });

  const summary = data?.summary ?? [];
  const details = data?.details ?? [];
  const totals = data?.totals;

  const chartData = summary.map((s) => ({
    name: s.material,
    area: s.totalAreaSqm,
    sheets: s.totalSheets,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <BarChart3 className="h-5 w-5 text-primary" />
            Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Material consumption analytics and production insights.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="no-print">
            <Printer className="mr-2 h-4 w-4" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Date range filter */}
      <Card className="no-print">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-primary/10 p-2">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {totals.totalAreaSqm}
                </p>
                <p className="text-xs text-muted-foreground">Total Area (m²)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-teal-500/10 p-2">
                <Package className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {totals.totalSheets}
                </p>
                <p className="text-xs text-muted-foreground">Sheets Used</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-violet-500/10 p-2">
                <Scissors className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {totals.totalCuttingLists}
                </p>
                <p className="text-xs text-muted-foreground">Cutting Lists</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <ClipboardList className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {totals.totalJobs}
                </p>
                <p className="text-xs text-muted-foreground">Jobs Affected</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Material consumption chart */}
      {summary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Material Consumption by Area
            </CardTitle>
            <CardDescription>
              Total panel area consumed per material type (m²)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "var(--foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="area" radius={[6, 6, 0, 0]} barSize={50} name="Area (m²)">
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={MATERIAL_COLORS[i % MATERIAL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Summary table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Material Summary</CardTitle>
          <CardDescription>
            Aggregated consumption by material type
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating report…
            </div>
          ) : summary.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No consumption data in this range"
              description="Try adjusting the date range or create cutting lists."
            />
          ) : (
            <div className="max-h-[40vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow>
                    <TableHead className="min-w-[140px]">Material</TableHead>
                    <TableHead className="text-right min-w-[100px]">Area (m²)</TableHead>
                    <TableHead className="text-right min-w-[80px]">Sheets</TableHead>
                    <TableHead className="text-right hidden sm:table-cell min-w-[90px]">Cut Lists</TableHead>
                    <TableHead className="text-right hidden sm:table-cell min-w-[80px]">Jobs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((row, i) => (
                    <TableRow key={row.material} className={`hover:bg-muted/50 transition-colors ${i % 2 === 1 ? "bg-muted/40" : ""}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: MATERIAL_COLORS[i % MATERIAL_COLORS.length] }}
                          />
                          <span className="font-medium">{row.material}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {row.totalAreaSqm}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.totalSheets}
                      </TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">
                        {row.cuttingListCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">
                        {row.jobCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed list */}
      {details.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Consumption Details</CardTitle>
            <CardDescription>
              Individual cutting list entries ({details.length} total)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[50vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow>
                    <TableHead className="min-w-[140px]">Job</TableHead>
                    <TableHead className="hidden min-w-[140px] md:table-cell">Customer</TableHead>
                    <TableHead className="hidden min-w-[110px] sm:table-cell">Panel</TableHead>
                    <TableHead className="min-w-[110px]">Material</TableHead>
                    <TableHead className="text-right min-w-[80px]">Area</TableHead>
                    <TableHead className="text-right min-w-[70px]">Sheets</TableHead>
                    <TableHead className="hidden min-w-[100px] lg:table-cell">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.map((d, idx) => (
                    <TableRow key={d.id} className={`hover:bg-muted/50 transition-colors ${idx % 2 === 1 ? "bg-muted/40" : ""}`}>
                      <TableCell>
                        <p className="font-mono text-xs text-primary">{d.orderNumber}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {d.jobTitle}
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        {d.customerName}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs">
                        {d.panelName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {d.material}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {d.areaSqm} m²
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-semibold">
                        {d.sheets}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
