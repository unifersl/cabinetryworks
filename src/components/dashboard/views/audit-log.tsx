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
  UserPlus,
  RefreshCw,
  Trash2,
  LogIn,
  Plus,
  UserCheck,
  Settings,
  ShieldCheck,
  Activity,
  Calendar,
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
};

const ACTIONS = [
  "create",
  "update",
  "delete",
  "login",
  "status_change",
  "assign",
];
const ENTITY_TYPES = [
  "job",
  "customer",
  "user",
  "measurement",
  "cutting_list",
  "auth",
  "settings",
];

export function AuditLogView() {
  const [search, setSearch] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState<"all" | string>("all");
  const [entityFilter, setEntityFilter] = React.useState<"all" | string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["audit", actionFilter, entityFilter],
    queryFn: () =>
      auditApi.list({
        action: actionFilter === "all" ? undefined : actionFilter,
        entityType: entityFilter === "all" ? undefined : entityFilter,
        limit: 100,
      }),
  });

  const logs = data?.logs ?? [];
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <ScrollText className="h-5 w-5 text-primary" />
            Audit Log
          </h1>
          <p className="text-sm text-muted-foreground">
            Persistent record of all system changes for compliance &
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
              <p className="text-xs text-muted-foreground">Sign-ins (shown)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Event History</CardTitle>
              <CardDescription>
                {filtered.length} of {logs.length} entries shown
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                <SelectTrigger className="h-9 w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((log, idx) => {
                    const Icon = ACTION_ICONS[log.action] ?? ScrollText;
                    const tint =
                      ACTION_TINTS[log.action] ?? "bg-muted text-muted-foreground";
                    const initials = (log.actorName ?? "?")
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    return (
                      <TableRow
                        key={log.id}
                        className={`hover:bg-muted/50 ${idx % 2 === 1 ? "bg-muted/40" : ""}`}
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
                            <span className="text-xs text-muted-foreground">
                              System
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">
                            <span className="mr-1">
                              {ENTITY_ICONS[log.entityType] ?? "📄"}
                            </span>
                            {log.entityType.replace("_", " ")}
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
