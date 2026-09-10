"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { jobsApi, measurementsApi, cuttingListsApi, usersApi } from "@/lib/api";
import type { JobStatus, Priority, CuttingListItem } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/components/providers";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  X,
  Loader2,
  Calendar,
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  Ruler,
  Scissors,
  ClipboardList,
  Clock,
  FileText,
  Package,
  ArrowDownToLine,
  DoorOpen,
  Printer,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Archive,
  RotateCcw,
} from "lucide-react";

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
const PRIORITIES: Priority[] = ["Low", "Normal", "High", "Urgent"];

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

const PRIORITY_BADGE: Record<string, string> = {
  Low: "bg-zinc-500/10 text-zinc-600",
  Normal: "bg-sky-500/10 text-sky-600",
  High: "bg-orange-500/10 text-orange-600",
  Urgent: "bg-rose-500/10 text-rose-600",
};

export function JobDetailSheet({
  jobId,
  open,
  onOpenChange,
}: {
  jobId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === "Admin" || user?.role === "SuperAdmin";
  const isMobile = useIsMobile();

  const { data, isLoading } = useQuery({
    queryKey: ["job-detail", jobId],
    queryFn: () => jobsApi.get(jobId!),
    enabled: !!jobId && open,
  });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
    enabled: canEdit && open,
  });
  const technicians = (usersData?.users ?? []).filter(
    (u) => u.role === "Technician" && u.status === "active"
  );

  const job = data?.job;

  async function patchJob(patch: Record<string, unknown>) {
    if (!jobId) return;
    try {
      await jobsApi.update(jobId, patch as Parameters<typeof jobsApi.update>[1]);
      queryClient.invalidateQueries({ queryKey: ["job-detail", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
      toast.success("Job updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function deleteMeasurement(id: string) {
    try {
      await measurementsApi.remove(id);
      queryClient.invalidateQueries({ queryKey: ["job-detail", jobId] });
      queryClient.invalidateQueries({ queryKey: ["measurements"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Measurement deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function deleteCuttingList(id: string) {
    try {
      await cuttingListsApi.remove(id);
      queryClient.invalidateQueries({ queryKey: ["job-detail", jobId] });
      queryClient.invalidateQueries({ queryKey: ["cutting-lists"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Cutting list deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function deleteJob() {
    if (!jobId) return;
    try {
      await jobsApi.remove(jobId);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
      toast.success("Job deleted");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function exportCuttingListCsv(items: CuttingListItem[], panelName: string) {
    const headers = ["Part", "Qty", "Length", "Width", "Thickness", "Edge Banding"];
    const rows = items.map((i) => [
      i.part,
      i.qty,
      i.length,
      i.width,
      i.thickness,
      i.edge ?? "",    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cutting-list-${panelName ?? "list"}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Cutting list exported as CSV");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "overflow-y-auto scrollbar-warm p-0",
          isMobile ? "h-[90vh] rounded-t-xl" : "w-full sm:max-w-2xl",
        )}
      >
        <SheetTitle className="sr-only">Job details</SheetTitle>
        {isLoading || !job ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="border-b border-border bg-gradient-to-br from-primary/5 to-background p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-primary">
                    {job.orderNumber}
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold leading-tight">
                    {job.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={STATUS_BADGE[job.status]}>
                      {job.status}
                    </Badge>
                    <Badge variant="outline" className={PRIORITY_BADGE[job.priority]}>
                      {job.priority} priority
                    </Badge>
                    {job.archived && (
                      <Badge className="bg-zinc-500/15 text-zinc-600 border-zinc-500/30">
                        <Archive className="mr-1 h-3 w-3" />
                        Archived
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() =>
                          patchJob({ archived: !job.archived })
                        }
                      >
                        {job.archived ? (
                          <>
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restore
                          </>
                        ) : (
                          <>
                            <Archive className="h-3.5 w-3.5" />
                            Archive
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Delete ${job.orderNumber}? This cannot be undone.`)) {
                            deleteJob();
                          }
                        }}
                        aria-label="Delete job"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex-1 overflow-y-auto scrollbar-warm">
              <Tabs defaultValue="overview" className="w-full">
                <div className="sticky top-0 z-10 overflow-x-auto scrollbar-warm bg-card px-3">
                  <TabsList className="flex h-auto w-max justify-start rounded-none border-b border-border bg-transparent p-0">
                    <TabsTrigger value="overview" className="gap-1.5 whitespace-nowrap flex-shrink-0">
                      <ClipboardList className="h-3.5 w-3.5" />
                      Overview
                    </TabsTrigger>
                    <TabsTrigger value="measurements" className="gap-1.5 whitespace-nowrap flex-shrink-0">
                      <Ruler className="h-3.5 w-3.5" />
                      Measurements
                      <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] font-medium">
                        {job.measurements.length}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="cutting" className="gap-1.5 whitespace-nowrap flex-shrink-0">
                      <Scissors className="h-3.5 w-3.5" />
                      Cutting Lists
                      <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] font-medium">
                        {job.cuttingLists.length}
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Overview tab */}
                <TabsContent value="overview" className="space-y-4 p-5">
                  {canEdit && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Status
                        </label>
                        <Select
                          value={job.status}
                          onValueChange={(v) => patchJob({ status: v })}
                        >
                          <SelectTrigger className="h-9">
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
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Priority
                        </label>
                        <Select
                          value={job.priority}
                          onValueChange={(v) =>
                            patchJob({ priority: v as Priority })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITIES.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {canEdit && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Assigned Technician
                      </label>
                      <Select
                        value={job.assignedToId ?? "__unassigned"}
                        onValueChange={(v) =>
                          patchJob({
                            assignedToId: v === "__unassigned" ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unassigned">
                            Unassigned
                          </SelectItem>
                          {technicians.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Customer card */}
                  {job.customer && (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <UserIcon className="h-3.5 w-3.5" />
                        CUSTOMER
                      </div>
                      <p className="font-medium">{job.customer.name}</p>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {job.customer.phone && (
                          <p className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5" />
                            {job.customer.phone}
                          </p>
                        )}
                        {job.customer.email && (
                          <p className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5" />
                            {job.customer.email}
                          </p>
                        )}
                        {job.customer.address && (
                          <p className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5" />
                            {job.customer.address}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-3">
                    <InfoTile
                      icon={Calendar}
                      label="Created"
                      value={new Date(job.createdAt ?? "").toLocaleDateString()}
                    />
                    <InfoTile
                      icon={Clock}
                      label="Delivery"
                      value={
                        job.deliveryDate
                          ? new Date(job.deliveryDate).toLocaleDateString()
                          : "Not set"
                      }
                    />
                  </div>

                  {job.description && (
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        DESCRIPTION
                      </div>
                      <p className="text-sm leading-relaxed">{job.description}</p>
                    </div>
                  )}

                  {/* Status Stepper */}
                  <div>
                    <h3 className="mb-3 text-sm font-medium">Production Pipeline</h3>
                    <StatusStepper
                      currentStatus={job.status}
                      onStepClick={(status) => canEdit && patchJob({ status })}
                      canEdit={canEdit}
                    />
                  </div>

                  {/* Activity timeline */}
                  <div>
                    <h3 className="mb-3 text-sm font-medium">Activity Timeline</h3>
                    <div className="space-y-3">
                      <TimelineItem
                        icon={Plus}
                        title="Job created"
                        time={job.createdAt}
                        done
                      />
                      {job.measurements.length > 0 && (
                        <TimelineItem
                          icon={Ruler}
                          title="Site measurement captured"
                          time={job.measurements[0].createdAt}
                          done
                        />
                      )}
                      {job.cuttingLists.length > 0 && (
                        <TimelineItem
                          icon={Scissors}
                          title="Cutting list generated"
                          time={job.cuttingLists[0].createdAt}
                          done
                        />
                      )}
                      {job.status === "Completed" && (
                        <TimelineItem
                          icon={CheckCircle2}
                          title="Job completed"
                          time={job.updatedAt}
                          done
                        />
                      )}
                      {job.status === "Cancelled" && (
                        <TimelineItem
                          icon={AlertCircle}
                          title="Job cancelled"
                          time={job.updatedAt}
                          done
                          danger
                        />
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Measurements tab */}
                <TabsContent value="measurements" className="p-5">
                  {job.measurements.length === 0 ? (
                    <EmptyState
                      icon={Ruler}
                      title="No measurements yet"
                      description="Site measurements captured for this job will appear here."
                    />
                  ) : (
                    <div className="space-y-3">
                      {job.measurements.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-lg border border-border bg-card p-4"
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="rounded-md bg-primary/10 p-1.5">
                                <DoorOpen className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {m.roomType ?? "Measurement"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  by {m.takenBy?.fullName ?? "Unknown"} ·{" "}
                                  {m.createdAt &&
                                    new Date(m.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge
                                variant="outline"
                                className={
                                  m.status === "Approved"
                                    ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                                    : m.status === "Submitted"
                                      ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                                      : "bg-zinc-500/15 text-zinc-600 border-zinc-500/30"
                                }
                              >
                                {m.status}
                              </Badge>
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  onClick={() => deleteMeasurement(m.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {m.wallLength && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Ruler className="h-3 w-3" />
                                <span className="font-medium text-foreground">
                                  {m.wallLength}
                                </span>
                              </div>
                            )}
                            {m.ceilingHt && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <ArrowDownToLine className="h-3 w-3" />
                                <span className="font-medium text-foreground">
                                  {m.ceilingHt}
                                </span>
                              </div>
                            )}
                          </div>
                          {m.notes && (
                            <p className="mt-2 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
                              {m.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Cutting lists tab */}
                <TabsContent value="cutting" className="p-5">
                  {job.cuttingLists.length === 0 ? (
                    <EmptyState
                      icon={Scissors}
                      title="No cutting lists yet"
                      description="Factory-ready cut lists generated for this job will appear here."
                    />
                  ) : (
                    <div className="space-y-4">
                      {job.cuttingLists.map((cl) => {
                        let items: CuttingListItem[] = [];
                        try {
                          items = cl.items ? JSON.parse(cl.items) : [];
                        } catch {
                          items = [];
                        }
                        const totalPieces = items.reduce(
                          (s, i) => s + (Number(i.qty) || 0),
                          0
                        );
                        return (
                          <div
                            key={cl.id}
                            className="rounded-lg border border-border bg-card"
                          >
                            <div className="flex items-center justify-between gap-2 border-b border-border p-4">
                              <div className="flex items-center gap-2">
                                <div className="rounded-md bg-primary/10 p-1.5">
                                  <Package className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">
                                    {cl.panelName ?? "Cutting List"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {cl.material} · {items.length} parts ·{" "}
                                    {totalPieces} pieces
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Badge
                                  variant="outline"
                                  className={
                                    cl.status === "Done"
                                      ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                                      : cl.status === "In Cutting"
                                        ? "bg-rose-500/15 text-rose-700 border-rose-500/30"
                                        : "bg-amber-500/15 text-amber-700 border-amber-500/30"
                                  }
                                >
                                  {cl.status}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    exportCuttingListCsv(
                                      items,
                                      cl.panelName ?? "list"
                                    )
                                  }
                                  title="Export CSV"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </Button>
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                    onClick={() => deleteCuttingList(cl.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="h-8 text-xs">Part</TableHead>
                                    <TableHead className="h-8 text-center text-xs">Qty</TableHead>
                                    <TableHead className="h-8 text-xs">Length</TableHead>
                                    <TableHead className="h-8 text-xs">Width</TableHead>
                                    <TableHead className="h-8 text-xs">Thk</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {items.map((it, i) => (
                                    <TableRow key={i}>
                                      <TableCell className="py-1.5 text-xs font-medium">
                                        {it.part}
                                      </TableCell>
                                      <TableCell className="py-1.5 text-center text-xs tabular-nums">
                                        {it.qty}
                                      </TableCell>
                                      <TableCell className="py-1.5 text-xs tabular-nums">
                                        {it.length}
                                      </TableCell>
                                      <TableCell className="py-1.5 text-xs tabular-nums">
                                        {it.width}
                                      </TableCell>
                                      <TableCell className="py-1.5 text-xs tabular-nums">
                                        {it.thickness}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function TimelineItem({
  icon: Icon,
  title,
  time,
  done,
  danger,
}: {
  icon: typeof Calendar;
  title: string;
  time?: string | null;
  done?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full ${
            danger
              ? "bg-destructive/10 text-destructive"
              : done
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="mt-1 w-px flex-1 bg-border" />
      </div>
      <div className="pb-3">
        <p className="text-sm font-medium">{title}</p>
        {time && (
          <p className="text-xs text-muted-foreground">
            {new Date(time).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Ruler;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <div className="rounded-full bg-muted p-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

const PIPELINE_STEPS: { status: JobStatus; label: string; short: string }[] = [
  { status: "Pending", label: "Pending", short: "1" },
  { status: "Measured", label: "Measured", short: "2" },
  { status: "Design", label: "Design", short: "3" },
  { status: "In Production", label: "Production", short: "4" },
  { status: "Cutting", label: "Cutting", short: "5" },
  { status: "Assembly", label: "Assembly", short: "6" },
  { status: "Installation", label: "Install", short: "7" },
  { status: "Completed", label: "Completed", short: "8" },
];

function StatusStepper({
  currentStatus,
  onStepClick,
  canEdit,
}: {
  currentStatus: JobStatus;
  onStepClick: (status: JobStatus) => void;
  canEdit?: boolean;
}) {
  const currentIndex = PIPELINE_STEPS.findIndex((s) => s.status === currentStatus);
  const isCancelled = currentStatus === "Cancelled";

  return (
    <div className="overflow-x-auto scrollbar-warm">
      <div className="flex min-w-[560px] items-start gap-0">
        {PIPELINE_STEPS.map((step, i) => {
          const isCompleted = !isCancelled && i < currentIndex;
          const isCurrent = !isCancelled && i === currentIndex;
          const isLast = i === PIPELINE_STEPS.length - 1;

          return (
            <div key={step.status} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {/* Connector line before */}
                {i > 0 && (
                  <div
                    className={`h-0.5 flex-1 ${
                      isCompleted || isCurrent
                        ? "bg-primary"
                        : "bg-border"
                    }`}
                  />
                )}
                {/* Step circle */}
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => onStepClick(step.status)}
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                    isCancelled
                      ? "border-zinc-300 bg-zinc-100 text-zinc-400"
                      : isCompleted
                        ? "border-primary bg-primary text-primary-foreground"
                        : isCurrent
                          ? "border-primary bg-primary/10 text-primary ring-4 ring-primary/10"
                          : "border-border bg-card text-muted-foreground"
                  } ${canEdit ? "cursor-pointer hover:scale-110" : "cursor-default"}`}
                  title={canEdit ? `Move to ${step.label}` : step.label}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isCancelled ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    step.short
                  )}
                </button>
                {/* Connector line after */}
                {!isLast && (
                  <div
                    className={`h-0.5 flex-1 ${
                      isCompleted ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
              {/* Label */}
              <span
                className={`mt-1.5 text-[10px] font-medium leading-tight ${
                  isCurrent
                    ? "text-primary"
                    : isCompleted
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      {isCancelled && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
          <AlertCircle className="h-3.5 w-3.5" />
          This job was cancelled
        </p>
      )}
    </div>
  );
}
