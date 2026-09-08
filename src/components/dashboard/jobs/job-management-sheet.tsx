"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  jobsApi,
  usersApi,
  customersApi,
  jobTimeLogsApi,
  jobTransportsApi,
  jobFoodBeveragesApi,
  jobToolsApi,
  jobToolIssuesApi,
  jobToolReturnsApi,
  jobInsightsApi,
  jobExpensesApi,
  goodsIssuesApi,
  goodsReturnsApi,
  outsidePurchasesApi,
  stockRequestsApi,
  materialRequirementsApi,
  attendanceApi,
  EXPENSE_CATEGORIES,
  type JobTimeLog,
  type JobTransport,
  type JobFoodBeverage,
  type JobTool,
  type JobToolIssue,
  type JobToolReturn,
  type JobInsights,
  type JobExpense,
  type MaterialRequirement,
} from "@/lib/api";
import type { JobStatus, Priority, JobDetail } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { Separator } from "@/components/ui/separator";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/providers";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { JobReportDialog } from "./job-report-dialog";
import {
  Loader2,
  Clock,
  Truck,
  Utensils,
  Wrench,
  Package,
  ArrowLeftRight,
  BarChart3,
  CalendarCheck,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  User as UserIcon,
  MapPin,
  ClipboardList,
  X,
  Filter as FilterIcon,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Phone,
  Mail,
  DoorOpen,
  Route as RouteIcon,
  Hash,
  ArrowRight,
  TrendingUp,
  Users,
  AlertTriangle,
  Wallet,
  Receipt,
} from "lucide-react";

const STATUSES: JobStatus[] = [
  "Pending",
  "Measured",
  "Design",
  "In Production",
  "Cutting",
  "Assembly",
  "Installation",
  "Completed",
  "Cancelled",
];
const PRIORITIES: Priority[] = ["Low", "Normal", "High", "Urgent"];

const STATUS_BADGE: Record<string, string> = {
  Pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  Measured: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  Design: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  "In Production": "bg-orange-500/15 text-orange-700 border-orange-500/30",
  Cutting: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  Assembly: "bg-teal-500/15 text-teal-700 border-teal-500/30",
  Installation: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30",
  Completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  Cancelled: "bg-zinc-500/15 text-zinc-600 border-zinc-500/30",
};

const PRIORITY_BADGE: Record<string, string> = {
  Low: "bg-zinc-500/10 text-zinc-600",
  Normal: "bg-sky-500/10 text-sky-600",
  High: "bg-orange-500/10 text-orange-600",
  Urgent: "bg-rose-500/10 text-rose-600",
};

const ENTITY_TINTS: Record<string, string> = {
  // positive
  available: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  returned: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  good: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  // pending
  issued: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  draft: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  partial: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  fair: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  // negative
  lost: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  damaged: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  cancelled: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  retired: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  const tint = ENTITY_TINTS[status?.toLowerCase()] ?? "bg-muted text-muted-foreground";
  const label = status.replace(/_/g, " ");
  return (
    <Badge variant="outline" className={`capitalize ${tint}`}>
      {label}
    </Badge>
  );
}

