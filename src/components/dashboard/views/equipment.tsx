"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  equipmentApi,
  equipmentAssignmentsApi,
  jobsApi,
  type Equipment,
  type EquipmentAssignment,
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
  Wrench,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  MapPin,
  Factory,
  CalendarClock,
  ListChecks,
  X,
} from "lucide-react";

const TYPES = [
  { value: "cnc", label: "CNC", tint: "bg-violet-500/15 text-violet-700 border-violet-500/30" },
  { value: "panel_saw", label: "Panel Saw", tint: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  { value: "edge_bander", label: "Edge Bander", tint: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  { value: "drill", label: "Drill", tint: "bg-teal-500/15 text-teal-700 border-teal-500/30" },
  { value: "sander", label: "Sander", tint: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
  { value: "press", label: "Press", tint: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30" },
  { value: "other", label: "Other", tint: "bg-slate-500/15 text-slate-700 border-slate-500/30" },
];

const STATUS_TINTS: Record<string, string> = {
  operational: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  maintenance: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  broken: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  retired: "bg-slate-500/15 text-slate-700 border-slate-500/30",
};

function typeInfo(t: string) {
  return TYPES.find((x) => x.value === t) ?? TYPES[TYPES.length - 1];
}

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

interface EquipFormState {
  name: string;
  code: string;
  type: string;
  manufacturer: string;
  model: string;
  status: string;
  location: string;
  capacityPerDay: string;
  lastServiceDate: string;
  nextServiceDate: string;
  notes: string;
}

const EMPTY_FORM: EquipFormState = {
  name: "",
  code: "",
  type: "panel_saw",
  manufacturer: "",
  model: "",
  status: "operational",
  location: "",
  capacityPerDay: "0",
  lastServiceDate: "",
  nextServiceDate: "",
  notes: "",
};

interface AssignFormState {
  jobId: string;
  scheduledDate: string;
}

const EMPTY_ASSIGN: AssignFormState = {
  jobId: "",
  scheduledDate: new Date().toISOString().slice(0, 10),
};

export function EquipmentView() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = React.useState<"all" | string>("all");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Equipment | null>(null);
  const [form, setForm] = React.useState<EquipFormState>(EMPTY_FORM);
  const [assignmentsTarget, setAssignmentsTarget] =
    React.useState<Equipment | null>(null);
  const [assignForm, setAssignForm] = React.useState<AssignFormState>(EMPTY_ASSIGN);
  const [assignOpen, setAssignOpen] = React.useState(false);

  const { data: jobsData } = useQuery({
    queryKey: ["jobs", "for-equip"],
    queryFn: () => jobsApi.list(),
  });
  const jobs: JobLite[] = (jobsData as { jobs?: JobLite[] })?.jobs ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["equipment", typeFilter],
    queryFn: () =>
      equipmentApi.list({
        type: typeFilter === "all" ? undefined : typeFilter,
      }),
  });
  const equipment: Equipment[] = data?.equipment ?? [];

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["equipment-assignments", assignmentsTarget?.id],
    queryFn: () =>
      equipmentAssignmentsApi.list({
        equipmentId: assignmentsTarget?.id,
      }),
    enabled: !!assignmentsTarget,
  });
  const assignments: EquipmentAssignment[] =
    assignmentsData?.assignments ?? [];

  const createMut = useMutation({
    mutationFn: (payload: EquipFormState) =>
      equipmentApi.create({
        name: payload.name,
        type: payload.type,
        code: payload.code || null,
        manufacturer: payload.manufacturer || undefined,
        model: payload.model || undefined,
        status: payload.status,
        location: payload.location || undefined,
        capacityPerDay: Number(payload.capacityPerDay) || 0,
        lastServiceDate: payload.lastServiceDate || undefined,
        nextServiceDate: payload.nextServiceDate || undefined,
        notes: payload.notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Equipment added");
      qc.invalidateQueries({ queryKey: ["equipment"] });
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
      patch: Partial<Equipment>;
    }) => equipmentApi.update(id, patch),
    onSuccess: () => {
      toast.success("Equipment updated");
      qc.invalidateQueries({ queryKey: ["equipment"] });
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => equipmentApi.remove(id),
    onSuccess: () => {
      toast.success("Equipment deleted");
      qc.invalidateQueries({ queryKey: ["equipment"] });
      setAssignmentsTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  const createAssignMut = useMutation({
    mutationFn: (payload: AssignFormState & { equipmentId: string }) =>
      equipmentAssignmentsApi.create({
        equipmentId: payload.equipmentId,
        jobId: payload.jobId || null,
        scheduledDate: payload.scheduledDate,
      }),
    onSuccess: () => {
      toast.success("Assignment created");
      qc.invalidateQueries({ queryKey: ["equipment-assignments"] });
      qc.invalidateQueries({ queryKey: ["equipment"] });
      setAssignOpen(false);
      setAssignForm(EMPTY_ASSIGN);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to assign"),
  });

  const deleteAssignMut = useMutation({
    mutationFn: (id: string) => equipmentAssignmentsApi.remove(id),
    onSuccess: () => {
      toast.success("Assignment removed");
      qc.invalidateQueries({ queryKey: ["equipment-assignments"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to remove"),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(e: Equipment) {
    setEditing(e);
    setForm({
      name: e.name,
      code: e.code ?? "",
      type: e.type,
      manufacturer: e.manufacturer ?? "",
      model: e.model ?? "",
      status: e.status,
      location: e.location ?? "",
      capacityPerDay: String(e.capacityPerDay ?? 0),
      lastServiceDate: e.lastServiceDate
        ? new Date(e.lastServiceDate).toISOString().slice(0, 10)
        : "",
      nextServiceDate: e.nextServiceDate
        ? new Date(e.nextServiceDate).toISOString().slice(0, 10)
        : "",
      notes: e.notes ?? "",
    });
    setModalOpen(true);
  }

  function openAssignments(e: Equipment) {
    setAssignmentsTarget(e);
  }

  function submitEquip() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        patch: {
          name: form.name,
          code: form.code || null,
          type: form.type,
          manufacturer: form.manufacturer || null,
          model: form.model || null,
          status: form.status,
          location: form.location || null,
          capacityPerDay: Number(form.capacityPerDay) || 0,
          lastServiceDate: form.lastServiceDate || null,
          nextServiceDate: form.nextServiceDate || null,
          notes: form.notes || null,
        },
        onError: (e: Error) => toast.error(e.message || "Operation failed"),
      });
    } else {
      createMut.mutate(form);
    }
  }

  function submitAssign() {
    if (!assignmentsTarget) return;
    createAssignMut.mutate({
      ...assignForm,
      equipmentId: assignmentsTarget.id,
    });
  }

  const stats = React.useMemo(
    () => ({
      total: equipment.length,
      operational: equipment.filter((e) => e.status === "operational").length,
      maintenance: equipment.filter((e) => e.status === "maintenance").length,
      broken: equipment.filter((e) => e.status === "broken").length,
    }),
    [equipment]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Wrench className="h-5 w-5 text-primary" />
            Equipment
          </h1>
          <p className="text-xs text-muted-foreground">
            Machines, capacity &amp; maintenance scheduling.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPES.map((t) => (
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
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total machines</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <Wrench className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.operational}</p>
              <p className="text-xs text-muted-foreground">Operational</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Wrench className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.maintenance}</p>
              <p className="text-xs text-muted-foreground">Maintenance</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-rose-500/10 p-2">
              <Wrench className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.broken}</p>
              <p className="text-xs text-muted-foreground">Broken</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : equipment.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <Wrench className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No equipment registered</p>
              <p className="text-sm text-muted-foreground">
                Add your CNC, panel saw, edge banders and other machines.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {equipment.map((e) => {
            const ti = typeInfo(e.type);
            return (
              <Card key={e.id} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{e.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${ti.tint}`}
                        >
                          {ti.label}
                        </Badge>
                        {e.code && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {e.code}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEdit(e)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteMut.mutate(e.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize ${
                        STATUS_TINTS[e.status] ?? ""
                      }`}
                    >
                      {e.status}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {e.capacityPerDay} /day
                    </span>
                  </div>
                  {e.manufacturer && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Factory className="h-3.5 w-3.5 shrink-0" />
                      {e.manufacturer}
                      {e.model ? ` — ${e.model}` : ""}
                    </p>
                  )}
                  {e.location && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {e.location}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      Last: {fmtDate(e.lastServiceDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      Next: {fmtDate(e.nextServiceDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <Badge variant="outline" className="text-[10px]">
                      {e._count?.assignments ?? 0} assignment
                      {(e._count?.assignments ?? 0) === 1 ? "" : "s"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => openAssignments(e)}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Equipment" : "Add Equipment"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update machine details."
                : "Register a new machine / tool."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name *</Label>
                <Input
                  placeholder="e.g. Holzma Panel Saw"
                  className="h-9 text-sm"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Code</Label>
                <Input
                  placeholder="e.g. PS-001"
                  className="h-9 text-sm"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Type *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
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
                    <SelectItem value="operational">Operational</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="broken">Broken</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Manufacturer</Label>
                <Input
                  placeholder="e.g. Homag"
                  className="h-9 text-sm"
                  value={form.manufacturer}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, manufacturer: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Model</Label>
                <Input
                  placeholder="e.g. HPP 250"
                  className="h-9 text-sm"
                  value={form.model}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, model: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Location</Label>
                <Input
                  placeholder="Workstation / bay"
                  className="h-9 text-sm"
                  value={form.location}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, location: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Capacity / Day</Label>
                <Input
                  type="number"
                  placeholder="0"
                  className="h-9 text-sm"
                  value={form.capacityPerDay}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, capacityPerDay: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Last Service</Label>
                <Input
                  type="date"
                  className="h-9 text-sm"
                  value={form.lastServiceDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lastServiceDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Next Service</Label>
                <Input
                  type="date"
                  className="h-9 text-sm"
                  value={form.nextServiceDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nextServiceDate: e.target.value }))
                  }
                />
              </div>
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
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submitEquip}
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
              <Wrench className="h-5 w-5 text-primary" />
              {assignmentsTarget?.name} — Assignments
            </DialogTitle>
            <DialogDescription>
              Job assignments for this equipment.
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
                    <Label className="text-xs">Job (optional)</Label>
                    <Select
                      value={assignForm.jobId}
                      onValueChange={(v) =>
                        setAssignForm((f) => ({
                          ...f,
                          jobId: v === "_none" ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="No linked job" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">No linked job</SelectItem>
                        {jobs.map((j) => (
                          <SelectItem key={j.id} value={j.id}>
                            {j.orderNumber} — {j.title}
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
                          {a.job?.orderNumber ?? "Unlinked"} ·{" "}
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
