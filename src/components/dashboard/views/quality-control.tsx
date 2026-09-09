// @ts-nocheck
"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  qcCheckpointsApi,
  jobsApi,
  type QcCheckpoint,
  type QcChecklistItem,
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
import { Checkbox } from "@/components/ui/checkbox";
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
  ShieldCheck,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  User,
} from "lucide-react";

const STAGES = ["Cutting", "Assembly", "Finishing", "Installation"];

const STATUS_TINTS: Record<string, string> = {
  pending: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  passed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  failed: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  rework: "bg-amber-500/15 text-amber-700 border-amber-500/30",
};

const DEFAULT_CHECKLIST: QcChecklistItem[] = [
  { item: "Dimensions within tolerance", checked: false, note: "" },
  { item: "Material quality verified", checked: false, note: "" },
  { item: "Surface finish acceptable", checked: false, note: "" },
  { item: "Joints and assembly correct", checked: false, note: "" },
  { item: "Hardware alignment", checked: false, note: "" },
];

function parseChecklist(raw: string | null): QcChecklistItem[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr as QcChecklistItem[];
  } catch {
    return [];
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

interface JobLite {
  id: string;
  orderNumber: string;
  title: string;
}

export function QualityControlView() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState<"all" | string>("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<QcCheckpoint | null>(null);
  const [checklistOpen, setChecklistOpen] = React.useState<QcCheckpoint | null>(
    null
  );

  // Create / edit form state
  const [form, setForm] = React.useState({
    jobId: "",
    stage: "Cutting",
    inspector: "",
    notes: "",
  });
  // Checklist editor state
  const [checklist, setChecklist] = React.useState<QcChecklistItem[]>([]);
  const [checklistNotes, setChecklistNotes] = React.useState("");

  const { data: jobsData } = useQuery({
    queryKey: ["jobs", "for-qc"],
    queryFn: () => jobsApi.list(),
  });
  const jobs: JobLite[] = (jobsData as { jobs?: JobLite[] })?.jobs ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["qc-checkpoints", statusFilter],
    queryFn: () =>
      qcCheckpointsApi.list({
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });
  const checkpoints: QcCheckpoint[] = data?.checkpoints ?? [];

  const createMut = useMutation({
    mutationFn: (payload: typeof form) =>
      qcCheckpointsApi.create({
        jobId: payload.jobId,
        stage: payload.stage,
        inspector: payload.inspector || undefined,
        notes: payload.notes || undefined,
      }),
    onSuccess: () => {
      toast.success("QC checkpoint created");
      qc.invalidateQueries({ queryKey: ["qc-checkpoints"] });
      setCreateOpen(false);
      setForm({ jobId: "", stage: "Cutting", inspector: "", notes: "" });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to create"),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<QcCheckpoint> & { checklist?: QcChecklistItem[] };
    }) => qcCheckpointsApi.update(id, patch),
    onSuccess: () => {
      toast.success("Checkpoint updated");
      qc.invalidateQueries({ queryKey: ["qc-checkpoints"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => qcCheckpointsApi.remove(id),
    onSuccess: () => {
      toast.success("Checkpoint deleted");
      qc.invalidateQueries({ queryKey: ["qc-checkpoints"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  function openCreate() {
    setEditTarget(null);
    setForm({ jobId: "", stage: "Cutting", inspector: "", notes: "" });
    setCreateOpen(true);
  }

  function openEdit(c: QcCheckpoint) {
    setEditTarget(c);
    setForm({
      jobId: c.jobId,
      stage: c.stage,
      inspector: c.inspector ?? "",
      notes: c.notes ?? "",
    });
    setCreateOpen(true);
  }

  function openChecklist(c: QcCheckpoint) {
    setChecklistOpen(c);
    const parsed = parseChecklist(c.checklist);
    setChecklist(parsed.length > 0 ? parsed : DEFAULT_CHECKLIST);
    setChecklistNotes(c.notes ?? "");
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
          },
        }
      );
    } else {
      createMut.mutate(form);
    }
  }

  function saveChecklist() {
    if (!checklistOpen) return;
    // Compute status from checklist
    const anyUnchecked = checklist.some((i) => !i.checked);
    const newStatus = anyUnchecked ? "pending" : "passed";
    updateMut.mutate(
      {
        id: checklistOpen.id,
        patch: {
          checklist,
          notes: checklistNotes || null,
          status: newStatus,
          inspectedAt: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          setChecklistOpen(null);
        },
      }
    );
  }

  function setStatus(c: QcCheckpoint, status: string) {
    updateMut.mutate({
      id: c.id,
      patch: { status, inspectedAt: new Date().toISOString() },
      onError: (e: Error) => toast.error(e.message || "Operation failed"),
    });
  }

  const stats = React.useMemo(() => {
    return {
      total: checkpoints.length,
      pending: checkpoints.filter((c) => c.status === "pending").length,
      passed: checkpoints.filter((c) => c.status === "passed").length,
      failed: checkpoints.filter((c) => c.status === "failed").length,
    };
  }, [checkpoints]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Quality Control
          </h1>
          <p className="text-xs text-muted-foreground">
            Inspection checkpoints per stage with pass/fail checklists.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          New Checkpoint
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total checks</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-slate-500/10 p-2">
              <Loader2 className="h-5 w-5 text-slate-600" />
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
              <p className="text-2xl font-bold tabular-nums">{stats.passed}</p>
              <p className="text-xs text-muted-foreground">Passed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-rose-500/10 p-2">
              <XCircle className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter + table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Inspections</CardTitle>
              <CardDescription className="text-xs">
                {checkpoints.length} checkpoint{checkpoints.length === 1 ? "" : "s"} recorded
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-40 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="rework">Rework</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : checkpoints.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <ShieldCheck className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No checkpoints yet</p>
                <p className="text-sm text-muted-foreground">
                  Create an inspection checkpoint to start tracking quality.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs min-w-[120px]">Job</TableHead>
                    <TableHead className="h-8 text-xs min-w-[100px]">Stage</TableHead>
                    <TableHead className="h-8 text-xs min-w-[120px]">Inspector</TableHead>
                    <TableHead className="h-8 text-xs min-w-[100px]">Status</TableHead>
                    <TableHead className="h-8 text-xs min-w-[120px]">Inspected At</TableHead>
                    <TableHead className="h-8 text-xs text-right min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkpoints.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="py-2 text-xs">
                        <div className="font-medium">
                          {c.job?.orderNumber ?? "—"}
                        </div>
                        <div className="text-muted-foreground truncate max-w-[180px]">
                          {c.job?.title ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-xs">{c.stage}</TableCell>
                      <TableCell className="py-2 text-xs">
                        {c.inspector ? (
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {c.inspector}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={`capitalize text-xs ${
                            STATUS_TINTS[c.status] ?? ""
                          }`}
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        {fmtDateTime(c.inspectedAt)}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => openChecklist(c)}
                          >
                            <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
                            Checklist
                          </Button>
                          {c.status !== "passed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-emerald-600"
                              onClick={() => setStatus(c, "passed")}
                            >
                              Pass
                            </Button>
                          )}
                          {c.status !== "failed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-rose-600"
                              onClick={() => setStatus(c, "failed")}
                            >
                              Fail
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openEdit(c)}
                            aria-label="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteMut.mutate(c.id)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* Create / edit dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setEditTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Edit Checkpoint" : "New QC Checkpoint"}
            </DialogTitle>
            <DialogDescription>
              {editTarget
                ? "Update inspector or notes."
                : "Record an inspection checkpoint for a job stage."}
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
              <Label className="text-xs">Inspector</Label>
              <Input
                placeholder="Inspector name (defaults to you)"
                className="h-9 text-sm"
                value={form.inspector}
                onChange={(e) =>
                  setForm((f) => ({ ...f, inspector: e.target.value }))
                }
              />
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

      {/* Checklist editor dialog */}
      <Dialog
        open={!!checklistOpen}
        onOpenChange={(o) => {
          if (!o) setChecklistOpen(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>QC Checklist</DialogTitle>
            <DialogDescription>
              {checklistOpen?.job?.orderNumber ?? "—"} · {checklistOpen?.stage}
              {" — "}tick all items to mark as passed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {checklist.map((item, idx) => (
              <div
                key={idx}
                className="rounded-md border border-border p-2 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`qc-${idx}`}
                    checked={!!item.checked}
                    onCheckedChange={(v) =>
                      setChecklist((arr) =>
                        arr.map((it, i) =>
                          i === idx ? { ...it, checked: !!v } : it
                        )
                      )
                    }
                  />
                  <Label
                    htmlFor={`qc-${idx}`}
                    className="text-xs font-medium cursor-pointer"
                  >
                    {item.item}
                  </Label>
                </div>
                <Input
                  placeholder="Note (optional)"
                  className="h-8 text-xs"
                  value={item.note ?? ""}
                  onChange={(e) =>
                    setChecklist((arr) =>
                      arr.map((it, i) =>
                        i === idx ? { ...it, note: e.target.value } : it
                      )
                    )
                  }
                />
              </div>
            ))}
            <div className="space-y-1.5 pt-2">
              <Label className="text-xs">Checkpoint Notes</Label>
              <Textarea
                rows={2}
                placeholder="Overall inspection notes…"
                className="text-sm"
                value={checklistNotes}
                onChange={(e) => setChecklistNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setChecklistOpen(null)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={saveChecklist} disabled={updateMut.isPending}>
              {updateMut.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Save Checklist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
