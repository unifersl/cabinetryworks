"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobsApi, measurementsApi, cuttingListsApi } from "@/lib/api";
import type { JobStatus } from "@/lib/types";
import { useAuth } from "@/components/providers";
import { JobDetailSheet } from "../jobs/job-detail-sheet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Calendar,
  Ruler,
  Scissors,
  User as UserIcon,
  Loader2,
  ClipboardList,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui-helpers";

const STATUS_BADGE: Record<string, string> = {
  Pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  Measured: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  Design: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  "In Production": "bg-orange-500/15 text-orange-700 border-orange-500/30",
  Cutting: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  Assembly: "bg-teal-500/15 text-teal-700 border-teal-500/30",
  Installation: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30",
  Completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  Cancelled: "bg-zinc-500/15 text-zinc-600 border-zinc-500/30",
};

const STATUSES: JobStatus[] = [
  "Pending",
  "Measured",
  "Design",
  "In Production",
  "Cutting",
  "Assembly",
  "Installation",
  "Completed",
  "Cancelled",
];

export function MyJobsView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["my-jobs", user?.id],
    queryFn: () => jobsApi.list({ assignedToId: user?.id }),
    enabled: !!user?.id,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobStatus }) =>
      jobsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const jobs = data?.jobs ?? [];

  // Quick stats for technician
  const stats = {
    total: jobs.length,
    active: jobs.filter(
      (j) => j.status !== "Completed" && j.status !== "Cancelled"
    ).length,
    completed: jobs.filter((j) => j.status === "Completed").length,
    measurements: jobs.reduce((s, j) => s + (j._count?.measurements ?? 0), 0),
    cuttingLists: jobs.reduce((s, j) => s + (j._count?.cuttingLists ?? 0), 0),
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight">My Assigned Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Jobs assigned to you, {user?.fullName.split(" ")[0]}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Total" value={stats.total} />
        <MiniStat label="Active" value={stats.active} />
        <MiniStat label="Measurements" value={stats.measurements} />
        <MiniStat label="Cut Lists" value={stats.cuttingLists} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading your jobs…
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={ClipboardList}
              title="No jobs assigned to you"
              description="Jobs assigned by an admin will appear here."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {jobs.map((job) => (
            <Card
              key={job.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => {
                setSelectedJobId(job.id);
                setDetailOpen(true);
              }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="font-mono text-xs text-primary">
                        {job.orderNumber}
                      </span>
                      {job.title}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {job.customer?.name}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className={STATUS_BADGE[job.status]}>
                    {job.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5" />
                    {job.priority} priority
                  </div>
                  {job.deliveryDate && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(job.deliveryDate).toLocaleDateString()}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Ruler className="h-3.5 w-3.5" />
                    {job._count?.measurements ?? 0} measurements
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Scissors className="h-3.5 w-3.5" />
                    {job._count?.cuttingLists ?? 0} cut lists
                  </div>
                </div>
                {job.description && (
                  <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                    {job.description}
                  </p>
                )}
                <div
                  className="flex items-center gap-2 pt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Select
                    value={job.status}
                    onValueChange={(v) =>
                      updateStatus.mutate({
                        id: job.id,
                        status: v as JobStatus,
                      })
                    }
                    disabled={updateStatus.isPending}
                  >
                    <SelectTrigger className="h-8 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <JobDetailSheet
        jobId={selectedJobId}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setSelectedJobId(null);
        }}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
