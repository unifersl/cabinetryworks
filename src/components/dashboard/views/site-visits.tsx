"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { siteVisitsApi, jobsApi, type SiteVisit } from "@/lib/api";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ClipboardList,
  Plus,
  Loader2,
  Trash2,
  MapPin,
  ClipboardCheck,
  Wrench,
  Handshake,
  Search,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui-helpers";

const PURPOSES = [
  {
    value: "inspection",
    label: "Inspection",
    icon: Search,
    tint: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  },
  {
    value: "measurement",
    label: "Measurement",
    icon: ClipboardCheck,
    tint: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  },
  {
    value: "meeting",
    label: "Meeting",
    icon: Handshake,
    tint: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  },
  {
    value: "handover",
    label: "Handover",
    icon: MapPin,
    tint: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  },
  {
    value: "other",
    label: "Other",
    icon: Wrench,
    tint: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  },
];

function purposeInfo(p: string) {
  return PURPOSES.find((x) => x.value === p) ?? PURPOSES[PURPOSES.length - 1];
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

interface VisitFormState {
  jobId: string;
  visitorName: string;
  visitDate: string;
  purpose: string;
  observations: string;
}

const EMPTY_FORM: VisitFormState = {
  jobId: "",
  visitorName: "",
  visitDate: new Date().toISOString().slice(0, 10),
  purpose: "inspection",
  observations: "",
};

export function SiteVisitsView() {
  const qc = useQueryClient();
  const [jobFilter, setJobFilter] = React.useState<"all" | string>("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<SiteVisit | null>(null);
  const [form, setForm] = React.useState<VisitFormState>(EMPTY_FORM);

  const { data: jobsData } = useQuery({
    queryKey: ["jobs", "for-visits"],
    queryFn: () => jobsApi.list(),
  });
  const jobs: JobLite[] = (jobsData as { jobs?: JobLite[] })?.jobs ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["site-visits", jobFilter],
    queryFn: () =>
      siteVisitsApi.list({
        jobId: jobFilter === "all" ? undefined : jobFilter,
      }),
  });
  const visits: SiteVisit[] = data?.visits ?? [];

  const createMut = useMutation({
    mutationFn: (payload: VisitFormState) =>
      siteVisitsApi.create({
        jobId: payload.jobId || null,
        visitorName: payload.visitorName,
        visitDate: payload.visitDate,
        purpose: payload.purpose,
        observations: payload.observations || undefined,
      }),
    onSuccess: () => {
      toast.success("Site visit logged");
      qc.invalidateQueries({ queryKey: ["site-visits"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to log"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => siteVisitsApi.remove(id),
    onSuccess: () => {
      toast.success("Visit deleted");
      qc.invalidateQueries({ queryKey: ["site-visits"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  function submit() {
    if (!form.visitorName.trim()) {
      toast.error("Visitor name is required");
      return;
    }
    createMut.mutate(form);
  }

  const stats = React.useMemo(
    () => ({
      total: visits.length,
      inspections: visits.filter((v) => v.purpose === "inspection").length,
      measurements: visits.filter((v) => v.purpose === "measurement").length,
      handovers: visits.filter((v) => v.purpose === "handover").length,
    }),
    [visits]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <ClipboardList className="h-5 w-5 text-primary" />
            Site Visit Log
          </h1>
          <p className="text-xs text-muted-foreground">
            Track every on-site visit — observations &amp; follow-ups.
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
            Log Visit
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total visits</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-sky-500/10 p-2">
              <Search className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.inspections}</p>
              <p className="text-xs text-muted-foreground">Inspections</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.measurements}</p>
              <p className="text-xs text-muted-foreground">Measurements</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-violet-500/10 p-2">
              <MapPin className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.handovers}</p>
              <p className="text-xs text-muted-foreground">Handovers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Visit Timeline</CardTitle>
          <CardDescription className="text-xs">
            {visits.length} visit{visits.length === 1 ? "" : "s"} logged
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : visits.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No site visits logged"
              description="Log inspections, measurements, meetings and handovers."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Log Visit
                </Button>
              }
            />
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-6">
              {visits.map((v) => {
                const pi = purposeInfo(v.purpose);
                const Icon = pi.icon;
                return (
                  <li key={v.id} className="relative">
                    <span
                      className={`absolute -left-[1.6rem] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background ${pi.tint}`}
                    >
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                    <div className="rounded-md border border-border bg-background p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {v.visitorName}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              · {fmtDate(v.visitDate)}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {v.job?.orderNumber ?? "No linked job"}
                            {v.job?.title ? ` — ${v.job.title}` : ""}
                          </p>
                          {v.observations && (
                            <p className="mt-1 text-xs text-foreground/90">
                              {v.observations}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${pi.tint}`}
                          >
                            {pi.label}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setDeleting(v)}
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
            <DialogTitle>Log Site Visit</DialogTitle>
            <DialogDescription>
              Record an on-site visit with observations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Job (optional)</Label>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Visitor Name *</Label>
                <Input
                  placeholder="e.g. Siva Kumar"
                  className="h-9 text-sm"
                  value={form.visitorName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, visitorName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Visit Date</Label>
                <Input
                  type="date"
                  className="h-9 text-sm"
                  value={form.visitDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, visitDate: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Purpose</Label>
              <Select
                value={form.purpose}
                onValueChange={(v) => setForm((f) => ({ ...f, purpose: v }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURPOSES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observations</Label>
              <Textarea
                rows={4}
                placeholder="Site conditions, dimensions, issues found…"
                className="text-sm"
                value={form.observations}
                onChange={(e) =>
                  setForm((f) => ({ ...f, observations: e.target.value }))
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
              Log Visit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete site visit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the visit by
              {" "}
              <span className="font-medium text-foreground">
                {deleting?.visitorName}
              </span>{" "}
              on {fmtDate(deleting?.visitDate)}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMut.mutate(deleting.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
