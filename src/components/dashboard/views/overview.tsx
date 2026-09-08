"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  statsApi,
  activityApi,
  inventoryApi,
  jobsApi,
  type ActivityEvent,
} from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  ClipboardList,
  Ruler,
  Scissors,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  UserCheck,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Layers,
  HardHat,
  RefreshCw,
  Printer,
  AlertTriangle,
  Package,
  CalendarCheck,
  BarChart3,
  Camera,
  Sparkles,
  X,
  CalendarRange,
  Bug,
  GitBranch,
  Wrench,
  Flag,
  PackageSearch,
  ClipboardCheck,
  ChevronRight,
  ChevronDown,
  ShoppingCart,
  ArrowRight,
  Calendar,
  Filter,
  Sun,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  Pending: "#f59e0b",
  Measured: "#0ea5e9",
  Design: "#8b5cf6",
  "In Production": "#f97316",
  Cutting: "#f43f5e",
  Assembly: "#14b8a6",
  Installation: "#06b6d4",
  Completed: "#10b981",
  Cancelled: "#a1a1aa",
};

const MATERIAL_COLORS = [
  "#b45309",
  "#0d9488",
  "#7c3aed",
  "#be123c",
  "#0369a1",
  "#ca8a04",
];

const PRIORITY_COLORS: Record<string, string> = {
  Low: "#a1a1aa",
  Normal: "#0ea5e9",
  High: "#f97316",
  Urgent: "#f43f5e",
};

const ACTIVITY_ICONS: Record<string, typeof Activity> = {
  job_created: ClipboardList,
  job_assigned: UserCheck,
  job_status: RefreshCw,
  measurement: Ruler,
  cutting_list: Scissors,
};

const ACTIVITY_TINTS: Record<string, string> = {
  job_created: "bg-orange-500/10 text-orange-600",
  job_assigned: "bg-violet-500/10 text-violet-600",
  job_status: "bg-sky-500/10 text-sky-600",
  measurement: "bg-teal-500/10 text-teal-600",
  cutting_list: "bg-rose-500/10 text-rose-600",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Working late";
}

/** Returns "Today" / "Yesterday" / "Aug 19" (short locale). */
function dayBucket(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDay.getTime()) / 86400000
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type ActivityFilter = "all" | "jobs" | "measurements" | "cutting";

function filterActivity(
  events: ActivityEvent[],
  filter: ActivityFilter
): ActivityEvent[] {
  if (filter === "all") return events;
  if (filter === "jobs")
    return events.filter((e) =>
      ["job_created", "job_assigned", "job_status"].includes(e.type)
    );
  if (filter === "measurements")
    return events.filter((e) => e.type === "measurement");
  return events.filter((e) => e.type === "cutting_list");
}

