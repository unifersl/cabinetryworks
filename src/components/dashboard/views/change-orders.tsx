"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { changeOrdersApi, jobsApi, type ChangeOrder } from "@/lib/api";
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
  GitBranch,
  Plus,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui-helpers";

const CHANGE_TYPES = [
  { value: "modification", label: "Modification", tint: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  { value: "addition", label: "Addition", tint: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  { value: "deletion", label: "Deletion", tint: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
  { value: "material_change", label: "Material Change", tint: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
];

const STATUS_TINTS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  implemented: "bg-teal-500/15 text-teal-700 border-teal-500/30",
};

function typeInfo(t: string) {
  return CHANGE_TYPES.find((c) => c.value === t) ?? CHANGE_TYPES[0];
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

interface CoFormState {
  jobId: string;
  title: string;
  description: string;
  changeType: string;
  affectedItems: string;
  impactNotes: string;
}

const EMPTY_FORM: CoFormState = {
  jobId: "",
  title: "",
  description: "",
  changeType: "modification",
  affectedItems: "",
  impactNotes: "",
};

export function ChangeOrdersView() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState<"all" | string>("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState<CoFormState>(EMPTY_FORM);

  const { data: jobsData } = useQuery({
    queryKey: ["jobs", "for-co"],
    queryFn: () => jobsApi.list(),
  });
  const jobs: JobLite[] = (jobsData as { jobs?: JobLite[] })?.jobs ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["change-orders", statusFilter],
    queryFn: () =>
      changeOrdersApi.list({
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });
  const orders: ChangeOrder[] = data?.changeOrders ?? [];

  const createMut = useMutation({
    mutationFn: (payload: CoFormState) =>
      changeOrdersApi.create({
        jobId: payload.jobId,
        title: payload.title,
        description: payload.description || undefined,
        changeType: payload.changeType,
        affectedItems: payload.affectedItems || undefined,
        impactNotes: payload.impactNotes || undefined,
      }),
    onSuccess: (resp) => {
      toast.success(`Change order ${resp.changeOrder.changeNo} created`);
      qc.invalidateQueries({ queryKey: ["change-orders"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to create"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ChangeOrder> }) =>
      changeOrdersApi.update(id, patch),
    onSuccess: () => {
      toast.success("Change order updated");
      qc.invalidateQueries({ queryKey: ["change-orders"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => changeOrdersApi.remove(id),
    onSuccess: () => {
      toast.success("Change order deleted");
      qc.invalidateQueries({ queryKey: ["change-orders"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  function setStatus(co: ChangeOrder, status: string) {
    updateMut.mutate({ id: co.id, patch: { status } });
  }

  function submit() {
    if (!form.jobId) {
      toast.error("Please select a job");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    createMut.mutate(form);
  }

  const stats = React.useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter((o) => o.status === "pending").length,
      approved: orders.filter((o) => o.status === "approved").length,
      implemented: orders.filter((o) => o.status === "implemented").length,
    }),
    [orders]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <GitBranch className="h-5 w-5 text-primary" />
            Change Orders
          </h1>
          <p className="text-xs text-muted-foreground">
            Scope changes &amp; modifications during production.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setForm(EMPTY_FORM);
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          New Change Order
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <GitBranch className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total orders</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <GitBranch className="h-5 w-5 text-amber-600" />
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
              <p className="text-2xl font-bold tabular-nums">{stats.approved}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-teal-500/10 p-2">
              <GitBranch className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.implemented}</p>
              <p className="text-xs text-muted-foreground">Implemented</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Change Orders</CardTitle>
              <CardDescription className="text-xs">
                {orders.length} order{orders.length === 1 ? "" : "s"} shown
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-40 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="implemented">Implemented</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              icon={GitBranch}
              title="No change orders"
              description="Track scope changes when clients request modifications."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  New Change Order
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs min-w-[100px]">Change #</TableHead>
                    <TableHead className="h-8 text-xs min-w-[100px]">Job #</TableHead>
                    <TableHead className="h-8 text-xs min-w-[160px]">Title</TableHead>
                    <TableHead className="h-8 text-xs min-w-[100px]">Type</TableHead>
                    <TableHead className="h-8 text-xs min-w-[100px]">Status</TableHead>
                    <TableHead className="h-8 text-xs min-w-[120px]">Requested By</TableHead>
                    <TableHead className="h-8 text-xs min-w-[100px]">Date</TableHead>
                    <TableHead className="h-8 text-xs text-right min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => {
                    const ti = typeInfo(o.changeType);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="py-2 text-xs font-mono font-medium">
                          {o.changeNo}
                        </TableCell>
                        <TableCell className="py-2 text-xs font-mono">
                          {o.job?.orderNumber ?? "—"}
                        </TableCell>
                        <TableCell className="py-2 text-xs max-w-[200px]">
                          <div className="font-medium truncate">{o.title}</div>
                          {o.description && (
                            <div className="text-muted-foreground truncate">
                              {o.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${ti.tint}`}
                          >
                            {ti.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            variant="outline"
                            className={`capitalize text-xs ${
                              STATUS_TINTS[o.status] ?? ""
                            }`}
                          >
                            {o.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-xs">
                          {o.requestedBy ?? "—"}
                        </TableCell>
                        <TableCell className="py-2 text-xs">
                          {fmtDate(o.createdAt)}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <div className="flex justify-end gap-1">
                            {o.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-emerald-600"
                                  onClick={() => setStatus(o, "approved")}
                                  disabled={updateMut.isPending}
                                >
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-rose-600"
                                  onClick={() => setStatus(o, "rejected")}
                                  disabled={updateMut.isPending}
                                >
                                  <XCircle className="mr-1 h-3 w-3" />
                                  Reject
                                </Button>
                              </>
                            )}
                            {o.status === "approved" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-teal-600"
                                onClick={() => setStatus(o, "implemented")}
                                disabled={updateMut.isPending}
                              >
                                Mark Implemented
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={() => deleteMut.mutate(o.id)} disabled={deleteMut.isPending}
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
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Change Order</DialogTitle>
            <DialogDescription>
              Change number is auto-generated as CO-YYYY-0001.
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
              <Label className="text-xs">Title *</Label>
              <Input
                placeholder="e.g. Add upper cabinet over sink"
                className="h-9 text-sm"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={3}
                placeholder="Detailed description of the change…"
                className="text-sm"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Change Type</Label>
                <Select
                  value={form.changeType}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, changeType: v }))
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANGE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Affected Items</Label>
              <Textarea
                rows={2}
                placeholder="List of affected parts / areas / rooms…"
                className="text-sm"
                value={form.affectedItems}
                onChange={(e) =>
                  setForm((f) => ({ ...f, affectedItems: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Impact Notes</Label>
              <Textarea
                rows={2}
                placeholder="Effect on materials, time, schedule…"
                className="text-sm"
                value={form.impactNotes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, impactNotes: e.target.value }))
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
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
