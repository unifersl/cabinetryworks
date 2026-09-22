"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi, type AuditLogEntry } from "@/lib/api";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ScrollText,
  Search,
  Filter,
  Loader2,
  RefreshCw,
  Trash2,
  LogIn,
  Plus,
  UserCheck,
  ShieldCheck,
  Activity,
  Calendar,
  ChevronRight,
  ChevronDown,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui-helpers";

const ACTION_ICONS: Record<string, typeof ScrollText> = {
  create: Plus,
  update: RefreshCw,
  delete: Trash2,
  login: LogIn,
  logout: LogIn,
  status_change: RefreshCw,
  assign: UserCheck,
};

const ACTION_TINTS: Record<string, string> = {
  create: "bg-emerald-500/10 text-emerald-600",
  update: "bg-sky-500/10 text-sky-600",
  delete: "bg-rose-500/10 text-rose-600",
  login: "bg-violet-500/10 text-violet-600",
  logout: "bg-zinc-500/10 text-zinc-600",
  status_change: "bg-amber-500/10 text-amber-600",
  assign: "bg-teal-500/10 text-teal-600",
};

const ENTITY_ICONS: Record<string, string> = {
  job: "📦",
  customer: "🏢",
  user: "👤",
  measurement: "📏",
  cutting_list: "✂️",
  auth: "🔐",
  settings: "⚙️",
  site_visit: "🚗",
  punch_item: "🐞",
  change_order: "🔀",
  communication: "💬",
  subcontractor: "👷",
  subcontractor_assignment: "🔗",
  equipment: "🛠️",
  equipment_assignment: "🔗",
  milestone: "🚩",
  material_requirement: "📦",
  job_expense: "💰",
  user_permission: "🔐",
  stock_request: "🧾",
  goods_issue: "📤",
  goods_return: "📥",
  stock_transfer: "🔄",
  stock_adjustment: "⚖️",
  stock_take: "📋",
  outside_purchase: "🛒",
  inventory_item: "🧱",
  warehouse: "🏬",
  supplier: "🚚",
  quote: "💵",
  material_price: "💲",
};

const ACTIONS = [
  "create",
  "update",
  "delete",
  "login",
  "logout",
  "status_change",
  "assign",
];

/**
 * Full list of valid AuditEntityType values from `src/lib/audit.ts`.
 * Kept in sync manually — if a new entity is added there, add it here too.
 */
const ENTITY_TYPES = [
  "job",
  "customer",
  "user",
  "measurement",
  "cutting_list",
  "auth",
  "settings",
  "site_visit",
  "punch_item",
  "change_order",
  "communication",
  "subcontractor",
  "subcontractor_assignment",
  "equipment",
  "equipment_assignment",
  "milestone",
  "material_requirement",
  "job_expense",
  "user_permission",
  "stock_request",
  "goods_issue",
  "goods_return",
  "stock_transfer",
  "stock_adjustment",
  "stock_take",
  "outside_purchase",
  "inventory_item",
  "warehouse",
  "supplier",
  "quote",
  "material_price",
];

const PAGE_SIZE = 25;

