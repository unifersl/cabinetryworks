"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { punchItemsApi, jobsApi, type PunchItem } from "@/lib/api";
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
  Bug,
  Plus,
  Loader2,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui-helpers";

const CATEGORIES = [
  { value: "general", label: "General", tint: "bg-slate-500/15 text-slate-700 border-slate-500/30" },
  { value: "door", label: "Door", tint: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  { value: "drawer", label: "Drawer", tint: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30" },
  { value: "finish", label: "Finish", tint: "bg-violet-500/15 text-violet-700 border-violet-500/30" },
  { value: "alignment", label: "Alignment", tint: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  { value: "hardware", label: "Hardware", tint: "bg-teal-500/15 text-teal-700 border-teal-500/30" },
  { value: "damage", label: "Damage", tint: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
  { value: "other", label: "Other", tint: "bg-slate-500/15 text-slate-700 border-slate-500/30" },
];

const STATUS_FLOW: Record<string, string> = {
  open: "assigned",
  assigned: "fixed",
  fixed: "verified",
  verified: "closed",
  closed: "closed",
};

const STATUS_TINTS: Record<string, string> = {
  open: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  assigned: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  fixed: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  verified: "bg-teal-500/15 text-teal-700 border-teal-500/30",
  closed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
};

function categoryInfo(type: string) {
  return CATEGORIES.find((t) => t.value === type) ?? CATEGORIES[0];
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

interface PunchFormState {
  jobId: string;
  title: string;
  description: string;
  category: string;
  assignedTo: string;
}

const EMPTY_FORM: PunchFormState = {
  jobId: "",
  title: "",
  description: "",
  category: "general",
  assignedTo: "",
};

export function PunchListView() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState<"all" | string>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<"all" | string>("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState<PunchFormState>(EMPTY_FORM);

  const { data: jobsData } = useQuery({
    queryKey: ["jobs", "for-punch"],
    queryFn: () => jobsApi.list(),
  });
  const jobs: JobLite[] = (jobsData as { jobs?: JobLite[] })?.jobs ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["punch-items", statusFilter],
    queryFn: () =>
      punchItemsApi.list({
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });
  const items: PunchItem[] = data?.items ?? [];

  const filtered = React.useMemo(() => {
    if (categoryFilter === "all") return items;
    return items.filter((i) => i.category === categoryFilter);
  }, [items, categoryFilter]);

  const createMut = useMutation({
    mutationFn: (payload: PunchFormState) =>
      punchItemsApi.create({
        jobId: payload.jobId,
        title: payload.title,
        description: payload.description || undefined,
        category: payload.category,
        assignedTo: payload.assignedTo || undefined,
      }),
    onSuccess: () => {
      toast.success("Punch item created");
      qc.invalidateQueries({ queryKey: ["punch-items"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to create"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<PunchItem> }) =>
      punchItemsApi.update(id, patch),
    onSuccess: () => {
      toast.success("Punch item updated");
      qc.invalidateQueries({ queryKey: ["punch-items"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => punchItemsApi.remove(id),
    onSuccess: () => {
      toast.success("Punch item deleted");
      qc.invalidateQueries({ queryKey: ["punch-items"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  function advance(item: PunchItem) {
    const next = STATUS_FLOW[item.status] ?? "assigned";
    const patch: Partial<PunchItem> = { status: next };
    if (next === "closed" || next === "verified") {
      patch.resolvedAt = new Date().toISOString();
    }
    updateMut.mutate({ id: item.id, patch });
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
      total: items.length,
      open: items.filter((i) => i.status === "open").length,
      assigned: items.filter((i) => i.status === "assigned").length,
      closed: items.filter((i) => i.status === "closed").length,
    }),
    [items]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Bug className="h-5 w-5 text-primary" />
            Punch List
          </h1>
          <p className="text-xs text-muted-foreground">
            Post-installation deficiencies, fixes &amp; verification.
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
          New Item
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Bug className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total items</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-rose-500/10 p-2">
              <Bug className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.open}</p>
              <p className="text-xs text-muted-foreground">Open</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Bug className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.assigned}</p>
              <p className="text-xs text-muted-foreground">Assigned</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <Bug className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.closed}</p>
              <p className="text-xs text-muted-foreground">Closed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Items</CardTitle>
              <CardDescription className="text-xs">
                {filtered.length} item{filtered.length === 1 ? "" : "s"} shown
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-36 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 w-36 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
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
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Bug}
              title="No punch items"
              description="Add deficiencies discovered during or after installation."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  New Item
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">Job #</TableHead>
                    <TableHead className="h-8 text-xs">Title</TableHead>
                    <TableHead className="h-8 text-xs">Category</TableHead>
                    <TableHead className="h-8 text-xs">Status</TableHead>
                    <TableHead className="h-8 text-xs">Assigned To</TableHead>
                    <TableHead className="h-8 text-xs">Created</TableHead>
                    <TableHead className="h-8 text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((i) => {
                    const ci = categoryInfo(i.category);
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="py-2 text-xs font-mono font-medium">
                          {i.job?.orderNumber ?? "—"}
                        </TableCell>
                        <TableCell className="py-2 text-xs max-w-[200px]">
                          <div className="font-medium truncate">{i.title}</div>
                          {i.description && (
                            <div className="text-muted-foreground truncate">
                              {i.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${ci.tint}`}
                          >
                            {ci.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            variant="outline"
                            className={`capitalize text-xs ${
                              STATUS_TINTS[i.status] ?? ""
                            }`}
                          >
                            {i.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-xs">
                          {i.assignedTo ?? (
                            <span className="text-muted-foreground italic">
                              Unassigned
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-xs">
                          {fmtDate(i.createdAt)}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <div className="flex justify-end gap-1">
                            {i.status !== "closed" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => advance(i)}
                                disabled={updateMut.isPending}
                                title={`Advance to ${STATUS_FLOW[i.status] ?? "next"}`}
                              >
                                {i.status}
                                <ChevronRight className="ml-0.5 h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={() => deleteMut.mutate(i.id)}
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
            <DialogTitle>New Punch Item</DialogTitle>
            <DialogDescription>
              Log a deficiency or issue for a specific job.
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
                placeholder="e.g. Drawer front scratched"
                className="h-9 text-sm"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category: v }))
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Assign To</Label>
                <Input
                  placeholder="Technician name"
                  className="h-9 text-sm"
                  value={form.assignedTo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, assignedTo: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={3}
                placeholder="What needs fixing, where, severity…"
                className="text-sm"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
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
              Create Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
