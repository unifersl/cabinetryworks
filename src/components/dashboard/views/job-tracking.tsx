// @ts-nocheck
"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/dashboard/ui-helpers";
import {
  Search, Loader2, Package, Wrench, Brush, Plus, Edit3, ShieldCheck, ClipboardList,
  ChevronDown, ChevronRight, Calendar, User, TrendingUp, Building2, Filter,
} from "lucide-react";
import { toast } from "sonner";

// Job type metadata
const JOB_TYPES = [
  { value: "New", label: "New", icon: Package, color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  { value: "Installation", label: "Installation", icon: ClipboardList, color: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  { value: "Repair", label: "Repair", icon: Wrench, color: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  { value: "Touch-Up", label: "Touch-Up", icon: Brush, color: "bg-violet-500/15 text-violet-700 border-violet-500/30" },
  { value: "Add-On", label: "Add-On", icon: Plus, color: "bg-teal-500/15 text-teal-700 border-teal-500/30" },
  { value: "Modification", label: "Modification", icon: Edit3, color: "bg-orange-500/15 text-orange-700 border-orange-500/30" },
  { value: "Warranty", label: "Warranty", icon: ShieldCheck, color: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
];

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  Measured: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  Design: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  "In Production": "bg-orange-500/15 text-orange-700 border-orange-500/30",
  Cutting: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  Assembly: "bg-teal-500/15 text-teal-700 border-teal-500/30",
  Installation: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30",
  Completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  Cancelled: "bg-slate-500/15 text-slate-700 border-slate-500/30",
};

interface TrackingJob {
  id: string;
  orderNumber: string;
  title: string;
  status: string;
  priority: string;
  jobType: string;
  customerId: string;
  parentJobId: string | null;
  deliveryDate: string | null;
  createdAt: string;
  customer: { id: string; name: string; phone: string | null; email: string | null; address: string | null };
  assignedTo: { id: string; fullName: string } | null;
  parentJob: { id: string; orderNumber: string; title: string } | null;
  _count: { measurements: number; cuttingLists: number; quotes: number; goodsIssues: number; goodsReturns: number };
}

interface CustomerGroup {
  customer: { id: string; name: string; phone: string | null; email: string | null; address: string | null };
  jobs: TrackingJob[];
  totalJobs: number;
  jobTypes: Record<string, number>;
  latestJob: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getJobTypeMeta(type: string) {
  return JOB_TYPES.find((t) => t.value === type) ?? JOB_TYPES[0];
}

export function JobTrackingView({ onNavigate }: { onNavigate?: (view: string, entityId?: string) => void }) {
  const [search, setSearch] = React.useState("");
  const [filterJobType, setFilterJobType] = React.useState("all");
  const [filterStatus, setFilterStatus] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [expandedCustomers, setExpandedCustomers] = React.useState<Set<string>>(new Set());

  const queryString = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set("groupBy", "customer");
    if (filterJobType !== "all") params.set("jobType", filterJobType);
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    return params.toString();
  }, [filterJobType, filterStatus, dateFrom, dateTo]);

  const { data, isLoading } = useQuery({
    queryKey: ["job-tracking", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/job-tracking?${queryString}`);
      if (!res.ok) throw new Error("Failed to load tracking data");
      return res.json() as Promise<{ groups: CustomerGroup[]; totalJobs: number; totalCustomers: number }>;
    },
  });

  const groups = data?.groups ?? [];
  const totalJobs = data?.totalJobs ?? 0;
  const totalCustomers = data?.totalCustomers ?? 0;

  // Client-side search filter on customer name
  const filteredGroups = React.useMemo(() => {
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups.filter(
      (g) => g.customer.name.toLowerCase().includes(q) || g.customer.phone?.toLowerCase().includes(q),
    );
  }, [groups, search]);

  function toggleCustomer(id: string) {
    setExpandedCustomers((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // Build summary stats
  const jobTypeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of groups) {
      for (const [type, count] of Object.entries(g.jobTypes)) {
        counts[type] = (counts[type] ?? 0) + count;
      }
    }
    return counts;
  }, [groups]);

  const hasActiveFilters = filterJobType !== "all" || filterStatus !== "all" || dateFrom || dateTo;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <TrendingUp className="h-5 w-5 text-primary" />
            Job Tracking Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track all jobs per customer — new installations, repairs, touch-ups, add-ons, modifications & warranty claims.
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Jobs</p>
          <p className="text-lg font-bold tabular-nums">{totalJobs}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Customers</p>
          <p className="text-lg font-bold tabular-nums">{totalCustomers}</p>
        </Card>
        {JOB_TYPES.map((jt) => (
          <Card key={jt.value} className="p-3">
            <div className="flex items-center gap-1.5">
              <jt.icon className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground truncate">{jt.label}</p>
            </div>
            <p className="text-sm font-bold tabular-nums">{jobTypeCounts[jt.value] ?? 0}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Label className="text-[10px] text-muted-foreground">Search Customer</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-8"
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Job Type</Label>
              <Select value={filterJobType} onValueChange={setFilterJobType}>
                <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {JOB_TYPES.map((jt) => <SelectItem key={jt.value} value={jt.value}>{jt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {["Pending", "Measured", "Design", "In Production", "Cutting", "Assembly", "Installation", "Completed", "Cancelled"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[140px]" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[140px]" />
            </div>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" className="h-9" onClick={() => { setFilterJobType("all"); setFilterStatus("all"); setDateFrom(""); setDateTo(""); }}>
                <Filter className="mr-1 h-3 w-3" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Job list grouped by customer */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No jobs found"
          description={hasActiveFilters ? "Try adjusting your filters." : "No jobs have been created yet."}
        />
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isExpanded = expandedCustomers.has(group.customer.id) || filteredGroups.length <= 3;
            return (
              <Card key={group.customer.id}>
                <CardHeader className="pb-2 px-4 pt-4">
                  <button
                    onClick={() => toggleCustomer(group.customer.id)}
                    className="flex w-full items-center gap-2 text-left"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {group.customer.name}
                        <Badge variant="outline" className="text-[10px]">{group.totalJobs} job{group.totalJobs !== 1 ? "s" : ""}</Badge>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {group.customer.phone ?? "No phone"} · Last: {fmtDate(group.latestJob)}
                      </CardDescription>
                    </div>
                    {/* Job type breakdown chips */}
                    <div className="hidden sm:flex items-center gap-1">
                      {Object.entries(group.jobTypes).map(([type, count]) => {
                        const meta = getJobTypeMeta(type);
                        return (
                          <Badge key={type} variant="outline" className={`text-[9px] ${meta.color}`}>
                            <meta.icon className="h-2.5 w-2.5 mr-0.5" />
                            {count} {meta.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </button>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="px-4 pb-4">
                    {/* Jobs timeline */}
                    <div className="space-y-2">
                      {group.jobs.map((job) => {
                        const typeMeta = getJobTypeMeta(job.jobType);
                        const TypeIcon = typeMeta.icon;
                        return (
                          <div
                            key={job.id}
                            className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary/30 transition-colors cursor-pointer"
                            onClick={() => onNavigate?.("job-orders", job.id)}
                          >
                            {/* Job type icon */}
                            <div className={`shrink-0 rounded-lg p-2 ${typeMeta.color}`}>
                              <TypeIcon className="h-4 w-4" />
                            </div>

                            {/* Job info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs text-primary font-semibold">{job.orderNumber}</span>
                                <span className="text-sm font-medium truncate">{job.title}</span>
                                <Badge variant="outline" className={`text-[9px] ${typeMeta.color}`}>
                                  {typeMeta.label}
                                </Badge>
                                {job.parentJob && (
                                  <Badge variant="outline" className="text-[9px]">
                                    ↳ {job.parentJob.orderNumber}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {fmtDate(job.createdAt)}
                                </span>
                                {job.deliveryDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Deliver: {fmtDate(job.deliveryDate)}
                                  </span>
                                )}
                                {job.assignedTo && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {job.assignedTo.fullName}
                                  </span>
                                )}
                                {/* Counts */}
                                {(job._count.measurements > 0 || job._count.cuttingLists > 0 || job._count.goodsIssues > 0) && (
                                  <span className="flex items-center gap-2">
                                    {job._count.measurements > 0 && <span>📏 {job._count.measurements}</span>}
                                    {job._count.cuttingLists > 0 && <span>✂️ {job._count.cuttingLists}</span>}
                                    {job._count.goodsIssues > 0 && <span>📦 {job._count.goodsIssues}</span>}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Status badge */}
                            <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_COLORS[job.status] ?? ""}`}>
                              {job.status}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
