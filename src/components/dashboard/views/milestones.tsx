"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { milestonesApi, jobsApi, type Milestone } from "@/lib/api";
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
import { toast } from "sonner";
import {
  Flag,
  Plus,
  Loader2,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
} from "lucide-react";

const MILESTONE_NAMES = [
  "Measurement Done",
  "Design Approved",
  "Cutting Started",
  "Assembly Started",
  "Installation Started",
  "Handover",
];

const STATUS_TINTS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  achieved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  delayed: "bg-rose-500/15 text-rose-700 border-rose-500/30",
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

interface JobLite {
  id: string;
  orderNumber: string;
  title: string;
}

interface MFormState {
  jobId: string;
  name: string;
  targetDate: string;
}

const EMPTY_FORM: MFormState = {
  jobId: "",
  name: MILESTONE_NAMES[0],
  targetDate: new Date().toISOString().slice(0, 10),
};

function isOverdue(target: string, status: string): boolean {
  if (status === "achieved") return false;
  try {
    return new Date(target).getTime() < Date.now();
  } catch {
    return false;
  }
}

export function MilestonesView() {
  const qc = useQueryClient();
  const [jobFilter, setJobFilter] = React.useState<"all" | string>("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState<MFormState>(EMPTY_FORM);

  const { data: jobsData } = useQuery({
    queryKey: ["jobs", "for-milestones"],
    queryFn: () => jobsApi.list(),
  });
  const jobs: JobLite[] = (jobsData as { jobs?: JobLite[] })?.jobs ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["milestones", jobFilter],
    queryFn: () =>
      milestonesApi.list({
        jobId: jobFilter === "all" ? undefined : jobFilter,
      }),
  });
  const milestones: Milestone[] = data?.milestones ?? [];

  const createMut = useMutation({
    mutationFn: (payload: MFormState) =>
      milestonesApi.create({
        jobId: payload.jobId,
        name: payload.name,
        targetDate: payload.targetDate,
      }),
    onSuccess: () => {
      toast.success("Milestone created");
      qc.invalidateQueries({ queryKey: ["milestones"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to create"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Milestone> }) =>
      milestonesApi.update(id, patch),
    onSuccess: () => {
      toast.success("Milestone updated");
      qc.invalidateQueries({ queryKey: ["milestones"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => milestonesApi.remove(id),
    onSuccess: () => {
      toast.success("Milestone deleted");
      qc.invalidateQueries({ queryKey: ["milestones"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  function markAchieved(m: Milestone) {
    updateMut.mutate({
      id: m.id,
      patch: {
        status: "achieved",
        achievedDate: new Date().toISOString(),
      },
    });
  }

  function submit() {
    if (!form.jobId) {
      toast.error("Please select a job");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Milestone name is required");
      return;
    }
    createMut.mutate(form);
  }

  const stats = React.useMemo(
    () => ({
      total: milestones.length,
      pending: milestones.filter((m) => m.status === "pending").length,
      achieved: milestones.filter((m) => m.status === "achieved").length,
      delayed: milestones.filter((m) => m.status === "delayed").length,
    }),
    [milestones]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Flag className="h-5 w-5 text-primary" />
            Project Milestones
          </h1>
          <p className="text-xs text-muted-foreground">
            Key dates per job — measurement, design, cutting, installation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={jobFilter} onValueChange={setJobFilter}>
            <SelectTrigger className="h-9 w-44 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All jobs</SelectItem>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.orderNumber} — {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => {
              setForm(EMPTY_FORM);
              setCreateOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            New Milestone
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Flag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total milestones</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.achieved}</p>
              <p className="text-xs text-muted-foreground">Achieved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-rose-500/10 p-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.delayed}</p>
              <p className="text-xs text-muted-foreground">Delayed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Timeline</CardTitle>
          <CardDescription className="text-xs">
            Ordered by target date — {milestones.length} milestone
            {milestones.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : milestones.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <Flag className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No milestones yet</p>
                <p className="text-sm text-muted-foreground">
                  Track key dates like Measurement, Design Approval, Handover.
                </p>
              </div>
            </div>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-6">
              {milestones.map((m) => {
                const overdue = isOverdue(m.targetDate, m.status);
                return (
                  <li key={m.id} className="relative">
                    <span
                      className={`absolute -left-[1.6rem] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background ${
                        m.status === "achieved"
                          ? "bg-emerald-500"
                          : overdue
                          ? "bg-rose-500"
                          : "bg-amber-500"
                      }`}
                    >
                      {m.status === "achieved" ? (
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      ) : (
                        <Circle className="h-2 w-2 text-white" />
                      )}
                    </span>
                    <div className="rounded-md border border-border bg-background p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{m.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.job?.orderNumber ?? "—"} ·{" "}
                            {m.job?.title ?? ""}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Target: {fmtDate(m.targetDate)}
                            </span>
                            <span>
                              Achieved: {fmtDate(m.achievedDate)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${
                              STATUS_TINTS[m.status] ?? ""
                            }`}
                          >
                            {m.status}
                          </Badge>
                          {overdue && m.status !== "achieved" && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-rose-500/40 bg-rose-500/10 text-rose-700"
                            >
                              Overdue
                            </Badge>
                          )}
                          {m.status !== "achieved" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-emerald-600"
                              onClick={() => markAchieved(m)}
                              disabled={updateMut.isPending}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Mark Achieved
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteMut.mutate(m.id)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Milestone</DialogTitle>
            <DialogDescription>
              Add a key project milestone for a job.
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
            <div className="space-y-1.5">
              <Label className="text-xs">Milestone *</Label>
              <Select
                value={form.name}
                onValueChange={(v) => setForm((f) => ({ ...f, name: v }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MILESTONE_NAMES.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Target Date</Label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={form.targetDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, targetDate: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={createMut.isPending}>
              {createMut.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Create Milestone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
