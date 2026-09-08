"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  warrantyClaimsApi,
  jobsApi,
  type WarrantyClaim,
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
  ShieldAlert,
  ShieldCheck,
  Plus,
  Loader2,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui-helpers";

const ISSUE_TYPES = [
  { value: "defect", label: "Defect", tint: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
  { value: "damage", label: "Damage", tint: "bg-orange-500/15 text-orange-700 border-orange-500/30" },
  { value: "adjustment", label: "Adjustment", tint: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  { value: "replacement", label: "Replacement", tint: "bg-violet-500/15 text-violet-700 border-violet-500/30" },
];

const STATUS_TINTS: Record<string, string> = {
  open: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  in_progress: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  resolved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

function issueInfo(type: string) {
  return ISSUE_TYPES.find((t) => t.value === type) ?? ISSUE_TYPES[0];
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

interface ClaimFormState {
  jobId: string;
  issueType: string;
  description: string;
}

const EMPTY_FORM: ClaimFormState = {
  jobId: "",
  issueType: "defect",
  description: "",
};

export function WarrantyView() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState<"all" | string>("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detailTarget, setDetailTarget] = React.useState<WarrantyClaim | null>(
    null
  );
  const [form, setForm] = React.useState<ClaimFormState>(EMPTY_FORM);

  // Resolution editor state
  const [resolution, setResolution] = React.useState("");

  const { data: jobsData } = useQuery({
    queryKey: ["jobs", "for-warranty"],
    queryFn: () => jobsApi.list(),
  });
  const jobs: JobLite[] = (jobsData as { jobs?: JobLite[] })?.jobs ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["warranty-claims", statusFilter],
    queryFn: () =>
      warrantyClaimsApi.list({
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });
  const claims: WarrantyClaim[] = data?.claims ?? [];

  const createMut = useMutation({
    mutationFn: (payload: ClaimFormState) =>
      warrantyClaimsApi.create({
        jobId: payload.jobId || null,
        issueType: payload.issueType,
        description: payload.description || undefined,
      }),
    onSuccess: () => {
      toast.success("Warranty claim created");
      qc.invalidateQueries({ queryKey: ["warranty-claims"] });
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
      patch: Partial<WarrantyClaim> & { resolution?: string };
    }) => warrantyClaimsApi.update(id, patch),
    onSuccess: () => {
      toast.success("Claim updated");
      qc.invalidateQueries({ queryKey: ["warranty-claims"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => warrantyClaimsApi.remove(id),
    onSuccess: () => {
      toast.success("Claim deleted");
      qc.invalidateQueries({ queryKey: ["warranty-claims"] });
      setDetailTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  function openDetail(c: WarrantyClaim) {
    setDetailTarget(c);
    setResolution(c.resolution ?? "");
  }

  function setStatus(c: WarrantyClaim, status: string) {
    const patch: Partial<WarrantyClaim> = { status };
    if (resolution && (status === "resolved" || status === "rejected")) {
      patch.resolution = resolution;
    }
    updateMut.mutate(
      { id: c.id, patch },
      {
        onSuccess: () => {
          if (detailTarget?.id === c.id) {
            setDetailTarget({ ...c, ...patch });
          }
        },
      }
    );
  }

  function saveResolution() {
    if (!detailTarget) return;
    updateMut.mutate(
      { id: detailTarget.id, patch: { resolution } },
      {
        onSuccess: () => {
          setDetailTarget({ ...detailTarget, resolution });
        },
      }
    );
  }

  function submit() {
    if (!form.issueType) {
      toast.error("Please select an issue type");
      return;
    }
    createMut.mutate(form);
  }

  const stats = React.useMemo(() => {
    return {
      total: claims.length,
      open: claims.filter((c) => c.status === "open").length,
      inProgress: claims.filter((c) => c.status === "in_progress").length,
      resolved: claims.filter((c) => c.status === "resolved").length,
    };
  }, [claims]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Warranty Claims
          </h1>
          <p className="text-xs text-muted-foreground">
            After-sales defect, damage &amp; replacement tracking.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          New Claim
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total claims</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.open}</p>
              <p className="text-xs text-muted-foreground">Open</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-sky-500/10 p-2">
              <Loader2 className="h-5 w-5 text-sky-600" />
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
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.resolved}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter + table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Claims</CardTitle>
              <CardDescription className="text-xs">
                {claims.length} claim{claims.length === 1 ? "" : "s"} shown
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-40 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : claims.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No warranty claims"
              description="Create a new claim when a customer reports an issue."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="mr-1 h-4 w-4" />
                  New Claim
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">Claim #</TableHead>
                    <TableHead className="h-8 text-xs">Job</TableHead>
                    <TableHead className="h-8 text-xs">Issue Type</TableHead>
                    <TableHead className="h-8 text-xs">Description</TableHead>
                    <TableHead className="h-8 text-xs">Status</TableHead>
                    <TableHead className="h-8 text-xs">Date</TableHead>
                    <TableHead className="h-8 text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((c) => {
                    const ii = issueInfo(c.issueType);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="py-2 text-xs font-mono font-medium">
                          {c.claimNo}
                        </TableCell>
                        <TableCell className="py-2 text-xs">
                          {c.job ? (
                            <div>
                              <div className="font-medium">
                                {c.job.orderNumber}
                              </div>
                              <div className="text-muted-foreground truncate max-w-[140px]">
                                {c.job.title}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">
                              No job linked
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${ii.tint}`}
                          >
                            {ii.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-xs max-w-[220px]">
                          <span className="line-clamp-2 text-muted-foreground">
                            {c.description ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            variant="outline"
                            className={`capitalize text-xs ${
                              STATUS_TINTS[c.status] ?? ""
                            }`}
                          >
                            {c.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-xs">
                          {fmtDate(c.claimDate)}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => openDetail(c)}
                              aria-label="View"
                            >
                              <Eye className="h-3.5 w-3.5" />
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
            <DialogTitle>New Warranty Claim</DialogTitle>
            <DialogDescription>
              File a new after-sales claim. Claim number is auto-generated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Linked Job (optional)</Label>
              <Select
                value={form.jobId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, jobId: v === "_none" ? "" : v }))
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
              <Label className="text-xs">Issue Type *</Label>
              <Select
                value={form.issueType}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, issueType: v }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={3}
                placeholder="Describe the issue, location, affected parts…"
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
              Create Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail / resolution dialog */}
      <Dialog
        open={!!detailTarget}
        onOpenChange={(o) => {
          if (!o) setDetailTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              {detailTarget?.claimNo}
            </DialogTitle>
            <DialogDescription>
              Filed {fmtDate(detailTarget?.claimDate)} ·{" "}
              {issueType(detailTarget?.issueType ?? "")}
            </DialogDescription>
          </DialogHeader>
          {detailTarget && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Job</p>
                  <p className="font-medium">
                    {detailTarget.job?.orderNumber ?? "No linked job"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={`mt-1 capitalize text-xs ${
                      STATUS_TINTS[detailTarget.status] ?? ""
                    }`}
                  >
                    {detailTarget.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Issue Description</p>
                <p className="text-sm mt-1">
                  {detailTarget.description ?? "No description provided."}
                </p>
              </div>
              {detailTarget.resolvedAt && (
                <div className="text-xs text-muted-foreground">
                  Resolved on {fmtDate(detailTarget.resolvedAt)}
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Resolution Notes</Label>
                <Textarea
                  rows={3}
                  placeholder="What was done to resolve this claim…"
                  className="text-sm"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveResolution}
                  disabled={updateMut.isPending}
                >
                  Save Notes
                </Button>
                {detailTarget.status !== "in_progress" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-sky-600"
                    onClick={() => setStatus(detailTarget, "in_progress")}
                  >
                    <Clock className="mr-1 h-3.5 w-3.5" />
                    Mark In Progress
                  </Button>
                )}
                {detailTarget.status !== "resolved" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-600"
                    onClick={() => setStatus(detailTarget, "resolved")}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Resolve
                  </Button>
                )}
                {detailTarget.status !== "rejected" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-600"
                    onClick={() => setStatus(detailTarget, "rejected")}
                  >
                    <XCircle className="mr-1 h-3.5 w-3.5" />
                    Reject
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-destructive"
                  onClick={() => deleteMut.mutate(detailTarget.id)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function issueType(t: string): string {
  return issueInfo(t).label;
}