/* ---------- Helpers ---------- */
function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtLKR(v: unknown): string {
  const n = num(v);
  if (!n) return "—";
  return `${n.toLocaleString()} LKR`;
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

function toInputDate(s?: string | null): string {
  if (!s) return "";
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function toInputDateTimeLocal(s?: string | null): string {
  if (!s) return "";
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "";
    // local time
    const offsetMs = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
  } catch {
    return "";
  }
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
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="rounded-full bg-muted p-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
      {action}
    </div>
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
    <div className="rounded-lg border border-border bg-card p-3">
      <div className={`mb-1 inline-flex rounded-md p-1 ${tint}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * Material Status card — surfaces each material's required vs available
 * vs shortage quantity for the job, with a one-click "Re-generate" action
 * that re-runs the material-requirements auto-calc from the cutting lists.
 */
function MaterialStatusCard({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["material-requirements", "job", jobId],
    queryFn: () => materialRequirementsApi.list({ jobId }),
  });
  const [regenerating, setRegenerating] = React.useState(false);

  const reqs: MaterialRequirement[] = data?.requirements ?? [];
  const shortages = reqs.filter((r) => Number(r.shortage) > 0);

  async function regenerate() {
    setRegenerating(true);
    try {
      const res = await materialRequirementsApi.generate({ jobId, regenerate: true });
      await queryClient.invalidateQueries({
        queryKey: ["material-requirements", "job", jobId],
      });
      const totalShortage = (res.summary?.totalShortage ?? 0) as number;
      if (totalShortage > 0) {
        toast.warning(`Re-generated ${res.requirements.length} requirement(s) — ${totalShortage} shortage(s)`);
      } else {
        toast.success(`Re-generated ${res.requirements.length} requirement(s) — no shortages`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate material requirements");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-1.5 text-xs">
              <ClipboardList className="h-3.5 w-3.5" />
              Material Status
            </CardTitle>
            <CardDescription className="text-[11px]">
              Required vs available stock, computed from cutting lists.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={regenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ClipboardList className="h-3 w-3" />
            )}
            Re-generate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : reqs.length === 0 ? (
          <div className="px-4 pb-4 text-xs text-muted-foreground">
            No material requirements recorded. Click <strong>Re-generate</strong> to auto-calculate from cutting lists.
          </div>
        ) : (
          <>
            {shortages.length > 0 && (
              <div className="mx-4 mb-2 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                {shortages.length} of {reqs.length} material(s) have a shortage — review below or create a Stock Request.
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">Material</TableHead>
                    <TableHead className="h-8 text-right text-xs">Required</TableHead>
                    <TableHead className="h-8 text-right text-xs">Available</TableHead>
                    <TableHead className="h-8 text-right text-xs">Shortage</TableHead>
                    <TableHead className="h-8 text-center text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reqs.map((r) => {
                    const shortage = Number(r.shortage);
                    const hasShortage = shortage > 0;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs font-medium">{r.material}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {Number(r.requiredQty).toFixed(2)} {r.unit}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {Number(r.availableQty).toFixed(2)} {r.unit}
                        </TableCell>
                        <TableCell
                          className={`text-right text-xs tabular-nums font-semibold ${
                            hasShortage ? "text-amber-600" : "text-emerald-600"
                          }`}
                        >
                          {shortage.toFixed(2)} {r.unit}
                        </TableCell>
                        <TableCell className="text-center">
                          {hasShortage ? (
                            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 text-[10px]">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              shortage
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 text-[10px]">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              fulfilled
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================================================
 *  Main Sheet Component
 * ========================================================== */
export function JobManagementSheet({
  jobId,
  open,
  onOpenChange,
}: {
  jobId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === "Admin" || user?.role === "SuperAdmin";
  const isMobile = useIsMobile();
  const [tab, setTab] = React.useState("overview");
  const [reportOpen, setReportOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["job-detail", jobId],
    queryFn: () => jobsApi.get(jobId!),
    enabled: !!jobId && open,
  });
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
    enabled: open,
  });
  const { data: customersData } = useQuery({
    queryKey: ["customers"],
    queryFn: customersApi.list,
    enabled: open,
  });
  const { data: insightsData, isLoading: insightsLoading } = useQuery({
    queryKey: ["job-insights", jobId],
    queryFn: () => jobInsightsApi.get(jobId!),
    enabled: !!jobId && open,
  });

  const job = data?.job;
  const technicians = (usersData?.users ?? []).filter(
    (u) => u.role === "Technician" && u.status === "active"
  );
  const customers = customersData?.customers ?? [];
  const insights = insightsData;

  async function patchJob(patch: Record<string, unknown>) {
    if (!jobId) return;
    try {
      await jobsApi.update(jobId, patch as Parameters<typeof jobsApi.update>[1]);
      queryClient.invalidateQueries({ queryKey: ["job-detail", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job-insights", jobId] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
      toast.success("Job updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "overflow-y-auto scrollbar-warm p-0",
          isMobile ? "h-[90vh] rounded-t-xl" : "w-full sm:max-w-3xl",
        )}
      >
        <SheetTitle className="sr-only">Job management</SheetTitle>
        <SheetDescription className="sr-only">
          Manage all aspects of this job: time logs, transport, food & beverage,
          tools, issues, returns, stock movements, and insights.
        </SheetDescription>
        {isLoading || !job ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="border-b border-border bg-gradient-to-br from-primary/5 to-background p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-primary">
                    {job.orderNumber}
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold leading-tight">
                    {job.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={STATUS_BADGE[job.status]}>
                      {job.status}
                    </Badge>
                    <Badge variant="outline" className={PRIORITY_BADGE[job.priority]}>
                      {job.priority} priority
                    </Badge>
                    {job.customer && (
                      <span className="text-xs text-muted-foreground">
                        · {job.customer.name}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setReportOpen(true)}
                >
                  <FileText className="mr-1.5 h-4 w-4" />
                  Report
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex-1 overflow-y-auto scrollbar-warm">
              <Tabs value={tab} onValueChange={setTab} className="w-full">
                <div className="sticky top-0 z-10 overflow-x-auto bg-card px-3">
                  <TabsList className="flex h-auto w-max rounded-none border-b border-transparent bg-transparent p-0">
                    <TabsTrigger value="overview" className="gap-1.5">
                      <ClipboardList className="h-3.5 w-3.5" />
                      Overview
                    </TabsTrigger>
                    <TabsTrigger value="time" className="gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Time Logs
                    </TabsTrigger>
                    <TabsTrigger value="transport" className="gap-1.5">
                      <Truck className="h-3.5 w-3.5" />
                      Transport
                    </TabsTrigger>
                    <TabsTrigger value="fb" className="gap-1.5">
                      <Utensils className="h-3.5 w-3.5" />
                      F&B
                    </TabsTrigger>
                    <TabsTrigger value="tools" className="gap-1.5">
                      <Wrench className="h-3.5 w-3.5" />
                      Tools
                    </TabsTrigger>
                    <TabsTrigger value="issues" className="gap-1.5">
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      Tool Issues
                    </TabsTrigger>
                    <TabsTrigger value="returns" className="gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Tool Returns
                    </TabsTrigger>
                    <TabsTrigger value="stock" className="gap-1.5">
                      <Package className="h-3.5 w-3.5" />
                      Stock
                    </TabsTrigger>
                    <TabsTrigger value="expenses" className="gap-1.5">
                      <Wallet className="h-3.5 w-3.5" />
                      Expenses
                    </TabsTrigger>
                    <TabsTrigger value="attendance" className="gap-1.5">
                      <CalendarCheck className="h-3.5 w-3.5" />
                      Attendance
                    </TabsTrigger>
                    <TabsTrigger value="insights" className="gap-1.5">
                      <BarChart3 className="h-3.5 w-3.5" />
                      Insights
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="overview" className="space-y-4 p-5">
                  <OverviewTab
                    job={job}
                    canEdit={canEdit}
                    technicians={technicians}
                    customers={customers}
                    onPatch={patchJob}
                    insights={insights}
                    insightsLoading={insightsLoading}
                  />
                </TabsContent>

                <TabsContent value="time" className="p-5">
                  <TimeLogsTab jobId={job.id} canEdit={canEdit} />
                </TabsContent>

                <TabsContent value="transport" className="p-5">
                  <TransportTab jobId={job.id} canEdit={canEdit} />
                </TabsContent>

                <TabsContent value="fb" className="p-5">
                  <FoodBeverageTab jobId={job.id} canEdit={canEdit} />
                </TabsContent>

                <TabsContent value="tools" className="p-5">
                  <ToolsCatalogTab canEdit={canEdit} />
                </TabsContent>

                <TabsContent value="issues" className="p-5">
                  <ToolIssuesTab jobId={job.id} canEdit={canEdit} />
                </TabsContent>

                <TabsContent value="returns" className="p-5">
                  <ToolReturnsTab jobId={job.id} canEdit={canEdit} />
                </TabsContent>

                <TabsContent value="stock" className="p-5">
                  <StockMovementsTab jobId={job.id} />
                </TabsContent>

                <TabsContent value="expenses" className="p-5">
                  <ExpensesTab jobId={job.id} canEdit={canEdit} />
                </TabsContent>

                <TabsContent value="attendance" className="p-5">
                  <JobAttendanceTab jobId={job.id} />
                </TabsContent>

                <TabsContent value="insights" className="p-5">
                  <InsightsTab jobId={job.id} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </SheetContent>
      {job && (
        <JobReportDialog open={reportOpen} onOpenChange={setReportOpen} jobId={job.id} />
      )}
    </Sheet>
  );
}

/* ============================================================
 *  Tab 1: Overview
 * ========================================================== */
function OverviewTab({
  job,
  canEdit,
  technicians,
  customers,
  onPatch,
  insights,
  insightsLoading,
}: {
  job: JobDetail;
  canEdit: boolean;
  technicians: { id: string; fullName: string }[];
  customers: { id: string; name: string; phone?: string | null; email?: string | null; address?: string | null }[];
  onPatch: (patch: Record<string, unknown>) => void;
  insights?: JobInsights;
  insightsLoading: boolean;
}) {
  const [editingDesc, setEditingDesc] = React.useState(false);
  const [descDraft, setDescDraft] = React.useState(job.description ?? "");

  React.useEffect(() => {
    setDescDraft(job.description ?? "");
  }, [job.description]);

  return (
    <div className="space-y-4">
      {/* Editable core fields */}
      {canEdit && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={job.status} onValueChange={(v) => onPatch({ status: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Priority</Label>
            <Select value={job.priority} onValueChange={(v) => onPatch({ priority: v as Priority })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Assigned To</Label>
            <Select
              value={job.assignedToId ?? "__unassigned"}
              onValueChange={(v) => onPatch({ assignedToId: v === "__unassigned" ? null : v })}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned">Unassigned</SelectItem>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Customer</Label>
            <Select
              value={job.customerId}
              onValueChange={(v) => onPatch({ customerId: v })}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Delivery Date</Label>
            <Input
              type="date"
              className="h-9"
              value={toInputDate(job.deliveryDate)}
              onChange={(e) => onPatch({ deliveryDate: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Job Title</Label>
            <Input
              className="h-9"
              value={job.title}
              onChange={(e) => onPatch({ title: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Description */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            DESCRIPTION
          </div>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                if (editingDesc) {
                  onPatch({ description: descDraft });
                  setEditingDesc(false);
                } else {
                  setEditingDesc(true);
                }
              }}
            >
              {editingDesc ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Save
                </>
              ) : (
                <>
                  <Pencil className="h-3 w-3" />
                  Edit
                </>
              )}
            </Button>
          )}
        </div>
        {editingDesc ? (
          <Textarea
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            rows={3}
            placeholder="Scope, materials, special instructions…"
          />
        ) : job.description ? (
          <p className="text-sm leading-relaxed">{job.description}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">No description</p>
        )}
      </div>

      {/* Customer card */}
      {job.customer && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <UserIcon className="h-3.5 w-3.5" /> CUSTOMER
          </div>
          <p className="font-medium">{job.customer.name}</p>
          {job.customer.phone && (
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" /> {job.customer.phone}
            </p>
          )}
        </div>
      )}

      {/* Key Stats */}
      <div>
        <h3 className="mb-2 text-sm font-medium">Key Stats</h3>
        {insightsLoading || !insights ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading stats…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MiniStat label="Total Hours" value={insights.timeLogs.totalHours} icon={Clock} tint="bg-primary/10 text-primary" />
            <MiniStat label="Transports" value={insights.transports.total} icon={Truck} tint="bg-orange-500/10 text-orange-600" />
            <MiniStat label="F&B Meals" value={insights.foodBeverage.totalMeals} icon={Utensils} tint="bg-teal-500/10 text-teal-600" />
            <MiniStat label="Tool Issues" value={insights.tools.issuesCount} icon={ArrowLeftRight} tint="bg-violet-500/10 text-violet-600" />
            <MiniStat label="Goods Issues" value={insights.stock.issuesCount} icon={Package} tint="bg-amber-500/10 text-amber-600" />
            <MiniStat label="Outside Purchases" value={insights.stock.outsidePurchasesCount} icon={Package} tint="bg-cyan-500/10 text-cyan-600" />
          </div>
        )}
      </div>

      {/* Pipeline */}
      {insights && (
        <div>
          <h3 className="mb-3 text-sm font-medium">Production Pipeline</h3>
          <ProgressStepper percent={insights.progress.percent} currentStatus={job.status} />
        </div>
      )}

      {/* Status Timeline */}
      {insights && insights.timeline.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium">Status Timeline</h3>
          <div className="space-y-2">
            {insights.timeline.slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-start gap-3 rounded-md border border-border bg-card p-3">
                <div className="rounded-md bg-primary/10 p-1.5">
                  <Clock className="h-3 w-3 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{t.summary}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.actorName ?? "System"} · {fmtDateTime(t.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressStepper({ percent, currentStatus }: { percent: number; currentStatus: string }) {
  const isCancelled = currentStatus === "Cancelled";
  return (
    <div className="space-y-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${isCancelled ? "bg-rose-500" : "bg-primary"}`}
          style={{ width: `${isCancelled ? 100 : percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {isCancelled ? "Cancelled" : `${percent}% complete`}
      </p>
    </div>
  );
}

/* ============================================================
 *  Tab 2: Time Logs
 * ========================================================== */
const WORK_TYPES = ["factory", "onsite", "travel", "meeting", "other"];

function TimeLogsTab({ jobId, canEdit }: { jobId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState<JobTimeLog | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data: usersData } = useQuery({ queryKey: ["users"], queryFn: usersApi.list });
  const { data, isLoading } = useQuery({
    queryKey: ["job-time-logs", jobId],
    queryFn: () => jobTimeLogsApi.list({ jobId }),
  });
  const logs = data?.logs ?? [];

  const totalHours = logs.reduce((s, l) => s + num(l.hoursWorked), 0);
  const totalLaborCost = logs.reduce((s, l) => s + num(l.laborCost), 0);
  const byWorker = new Map<string, { hours: number; count: number }>();
  const byType = new Map<string, number>();
  for (const l of logs) {
    const w = byWorker.get(l.workerName) ?? { hours: 0, count: 0 };
    w.hours += num(l.hoursWorked);
    w.count += 1;
    byWorker.set(l.workerName, w);
    byType.set(l.workType, (byType.get(l.workType) ?? 0) + num(l.hoursWorked));
  }

  const removeMutation = useMutation({
    mutationFn: (id: string) => jobTimeLogsApi.remove(id),
    onSuccess: () => {
      toast.success("Time log deleted");
      queryClient.invalidateQueries({ queryKey: ["job-time-logs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["job-insights", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <Clock className="h-4 w-4 text-primary" />
            Time Logs
          </h3>
          <p className="text-xs text-muted-foreground">
            {logs.length} entries · {Math.round(totalHours * 100) / 100} hours total
            {totalLaborCost > 0 && ` · ${totalLaborCost.toLocaleString()} LKR labor`}
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Time Log
          </Button>
        )}
      </div>

      {/* Summary */}
      {logs.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5" /> Hours by Worker
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {Array.from(byWorker.entries())
                .sort((a, b) => b[1].hours - a[1].hours)
                .map(([name, v]) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <span className="truncate">{name}</span>
                    <span className="font-medium tabular-nums">
                      {Math.round(v.hours * 100) / 100}h ({v.count})
                    </span>
                  </div>
                ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-xs">
                <TrendingUp className="h-3.5 w-3.5" /> Hours by Work Type
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {Array.from(byType.entries()).map(([type, hours]) => (
                <div key={type} className="flex items-center justify-between text-xs">
                  <span className="capitalize">{type}</span>
                  <span className="font-medium tabular-nums">{Math.round(hours * 100) / 100}h</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No time logs yet"
          description="Track worker hours by work type (factory, onsite, travel, meeting)."
          action={canEdit ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add First Time Log
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-9 text-xs">Worker</TableHead>
                <TableHead className="h-9 text-xs">Date</TableHead>
                <TableHead className="h-9 text-xs">Type</TableHead>
                <TableHead className="h-9 text-xs">Clock In</TableHead>
                <TableHead className="h-9 text-xs">Clock Out</TableHead>
                <TableHead className="h-9 text-right text-xs">Hours</TableHead>
                <TableHead className="h-9 text-right text-xs">Rate</TableHead>
                <TableHead className="h-9 text-right text-xs">Labor Cost</TableHead>
                <TableHead className="h-9 text-xs">Notes</TableHead>
                {canEdit && <TableHead className="h-9 text-right text-xs">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs font-medium">{l.workerName}</TableCell>
                  <TableCell className="text-xs">{fmtDate(l.workDate)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-[10px]">{l.workType}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{fmtDateTime(l.clockIn)}</TableCell>
                  <TableCell className="text-xs">{fmtDateTime(l.clockOut)}</TableCell>
                  <TableCell className="text-right text-xs font-medium tabular-nums">{num(l.hoursWorked).toFixed(2)}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {num(l.hourlyRate) > 0 ? `${num(l.hourlyRate).toLocaleString()} LKR` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium tabular-nums">
                    {num(l.laborCost) > 0 ? `${num(l.laborCost).toLocaleString()} LKR` : "—"}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">{l.notes ?? "—"}</TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(l)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm("Delete this time log?")) removeMutation.mutate(l.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {(createOpen || editing) && (
        <TimeLogDialog
          jobId={jobId}
          log={editing}
          users={usersData?.users ?? []}
          open={createOpen || !!editing}
          onOpenChange={(o) => {
            if (!o) {
              setCreateOpen(false);
              setEditing(null);
            }
          }}
        />
      )}
    </div>
  );
}

function TimeLogDialog({
  jobId,
  log,
  users,
  open,
  onOpenChange,
}: {
  jobId: string;
  log: JobTimeLog | null;
  users: { id: string; fullName: string; role: string }[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [workerName, setWorkerName] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [workDate, setWorkDate] = React.useState("");
  const [workType, setWorkType] = React.useState("onsite");
  const [clockIn, setClockIn] = React.useState("");
  const [clockOut, setClockOut] = React.useState("");
  const [hoursWorked, setHoursWorked] = React.useState("");
  const [hourlyRate, setHourlyRate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [useClock, setUseClock] = React.useState(true);

  React.useEffect(() => {
    if (log) {
      setWorkerName(log.workerName);
      setUserId(log.userId ?? "");
      setWorkDate(toInputDate(log.workDate));
      setWorkType(log.workType);
      setClockIn(toInputDateTimeLocal(log.clockIn));
      setClockOut(toInputDateTimeLocal(log.clockOut));
      setHoursWorked(log.clockIn && log.clockOut ? "" : String(log.hoursWorked));
      setHourlyRate(num(log.hourlyRate) > 0 ? String(log.hourlyRate) : "");
      setNotes(log.notes ?? "");
      setUseClock(!!log.clockIn && !!log.clockOut);
    } else {
      setWorkerName("");
      setUserId("");
      setWorkDate(new Date().toISOString().slice(0, 10));
      setWorkType("onsite");
      setClockIn("");
      setClockOut("");
      setHoursWorked("");
      setHourlyRate("");
      setNotes("");
      setUseClock(true);
    }
  }, [log, open]);

  // Auto-set worker name from selected user
  React.useEffect(() => {
    if (userId) {
      const u = users.find((x) => x.id === userId);
      if (u) setWorkerName(u.fullName);
    }
  }, [userId, users]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        workerName: workerName.trim(),
        workType,
        workDate: workDate || new Date().toISOString(),
        notes: notes || undefined,
      };
      if (userId) payload.userId = userId;
      if (useClock) {
        if (clockIn) payload.clockIn = new Date(clockIn).toISOString();
        if (clockOut) payload.clockOut = new Date(clockOut).toISOString();
      } else if (hoursWorked) {
        payload.hoursWorked = Number(hoursWorked);
      }
      const rate = Number(hourlyRate);
      if (Number.isFinite(rate) && rate > 0) payload.hourlyRate = rate;
      if (log) {
        return jobTimeLogsApi.update(log.id, payload);
      }
      return jobTimeLogsApi.create({ jobId, ...payload } as Parameters<typeof jobTimeLogsApi.create>[0]);
    },
    onSuccess: () => {
      toast.success(log ? "Time log updated" : "Time log added");
      queryClient.invalidateQueries({ queryKey: ["job-time-logs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["job-insights", jobId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>{log ? "Edit Time Log" : "Add Time Log"}</DialogTitle>
              <DialogDescription>Track worker hours for this job.</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!workerName.trim()) {
              toast.error("Worker name is required");
              return;
            }
            save.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Worker (system user)</Label>
              <Select value={userId} onValueChange={(v) => setUserId(v === "__none" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Free text —</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName} ({u.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Worker Name *</Label>
              <Input
                className="h-9"
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                placeholder="e.g. John Smith"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                className="h-9"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Work Type</Label>
              <Select value={workType} onValueChange={setWorkType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WORK_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={useClock ? "default" : "outline"}
              onClick={() => setUseClock(true)}
            >
              Clock In/Out
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!useClock ? "default" : "outline"}
              onClick={() => setUseClock(false)}
            >
              Enter Hours Directly
            </Button>
          </div>

          {useClock ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Clock In</Label>
                <Input
                  type="datetime-local"
                  className="h-9"
                  value={clockIn}
                  onChange={(e) => setClockIn(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Clock Out</Label>
                <Input
                  type="datetime-local"
                  className="h-9"
                  value={clockOut}
                  onChange={(e) => setClockOut(e.target.value)}
                />
              </div>
              {clockIn && clockOut && (
                <p className="col-span-2 text-xs text-muted-foreground">
                  Computed hours:{" "}
                  {Math.round(
                    ((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60)) * 100
                  ) / 100}h
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Hours Worked</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  className="h-9"
                  value={hoursWorked}
                  onChange={(e) => setHoursWorked(e.target.value)}
                  placeholder="e.g. 8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hourly Rate (LKR)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  className="h-9"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="e.g. 1500"
                />
              </div>
              {hoursWorked && hourlyRate && (
                <p className="col-span-2 text-xs text-muted-foreground">
                  Labor cost:{" "}
                  {(Number(hoursWorked) * Number(hourlyRate)).toLocaleString()} LKR
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="What work was done…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {log ? "Save Changes" : "Add Time Log"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 *  Tab 3: Transport
 * ========================================================== */
const TRANSPORT_PURPOSES = [
  { value: "material_delivery", label: "Material Delivery" },
  { value: "worker_transport", label: "Worker Transport" },
  { value: "site_visit", label: "Site Visit" },
  { value: "other", label: "Other" },
];

function TransportTab({ jobId, canEdit }: { jobId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState<JobTransport | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["job-transports", jobId],
    queryFn: () => jobTransportsApi.list({ jobId }),
  });
  const transports = data?.transports ?? [];

  const totalDistance = transports.reduce((s, t) => s + num(t.distanceKm), 0);
  const totalTransportCost = transports.reduce((s, t) => s + num(t.cost), 0);

  const removeMutation = useMutation({
    mutationFn: (id: string) => jobTransportsApi.remove(id),
    onSuccess: () => {
      toast.success("Transport record deleted");
      queryClient.invalidateQueries({ queryKey: ["job-transports", jobId] });
      queryClient.invalidateQueries({ queryKey: ["job-insights", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <Truck className="h-4 w-4 text-primary" />
            Transport
          </h3>
          <p className="text-xs text-muted-foreground">
            {transports.length} trips · {Math.round(totalDistance * 100) / 100} km total
            {totalTransportCost > 0 && ` · ${totalTransportCost.toLocaleString()} LKR`}
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Transport
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : transports.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No transport records"
          description="Log vehicle trips, material deliveries, and worker transport for this job."
          action={canEdit ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add Transport
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-9 text-xs">Date</TableHead>
                <TableHead className="h-9 text-xs">Vehicle</TableHead>
                <TableHead className="h-9 text-xs">Driver</TableHead>
                <TableHead className="h-9 text-xs">Route</TableHead>
                <TableHead className="h-9 text-xs">Purpose</TableHead>
                <TableHead className="h-9 text-right text-xs">Distance</TableHead>
                <TableHead className="h-9 text-right text-xs">Cost</TableHead>
                {canEdit && <TableHead className="h-9 text-right text-xs">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {transports.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs">{fmtDate(t.date)}</TableCell>
                  <TableCell className="text-xs font-medium">{t.vehicleNo ?? "—"}</TableCell>
                  <TableCell className="text-xs">{t.driverName ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {t.fromLocation || t.toLocation ? (
                      <span className="flex items-center gap-1">
                        <span>{t.fromLocation ?? "?"}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span>{t.toLocation ?? "?"}</span>
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {TRANSPORT_PURPOSES.find((p) => p.value === t.purpose)?.label ?? t.purpose}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium tabular-nums">{num(t.distanceKm).toFixed(1)} km</TableCell>
                  <TableCell className="text-right text-xs font-medium tabular-nums">
                    {num(t.cost) > 0 ? `${num(t.cost).toLocaleString()} LKR` : "—"}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(t)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm("Delete this transport record?")) removeMutation.mutate(t.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {(createOpen || editing) && (
        <TransportDialog
          jobId={jobId}
          transport={editing}
          open={createOpen || !!editing}
          onOpenChange={(o) => {
            if (!o) {
              setCreateOpen(false);
              setEditing(null);
            }
          }}
        />
      )}
    </div>
  );
}

function TransportDialog({
  jobId,
  transport,
  open,
  onOpenChange,
}: {
  jobId: string;
  transport: JobTransport | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [date, setDate] = React.useState("");
  const [vehicleNo, setVehicleNo] = React.useState("");
  const [driverName, setDriverName] = React.useState("");
  const [fromLocation, setFromLocation] = React.useState("");
  const [toLocation, setToLocation] = React.useState("");
  const [purpose, setPurpose] = React.useState("material_delivery");
  const [distanceKm, setDistanceKm] = React.useState("");
  const [cost, setCost] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (transport) {
      setDate(toInputDate(transport.date));
      setVehicleNo(transport.vehicleNo ?? "");
      setDriverName(transport.driverName ?? "");
      setFromLocation(transport.fromLocation ?? "");
      setToLocation(transport.toLocation ?? "");
      setPurpose(transport.purpose);
      setDistanceKm(String(num(transport.distanceKm)));
      setCost(num(transport.cost) > 0 ? String(transport.cost) : "");
      setNotes(transport.notes ?? "");
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setVehicleNo("");
      setDriverName("");
      setFromLocation("");
      setToLocation("");
      setPurpose("material_delivery");
      setDistanceKm("");
      setCost("");
      setNotes("");
    }
  }, [transport, open]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        date: date || new Date().toISOString(),
        vehicleNo: vehicleNo || undefined,
        driverName: driverName || undefined,
        fromLocation: fromLocation || undefined,
        toLocation: toLocation || undefined,
        purpose,
        distanceKm: Number(distanceKm) || 0,
        cost: Number(cost) || 0,
        notes: notes || undefined,
      };
      if (transport) return jobTransportsApi.update(transport.id, payload);
      return jobTransportsApi.create({ jobId, ...payload });
    },
    onSuccess: () => {
      toast.success(transport ? "Transport updated" : "Transport added");
      queryClient.invalidateQueries({ queryKey: ["job-transports", jobId] });
      queryClient.invalidateQueries({ queryKey: ["job-insights", jobId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>{transport ? "Edit Transport" : "Add Transport"}</DialogTitle>
              <DialogDescription>Log a vehicle trip or delivery.</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" className="h-9" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Purpose</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRANSPORT_PURPOSES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vehicle No.</Label>
              <Input className="h-9" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="e.g. B 1234 ABC" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Driver</Label>
              <Input className="h-9" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input className="h-9" value={fromLocation} onChange={(e) => setFromLocation(e.target.value)} placeholder="Workshop" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input className="h-9" value={toLocation} onChange={(e) => setToLocation(e.target.value)} placeholder="Site" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Distance (km)</Label>
              <Input type="number" step="0.1" min="0" className="h-9" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Cost (LKR)</Label>
              <Input type="number" step="1" min="0" className="h-9" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="e.g. 5000" />
              <p className="text-[11px] text-muted-foreground">Fuel / transport cost for this trip.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {transport ? "Save Changes" : "Add Transport"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 *  Tab 4: Food & Beverage
 * ========================================================== */
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snacks", "tea", "water"];

function FoodBeverageTab({ jobId, canEdit }: { jobId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState<JobFoodBeverage | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["job-food-beverages", jobId],
    queryFn: () => jobFoodBeveragesApi.list({ jobId }),
  });
  const items = data?.items ?? [];
  const totalMeals = items.reduce((s, i) => s + (i.personCount || 0), 0);
  const totalFbCost = items.reduce((s, i) => s + num(i.cost), 0);
  const byType = new Map<string, number>();
  for (const i of items) byType.set(i.mealType, (byType.get(i.mealType) ?? 0) + i.personCount);

  const removeMutation = useMutation({
    mutationFn: (id: string) => jobFoodBeveragesApi.remove(id),
    onSuccess: () => {
      toast.success("F&B record deleted");
      queryClient.invalidateQueries({ queryKey: ["job-food-beverages", jobId] });
      queryClient.invalidateQueries({ queryKey: ["job-insights", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <Utensils className="h-4 w-4 text-primary" />
            Food & Beverage
          </h3>
          <p className="text-xs text-muted-foreground">
            {items.length} entries · {totalMeals} person-meals total
            {totalFbCost > 0 && ` · ${totalFbCost.toLocaleString()} LKR`}
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add F&B Record
          </Button>
        )}
      </div>

      {items.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-xs">
              <Utensils className="h-3.5 w-3.5" /> Meals by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Array.from(byType.entries()).map(([type, count]) => (
                <Badge key={type} variant="outline" className="capitalize">
                  {type}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title="No F&B records"
          description="Log meals provided to workers on site (breakfast, lunch, dinner, etc.)."
          action={canEdit ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add F&B Record
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-9 text-xs">Date</TableHead>
                <TableHead className="h-9 text-xs">Meal Type</TableHead>
                <TableHead className="h-9 text-right text-xs">Persons</TableHead>
                <TableHead className="h-9 text-right text-xs">Cost</TableHead>
                <TableHead className="h-9 text-xs">Description</TableHead>
                {canEdit && <TableHead className="h-9 text-right text-xs">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="text-xs">{fmtDate(i.date)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-[10px]">{i.mealType}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium tabular-nums">{i.personCount}</TableCell>
                  <TableCell className="text-right text-xs font-medium tabular-nums">
                    {num(i.cost) > 0 ? `${num(i.cost).toLocaleString()} LKR` : "—"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{i.description ?? "—"}</TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(i)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm("Delete this F&B record?")) removeMutation.mutate(i.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {(createOpen || editing) && (
        <FoodBeverageDialog
          jobId={jobId}
          item={editing}
          open={createOpen || !!editing}
          onOpenChange={(o) => {
            if (!o) {
              setCreateOpen(false);
              setEditing(null);
            }
          }}
        />
      )}
    </div>
  );
}

function FoodBeverageDialog({
  jobId,
  item,
  open,
  onOpenChange,
}: {
  jobId: string;
  item: JobFoodBeverage | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [date, setDate] = React.useState("");
  const [mealType, setMealType] = React.useState("lunch");
  const [personCount, setPersonCount] = React.useState("1");
  const [cost, setCost] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (item) {
      setDate(toInputDate(item.date));
      setMealType(item.mealType);
      setPersonCount(String(item.personCount));
      setCost(num(item.cost) > 0 ? String(item.cost) : "");
      setDescription(item.description ?? "");
      setNotes(item.notes ?? "");
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setMealType("lunch");
      setPersonCount("1");
      setCost("");
      setDescription("");
      setNotes("");
    }
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        date: date || new Date().toISOString(),
        mealType,
        personCount: parseInt(personCount, 10) || 1,
        cost: Number(cost) || 0,
        description: description || undefined,
        notes: notes || undefined,
      };
      if (item) return jobFoodBeveragesApi.update(item.id, payload);
      return jobFoodBeveragesApi.create({ jobId, ...payload });
    },
    onSuccess: () => {
      toast.success(item ? "F&B updated" : "F&B added");
      queryClient.invalidateQueries({ queryKey: ["job-food-beverages", jobId] });
      queryClient.invalidateQueries({ queryKey: ["job-insights", jobId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>{item ? "Edit F&B Record" : "Add F&B Record"}</DialogTitle>
              <DialogDescription>Log meals provided to workers.</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" className="h-9" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Meal Type</Label>
              <Select value={mealType} onValueChange={setMealType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Person Count</Label>
                <Input type="number" min="1" className="h-9" value={personCount} onChange={(e) => setPersonCount(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cost (LKR)</Label>
                <Input type="number" min="0" step="1" className="h-9" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="e.g. 2500" />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input className="h-9" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Chicken rice with drinks" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {item ? "Save Changes" : "Add F&B"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 *  Tab 5: Tools Catalog (global)
 * ========================================================== */
const TOOL_CATEGORIES = [
  { value: "power_tool", label: "Power Tool" },
  { value: "hand_tool", label: "Hand Tool" },
  { value: "measuring", label: "Measuring" },
  { value: "safety", label: "Safety" },
  { value: "ladder", label: "Ladder" },
  { value: "other", label: "Other" },
];
const TOOL_STATUSES = ["available", "issued", "lost", "damaged", "retired"];

function ToolsCatalogTab({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [editing, setEditing] = React.useState<JobTool | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["job-tools", categoryFilter, statusFilter],
    queryFn: () => jobToolsApi.list({
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
    }),
  });
  const tools = data?.tools ?? [];

  const filtered = tools.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || t.name.toLowerCase().includes(q) || (t.code ?? "").toLowerCase().includes(q);
    return matchesSearch;
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => jobToolsApi.remove(id),
    onSuccess: () => {
      toast.success("Tool deleted");
      queryClient.invalidateQueries({ queryKey: ["job-tools"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <Wrench className="h-4 w-4 text-primary" />
            Tools Catalog
          </h3>
          <p className="text-xs text-muted-foreground">
            Global catalog of reusable tools ({tools.length} total). Shared across all jobs.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Tool
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tools…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 sm:w-40">
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {TOOL_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {TOOL_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No tools in catalog"
          description="Add power tools, hand tools, measuring instruments, and safety equipment to the catalog."
          action={canEdit ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add First Tool
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="max-h-[60vh] overflow-y-auto scrollbar-warm rounded-lg border border-border">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead className="h-9 text-xs">Name</TableHead>
                <TableHead className="h-9 text-xs">Code</TableHead>
                <TableHead className="h-9 text-xs">Category</TableHead>
                <TableHead className="h-9 text-xs">Status</TableHead>
                {canEdit && <TableHead className="h-9 text-right text-xs">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs font-medium">
                    {t.name}
                    {t.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{t.description}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{t.code ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {TOOL_CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category}
                    </Badge>
                  </TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(t)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Delete tool "${t.name}"?`)) removeMutation.mutate(t.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {(createOpen || editing) && (
        <ToolDialog
          tool={editing}
          open={createOpen || !!editing}
          onOpenChange={(o) => {
            if (!o) {
              setCreateOpen(false);
              setEditing(null);
            }
          }}
        />
      )}
    </div>
  );
}

function ToolDialog({
  tool,
  open,
  onOpenChange,
}: {
  tool: JobTool | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [category, setCategory] = React.useState("hand_tool");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState("available");

  React.useEffect(() => {
    if (tool) {
      setName(tool.name);
      setCode(tool.code ?? "");
      setCategory(tool.category);
      setDescription(tool.description ?? "");
      setStatus(tool.status);
    } else {
      setName("");
      setCode("");
      setCategory("hand_tool");
      setDescription("");
      setStatus("available");
    }
  }, [tool, open]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        category,
        description: description || undefined,
        status,
      };
      if (tool) return jobToolsApi.update(tool.id, payload);
      return jobToolsApi.create(payload);
    },
    onSuccess: () => {
      toast.success(tool ? "Tool updated" : "Tool added");
      queryClient.invalidateQueries({ queryKey: ["job-tools"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>{tool ? "Edit Tool" : "Add Tool"}</DialogTitle>
              <DialogDescription>Add a reusable tool to the catalog.</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              toast.error("Name is required");
              return;
            }
            save.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input className="h-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cordless Drill" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Code</Label>
              <Input className="h-9" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. PWR-001" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TOOL_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TOOL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {tool ? "Save Changes" : "Add Tool"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 *  Tab 6: Tool Issues
 * ========================================================== */
const ISSUE_CONDITIONS = ["good", "fair", "damaged"];

function ToolIssuesTab({ jobId, canEdit }: { jobId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [viewIssue, setViewIssue] = React.useState<JobToolIssue | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["job-tool-issues", jobId],
    queryFn: () => jobToolIssuesApi.list({ jobId }),
  });
  const issues = data?.issues ?? [];

  const removeMutation = useMutation({
    mutationFn: (id: string) => jobToolIssuesApi.remove(id),
    onSuccess: () => {
      toast.success("Tool issue deleted");
      queryClient.invalidateQueries({ queryKey: ["job-tool-issues", jobId] });
      queryClient.invalidateQueries({ queryKey: ["job-tool-returns", jobId] });
      queryClient.invalidateQueries({ queryKey: ["job-tools"] });
      queryClient.invalidateQueries({ queryKey: ["job-insights", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            Tool Issues
          </h3>
          <p className="text-xs text-muted-foreground">{issues.length} issues for this job</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Issue Tools
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : issues.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No tool issues yet"
          description="Issue tools from the catalog to workers for this job."
          action={canEdit ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Issue Tools
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {issues.map((iss) => (
            <Card key={iss.id} className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-border p-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-primary/10 p-1.5">
                    <Hash className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{iss.issueNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(iss.date)} · To: {iss.issuedTo ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <StatusBadge status={iss.status} />
                  <Badge variant="outline" className="text-[10px]">{iss.lines.length} item(s)</Badge>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`Delete issue ${iss.issueNo}? Tool statuses will be reverted.`)) removeMutation.mutate(iss.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 text-xs">Tool</TableHead>
                      <TableHead className="h-8 text-center text-xs">Qty</TableHead>
                      <TableHead className="h-8 text-xs">Condition</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {iss.lines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">
                          <span className="font-medium">{l.tool?.name ?? "—"}</span>
                          {l.tool?.code && (
                            <span className="ml-1 text-[11px] text-muted-foreground">({l.tool.code})</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs tabular-nums">{l.quantity}</TableCell>
                        <TableCell><StatusBadge status={l.condition} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {iss.notes && (
                <div className="border-t border-border bg-muted/30 p-2 text-xs text-muted-foreground">
                  {iss.notes}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {viewIssue && (
        <Dialog open={!!viewIssue} onOpenChange={(o) => !o && setViewIssue(null)}>
          <DialogContent showCloseButton={false} className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Issue {viewIssue.issueNo}</DialogTitle>
              <DialogDescription>{fmtDate(viewIssue.date)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <p><strong>Issued To:</strong> {viewIssue.issuedTo ?? "—"}</p>
              <p><strong>Status:</strong> <StatusBadge status={viewIssue.status} /></p>
              <Separator />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tool</TableHead>
                    <TableHead className="text-center text-xs">Qty</TableHead>
                    <TableHead className="text-xs">Condition</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewIssue.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{l.tool?.name ?? "—"}</TableCell>
                      <TableCell className="text-center text-xs">{l.quantity}</TableCell>
                      <TableCell><StatusBadge status={l.condition} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {createOpen && (
        <ToolIssueDialog
          jobId={jobId}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}
    </div>
  );
}

function ToolIssueDialog({
  jobId,
  open,
  onOpenChange,
}: {
  jobId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [issuedTo, setIssuedTo] = React.useState("");
  const [date, setDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<Array<{ toolId: string; quantity: number; condition: string }>>([]);

  const { data: toolsData } = useQuery({ queryKey: ["job-tools"], queryFn: () => jobToolsApi.list() });
  const tools = toolsData?.tools ?? [];

  const save = useMutation({
    mutationFn: () => {
      if (lines.length === 0) throw new Error("Add at least one tool");
      return jobToolIssuesApi.create({
        jobId,
        issuedTo: issuedTo || undefined,
        date: date || undefined,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          toolId: l.toolId,
          quantity: Number(l.quantity) || 1,
          condition: l.condition,
        })),
      });
    },
    onSuccess: () => {
      toast.success("Tools issued");
      queryClient.invalidateQueries({ queryKey: ["job-tool-issues", jobId] });
      queryClient.invalidateQueries({ queryKey: ["job-tools"] });
      queryClient.invalidateQueries({ queryKey: ["job-insights", jobId] });
      onOpenChange(false);
      setIssuedTo("");
      setDate("");
      setNotes("");
      setLines([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addLine() {
    const firstTool = tools[0];
    if (!firstTool) {
      toast.error("No tools in catalog. Add tools first.");
      return;
    }
    setLines((prev) => [...prev, { toolId: firstTool.id, quantity: 1, condition: "good" }]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[560px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>Issue Tools</DialogTitle>
              <DialogDescription>Select tools from catalog to issue to a worker.</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Issued To</Label>
              <Input className="h-9" value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} placeholder="Worker name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" className="h-9" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Tools</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLine}>
                <Plus className="mr-1 h-3 w-3" /> Add Tool
              </Button>
            </div>
            {lines.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No tools added yet</p>
            ) : (
              <div className="space-y-2">
                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <Select value={line.toolId} onValueChange={(v) => setLines((prev) => prev.map((l, i) => i === idx ? { ...l, toolId: v } : l))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {tools.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}{t.code ? ` (${t.code})` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="1"
                        className="h-8 text-xs"
                        value={line.quantity}
                        onChange={(e) => setLines((prev) => prev.map((l, i) => i === idx ? { ...l, quantity: parseInt(e.target.value, 10) || 1 } : l))}
                      />
                    </div>
                    <div className="col-span-3">
                      <Select value={line.condition} onValueChange={(v) => setLines((prev) => prev.map((l, i) => i === idx ? { ...l, condition: v } : l))}>
                        <SelectTrigger className="h-8 text-xs capitalize"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ISSUE_CONDITIONS.map((c) => (
                            <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Issue Tools
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 *  Tab 7: Tool Returns
 * ========================================================== */
const RETURN_CONDITIONS = ["good", "fair", "damaged", "lost"];

function ToolReturnsTab({ jobId, canEdit }: { jobId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["job-tool-returns", jobId],
    queryFn: () => jobToolReturnsApi.list({ jobId }),
  });
  const returns = data?.returns ?? [];

  const removeMutation = useMutation({
    mutationFn: (id: string) => jobToolReturnsApi.remove(id),
    onSuccess: () => {
      toast.success("Tool return deleted");
      queryClient.invalidateQueries({ queryKey: ["job-tool-returns", jobId] });
      queryClient.invalidateQueries({ queryKey: ["job-insights", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <RotateCcw className="h-4 w-4 text-primary" />
            Tool Returns
          </h3>
          <p className="text-xs text-muted-foreground">{returns.length} returns for this job</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Return Tools
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : returns.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title="No tool returns yet"
          description="Record returns of issued tools. Tool conditions will update automatically."
          action={canEdit ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Return Tools
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {returns.map((ret) => (
            <Card key={ret.id} className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-border p-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-primary/10 p-1.5">
                    <RotateCcw className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{ret.returnNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(ret.date)} · From: {ret.returnedFrom ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <StatusBadge status={ret.status} />
                  <Badge variant="outline" className="text-[10px]">{ret.lines.length} item(s)</Badge>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`Delete return ${ret.returnNo}?`)) removeMutation.mutate(ret.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 text-xs">Tool</TableHead>
                      <TableHead className="h-8 text-center text-xs">Qty</TableHead>
                      <TableHead className="h-8 text-xs">Condition</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ret.lines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">
                          <span className="font-medium">{l.tool?.name ?? "—"}</span>
                          {l.tool?.code && (
                            <span className="ml-1 text-[11px] text-muted-foreground">({l.tool.code})</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs tabular-nums">{l.quantity}</TableCell>
                        <TableCell><StatusBadge status={l.condition} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {ret.notes && (
                <div className="border-t border-border bg-muted/30 p-2 text-xs text-muted-foreground">
                  {ret.notes}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {createOpen && (
        <ToolReturnDialog
          jobId={jobId}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}
    </div>
  );
}

function ToolReturnDialog({
  jobId,
  open,
  onOpenChange,
}: {
  jobId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [issueId, setIssueId] = React.useState("");
  const [returnedFrom, setReturnedFrom] = React.useState("");
  const [date, setDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<Array<{ toolId: string; quantity: number; condition: string }>>([]);

  const { data: toolsData } = useQuery({ queryKey: ["job-tools"], queryFn: () => jobToolsApi.list() });
  const tools = toolsData?.tools ?? [];
  const { data: issuesData } = useQuery({
    queryKey: ["job-tool-issues", jobId],
    queryFn: () => jobToolIssuesApi.list({ jobId }),
  });
  const issues = (issuesData?.issues ?? []).filter((i) => i.status === "issued" || i.status === "partial");

  // When an issue is selected, auto-fill lines
  React.useEffect(() => {
    if (!issueId) {
      setLines([]);
      return;
    }
    const selected = issues.find((i) => i.id === issueId);
    if (selected) {
      setLines(selected.lines.map((l) => ({
        toolId: l.toolId,
        quantity: l.quantity,
        condition: "good",
      })));
    }
  }, [issueId, issues]);

  const save = useMutation({
    mutationFn: () => {
      if (lines.length === 0) throw new Error("Add at least one tool");
      return jobToolReturnsApi.create({
        jobId,
        issueId: issueId || null,
        returnedFrom: returnedFrom || undefined,
        date: date || undefined,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          toolId: l.toolId,
          quantity: Number(l.quantity) || 1,
          condition: l.condition,
        })),
      });
    },
    onSuccess: () => {
      toast.success("Tools returned");
      queryClient.invalidateQueries({ queryKey: ["job-tool-returns", jobId] });
      queryClient.invalidateQueries({ queryKey: ["job-tool-issues", jobId] });
      queryClient.invalidateQueries({ queryKey: ["job-tools"] });
      queryClient.invalidateQueries({ queryKey: ["job-insights", jobId] });
      onOpenChange(false);
      setIssueId("");
      setReturnedFrom("");
      setDate("");
      setNotes("");
      setLines([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addLine() {
    const firstTool = tools[0];
    if (!firstTool) {
      toast.error("No tools in catalog");
      return;
    }
    setLines((prev) => [...prev, { toolId: firstTool.id, quantity: 1, condition: "good" }]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[560px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>Return Tools</DialogTitle>
              <DialogDescription>Optionally link to an original issue to auto-fill lines.</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Link to Issue (optional)</Label>
              <Select value={issueId || "__none"} onValueChange={(v) => setIssueId(v === "__none" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— No link —</SelectItem>
                  {issues.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.issueNo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Returned From</Label>
              <Input className="h-9" value={returnedFrom} onChange={(e) => setReturnedFrom(e.target.value)} placeholder="Worker name" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" className="h-9" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Tools</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLine}>
                <Plus className="mr-1 h-3 w-3" /> Add Tool
              </Button>
            </div>
            {lines.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No tools added yet</p>
            ) : (
              <div className="space-y-2">
                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <Select value={line.toolId} onValueChange={(v) => setLines((prev) => prev.map((l, i) => i === idx ? { ...l, toolId: v } : l))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {tools.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}{t.code ? ` (${t.code})` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="1"
                        className="h-8 text-xs"
                        value={line.quantity}
                        onChange={(e) => setLines((prev) => prev.map((l, i) => i === idx ? { ...l, quantity: parseInt(e.target.value, 10) || 1 } : l))}
                      />
                    </div>
                    <div className="col-span-3">
                      <Select value={line.condition} onValueChange={(v) => setLines((prev) => prev.map((l, i) => i === idx ? { ...l, condition: v } : l))}>
                        <SelectTrigger className="h-8 text-xs capitalize"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RETURN_CONDITIONS.map((c) => (
                            <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Return Tools
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 *  Tab 8: Expenses — job-wise expense records & reports
 * ========================================================== */
function ExpensesTab({ jobId, canEdit }: { jobId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<JobExpense | null>(null);
  const [filterCat, setFilterCat] = React.useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["job-expenses", jobId],
    queryFn: () => jobExpensesApi.list(jobId),
  });

  const createMut = useMutation({
    mutationFn: (payload: Partial<JobExpense> & { jobId: string; amount: number }) =>
      jobExpensesApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-expenses", jobId] });
      qc.invalidateQueries({ queryKey: ["job-insights", jobId] });
      toast.success("Expense added");
      setDialogOpen(false);
    },
    onError: () => toast.error("Failed to add expense"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<JobExpense> }) =>
      jobExpensesApi.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-expenses", jobId] });
      qc.invalidateQueries({ queryKey: ["job-insights", jobId] });
      toast.success("Expense updated");
      setDialogOpen(false);
    },
    onError: () => toast.error("Failed to update expense"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => jobExpensesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-expenses", jobId] });
      qc.invalidateQueries({ queryKey: ["job-insights", jobId] });
      toast.success("Expense deleted");
    },
    onError: () => toast.error("Failed to delete expense"),
  });

  const expenses = data?.expenses ?? [];
  const summary = data?.summary;

  const filtered = filterCat === "all" ? expenses : expenses.filter((e) => e.category === filterCat);

  const catLabel = (cat: string) =>
    EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat.charAt(0).toUpperCase() + cat.slice(1);

  function exportCSV() {
    const rows = [
      ["Date", "Category", "Amount", "Currency", "Description", "Receipt No", "Paid By", "Notes"],
      ...filtered.map((e) => [
        new Date(e.date).toLocaleDateString(),
        catLabel(e.category),
        String(e.amount),
        e.currency,
        e.description ?? "",
        e.receiptNo ?? "",
        e.paidBy ?? "",
        e.notes ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${jobId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = filtered
      .map(
        (e) => `<tr>
          <td>${new Date(e.date).toLocaleDateString()}</td>
          <td>${catLabel(e.category)}</td>
          <td style="text-align:right">${e.amount.toLocaleString()} ${e.currency}</td>
          <td>${e.description ?? ""}</td>
          <td>${e.receiptNo ?? ""}</td>
          <td>${e.paidBy ?? ""}</td>
        </tr>`,
      )
      .join("");
    const catRows = summary
      ? Object.entries(summary.byCategory)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, amt]) => `<tr><td>${catLabel(cat)}</td><td style="text-align:right">${amt.toLocaleString()}</td></tr>`)
          .join("")
      : "";
    w.document.write(`<html><head><title>Expense Report</title>
      <style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:13px}th{background:#f5f5f5}h1{font-size:20px}h2{font-size:16px;margin-top:24px}.total{font-weight:bold;font-size:18px}</style>
      </head><body>
      <h1>Job Expense Report</h1>
      <p>Date: ${new Date().toLocaleDateString()}</p>
      <p class="total">Total Expenses: ${(summary?.total ?? 0).toLocaleString()} LKR</p>
      <h2>By Category</h2>
      <table><tr><th>Category</th><th style="text-align:right">Amount</th></tr>${catRows}</table>
      <h2>Detailed Records (${filtered.length})</h2>
      <table><tr><th>Date</th><th>Category</th><th>Amount</th><th>Description</th><th>Receipt</th><th>Paid By</th></tr>${rows}</table>
      </body></html>`);
    w.document.close();
    w.print();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Wallet className="h-5 w-5 text-primary" />
            Expenses & Records
          </h3>
          <p className="text-sm text-muted-foreground">
            {summary?.count ?? 0} entries · Total:{" "}
            <span className="font-bold text-foreground">
              {(summary?.total ?? 0).toLocaleString()} LKR
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={printReport} disabled={filtered.length === 0}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print
          </Button>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Expense
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards by category */}
      {summary && summary.count > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(summary.byCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([cat, amt]) => (
              <Card key={cat} className="p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{catLabel(cat)}</p>
                <p className="text-sm font-bold">{amt.toLocaleString()} LKR</p>
              </Card>
            ))}
        </div>
      )}

      {/* Category filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="rounded-full bg-muted p-4">
            <Wallet className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">No expenses recorded</p>
            <p className="text-sm text-muted-foreground">
              Track on-site expenses like food &amp; beverage, transport fuel, tools, and more.
            </p>
          </div>
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add First Expense
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-32">Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-28">Receipt</TableHead>
                <TableHead className="w-28">Paid By</TableHead>
                {canEdit && <TableHead className="w-20 text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{new Date(e.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {catLabel(e.category)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {e.amount.toLocaleString()} {e.currency}
                  </TableCell>
                  <TableCell className="text-xs">{e.description ?? "—"}</TableCell>
                  <TableCell className="text-xs">{e.receiptNo ?? "—"}</TableCell>
                  <TableCell className="text-xs">{e.paidBy ?? "—"}</TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditing(e);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => deleteMut.mutate(e.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        jobId={jobId}
        expense={editing}
        onSubmit={(payload) => {
          if (editing) {
            updateMut.mutate({ id: editing.id, patch: payload });
          } else {
            createMut.mutate(payload);
          }
        }}
        loading={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}

function ExpenseDialog({
  open,
  onOpenChange,
  jobId,
  expense,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jobId: string;
  expense: JobExpense | null;
  onSubmit: (payload: Partial<JobExpense> & { jobId: string; amount: number }) => void;
  loading: boolean;
}) {
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = React.useState("fnb");
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState("LKR");
  const [description, setDescription] = React.useState("");
  const [receiptNo, setReceiptNo] = React.useState("");
  const [paidBy, setPaidBy] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (open) {
      if (expense) {
        setDate(new Date(expense.date).toISOString().slice(0, 10));
        setCategory(expense.category);
        setAmount(String(expense.amount));
        setCurrency(expense.currency);
        setDescription(expense.description ?? "");
        setReceiptNo(expense.receiptNo ?? "");
        setPaidBy(expense.paidBy ?? "");
        setNotes(expense.notes ?? "");
      } else {
        setDate(new Date().toISOString().slice(0, 10));
        setCategory("fnb");
        setAmount("");
        setCurrency("LKR");
        setDescription("");
        setReceiptNo("");
        setPaidBy("");
        setNotes("");
      }
    }
  }, [open, expense]);

  function handleSubmit() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    onSubmit({
      jobId,
      date: new Date(date),
      category,
      amount: amt,
      currency,
      description: description.trim() || undefined,
      receiptNo: receiptNo.trim() || undefined,
      paidBy: paidBy.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            {expense ? "Edit Expense" : "Add Expense"}
          </DialogTitle>
          <DialogDescription>Record a job-related expense (F&amp;B, transport, fuel, tools, etc.)</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Date *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Amount *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 text-sm"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LKR">LKR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="INR">INR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Description</Label>
            <Input
              placeholder="e.g. Lunch for 4 workers"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Receipt No</Label>
            <Input
              placeholder="e.g. RCP-001"
              value={receiptNo}
              onChange={(e) => setReceiptNo(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Paid By</Label>
            <Input
              placeholder="e.g. Kasun"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea
              placeholder="Additional notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-sm"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {expense ? "Update" : "Add"} Expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 *  Tab 9: Stock Movements (read-only)
 * ========================================================== */
function StockMovementsTab({ jobId }: { jobId: string }) {
  const { data: issuesData, isLoading: li1 } = useQuery({
    queryKey: ["goods-issues", "job", jobId],
    queryFn: () => goodsIssuesApi.list({ jobId }),
  });
  const { data: returnsData, isLoading: li2 } = useQuery({
    queryKey: ["goods-returns", "job", jobId],
    queryFn: () => goodsReturnsApi.list({ jobId }),
  });
  const { data: purchasesData, isLoading: li3 } = useQuery({
    queryKey: ["outside-purchases", "job", jobId],
    queryFn: () => outsidePurchasesApi.list({ jobId }),
  });
  const { data: requestsData, isLoading: li4 } = useQuery({
    queryKey: ["stock-requests", "job", jobId],
    queryFn: () => stockRequestsApi.list({ jobId }),
  });

  const issues = issuesData?.issues ?? [];
  const returns = returnsData?.returns ?? [];
  const purchases = purchasesData?.purchases ?? [];
  const requests = requestsData?.requests ?? [];

  const isLoading = li1 || li2 || li3 || li4;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Package className="h-4 w-4 text-primary" />
          Stock Movements
        </h3>
        <p className="text-xs text-muted-foreground">
          Read-only summary of inventory transactions linked to this job.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Stock Requests" value={requests.length} icon={ClipboardList} tint="bg-amber-500/10 text-amber-600" />
          <MiniStat label="Goods Issues" value={issues.length} icon={ArrowLeftRight} tint="bg-violet-500/10 text-violet-600" />
          <MiniStat label="Goods Returns" value={returns.length} icon={RotateCcw} tint="bg-emerald-500/10 text-emerald-600" />
          <MiniStat label="Outside Purchases" value={purchases.length} icon={Package} tint="bg-cyan-500/10 text-cyan-600" />
        </div>
      )}

      {/* Material Status — required vs available vs shortage */}
      <MaterialStatusCard jobId={jobId} />

      {/* Goods Issues */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <ArrowLeftRight className="h-3.5 w-3.5" /> Goods Issues
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {issues.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-muted-foreground">No goods issued to this job.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">Issue No</TableHead>
                    <TableHead className="h-8 text-xs">Warehouse</TableHead>
                    <TableHead className="h-8 text-right text-xs">Items</TableHead>
                    <TableHead className="h-8 text-xs">Status</TableHead>
                    <TableHead className="h-8 text-xs">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="text-xs font-mono">{i.issueNo}</TableCell>
                      <TableCell className="text-xs">{i.warehouse?.code ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{i.lines.length}</TableCell>
                      <TableCell><StatusBadge status={i.status} /></TableCell>
                      <TableCell className="text-xs">{fmtDate(i.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Goods Returns */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <RotateCcw className="h-3.5 w-3.5" /> Goods Returns
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {returns.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-muted-foreground">No goods returned from this job.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">Return No</TableHead>
                    <TableHead className="h-8 text-xs">Warehouse</TableHead>
                    <TableHead className="h-8 text-right text-xs">Items</TableHead>
                    <TableHead className="h-8 text-xs">Status</TableHead>
                    <TableHead className="h-8 text-xs">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-mono">{r.returnNo}</TableCell>
                      <TableCell className="text-xs">{r.warehouse?.code ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{r.lines.length}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-xs">{fmtDate(r.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outside Purchases */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <Package className="h-3.5 w-3.5" /> Outside Purchases
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {purchases.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-muted-foreground">No outside purchases for this job.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">PO No</TableHead>
                    <TableHead className="h-8 text-xs">Supplier</TableHead>
                    <TableHead className="h-8 text-right text-xs">Items</TableHead>
                    <TableHead className="h-8 text-xs">Status</TableHead>
                    <TableHead className="h-8 text-xs">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-mono">{p.poNo}</TableCell>
                      <TableCell className="text-xs">{p.supplier ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{p.lines.length}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell className="text-xs">{fmtDate(p.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Requests */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <ClipboardList className="h-3.5 w-3.5" /> Stock Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-muted-foreground">No stock requests for this job.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">Req No</TableHead>
                    <TableHead className="h-8 text-xs">Warehouse</TableHead>
                    <TableHead className="h-8 text-right text-xs">Items</TableHead>
                    <TableHead className="h-8 text-xs">Status</TableHead>
                    <TableHead className="h-8 text-xs">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-mono">{r.reqNo}</TableCell>
                      <TableCell className="text-xs">{r.warehouse?.code ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{r.lines.length}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-xs">{fmtDate(r.createdAt)}</TableCell>
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

/* ============================================================
 *  Tab 8b: Attendance (job-linked worker attendance)
 * ========================================================== */
function JobAttendanceTab({ jobId }: { jobId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["attendance", "job", jobId],
    queryFn: () => attendanceApi.list({ jobId }),
  });
  const records = data?.records ?? [];

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="rounded-full bg-muted p-4">
          <CalendarCheck className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">No attendance records for this job</p>
          <p className="text-sm text-muted-foreground">
            Attendance records linked to this job will appear here. Mark attendance from the Attendance module.
          </p>
        </div>
      </div>
    );
  }

  // Summary
  const totalHours = records.reduce((s, r) => s + (r.hoursWorked || 0), 0);
  const presentCount = records.filter((r) => r.status === "present").length;
  const byWorker = new Map<string, { hours: number; days: number }>();
  for (const r of records) {
    const name = r.worker?.name ?? "Unknown";
    const existing = byWorker.get(name) ?? { hours: 0, days: 0 };
    existing.hours += r.hoursWorked || 0;
    existing.days += 1;
    byWorker.set(name, existing);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarCheck className="h-5 w-5 text-primary" />
          Job Attendance
        </h3>
        <p className="text-sm text-muted-foreground">
          {records.length} records · {byWorker.size} workers · {totalHours}h total
        </p>
      </div>

      {/* Summary by worker */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3"><p className="text-[10px] uppercase text-muted-foreground">Records</p><p className="text-xl font-bold">{records.length}</p></Card>
        <Card className="p-3"><p className="text-[10px] uppercase text-muted-foreground">Total Hours</p><p className="text-xl font-bold">{totalHours}h</p></Card>
        <Card className="p-3"><p className="text-[10px] uppercase text-muted-foreground">Present Days</p><p className="text-xl font-bold">{presentCount}</p></Card>
        <Card className="p-3"><p className="text-[10px] uppercase text-muted-foreground">Workers</p><p className="text-xl font-bold">{byWorker.size}</p></Card>
      </div>

      {/* Worker summary */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Worker</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead className="text-right">Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from(byWorker.entries()).map(([name, v]) => (
              <TableRow key={name}>
                <TableCell className="font-medium">{name}</TableCell>
                <TableCell className="text-right tabular-nums">{v.days}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{v.hours}h</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detailed records */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Worker</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">In</TableHead>
              <TableHead className="text-right">Out</TableHead>
              <TableHead className="text-right">Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.slice(0, 50).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{new Date(r.date).toLocaleDateString()}</TableCell>
                <TableCell className="font-medium text-sm">{r.worker?.name ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px] capitalize">{r.status.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell className="text-right text-xs font-mono">{r.clockIn ?? "—"}</TableCell>
                <TableCell className="text-right text-xs font-mono">{r.clockOut ?? "—"}</TableCell>
                <TableCell className="text-right font-mono font-semibold">{r.hoursWorked}h</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ============================================================
 *  Tab 9: Insights
 * ========================================================== */
function InsightsTab({ jobId }: { jobId: string }) {
  const { data: insights, isLoading } = useQuery({
    queryKey: ["job-insights", jobId],
    queryFn: () => jobInsightsApi.get(jobId),
  });

  if (isLoading || !insights) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading insights…
      </div>
    );
  }

  const insightsData = insights;

  function exportCsv() {
    const rows: string[][] = [];
    rows.push(["Section", "Metric", "Value"]);
    rows.push(["Time", "Total Hours", String(insightsData.timeLogs.totalHours)]);
    insightsData.timeLogs.hoursByWorker.forEach((w) => rows.push(["Time", `Worker: ${w.workerName}`, String(w.hours)]));
    insightsData.timeLogs.hoursByWorkType.forEach((t) => rows.push(["Time", `Type: ${t.workType}`, String(t.hours)]));
    rows.push(["Transport", "Total Trips", String(insightsData.transports.total)]);
    rows.push(["Transport", "Total Distance (km)", String(insightsData.transports.totalDistance)]);
    rows.push(["Food & Beverage", "Total Meals", String(insightsData.foodBeverage.totalMeals)]);
    insightsData.foodBeverage.mealsByType.forEach((m) => rows.push(["Food & Beverage", `Type: ${m.mealType}`, String(m.count)]));
    rows.push(["Tools", "Issues Count", String(insightsData.tools.issuesCount)]);
    rows.push(["Tools", "Returns Count", String(insightsData.tools.returnsCount)]);
    rows.push(["Tools", "Issued Qty", String(insightsData.tools.totalIssuedQty)]);
    rows.push(["Tools", "Returned Qty", String(insightsData.tools.totalReturnedQty)]);
    rows.push(["Tools", "Lost Qty", String(insightsData.tools.totalLostQty)]);
    rows.push(["Tools", "Damaged Qty", String(insightsData.tools.totalDamagedQty)]);
    rows.push(["Stock", "Issues Count", String(insightsData.stock.issuesCount)]);
    rows.push(["Stock", "Returns Count", String(insightsData.stock.returnsCount)]);
    rows.push(["Stock", "Outside Purchases", String(insightsData.stock.outsidePurchasesCount)]);
    rows.push(["Stock", "Issued Qty", String(insightsData.stock.totalIssuedQty)]);
    rows.push(["Stock", "Returned Qty", String(insightsData.stock.totalReturnedQty)]);
    rows.push(["Stock", "Purchased Qty", String(insightsData.stock.totalPurchasedQty)]);

    if (insightsData.expenses) {
      rows.push(["Expenses", "Total", String(insightsData.expenses.total)]);
      rows.push(["Expenses", "Count", String(insightsData.expenses.count)]);
      for (const c of insightsData.expenses.byCategory) {
        rows.push(["Expenses", `Category: ${c.category}`, String(c.total)]);
      }
    }

    if (insightsData.attendance) {
      rows.push(["Attendance", "Total Records", String(insightsData.attendance.total)]);
      rows.push(["Attendance", "Total Hours", String(insightsData.attendance.totalHours)]);
      for (const w of insightsData.attendance.byWorker) {
        rows.push(["Attendance", `Worker: ${w.workerName}`, `${w.hours}h (${w.days} days)`]);
      }
    }

    if (insightsData.costSummary) {
      rows.push(["Cost Summary", "Labor Cost (LKR)", String(insightsData.costSummary.labor ?? 0)]);
      rows.push(["Cost Summary", "Transport Cost (LKR)", String(insightsData.costSummary.transport ?? 0)]);
      rows.push(["Cost Summary", "F&B Cost (LKR)", String(insightsData.costSummary.foodBeverage ?? 0)]);
      rows.push(["Cost Summary", "Other Expenses (LKR)", String(insightsData.costSummary.expenses ?? 0)]);
      rows.push(["Cost Summary", "Grand Total (LKR)", String(insightsData.costSummary.grandTotal ?? 0)]);
    }

    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `insights-${insightsData.job.orderNumber}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Insights exported as CSV");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <BarChart3 className="h-4 w-4 text-primary" />
            Insights & Reporting
          </h3>
          <p className="text-xs text-muted-foreground">
            Aggregated operational metrics for {insights.job.orderNumber}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs">Overall Job Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">{insights.job.status}</span>
            <span className="font-bold tabular-nums">{insights.progress.percent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${insights.job.status === "Cancelled" ? "bg-rose-500" : "bg-primary"}`}
              style={{ width: `${insights.job.status === "Cancelled" ? 100 : insights.progress.percent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Time Tracking */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> Hours by Worker
            </CardTitle>
            <CardDescription>{insights.timeLogs.totalHours}h total across {insights.timeLogs.hoursByWorker.length} worker(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {insights.timeLogs.hoursByWorker.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data</p>
            ) : (
              insights.timeLogs.hoursByWorker.map((w) => {
                const max = insights.timeLogs.hoursByWorker[0]?.hours ?? 1;
                const pct = max > 0 ? (w.hours / max) * 100 : 0;
                return (
                  <div key={w.workerName} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="truncate">{w.workerName}</span>
                      <span className="font-medium tabular-nums">{Math.round(w.hours * 100) / 100}h</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" /> Hours by Work Type
            </CardTitle>
            <CardDescription>Breakdown by activity</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.timeLogs.hoursByWorkType.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data</p>
            ) : (
              <div className="flex h-4 w-full overflow-hidden rounded-full">
                {insights.timeLogs.hoursByWorkType.map((t, i) => {
                  const total = insights.timeLogs.hoursByWorkType.reduce((s, x) => s + x.hours, 0) || 1;
                  const pct = (t.hours / total) * 100;
                  const colors = ["bg-primary", "bg-orange-500", "bg-teal-500", "bg-violet-500", "bg-amber-500"];
                  return (
                    <div
                      key={t.workType}
                      className={colors[i % colors.length]}
                      style={{ width: `${pct}%` }}
                      title={`${t.workType}: ${Math.round(t.hours * 100) / 100}h`}
                    />
                  );
                })}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {insights.timeLogs.hoursByWorkType.map((t, i) => {
                const colors = ["bg-primary", "bg-orange-500", "bg-teal-500", "bg-violet-500", "bg-amber-500"];
                return (
                  <span key={t.workType} className="flex items-center gap-1 text-[11px]">
                    <span className={`inline-block h-2 w-2 rounded-full ${colors[i % colors.length]}`} />
                    <span className="capitalize">{t.workType}</span>
                    <span className="font-medium tabular-nums">{Math.round(t.hours * 100) / 100}h</span>
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transport + F&B Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Total Trips" value={insights.transports.total} icon={Truck} tint="bg-orange-500/10 text-orange-600" />
        <MiniStat label="Total Distance" value={`${insights.transports.totalDistance} km`} icon={RouteIcon} tint="bg-amber-500/10 text-amber-600" />
        <MiniStat label="Total Meals" value={insights.foodBeverage.totalMeals} icon={Utensils} tint="bg-teal-500/10 text-teal-600" />
        <MiniStat label="F&B Records" value={insights.foodBeverage.total} icon={ClipboardList} tint="bg-cyan-500/10 text-cyan-600" />
      </div>

      {/* Tool Utilization */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <Wrench className="h-3.5 w-3.5" /> Tool Utilization
          </CardTitle>
          <CardDescription>
            Issued: {insights.tools.totalIssuedQty} · Returned: {insights.tools.totalReturnedQty} · Lost: {insights.tools.totalLostQty} · Damaged: {insights.tools.totalDamagedQty}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {insights.tools.utilization.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-muted-foreground">No tool activity</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">Tool</TableHead>
                    <TableHead className="h-8 text-right text-xs">Issued</TableHead>
                    <TableHead className="h-8 text-right text-xs">Returned</TableHead>
                    <TableHead className="h-8 text-right text-xs">Lost</TableHead>
                    <TableHead className="h-8 text-right text-xs">Damaged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insights.tools.utilization.map((u) => (
                    <TableRow key={u.toolId}>
                      <TableCell className="text-xs">
                        <span className="font-medium">{u.toolName}</span>
                        {u.toolCode && <span className="ml-1 text-[11px] text-muted-foreground">({u.toolCode})</span>}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{u.issued}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-emerald-600">{u.returned}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-rose-600">{u.lost}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-amber-600">{u.damaged}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <Package className="h-3.5 w-3.5" /> Stock Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold tabular-nums">{insights.stock.issuesCount}</p>
              <p className="text-[11px] text-muted-foreground">Goods Issues</p>
              <p className="text-xs tabular-nums">{insights.stock.totalIssuedQty} units</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-emerald-600">{insights.stock.returnsCount}</p>
              <p className="text-[11px] text-muted-foreground">Goods Returns</p>
              <p className="text-xs tabular-nums">{insights.stock.totalReturnedQty} units</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-cyan-600">{insights.stock.outsidePurchasesCount}</p>
              <p className="text-[11px] text-muted-foreground">Outside Purchases</p>
              <p className="text-xs tabular-nums">{insights.stock.totalPurchasedQty} units</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Summary */}
      {(() => {
        const cs = insights.costSummary;
        const labor = num(cs?.labor);
        const transport = num(cs?.transport);
        const foodBeverage = num(cs?.foodBeverage);
        const expenses = num(cs?.expenses);
        const grandTotal = num(cs?.grandTotal);
        const hasAnyCost = labor > 0 || transport > 0 || foodBeverage > 0 || expenses > 0 || grandTotal > 0;
        if (!hasAnyCost) return null;
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-xs">
                <Wallet className="h-3.5 w-3.5" /> Cost Summary
              </CardTitle>
              <CardDescription>Aggregated job costs in LKR</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="mb-1 inline-flex rounded-md bg-primary/10 p-1 text-primary">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-sm font-bold tabular-nums leading-tight">{labor.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">Labor Cost (LKR)</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="mb-1 inline-flex rounded-md bg-orange-500/10 p-1 text-orange-600">
                    <Truck className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-sm font-bold tabular-nums leading-tight">{transport.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">Transport Cost (LKR)</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="mb-1 inline-flex rounded-md bg-teal-500/10 p-1 text-teal-600">
                    <Utensils className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-sm font-bold tabular-nums leading-tight">{foodBeverage.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">F&B Cost (LKR)</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="mb-1 inline-flex rounded-md bg-amber-500/10 p-1 text-amber-600">
                    <Receipt className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-sm font-bold tabular-nums leading-tight">{expenses.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground">Other Expenses (LKR)</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between rounded-lg bg-primary/5 p-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">Grand Total</p>
                    <p className="text-[11px] text-muted-foreground">All costs combined</p>
                  </div>
                </div>
                <p className="text-xl font-bold tabular-nums text-primary">
                  {grandTotal.toLocaleString()} <span className="text-sm font-medium">LKR</span>
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Expense Summary */}
      {insights.expenses && insights.expenses.count > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-xs">
              <Wallet className="h-3.5 w-3.5" /> Expense Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">
                {insights.expenses.total.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">LKR total · {insights.expenses.count} entries</span>
            </div>
            <div className="space-y-1.5">
              {insights.expenses.byCategory.map((c) => {
                const maxAmt = insights.expenses.byCategory[0]?.total ?? 1;
                const pct = maxAmt > 0 ? Math.round((c.total / maxAmt) * 100) : 0;
                const catLabel = EXPENSE_CATEGORIES.find((x) => x.value === c.category)?.label ?? c.category;
                return (
                  <div key={c.category} className="flex items-center gap-2 text-xs">
                    <span className="w-32 shrink-0 truncate text-muted-foreground">{catLabel}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                      <div className="h-full rounded bg-primary/60" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right font-mono tabular-nums">{c.total.toLocaleString()} LKR</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" /> Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {insights.timeline.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-muted-foreground">No activity recorded</p>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y">
              {insights.timeline.slice(0, 15).map((t) => (
                <div key={t.id} className="flex items-start gap-2 px-4 py-2">
                  <div className="rounded-md bg-primary/10 p-1">
                    <AlertCircle className="h-3 w-3 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{t.summary}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.actorName ?? "System"} · {fmtDateTime(t.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
