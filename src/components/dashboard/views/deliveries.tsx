"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deliveriesApi,
  jobsApi,
  type DeliveryRecord,
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
  Truck,
  Wrench,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  User,
  Calendar,
  PackageCheck,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui-helpers";

const TYPES = [
  { value: "delivery", label: "Delivery" },
  { value: "installation", label: "Installation" },
];

const STATUS_FLOW: Record<string, string> = {
  scheduled: "in_transit",
  in_transit: "delivered",
  delivered: "installed",
  installed: "installed",
  cancelled: "cancelled",
};

const STATUS_TINTS: Record<string, string> = {
  scheduled: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  in_transit: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  delivered: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  installed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  cancelled: "bg-rose-500/15 text-rose-700 border-rose-500/30",
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

interface DeliveryFormState {
  jobId: string;
  type: string;
  scheduledDate: string;
  driverName: string;
  vehicleNo: string;
  installTeam: string;
  notes: string;
}

const EMPTY_FORM: DeliveryFormState = {
  jobId: "",
  type: "delivery",
  scheduledDate: new Date().toISOString().slice(0, 10),
  driverName: "",
  vehicleNo: "",
  installTeam: "",
  notes: "",
};

export function DeliveriesView() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = React.useState<"all" | string>("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | string>("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<DeliveryRecord | null>(
    null
  );
  const [form, setForm] = React.useState<DeliveryFormState>(EMPTY_FORM);

  const { data: jobsData } = useQuery({
    queryKey: ["jobs", "for-deliveries"],
    queryFn: () => jobsApi.list(),
  });
  const jobs: JobLite[] = (jobsData as { jobs?: JobLite[] })?.jobs ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["deliveries", typeFilter, statusFilter],
    queryFn: () =>
      deliveriesApi.list({
        type: typeFilter === "all" ? undefined : typeFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });
  const deliveries: DeliveryRecord[] = data?.deliveries ?? [];

  const createMut = useMutation({
    mutationFn: (payload: DeliveryFormState) =>
      deliveriesApi.create({
        jobId: payload.jobId,
        type: payload.type,
        scheduledDate: payload.scheduledDate,
        driverName: payload.driverName || undefined,
        vehicleNo: payload.vehicleNo || undefined,
        installTeam: payload.installTeam || undefined,
        notes: payload.notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Delivery record created");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
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
      patch: Partial<DeliveryRecord>;
    }) => deliveriesApi.update(id, patch),
    onSuccess: () => {
      toast.success("Delivery updated");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deliveriesApi.remove(id),
    onSuccess: () => {
      toast.success("Delivery deleted");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  function advanceStatus(d: DeliveryRecord) {
    const next = STATUS_FLOW[d.status] ?? "scheduled";
    const patch: Partial<DeliveryRecord> = { status: next };
    if (next === "delivered" || next === "installed") {
      patch.completedDate = new Date().toISOString();
    }
    updateMut.mutate({ id: d.id, patch });
  }

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  function openEdit(d: DeliveryRecord) {
    setEditTarget(d);
    setForm({
      jobId: d.jobId,
      type: d.type,
      scheduledDate: new Date(d.scheduledDate).toISOString().slice(0, 10),
      driverName: d.driverName ?? "",
      vehicleNo: d.vehicleNo ?? "",
      installTeam: d.installTeam ?? "",
      notes: d.notes ?? "",
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
      total: deliveries.length,
      scheduled: deliveries.filter((d) => d.status === "scheduled").length,
      inTransit: deliveries.filter((d) => d.status === "in_transit").length,
      installed: deliveries.filter((d) => d.status === "installed").length,
    };
  }, [deliveries]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Truck className="h-5 w-5 text-primary" />
            Delivery &amp; Installation
          </h1>
          <p className="text-xs text-muted-foreground">
            Track deliveries and on-site installation progress per job.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          New Record
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total records</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-slate-500/10 p-2">
              <Calendar className="h-5 w-5 text-slate-600" />
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
              <Truck className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.inTransit}</p>
              <p className="text-xs text-muted-foreground">In transit</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <PackageCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.installed}</p>
              <p className="text-xs text-muted-foreground">Installed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Records</CardTitle>
              <CardDescription className="text-xs">
                {deliveries.length} record{deliveries.length === 1 ? "" : "s"} shown
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-32 text-sm">
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-36 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="installed">Installed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : deliveries.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No delivery records"
              description="Schedule a delivery or installation to begin tracking."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="mr-1 h-4 w-4" />
                  New Record
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs min-w-[110px]">Job</TableHead>
                    <TableHead className="h-8 text-xs min-w-[100px]">Type</TableHead>
                    <TableHead className="h-8 text-xs min-w-[120px]">Scheduled</TableHead>
                    <TableHead className="h-8 text-xs min-w-[140px]">Driver / Vehicle</TableHead>
                    <TableHead className="h-8 text-xs min-w-[140px]">Install Team</TableHead>
                    <TableHead className="h-8 text-xs min-w-[100px]">Status</TableHead>
                    <TableHead className="h-8 text-xs text-right min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="py-2 text-xs">
                        <div className="font-medium">
                          {d.job?.orderNumber ?? "—"}
                        </div>
                        <div className="text-muted-foreground truncate max-w-[160px]">
                          {d.job?.title ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className="text-xs">
                          {d.type === "installation" ? (
                            <Wrench className="mr-1 h-3 w-3" />
                          ) : (
                            <Truck className="mr-1 h-3 w-3" />
                          )}
                          <span className="capitalize">{d.type}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        {fmtDate(d.scheduledDate)}
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        {d.driverName || d.vehicleNo ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {d.driverName ?? "—"}
                            </div>
                            <div className="text-muted-foreground">
                              {d.vehicleNo ?? ""}
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        {d.installTeam ?? "—"}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={`capitalize text-xs ${
                            STATUS_TINTS[d.status] ?? ""
                          }`}
                        >
                          {d.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {d.status !== "installed" &&
                            d.status !== "cancelled" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => advanceStatus(d)}
                                disabled={updateMut.isPending}
                              >
                                Advance →
                              </Button>
                            )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openEdit(d)}
                            aria-label="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteMut.mutate(d.id)}
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
          if (!o) {
            setEditTarget(null);
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Edit Record" : "New Delivery / Installation"}
            </DialogTitle>
            <DialogDescription>
              {editTarget
                ? "Update delivery or installation details."
                : "Schedule a delivery or installation record."}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Driver Name</Label>
                <Input
                  placeholder="Driver"
                  className="h-9 text-sm"
                  value={form.driverName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, driverName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vehicle No.</Label>
                <Input
                  placeholder="e.g. WX-1234-B"
                  className="h-9 text-sm"
                  value={form.vehicleNo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vehicleNo: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Install Team</Label>
              <Input
                placeholder="e.g. Ali, Siva, Raj"
                className="h-9 text-sm"
                value={form.installTeam}
                onChange={(e) =>
                  setForm((f) => ({ ...f, installTeam: e.target.value }))
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
