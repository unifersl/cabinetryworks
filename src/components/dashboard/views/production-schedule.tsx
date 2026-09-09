"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  productionSchedulesApi,
  jobsApi,
  usersApi,
  type ProductionSchedule,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import {
  CalendarClock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  Factory,
  User,
  Pencil,
  Calendar,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui-helpers";

const STAGES = ["Cutting", "Edge Banding", "Assembly", "Painting", "Packing"];
const STATUS_FLOW: Record<string, string> = {
  scheduled: "in_progress",
  in_progress: "completed",
  completed: "completed",
  delayed: "in_progress",
};

const STATUS_TINTS: Record<string, string> = {
  scheduled: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  in_progress: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  delayed: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

const STAGE_TINTS: Record<string, string> = {
  Cutting: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  "Edge Banding": "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  Assembly: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  Painting: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  Packing: "bg-teal-500/15 text-teal-700 border-teal-500/30",
};

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface JobLite {
  id: string;
  orderNumber: string;
  title: string;
}
interface UserLite {
  id: string;
  fullName: string;
  username: string;
}

interface ScheduleFormState {
  jobId: string;
  stage: string;
  workstation: string;
  scheduledDate: string;
  assignedToId: string;
  notes: string;
}

const EMPTY_FORM: ScheduleFormState = {
  jobId: "",
  stage: "Cutting",
  workstation: "",
  scheduledDate: new Date().toISOString().slice(0, 10),
  assignedToId: "",
  notes: "",
};

export function ProductionScheduleView() {
  const qc = useQueryClient();
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [statusFilter, setStatusFilter] = React.useState<"all" | string>("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<ProductionSchedule | null>(
    null
  );
  const [form, setForm] = React.useState<ScheduleFormState>(EMPTY_FORM);

  const { data: jobsData } = useQuery({
    queryKey: ["jobs", "for-schedule"],
    queryFn: () => jobsApi.list(),
  });
  const jobs: JobLite[] = (jobsData as { jobs?: JobLite[] })?.jobs ?? [];

  const { data: usersData } = useQuery({
    queryKey: ["users", "for-schedule"],
    queryFn: () => usersApi.list(),
  });
  const users: UserLite[] =
    (usersData as { users?: UserLite[] })?.users ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["production-schedules", statusFilter],
    queryFn: () =>
      productionSchedulesApi.list({
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });

  const schedules: ProductionSchedule[] = data?.schedules ?? [];

  // Group schedules by month (current month)
  const monthSchedules = React.useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    return schedules
      .filter((s) => {
        const d = new Date(s.scheduledDate);
        return d.getFullYear() === y && d.getMonth() === m;
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledDate).getTime() -
          new Date(b.scheduledDate).getTime()
      );
  }, [schedules, currentMonth]);

  // Group by date
  const grouped = React.useMemo(() => {
    const map: Record<string, ProductionSchedule[]> = {};
    for (const s of monthSchedules) {
      const key = new Date(s.scheduledDate).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      (map[key] ??= []).push(s);
    }
    return map;
  }, [monthSchedules]);

  const createMut = useMutation({
    mutationFn: (payload: ScheduleFormState) =>
      productionSchedulesApi.create({
        jobId: payload.jobId,
        stage: payload.stage,
        workstation: payload.workstation || null,
        scheduledDate: payload.scheduledDate,
        assignedToId: payload.assignedToId || null,
        notes: payload.notes || null,
      }),
    onSuccess: () => {
      toast.success("Schedule entry created");
      qc.invalidateQueries({ queryKey: ["production-schedules"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to create"),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<ProductionSchedule>;
    }) => productionSchedulesApi.update(id, patch),
    onSuccess: () => {
      toast.success("Schedule updated");
      qc.invalidateQueries({ queryKey: ["production-schedules"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => productionSchedulesApi.remove(id),
    onSuccess: () => {
      toast.success("Schedule entry deleted");
      qc.invalidateQueries({ queryKey: ["production-schedules"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  function advanceStatus(s: ProductionSchedule) {
    const next = STATUS_FLOW[s.status] ?? "in_progress";
    updateMut.mutate({ id: s.id, patch: { status: next } });
  }

  function openEdit(s: ProductionSchedule) {
    setEditTarget(s);
    setForm({
      jobId: s.jobId,
      stage: s.stage,
      workstation: s.workstation ?? "",
      scheduledDate: new Date(s.scheduledDate).toISOString().slice(0, 10),
      assignedToId: s.assignedToId ?? "",
      notes: s.notes ?? "",
    });
    setCreateOpen(true);
  }

  function submit() {
    if (!form.jobId) {
      toast.error("Please select a job");
      return;
    }
    if (editTarget) {
      updateMut.mutate(
        { id: editTarget.id, patch: { ...form } },
        {
          onSuccess: () => {
            setCreateOpen(false);
            setEditTarget(null);
            setForm(EMPTY_FORM);
          },
        }
      );
    } else {
      createMut.mutate(form);
    }
  }

  const stats = React.useMemo(() => {
    return {
      total: monthSchedules.length,
      scheduled: monthSchedules.filter((s) => s.status === "scheduled").length,
      inProgress: monthSchedules.filter((s) => s.status === "in_progress").length,
      completed: monthSchedules.filter((s) => s.status === "completed").length,
    };
  }, [monthSchedules]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <CalendarClock className="h-5 w-5 text-primary" />
            Production Schedule
          </h1>
          <p className="text-xs text-muted-foreground">
            Plan and track production stages by workstation and date.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditTarget(null);
            setForm(EMPTY_FORM);
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          New Schedule
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">This month</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-slate-500/10 p-2">
              <Factory className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.scheduled}</p>
              <p className="text-xs text-muted-foreground">Scheduled</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Loader2 className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">In progress</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <Factory className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Month nav + status filter */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              setCurrentMonth(
                (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)
              )
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[150px] text-center text-sm font-semibold">
            {monthLabel(currentMonth)}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              setCurrentMonth(
                (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)
              )
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 ml-1"
            onClick={() => {
              const d = new Date();
              setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
          >
            Today
          </Button>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="delayed">Delayed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Timeline grouped by date */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading schedules…
        </div>
      ) : monthSchedules.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Calendar}
              title="No schedules for this month"
              description="Click “New Schedule” to plan a production stage."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setEditTarget(null);
                    setForm(EMPTY_FORM);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  New Schedule
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3"><div className="overflow-x-auto rounded-lg border border-border">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <Card key={dateLabel}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  {dateLabel}
                </CardTitle>
                <CardDescription className="text-xs">
                  {items.length} stage{items.length === 1 ? "" : "s"} scheduled
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto scrollbar-warm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 text-xs min-w-[140px]">Job</TableHead>
                      <TableHead className="h-8 text-xs min-w-[100px]">Stage</TableHead>
                      <TableHead className="h-8 text-xs min-w-[110px]">Workstation</TableHead>
                      <TableHead className="h-8 text-xs min-w-[120px]">Assigned To</TableHead>
                      <TableHead className="h-8 text-xs min-w-[100px]">Status</TableHead>
                      <TableHead className="h-8 text-xs text-right min-w-[80px]">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((s) => {
                      const job = jobs.find((j) => j.id === s.jobId);
                      const assignee = users.find(
                        (u) => u.id === s.assignedToId
                      );
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="py-2 text-xs">
                            <div className="font-medium">
                              {s.job?.orderNumber ?? job?.orderNumber ?? "—"}
                            </div>
                            <div className="text-muted-foreground truncate max-w-[180px]">
                              {s.job?.title ?? job?.title ?? "—"}
                            </div>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                STAGE_TINTS[s.stage] ?? ""
                              }`}
                            >
                              {s.stage}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 text-xs">
                            {s.workstation ?? "—"}
                          </TableCell>
                          <TableCell className="py-2 text-xs">
                            {assignee ? (
                              <span className="inline-flex items-center gap-1">
                                <User className="h-3 w-3 text-muted-foreground" />
                                {assignee.fullName}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge
                              variant="outline"
                              className={`capitalize text-xs ${
                                STATUS_TINTS[s.status] ?? ""
                              }`}
                            >
                              {s.status.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            <div className="flex justify-end gap-1">
                              {s.status !== "completed" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => advanceStatus(s)}
                                  disabled={updateMut.isPending}
                                >
                                  Advance →
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => openEdit(s)}
                                aria-label="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => deleteMut.mutate(s.id)}
                                aria-label="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) {
            setEditTarget(null);
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Edit Schedule" : "New Schedule"}
            </DialogTitle>
            <DialogDescription>
              {editTarget
                ? "Update stage, workstation or assignment."
                : "Plan a production stage for a job."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Job *</Label>
              <Select
                value={form.jobId}
                onValueChange={(v) => setForm((f) => ({ ...f, jobId: v }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select job…" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No jobs available
                    </SelectItem>
                  ) : (
                    jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.orderNumber} — {j.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Stage *</Label>
                <Select
                  value={form.stage}
                  onValueChange={(v) => setForm((f) => ({ ...f, stage: v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Scheduled Date</Label>
                <Input
                  type="date"
                  className="h-9 text-sm"
                  value={form.scheduledDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, scheduledDate: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Workstation</Label>
              <Input
                placeholder="e.g. CNC-1, Paint Booth A"
                className="h-9 text-sm"
                value={form.workstation}
                onChange={(e) =>
                  setForm((f) => ({ ...f, workstation: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Assigned To</Label>
              <Select
                value={form.assignedToId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, assignedToId: v }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName} (@{u.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                rows={2}
                placeholder="Optional notes…"
                className="text-sm"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCreateOpen(false);
                setEditTarget(null);
                setForm(EMPTY_FORM);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submit}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {(createMut.isPending || updateMut.isPending) && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {editTarget ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
