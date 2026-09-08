"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobsApi } from "@/lib/api";
import type { JobOrder, JobStatus } from "@/lib/types";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus,
  GripVertical,
  Calendar,
  User as UserIcon,
  Ruler,
  Scissors,
  LayoutGrid,
  AlertCircle,
  ClipboardList,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui-helpers";

const COLUMNS: { status: JobStatus; label: string; color: string; bg: string }[] = [
  { status: "Pending", label: "Pending", color: "text-amber-700", bg: "bg-amber-500/5 border-amber-500/30" },
  { status: "Measured", label: "Measured", color: "text-sky-700", bg: "bg-sky-500/5 border-sky-500/30" },
  { status: "Design", label: "Design", color: "text-violet-700", bg: "bg-violet-500/5 border-violet-500/30" },
  { status: "In Production", label: "In Production", color: "text-orange-700", bg: "bg-orange-500/5 border-orange-500/30" },
  { status: "Cutting", label: "Cutting", color: "text-rose-700", bg: "bg-rose-500/5 border-rose-500/30" },
  { status: "Assembly", label: "Assembly", color: "text-teal-700", bg: "bg-teal-500/5 border-teal-500/30" },
  { status: "Installation", label: "Installation", color: "text-cyan-700", bg: "bg-cyan-500/5 border-cyan-500/30" },
  { status: "Completed", label: "Completed", color: "text-emerald-700", bg: "bg-emerald-500/5 border-emerald-500/30" },
];

const PRIORITY_DOT: Record<string, string> = {
  Low: "bg-zinc-400",
  Normal: "bg-sky-400",
  High: "bg-orange-500",
  Urgent: "bg-rose-500",
};

interface KanbanBoardProps {
  onJobClick?: (jobId: string) => void;
}

export function KanbanBoard({ onJobClick }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["jobs", "kanban"],
    queryFn: () => jobsApi.list(),
  });
  const jobs = data?.jobs ?? [];

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobStatus }) =>
      jobsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleDragStart(e: React.DragEvent, jobId: string) {
    setDraggedId(jobId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", jobId);
  }

  function handleDragOver(e: React.DragEvent, status: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(status);
  }

  function handleDrop(e: React.DragEvent, status: JobStatus) {
    e.preventDefault();
    setDragOverCol(null);
    const jobId = draggedId ?? e.dataTransfer.getData("text/plain");
    if (jobId) {
      const job = jobs.find((j) => j.id === jobId);
      if (job && job.status !== status) {
        updateStatus.mutate({ id: jobId, status });
        toast.success(`${job.orderNumber} → ${status}`, {
          description: job.title,
        });
      }
    }
    setDraggedId(null);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.slice(0, 6).map((col) => (
            <div key={col.status} className="w-72 shrink-0 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <LayoutGrid className="h-5 w-5 text-primary" />
            Production Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Drag job cards between columns to update their production status.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          {jobs.length} active jobs
        </Badge>
      </div>

      {/* Kanban columns */}
      {jobs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No jobs in the pipeline"
          description="Create your first job order to start tracking it through the production pipeline."
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-warm pb-4">
          {COLUMNS.map((col) => {
            const colJobs = jobs.filter((j) => j.status === col.status);
            return (
              <div
                key={col.status}
                className={`w-72 shrink-0 rounded-lg border-2 transition-colors ${
                  dragOverCol === col.status
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
                onDragOver={(e) => handleDragOver(e, col.status)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => handleDrop(e, col.status)}
              >
                {/* Column header */}
                <div className={`flex items-center justify-between rounded-t-md border-b-2 ${col.bg} px-3 py-2.5`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${col.color.replace("text-", "bg-")}`} />
                    <span className={`text-sm font-semibold ${col.color}`}>
                      {col.label}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {colJobs.length}
                  </Badge>
                </div>

                {/* Cards */}
                <div className="space-y-2 p-2 min-h-[120px]">
                  {colJobs.length === 0 ? (
                    <div className="flex flex-col items-center gap-1 py-8 text-center">
                      <Plus className="h-5 w-5 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground/50">
                        Drop jobs here
                      </p>
                    </div>
                  ) : (
                    colJobs.map((job) => (
                      <KanbanCard
                        key={job.id}
                        job={job}
                        onDragStart={(e) => handleDragStart(e, job.id)}
                        onDragEnd={() => setDraggedId(null)}
                        onClick={() => onJobClick?.(job.id)}
                        isDragging={draggedId === job.id}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <span className="font-medium">Priority:</span>
        {Object.entries(PRIORITY_DOT).map(([p, color]) => (
          <span key={p} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${color}`} />
            {p}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" />
          Tip: drag cards between columns to move jobs through the pipeline
        </span>
      </div>
    </div>
  );
}

function KanbanCard({
  job,
  onDragStart,
  onDragEnd,
  onClick,
  isDragging,
}: {
  job: JobOrder;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick?: () => void;
  isDragging?: boolean;
}) {
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group cursor-pointer border-border/80 transition-all hover:border-primary/40 hover:shadow-md ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] text-primary">
              {job.orderNumber}
            </p>
            <p className="truncate text-sm font-medium leading-tight">
              {job.title}
            </p>
          </div>
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${PRIORITY_DOT[job.priority] ?? "bg-zinc-400"}`}
            title={`${job.priority} priority`}
          />
          <span className="truncate text-xs text-muted-foreground">
            {job.customer?.name ?? "—"}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            {job.assignedTo && (
              <span className="flex items-center gap-0.5">
                <UserIcon className="h-3 w-3" />
                {job.assignedTo.fullName.split(" ")[0]}
              </span>
            )}
            {(job._count?.measurements ?? 0) > 0 && (
              <span className="flex items-center gap-0.5">
                <Ruler className="h-3 w-3" />
                {job._count?.measurements}
              </span>
            )}
            {(job._count?.cuttingLists ?? 0) > 0 && (
              <span className="flex items-center gap-0.5">
                <Scissors className="h-3 w-3" />
                {job._count?.cuttingLists}
              </span>
            )}
          </div>
          {job.deliveryDate && (
            <span className="flex items-center gap-0.5">
              <Calendar className="h-3 w-3" />
              {new Date(job.deliveryDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