/** Safe JSON parse for the `details` column. */
function parseDetails(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** Render the before/after diff (or any details object) as a readable block. */
function DetailsDiff({ details }: { details: Record<string, unknown> }) {
  // Two recognised shapes:
  //   1. { changes: [{ key, oldValue, newValue }, ...] }  — settings/users
  //   2. arbitrary flat object — render key/value pairs
  const changes = Array.isArray(details.changes)
    ? (details.changes as Array<Record<string, unknown>>)
    : null;

  if (changes && changes.length > 0) {
    return (
      <div className="space-y-1.5">
        {changes.map((c, i) => (
          <div
            key={i}
            className="grid grid-cols-[120px_1fr_1fr] items-start gap-2 rounded border border-border bg-muted/30 px-2 py-1.5 text-xs"
          >
            <span className="font-mono font-semibold text-foreground">
              {String(c.key ?? "—")}
            </span>
            <span className="font-mono text-rose-600 break-all">
              <span className="text-muted-foreground">old: </span>
              {formatValue(c.oldValue)}
            </span>
            <span className="font-mono text-emerald-600 break-all">
              <span className="text-muted-foreground">new: </span>
              {formatValue(c.newValue)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Fallback: render the details object as key/value pairs.
  const entries = Object.entries(details);
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No detail fields.</p>;
  }
  return (
    <div className="space-y-1">
      {entries.map(([k, v]) => (
        <div
          key={k}
          className="grid grid-cols-[120px_1fr] gap-2 rounded border border-border bg-muted/30 px-2 py-1 text-xs"
        >
          <span className="font-mono font-semibold text-foreground">{k}</span>
          <span className="font-mono text-muted-foreground break-all">
            {formatValue(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function AuditLogView() {
  const [search, setSearch] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState<"all" | string>("all");
  const [entityFilter, setEntityFilter] = React.useState<"all" | string>("all");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [page, setPage] = React.useState(1);

  // Reset to page 1 whenever any filter changes.
  React.useEffect(() => {
    setPage(1);
  }, [actionFilter, entityFilter, fromDate, toDate, search]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "audit",
      actionFilter,
      entityFilter,
      fromDate,
      toDate,
      page,
      PAGE_SIZE,
    ],
    queryFn: () =>
      auditApi.list({
        action: actionFilter === "all" ? undefined : actionFilter,
        entityType: entityFilter === "all" ? undefined : entityFilter,
        page,
        pageSize: PAGE_SIZE,
        from: fromDate || undefined,
        to: toDate || undefined,
      }),
    placeholderData: (prev) => prev, // keep previous page visible while fetching next
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const stats = data?.stats ?? { total: 0, todayCount: 0 };

  const filtered = React.useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.summary.toLowerCase().includes(q) ||
        (l.actorName ?? "").toLowerCase().includes(q) ||
        (l.entityType ?? "").toLowerCase().includes(q)
    );
  }, [logs, search]);

  function clearFilters() {
    setActionFilter("all");
    setEntityFilter("all");
    setFromDate("");
    setToDate("");
    setSearch("");
    setPage(1);
  }

  const hasActiveFilters =
    actionFilter !== "all" ||
    entityFilter !== "all" ||
    !!fromDate ||
    !!toDate ||
    !!search;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <ScrollText className="h-5 w-5 text-primary" />
            Audit Log
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Persistent record of all system changes for compliance &amp;
            traceability.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Events</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <Calendar className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {stats.todayCount}
              </p>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-violet-500/10 p-2">
              <ShieldCheck className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {logs.filter((l) => l.action === "login").length}
              </p>
              <p className="text-xs text-muted-foreground">Sign-ins (page)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Event History</CardTitle>
                <CardDescription>
                  Showing {filtered.length} of {total} entries
                  {page > 1 ? ` · page ${page} of ${totalPages}` : ""}
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search summary, actor…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 pl-8 sm:w-56"
                  />
                </div>
                <Select
                  value={actionFilter}
                  onValueChange={setActionFilter}
                >
                  <SelectTrigger className="h-9 w-full sm:w-36">
                    <Filter className="mr-1.5 h-3.5 w-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {ACTIONS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={entityFilter}
                  onValueChange={setEntityFilter}
                >
                  <SelectTrigger className="h-9 w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="all">All types</SelectItem>
                    {ENTITY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9"
                    onClick={clearFilters}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
            {/* Date-range filter row */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Date range
              </span>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 w-full sm:w-44"
                aria-label="From date"
              />
              <span className="hidden text-xs text-muted-foreground sm:inline">
                →
              </span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 w-full sm:w-44"
                aria-label="To date"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading audit log…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No audit entries"
              description="System actions will be logged here automatically."
            />
          ) : (
            <div className="max-h-[65vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow>
                    <TableHead className="w-10 min-w-[40px]"></TableHead>
                    <TableHead className="min-w-[200px]">Event</TableHead>
                    <TableHead className="hidden min-w-[160px] md:table-cell">
                      Actor
                    </TableHead>
                    <TableHead className="hidden min-w-[120px] sm:table-cell">
                      Entity
                    </TableHead>
                    <TableHead className="min-w-[120px]">When</TableHead>
                    <TableHead className="w-10 min-w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((log) => (
                    <AuditRow key={log.id} log={log} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {total} total entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
              className="h-8"
            >
              <ChevronRight className="mr-1 h-3.5 w-3.5 rotate-180" />
              Prev
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
              className="h-8"
            >
              Next
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Single audit row with an expandable "details" disclosure. */
function AuditRow({ log }: { log: AuditLogEntry }) {
  const [expanded, setExpanded] = React.useState(false);
  const details = React.useMemo(() => parseDetails(log.details), [log.details]);
  const hasDetails = !!details;

  const Icon = ACTION_ICONS[log.action] ?? ScrollText;
  const tint = ACTION_TINTS[log.action] ?? "bg-muted text-muted-foreground";
  const initials = (log.actorName ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <TableRow
        className={`hover:bg-muted/50 transition-colors ${
          hasDetails ? "cursor-pointer" : ""
        }`}
        onClick={() => hasDetails && setExpanded((e) => !e)}
      >
        <TableCell>
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-md ${tint}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        </TableCell>
        <TableCell>
          <p className="text-sm font-medium">{log.summary}</p>
          <p className="text-xs text-muted-foreground">
            {log.action.replace("_", " ")}
          </p>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          {log.actorName ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6 border border-border">
                <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">{log.actorName}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">System</span>
          )}
        </TableCell>
        <TableCell className="hidden sm:table-cell">
          <Badge variant="outline" className="text-xs">
            <span className="mr-1">
              {ENTITY_ICONS[log.entityType] ?? "📄"}
            </span>
            {log.entityType.replace(/_/g, " ")}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {new Date(log.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </TableCell>
        <TableCell>
          {hasDetails ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((e2) => !e2);
              }}
              aria-label={expanded ? "Collapse details" : "Expand details"}
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : null}
        </TableCell>
      </TableRow>
      {expanded && hasDetails && details && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={6} className="p-3">
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Activity className="h-3 w-3" />
                Before / After diff
              </p>
              <DetailsDiff details={details} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
