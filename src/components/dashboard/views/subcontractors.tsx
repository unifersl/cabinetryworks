"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  subcontractorsApi,
  subcontractorAssignmentsApi,
  jobsApi,
  type Subcontractor,
  type SubcontractorAssignment,
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  HardHat,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Star,
  ListChecks,
  X,
} from "lucide-react";

const TRADES = [
  { value: "painter", label: "Painter", tint: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
  { value: "tiler", label: "Tiler", tint: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  { value: "electrician", label: "Electrician", tint: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  { value: "plumber", label: "Plumber", tint: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  { value: "installer", label: "Installer", tint: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  { value: "other", label: "Other", tint: "bg-slate-500/15 text-slate-700 border-slate-500/30" },
];

function tradeInfo(t: string) {
  return TRADES.find((x) => x.value === t) ?? TRADES[TRADES.length - 1];
}

interface JobLite {
  id: string;
  orderNumber: string;
  title: string;
}

interface SubFormState {
  name: string;
  trade: string;
  contactName: string;
  phone: string;
  email: string;
  rating: number;
  status: string;
}

const EMPTY_FORM: SubFormState = {
  name: "",
  trade: "installer",
  contactName: "",
  phone: "",
  email: "",
  rating: 3,
  status: "active",
};

interface AssignFormState {
  jobId: string;
  task: string;
  scheduledDate: string;
}

const EMPTY_ASSIGN: AssignFormState = {
  jobId: "",
  task: "",
  scheduledDate: new Date().toISOString().slice(0, 10),
};

export function SubcontractorsView() {
  const qc = useQueryClient();
  const [tradeFilter, setTradeFilter] = React.useState<"all" | string>("all");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Subcontractor | null>(null);
  const [form, setForm] = React.useState<SubFormState>(EMPTY_FORM);
  const [assignmentsTarget, setAssignmentsTarget] =
    React.useState<Subcontractor | null>(null);
  const [assignForm, setAssignForm] = React.useState<AssignFormState>(EMPTY_ASSIGN);
  const [assignOpen, setAssignOpen] = React.useState(false);

  const { data: jobsData } = useQuery({
    queryKey: ["jobs", "for-subs"],
    queryFn: () => jobsApi.list(),
  });
  const jobs: JobLite[] = (jobsData as { jobs?: JobLite[] })?.jobs ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["subcontractors", tradeFilter],
    queryFn: () =>
      subcontractorsApi.list({
        trade: tradeFilter === "all" ? undefined : tradeFilter,
      }),
  });
  const subs: Subcontractor[] = data?.subcontractors ?? [];

  // Assignments for the currently selected subcontractor
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["subcontractor-assignments", assignmentsTarget?.id],
    queryFn: () =>
      subcontractorAssignmentsApi.list({
        subcontractorId: assignmentsTarget?.id,
      }),
    enabled: !!assignmentsTarget,
  });
  const assignments: SubcontractorAssignment[] =
    assignmentsData?.assignments ?? [];

  const createMut = useMutation({
    mutationFn: (payload: SubFormState) =>
      subcontractorsApi.create({
        name: payload.name,
        trade: payload.trade,
        contactName: payload.contactName || undefined,
        phone: payload.phone || undefined,
        email: payload.email || undefined,
        rating: payload.rating,
        status: payload.status,
      }),
    onSuccess: () => {
      toast.success("Subcontractor added");
      qc.invalidateQueries({ queryKey: ["subcontractors"] });
      setModalOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to add"),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Subcontractor>;
    }) => subcontractorsApi.update(id, patch),
    onSuccess: () => {
      toast.success("Subcontractor updated");
      qc.invalidateQueries({ queryKey: ["subcontractors"] });
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => subcontractorsApi.remove(id),
    onSuccess: () => {
      toast.success("Subcontractor deleted");
      qc.invalidateQueries({ queryKey: ["subcontractors"] });
      setAssignmentsTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  const createAssignMut = useMutation({
    mutationFn: (payload: AssignFormState & { subcontractorId: string }) =>
      subcontractorAssignmentsApi.create({
        subcontractorId: payload.subcontractorId,
        jobId: payload.jobId,
        task: payload.task,
        scheduledDate: payload.scheduledDate,
      }),
    onSuccess: () => {
      toast.success("Assignment created");
      qc.invalidateQueries({ queryKey: ["subcontractor-assignments"] });
      qc.invalidateQueries({ queryKey: ["subcontractors"] });
      setAssignOpen(false);
      setAssignForm(EMPTY_ASSIGN);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to assign"),
  });

  const updateAssignMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<SubcontractorAssignment>;
    }) => subcontractorAssignmentsApi.update(id, patch),
    onSuccess: () => {
      toast.success("Assignment updated");
      qc.invalidateQueries({ queryKey: ["subcontractor-assignments"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update"),
  });

  const deleteAssignMut = useMutation({
    mutationFn: (id: string) => subcontractorAssignmentsApi.remove(id),
    onSuccess: () => {
      toast.success("Assignment removed");
      qc.invalidateQueries({ queryKey: ["subcontractor-assignments"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to remove"),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(s: Subcontractor) {
    setEditing(s);
    setForm({
      name: s.name,
      trade: s.trade,
      contactName: s.contactName ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      rating: s.rating,
      status: s.status,
    });
    setModalOpen(true);
  }

  function openAssignments(s: Subcontractor) {
    setAssignmentsTarget(s);
  }

  function submitSub() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.trade) {
      toast.error("Trade is required");
      return;
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, patch: { ...form } });
    } else {
      createMut.mutate(form);
    }
  }

  function submitAssign() {
    if (!assignmentsTarget) return;
    if (!assignForm.jobId) {
      toast.error("Please select a job");
      return;
    }
    if (!assignForm.task.trim()) {
      toast.error("Task is required");
      return;
    }
    createAssignMut.mutate({
      ...assignForm,
      subcontractorId: assignmentsTarget.id,
    });
  }

  const stats = React.useMemo(
    () => ({
      total: subs.length,
      active: subs.filter((s) => s.status === "active").length,
      avgRating: subs.length
        ? (
            subs.reduce((acc, s) => acc + s.rating, 0) / subs.length
          ).toFixed(1)
        : "—",
      assignments: subs.reduce((acc, s) => acc + (s._count?.assignments ?? 0), 0),
    }),
    [subs]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <HardHat className="h-5 w-5 text-primary" />
            Subcontractors
          </h1>
          <p className="text-xs text-muted-foreground">
            External trades &amp; their assignments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={tradeFilter} onValueChange={setTradeFilter}>
            <SelectTrigger className="h-9 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All trades</SelectItem>
              {TRADES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <HardHat className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <HardHat className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Star className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.avgRating}</p>
              <p className="text-xs text-muted-foreground">Avg rating</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-violet-500/10 p-2">
              <ListChecks className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.assignments}</p>
              <p className="text-xs text-muted-foreground">Assignments</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : subs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <HardHat className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No subcontractors yet</p>
              <p className="text-sm text-muted-foreground">
                Add external trades and assign them to jobs.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {subs.map((s) => {
            const ti = tradeInfo(s.trade);
            return (
              <Card key={s.id} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{s.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${ti.tint}`}
                        >
                          {ti.label}
                        </Badge>
                        <span className="text-muted-foreground">·</span>
                        <span className="capitalize">{s.status}</span>
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
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
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i < s.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/40"
                        }`}
                      />
                    ))}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {s.rating}/5
                    </span>
                  </div>
                  {s.contactName && (
                    <p className="text-xs text-muted-foreground">
                      {s.contactName}
                    </p>
                  )}
                  {s.phone && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <a
                        href={`tel:${s.phone}`}
                        className="hover:text-foreground hover:underline"
                      >
                        {s.phone}
                      </a>
                    </p>
                  )}
                  {s.email && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <a
                        href={`mailto:${s.email}`}
                        className="hover:text-foreground hover:underline truncate"
                      >
                        {s.email}
                      </a>
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <Badge variant="outline" className="text-[10px]">
                      {s._count?.assignments ?? 0} assignment
                      {(s._count?.assignments ?? 0) === 1 ? "" : "s"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => openAssignments(s)}
                    >
                      <ListChecks className="mr-1 h-3 w-3" />
                      View Assignments
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Subcontractor" : "Add Subcontractor"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update subcontractor details."
                : "Register an external tradesperson."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input
                placeholder="e.g. Bright Painters"
                className="h-9 text-sm"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Trade *</Label>
                <Select
                  value={form.trade}
                  onValueChange={(v) => setForm((f) => ({ ...f, trade: v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Contact Name</Label>
                <Input
                  placeholder="Contact person"
                  className="h-9 text-sm"
                  value={form.contactName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input
                  placeholder="+1 555 0100"
                  className="h-9 text-sm"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                placeholder="sub@example.com"
                className="h-9 text-sm"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rating</Label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, rating: n }))}
                    className="p-0.5"
                    aria-label={`Set rating ${n}`}
                  >
                    <Star
                      className={`h-5 w-5 ${
                        n <= form.rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/40"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submitSub}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {(createMut.isPending || updateMut.isPending) && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {editing ? "Save Changes" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignments dialog */}
      <Dialog
        open={!!assignmentsTarget}
        onOpenChange={(o) => {
          if (!o) setAssignmentsTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardHat className="h-5 w-5 text-primary" />
              {assignmentsTarget?.name} — Assignments
            </DialogTitle>
            <DialogDescription>
              Job assignments for this subcontractor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAssignForm(EMPTY_ASSIGN);
                  setAssignOpen(true);
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                New Assignment
              </Button>
            </div>
            {assignOpen && (
              <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
                <div className="grid grid-cols-1 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Job *</Label>
                    <Select
                      value={assignForm.jobId}
                      onValueChange={(v) =>
                        setAssignForm((f) => ({ ...f, jobId: v }))
                      }
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
                    <Label className="text-xs">Task *</Label>
                    <Input
                      placeholder="e.g. Paint kitchen cabinets"
                      className="h-9 text-sm"
                      value={assignForm.task}
                      onChange={(e) =>
                        setAssignForm((f) => ({ ...f, task: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Scheduled Date</Label>
                    <Input
                      type="date"
                      className="h-9 text-sm"
                      value={assignForm.scheduledDate}
                      onChange={(e) =>
                        setAssignForm((f) => ({
                          ...f,
                          scheduledDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAssignOpen(false)}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={submitAssign}
                      disabled={createAssignMut.isPending}
                    >
                      {createAssignMut.isPending && (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      )}
                      Assign
                    </Button>
                  </div>
                </div>
                <Separator />
              </div>
            )}

            {assignmentsLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : assignments.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <ListChecks className="h-8 w-8 opacity-50" />
                <p className="text-sm">No assignments yet.</p>
              </div>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto scrollbar-warm pr-1">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-md border border-border bg-background p-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">
                          {a.job?.orderNumber ?? "—"} · {a.task}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Scheduled:{" "}
                          {new Date(a.scheduledDate).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                      >
                        {a.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="mt-2 flex justify-end gap-1">
                      {a.status !== "completed" && a.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() =>
                            updateAssignMut.mutate({
                              id: a.id,
                              patch: { status: "completed" },
                            })
                          }
                        >
                          Mark Completed
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        onClick={() => deleteAssignMut.mutate(a.id)}
                        aria-label="Remove"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