export function OverviewView({ onNavigate }: { onNavigate?: (view: string) => void }) {
  // Default to 30d so the throughput chart shows real activity (the 7d window
  // is often empty in steady-state operation).
  const [range, setRange] = React.useState<number>(30);
  const [activityFilter, setActivityFilter] =
    React.useState<ActivityFilter>("all");
  const { data, isLoading } = useQuery({
    queryKey: ["stats", range],
    queryFn: () => statsApi.get(range),
  });
  // Load activity and inventory only after stats are loaded to reduce
  // concurrent API calls and memory pressure on first render.
  const { data: activityData } = useQuery({
    queryKey: ["activity", 8],
    queryFn: () => activityApi.list(8),
    enabled: !!data,
  });
  const { data: inventoryData } = useQuery({
    queryKey: ["inventory"],
    queryFn: inventoryApi.list,
    enabled: !!data,
  });
  // Fetch jobs only to compute the Overdue count for Needs Attention.
  const { data: jobsForOverdue } = useQuery({
    queryKey: ["jobs", "overview-overdue"],
    queryFn: () => jobsApi.list(),
    enabled: !!data,
  });
  const overdueJobs = React.useMemo(() => {
    const now = new Date();
    return (jobsForOverdue?.jobs ?? []).filter(
      (j) =>
        j.deliveryDate &&
        new Date(j.deliveryDate) < now &&
        j.status !== "Completed" &&
        j.status !== "Cancelled"
    ).length;
  }, [jobsForOverdue]);

  const counts = data?.counts;
  const breakdown = data?.jobStatusBreakdown ?? {};
  const priority = data?.priorityBreakdown ?? {};
  const throughput = data?.throughput ?? [];
  const materials = data?.materialBreakdown ?? {};
  const workload = data?.technicianWorkload ?? [];

  const totalJobs = Object.values(breakdown).reduce((a, b) => a + b, 0) || 1;
  const totalMaterials = Object.values(materials).reduce((a, b) => a + b, 0) || 1;

  const statusPieData = Object.entries(breakdown).map(([name, value]) => ({
    name,
    value,
  }));
  const materialPieData = Object.entries(materials).map(([name, value]) => ({
    name,
    value,
  }));
  const priorityData = Object.entries(priority).map(([name, value]) => ({
    name,
    value,
  }));

  const cards = [
    {
      label: "Total Users",
      value: counts?.users ?? 0,
      sub: `${counts?.activeUsers ?? 0} active`,
      icon: Users,
      tint: "text-amber-600 bg-amber-500/10",
      trend: "+12%",
      up: true,
      view: "users",
    },
    {
      label: "Job Orders",
      value: counts?.jobOrders ?? 0,
      sub: `${counts?.pendingJobs ?? 0} pending`,
      icon: ClipboardList,
      tint: "text-orange-600 bg-orange-500/10",
      trend: "+8%",
      up: true,
      view: "job-orders",
    },
    {
      label: "Site Measurements",
      value: counts?.measurements ?? 0,
      sub: "captured",
      icon: Ruler,
      tint: "text-teal-600 bg-teal-500/10",
      trend: "+15%",
      up: true,
      view: "measurements",
    },
    {
      label: "Cutting Lists",
      value: counts?.cuttingLists ?? 0,
      sub: "generated",
      icon: Scissors,
      tint: "text-rose-600 bg-rose-500/10",
      trend: "-3%",
      up: false,
      view: "cutting-lists",
    },
  ];

  return (
    <div className="space-y-4">
      {/* What's New banner — dismissible */}
      <WhatsNewBanner onNavigate={onNavigate} />

      {/* Compact welcome banner */}
      <Card className="overflow-hidden border-primary/20">
        <div className="relative bg-gradient-to-br from-primary/10 via-accent/40 to-background p-4">
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold tracking-tight sm:text-xl">
                Cabinetry production at a glance
              </h1>
              <p className="text-xs text-muted-foreground">
                Monitor jobs from measurement through installation.
              </p>
            </div>
            <Button variant="outline" size="sm" className="no-print shrink-0 gap-1.5" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        </div>
      </Card>

      {/* Today's Snapshot — compact summary bar */}
      <TodaysSnapshot
        activeJobs={(counts?.jobOrders ?? 0) - (counts?.pendingJobs ?? 0) >= 0 ? (counts?.jobOrders ?? 0) - (counts?.pendingJobs ?? 0) : (counts?.jobOrders ?? 0)}
        pendingJobs={counts?.pendingJobs ?? 0}
        overdueJobs={overdueJobs}
        onNavigate={onNavigate}
      />

      {/* Stat cards + Quick Actions — bento grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card
              key={c.label}
              className="card-lift group relative cursor-pointer overflow-hidden p-3 hover:shadow-md"
              onClick={() => onNavigate?.(c.view)}
            >
              <div className="flex items-center justify-between">
                <div className={`rounded-lg p-1.5 ${c.tint}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span
                  className={`flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] font-semibold opacity-90 ${c.up ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}
                  title={`Trend ${c.up ? "up" : "down"}`}
                >
                  {c.up ? (
                    <ArrowUpRight className="h-2.5 w-2.5" />
                  ) : (
                    <ArrowDownRight className="h-2.5 w-2.5" />
                  )}
                  {c.trend}
                </span>
              </div>
              {isLoading ? (
                <div className="mt-1.5 h-6 w-12 animate-pulse rounded bg-muted" />
              ) : (
                <p className="mt-1.5 text-xl font-bold tabular-nums">{c.value}</p>
              )}
              <p className="text-[10px] text-muted-foreground">{c.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions — compact inline row */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "New Job", icon: ClipboardList, view: "job-orders" },
          { label: "Inventory", icon: Package, view: "inventory" },
          { label: "Attendance", icon: CalendarCheck, view: "attendance" },
          { label: "Customers", icon: Building2, view: "customers" },
          { label: "Reports", icon: BarChart3, view: "reports" },
          { label: "Notebook", icon: Camera, view: "blueprints" },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={() => onNavigate?.(a.view)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <Icon className="h-3.5 w-3.5 text-primary" />
              {a.label}
            </button>
          );
        })}
      </div>

      {/* Needs Attention — critical panels for daily standup */}
      <NeedsAttention
        pendingJobs={counts?.pendingJobs ?? 0}
        urgentJobs={(priority?.Urgent as number) ?? 0}
        highJobs={(priority?.High as number) ?? 0}
        lowStock={inventoryData?.stats.lowStock ?? 0}
        overdueJobs={overdueJobs}
        totalJobs={counts?.jobOrders ?? 0}
        onNavigate={onNavigate}
        isLoading={isLoading}
      />

      {/* Throughput chart */}
      <Card>
        <CardHeader className="p-3 sm:p-4 lg:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                Job Throughput
                {!isLoading && (() => {
                  const totalCreated = throughput.reduce((a, b) => a + (b.created ?? 0), 0);
                  const totalCompleted = throughput.reduce((a, b) => a + (b.completed ?? 0), 0);
                  return (
                    <span className="ml-1 flex items-center gap-2 text-xs font-normal text-muted-foreground">
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-primary">
                        {totalCreated} created
                      </span>
                      <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600">
                        {totalCompleted} completed
                      </span>
                    </span>
                  );
                })()}
              </CardTitle>
              <CardDescription>
                Jobs created vs completed over the last {range} days
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-border p-0.5">
                {[7, 30, 90].map((d) => (
                  <Button
                    key={d}
                    variant={range === d ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setRange(d)}
                  >
                    {d}d
                  </Button>
                ))}
              </div>
              <div className="hidden items-center gap-3 text-xs sm:flex">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  Created
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Completed
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-5">
          {isLoading ? (
            <div className="h-[200px] animate-pulse rounded bg-muted sm:h-[260px]" />
          ) : throughput.every((t) => (t.created ?? 0) === 0 && (t.completed ?? 0) === 0) ? (
            <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center sm:h-[260px]">
              <div className="rounded-full bg-muted p-3">
                <Activity className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No activity in this period</p>
              <p className="text-xs text-muted-foreground">
                Try switching to a wider range (30d or 90d) to see historical throughput.
              </p>
            </div>
          ) : (
            <div className="h-[200px] w-full sm:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={throughput}
                  margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                >
                <defs>
                  <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => {
                    const date = new Date(d);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                />
                <Area
                  type="monotone"
                  dataKey="created"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#createdGrad)"
                  name="Created"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#completedGrad)"
                  name="Completed"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Status donut */}
        <Card>
          <CardHeader className="p-3 sm:p-4 lg:p-5">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <ClipboardList className="h-4 w-4 text-primary" />
              Job Status Distribution
            </CardTitle>
            <CardDescription>
              Current pipeline state across {totalJobs} jobs
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-5">
            {isLoading ? (
              <div className="h-[220px] animate-pulse rounded bg-muted" />
            ) : statusPieData.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                No job data yet
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <ResponsiveContainer width="100%" height={220} className="!w-[50%]">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {statusPieData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={STATUS_COLORS[entry.name] ?? "#a1a1aa"}
                          stroke="var(--card)"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {statusPieData
                    .sort((a, b) => b.value - a.value)
                    .map((s) => {
                      const pct = Math.round((s.value / totalJobs) * 100);
                      return (
                        <div
                          key={s.name}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  STATUS_COLORS[s.name] ?? "#a1a1aa",
                              }}
                            />
                            <span className="font-medium">{s.name}</span>
                          </div>
                          <span className="tabular-nums text-muted-foreground">
                            {s.value} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority breakdown */}
        <Card>
          <CardHeader className="p-3 sm:p-4 lg:p-5">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Layers className="h-4 w-4 text-primary" />
              Priority Breakdown
            </CardTitle>
            <CardDescription>Job distribution by priority level</CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-5">
            {isLoading ? (
              <div className="h-[220px] animate-pulse rounded bg-muted" />
            ) : priorityData.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                No priority data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={priorityData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "var(--foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={60}
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
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                    {priorityData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={PRIORITY_COLORS[entry.name] ?? "#0ea5e9"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Material usage donut */}
        <Card>
          <CardHeader className="p-3 sm:p-4 lg:p-5">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Layers className="h-4 w-4 text-primary" />
              Material Usage
            </CardTitle>
            <CardDescription>Cutting lists by panel material</CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-5">
            {isLoading ? (
              <div className="h-[180px] animate-pulse rounded bg-muted" />
            ) : materialPieData.length === 0 ? (
              <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
                No material data yet
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={materialPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {materialPieData.map((entry, i) => (
                        <Cell
                          key={entry.name}
                          fill={MATERIAL_COLORS[i % MATERIAL_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-2">
                  {materialPieData.map((m, i) => (
                    <span
                      key={m.name}
                      className="flex items-center gap-1 text-xs"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            MATERIAL_COLORS[i % MATERIAL_COLORS.length],
                        }}
                      />
                      {m.name} ({m.value})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Technician workload */}
        <Card className="lg:col-span-2">
          <CardHeader className="p-3 sm:p-4 lg:p-5">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <HardHat className="h-4 w-4 text-primary" />
              Technician Workload
            </CardTitle>
            <CardDescription>
              Active job assignments per technician
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-5">
            {isLoading ? (
              <div className="h-[180px] animate-pulse rounded bg-muted" />
            ) : workload.length === 0 ? (
              <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
                No assigned jobs yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={workload}
                  margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
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
                  <Bar
                    dataKey="count"
                    fill="var(--primary)"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                    name="Assigned Jobs"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity + Inventory Alerts — bento 2-col */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {/* Recent Activity Feed */}
      <Card>
        <CardHeader className="pb-2 p-3 sm:p-4 lg:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-xs">
                Latest events across your production pipeline
              </CardDescription>
            </div>
            {/* Quick Filters — chips */}
            <div className="flex flex-wrap items-center gap-1">
              {([
                { id: "all", label: "All", icon: Filter },
                { id: "jobs", label: "Jobs", icon: ClipboardList },
                { id: "measurements", label: "Measurements", icon: Ruler },
                { id: "cutting", label: "Cutting Lists", icon: Scissors },
              ] as const).map((f) => {
                const Icon = f.icon;
                const active = activityFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setActivityFilter(f.id)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                    aria-pressed={active}
                  >
                    <Icon className="h-3 w-3" />
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const filteredEvents = filterActivity(
              activityData?.events ?? [],
              activityFilter
            ).slice(0, 8);
            if (filteredEvents.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center gap-1 py-8 text-center text-sm text-muted-foreground">
                  <Activity className="h-5 w-5 opacity-50" />
                  <span>
                    {activityFilter === "all"
                      ? "No recent activity"
                      : `No ${activityFilter} activity`}
                  </span>
                </div>
              );
            }
            // Group by day bucket, preserving chronological order
            const groups: { bucket: string; events: ActivityEvent[] }[] = [];
            for (const ev of filteredEvents) {
              const bucket = dayBucket(ev.timestamp);
              const last = groups[groups.length - 1];
              if (last && last.bucket === bucket) last.events.push(ev);
              else groups.push({ bucket, events: [ev] });
            }
            return (
              <div className="space-y-3">
                {groups.map((g) => (
                  <div key={g.bucket} className="space-y-1">
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.bucket}
                      </span>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>
                    {g.events.map((event) => {
                      const Icon = ACTIVITY_ICONS[event.type] ?? Activity;
                      const tint =
                        ACTIVITY_TINTS[event.type] ??
                        "bg-muted text-muted-foreground";
                      return (
                        <div
                          key={event.id}
                          className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/40"
                        >
                          <div
                            className={`mt-0.5 shrink-0 rounded-md p-1.5 ${tint}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-tight">
                              {event.title}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {event.description}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground/70">
                            {timeAgo(event.timestamp)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {onNavigate && (
                  <button
                    onClick={() => onNavigate("audit")}
                    className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    View all activity
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Inventory Alerts */}
      {(inventoryData?.stats.lowStock ?? 0) > 0 && (
        <InventoryAlertsCard
          items={inventoryData?.items ?? []}
          lowStock={inventoryData?.stats.lowStock ?? 0}
          onNavigate={onNavigate}
        />
      )}
      </div>

      {/* Quick stats footer — compact */}
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatRow
              icon={UserCheck}
              label="Active workforce"
              value={counts?.activeUsers ?? 0}
              total={counts?.users ?? 0}
            />
            <StatRow
              icon={Clock}
              label="Pending intake"
              value={counts?.pendingJobs ?? 0}
              total={counts?.jobOrders ?? 0}
            />
            <StatRow
              icon={CheckCircle2}
              label="Measurements"
              value={counts?.measurements ?? 0}
            />
            <StatRow
              icon={Scissors}
              label="Cutting lists"
              value={counts?.cuttingLists ?? 0}
            />
            <StatRow
              icon={Building2}
              label="Customers"
              value={counts?.customers ?? 0}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============ Needs Attention — daily standup panel ============ */
function NeedsAttention({
  pendingJobs,
  urgentJobs,
  highJobs,
  lowStock,
  overdueJobs,
  totalJobs,
  onNavigate,
  isLoading,
}: {
  pendingJobs: number;
  urgentJobs: number;
  highJobs: number;
  lowStock: number;
  overdueJobs: number;
  totalJobs: number;
  onNavigate?: (view: string) => void;
  isLoading?: boolean;
}) {
  const items: {
    label: string;
    value: number;
    sub: string;
    icon: typeof Clock;
    tint: string;
    view: string;
    severity: "info" | "warn" | "danger";
  }[] = [
    {
      label: "Pending intake",
      value: pendingJobs,
      sub: totalJobs ? `${Math.round((pendingJobs / totalJobs) * 100)}% of pipeline` : "—",
      icon: Clock,
      tint: "bg-amber-500/10 text-amber-600",
      view: "job-orders",
      severity: pendingJobs > 5 ? "warn" : "info",
    },
    {
      label: "Urgent priority",
      value: urgentJobs,
      sub: "needs immediate action",
      icon: AlertTriangle,
      tint: urgentJobs > 0 ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600",
      view: "job-orders",
      severity: urgentJobs > 0 ? "danger" : "info",
    },
    {
      label: "High priority",
      value: highJobs,
      sub: "in active pipeline",
      icon: Flag,
      tint: "bg-orange-500/10 text-orange-600",
      view: "job-orders",
      severity: "info",
    },
    {
      label: "Low stock items",
      value: lowStock,
      sub: lowStock > 0 ? "below reorder point" : "all stocked",
      icon: TrendingDown,
      tint: lowStock > 0 ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600",
      view: "inventory",
      severity: lowStock > 0 ? "danger" : "info",
    },
    {
      label: "Overdue",
      value: overdueJobs,
      sub: overdueJobs > 0 ? "past delivery date" : "on schedule",
      icon: CalendarRange,
      tint: overdueJobs > 0 ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600",
      view: "job-orders",
      severity: overdueJobs > 0 ? "danger" : "info",
    },
  ];

  const hasAttention = pendingJobs > 0 || urgentJobs > 0 || lowStock > 0 || overdueJobs > 0;

  return (
    <Card className={hasAttention ? "border-amber-500/30" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className={`h-4 w-4 ${hasAttention ? "text-amber-600" : "text-emerald-600"}`} />
            Needs Attention
          </CardTitle>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            hasAttention
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          }`}>
            {hasAttention ? "Action required" : "All clear"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((it) => {
            const Icon = it.icon;
            const isDanger = it.severity === "danger";
            return (
              <button
                key={it.label}
                onClick={() => onNavigate?.(it.view)}
                className={`group flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-sm ${
                  isDanger
                    ? "border-rose-500/40 bg-rose-500/5 hover:border-rose-500/60"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className={`shrink-0 rounded-lg p-2 ${it.tint}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  {isLoading ? (
                    <div className="h-5 w-8 animate-pulse rounded bg-muted" />
                  ) : (
                    <p className="text-lg font-bold tabular-nums leading-tight">{it.value}</p>
                  )}
                  <p className="truncate text-[11px] font-medium">{it.label}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{it.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ============ Today's Snapshot — compact summary bar ============ */
function TodaysSnapshot({
  activeJobs,
  pendingJobs,
  overdueJobs,
  onNavigate,
}: {
  activeJobs: number;
  pendingJobs: number;
  overdueJobs: number;
  onNavigate?: (view: string) => void;
}) {
  const now = React.useMemo(() => new Date(), []);
  const greeting = greetingFor(now);
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const pills = [
    {
      label: "Active jobs",
      value: activeJobs,
      icon: ClipboardList,
      tint: "bg-primary/10 text-primary",
      view: "job-orders",
    },
    {
      label: "Pending tasks",
      value: pendingJobs,
      icon: Clock,
      tint: "bg-amber-500/10 text-amber-600",
      view: "job-orders",
    },
    {
      label: "Overdue",
      value: overdueJobs,
      icon: CalendarRange,
      tint:
        overdueJobs > 0
          ? "bg-rose-500/10 text-rose-600"
          : "bg-emerald-500/10 text-emerald-600",
      view: "job-orders",
    },
  ];

  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sun className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold leading-tight sm:text-sm">
              {greeting}
              <span className="ml-1 text-muted-foreground">·</span>
              <span className="ml-1 text-muted-foreground font-normal">
                here&apos;s today&apos;s snapshot
              </span>
            </p>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground sm:text-xs">
              <Calendar className="h-3 w-3" />
              {dateLabel}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pills.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.label}
                onClick={() => onNavigate?.(p.view)}
                className={`flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium transition-colors hover:border-primary/40 hover:bg-primary/5 sm:px-3 sm:py-1.5 sm:text-xs ${p.tint}`}
                title={p.label}
              >
                <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="tabular-nums font-semibold">{p.value}</span>
                <span className="hidden text-muted-foreground sm:inline">
                  {p.label}
                </span>
                <ArrowRight className="hidden h-3 w-3 opacity-50 sm:block" />
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ============ Inventory Alerts (collapsible) ============ */
function InventoryAlertsCard({
  items,
  lowStock,
  onNavigate,
}: {
  items: Array<{
    id: string;
    name: string;
    material: string;
    thickness: string | null;
    unit: string;
    stockLevel: number | string;
    reorderPoint: number | string;
  }>;
  lowStock: number;
  onNavigate?: (view: string) => void;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const lowItems = items
    .filter(
      (i) =>
        Number(i.stockLevel) <= Number(i.reorderPoint) &&
        Number(i.reorderPoint) > 0
    )
    .slice(0, 5);

  return (
    <Card className="border-amber-500/30">
      <CardHeader>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={!collapsed}
        >
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Inventory Alerts
            </CardTitle>
            <CardDescription>
              {lowStock} item(s) below reorder point
            </CardDescription>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
              collapsed ? "" : "rotate-180"
            }`}
          />
        </button>
      </CardHeader>
      {!collapsed && (
        <CardContent>
          <div className="space-y-2">
            {lowItems.map((item) => {
              const stock = Number(item.stockLevel);
              const reorder = Number(item.reorderPoint);
              const isOut = stock === 0;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`shrink-0 rounded-md p-1.5 ${
                        isOut
                          ? "bg-rose-500/10 text-rose-600"
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      {isOut ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.material}
                        {item.thickness ? ` · ${item.thickness}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p
                        className={`text-sm font-bold tabular-nums ${
                          isOut ? "text-rose-600" : "text-amber-600"
                        }`}
                      >
                        {stock} {item.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        reorder at {reorder}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => onNavigate?.("inventory")}
                      title={`Reorder ${item.name}`}
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Reorder
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  total,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  total?: number;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="rounded-md bg-muted p-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold tabular-nums">
          {value}
          {total !== undefined && (
            <span className="text-xs font-normal text-muted-foreground">
              {" "}
              / {total}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

/* ============ What's New Banner (dismissible, compact) ============ */
function WhatsNewBanner({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const [dismissed, setDismissed] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    const seen = localStorage.getItem("kcm-whatsnew-v2-dismissed");
    if (seen === "true") setDismissed(true);
  }, []);

  function dismiss() {
    localStorage.setItem("kcm-whatsnew-v2-dismissed", "true");
    setDismissed(true);
  }

  if (dismissed) return null;

  const newFeatures = [
    { label: "Unified Calendar", icon: CalendarRange, view: "settings" },
    { label: "Punch List", icon: Bug, view: "settings" },
    { label: "Change Orders", icon: GitBranch, view: "settings" },
    { label: "Subcontractors", icon: HardHat, view: "settings" },
    { label: "Equipment", icon: Wrench, view: "settings" },
    { label: "Milestones", icon: Flag, view: "settings" },
    { label: "MRP", icon: PackageSearch, view: "settings" },
    { label: "Site Visits", icon: ClipboardCheck, view: "settings" },
  ];

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex flex-1 items-center gap-1.5 text-left text-xs font-medium"
          >
            <span className="text-primary">v2.0 — 17 new modules added</span>
            <span className="hidden text-muted-foreground sm:inline">
              · enable them in System Settings → Module Visibility
            </span>
            <ChevronRight
              className={`ml-auto hidden h-3 w-3 text-muted-foreground transition-transform sm:block ${
                expanded ? "rotate-90" : ""
              }`}
            />
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={dismiss}
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {expanded && (
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
            {newFeatures.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.label}
                  onClick={() => onNavigate?.(f.view)}
                  className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <Icon className="h-3 w-3 text-primary" />
                  {f.label}
                  <span className="rounded-full bg-primary px-1 py-0.5 text-[6px] font-bold leading-none text-primary-foreground">
                    NEW
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
