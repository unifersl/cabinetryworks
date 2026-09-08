"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobsApi, customersApi, usersApi, bulkApi, materialRequirementsApi } from "@/lib/api";
import type { JobOrder, JobStatus, Priority } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useAuth } from "@/components/providers";
import { JobManagementSheet } from "../jobs/job-management-sheet";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Loader2,
  ClipboardList,
  Calendar,
  User as UserIcon,
  Ruler,
  Scissors,
  Filter,
  X,
  ChevronRight,
  ChevronDown,
  Archive,
  Trash2,
  FileSpreadsheet,
  Upload,
  Download,
  LayoutGrid,
  Table as TableIcon,
  CalendarDays,
  Pencil,
  Copy,
  Eye,
  ArrowRightCircle,
  UserPlus,
  ChevronLeft,
  CircleAlert,
  MoreHorizontal,
  Boxes,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";

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

export function JobOrdersView({
  focusJobId,
  onFocusConsumed,
}: {
  focusJobId?: string | null;
  onFocusConsumed?: () => void;
} = {}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin" || user?.role === "SuperAdmin";
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | JobStatus>(
    "all"
  );
  const [priorityFilter, setPriorityFilter] = React.useState<"all" | Priority>(
    "all"
  );
  const [assignedFilter, setAssignedFilter] = React.useState<string>("all");
  const [viewMode, setViewMode] = React.useState<"table" | "board" | "calendar">(
    "table"
  );
  const [contextMenu, setContextMenu] = React.useState<{
    jobId: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  // Handle focus from global search
  React.useEffect(() => {
    if (focusJobId) {
      setSelectedJobId(focusJobId);
      setDetailOpen(true);
      onFocusConsumed?.();
    }
  }, [focusJobId, onFocusConsumed]);

  const [showArchived, setShowArchived] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const { data: jobsData, isLoading } = useQuery({
    queryKey: ["jobs", statusFilter, showArchived],
    queryFn: () =>
      jobsApi.list(
        showArchived
          ? { archived: true }
          : statusFilter === "all"
            ? undefined
            : { status: statusFilter }
      ),
  });

  const { data: customersData } = useQuery({
    queryKey: ["customers"],
    queryFn: customersApi.list,
  });
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  const jobs = jobsData?.jobs ?? [];
  const filtered = jobs.filter(
    (j) =>
      (!search ||
        j.title.toLowerCase().includes(search.toLowerCase()) ||
        j.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
        (j.customer?.name ?? "").toLowerCase().includes(search.toLowerCase())) &&
      (priorityFilter === "all" || j.priority === priorityFilter) &&
      (assignedFilter === "all" ||
        (assignedFilter === "unassigned" ? !j.assignedToId : j.assignedToId === assignedFilter))
  );

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (priorityFilter !== "all" ? 1 : 0) +
    (assignedFilter !== "all" ? 1 : 0) +
    (search ? 1 : 0) +
    (showArchived ? 1 : 0);

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setAssignedFilter("all");
    setShowArchived(false);
  }

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobStatus }) =>
      jobsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Job status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Undo-aware delete: optimistically remove + Undo toast (5s) ----
  const undoRef = React.useRef<{
    job: JobOrder;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);

  function deleteJobWithUndo(job: JobOrder) {
    const timeoutId = setTimeout(() => {
      jobsApi
        .remove(job.id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
          queryClient.invalidateQueries({ queryKey: ["stats"] });
        })
        .catch((e: unknown) => {
          toast.error("Failed to delete on server", {
            description: e instanceof Error ? e.message : "Unknown error",
          });
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
        });
      undoRef.current = null;
    }, 5000);
    undoRef.current = { job, timeoutId };

    // Optimistically remove from every jobs query (status filter / archived variants)
    queryClient.setQueriesData<{ jobs: JobOrder[] } | undefined>(
      { queryKey: ["jobs"] },
      (old) =>
        old
          ? { ...old, jobs: old.jobs.filter((j) => j.id !== job.id) }
          : old
    );

    toast(`Job ${job.orderNumber} deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          if (undoRef.current) {
            clearTimeout(undoRef.current.timeoutId);
            const restored = undoRef.current.job;
            queryClient.setQueriesData<{ jobs: JobOrder[] } | undefined>(
              { queryKey: ["jobs"] },
              (old) => {
                if (!old) return { jobs: [restored] };
                if (old.jobs.some((j) => j.id === restored.id)) return old;
                return { ...old, jobs: [restored, ...old.jobs] };
              }
            );
            toast.success("Job restored");
            undoRef.current = null;
          }
        },
      },
      duration: 5000,
    });
  }

  // ---- CSV Template / Import / Export ----
  function downloadJobTemplate() {
    const headers = ["Title", "Customer Name", "Status", "Priority", "Assigned To", "Description", "Delivery Date"];
    const sampleRows = [
      ["Kitchen Renovation", "John Smith", "Pending", "Normal", "technician", "Full kitchen refit", "2026-09-15"],
      ["Wardrobe Installation", "Jane Doe", "Design", "High", "technician", "3-door wardrobe", "2026-09-20"],
      ["Office Cabinetry", "ABC Corp", "In Production", "Urgent", "", "Reception desk + storage", "2026-08-30"],
    ];
    const csv = [headers.join(","), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "job-orders-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded — fill it and import back");
  }

  function exportJobsCsv() {
    const headers = ["Order Number", "Title", "Customer", "Status", "Priority", "Assigned To", "Delivery Date", "Created"];
    const rows = (jobsData?.jobs ?? []).map((j) => [
      j.orderNumber,
      j.title,
      j.customer?.name ?? "",
      j.status,
      j.priority,
      j.assignedTo?.fullName ?? "",
      j.deliveryDate ? new Date(j.deliveryDate).toLocaleDateString("en-GB") : "",
      new Date(j.createdAt ?? Date.now()).toLocaleDateString("en-GB"),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  function importJobsCsv(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result ?? "");
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error("CSV must have a header and at least one row");
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
      let imported = 0;
      let failed = 0;
      let customers = customersData?.customers ?? [];
      if (customers.length === 0) {
        try {
          const resp = await customersApi.list();
          customers = resp.customers;
        } catch { /* ignore */ }
      }
      const technicians = usersData?.users ?? [];
      const techMap = new Map(technicians.map((t) => [t.fullName.toLowerCase(), t.id]));

      for (const line of lines.slice(1)) {
        const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
        const get = (key: string) => {
          const idx = headers.indexOf(key);
          return idx >= 0 ? cells[idx] : "";
        };
        const title = get("title");
        const customerName = get("customer name") || get("customer");
        if (!title || !customerName) { failed++; continue; }
        const customer = customers.find((c) => c.name.toLowerCase() === customerName.toLowerCase());
        if (!customer) { failed++; continue; }
        const assignedTo = get("assigned to");
        const assignedToId = assignedTo ? (techMap.get(assignedTo.toLowerCase()) || "") : "";
        const statusVal = (get("status") as JobStatus) || "Pending";
        try {
          // The create endpoint intentionally omits `status` from its
          // payload type for security; we set it via a separate update
          // after the job is created, when the user picked a non-default
          // status in the import template.
          const created = await jobsApi.create({
            title,
            customerId: customer.id,
            assignedToId: assignedToId || undefined,
            priority: (get("priority") as Priority) || "Normal",
            description: get("description") || undefined,
            deliveryDate: get("delivery date") ? new Date(get("delivery date")).toISOString() : undefined,
          });
          if (statusVal && statusVal !== "Pending") {
            try {
              await jobsApi.update(created.job.id, { status: statusVal });
            } catch {
              /* best-effort status patch */
            }
          }
          imported++;
        } catch (e) {
          failed++;
          console.error("Import error:", e);
        }
      }
      toast.success(`Imported ${imported} job(s)${failed > 0 ? `, ${failed} failed` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    };
    reader.readAsText(file);
  }

  async function duplicateJob(jobId: string) {
    try {
      const original = jobs.find((j) => j.id === jobId);
      if (!original) {
        toast.error("Job not found");
        return;
      }
      const created = await jobsApi.create({
        title: `${original.title} (copy)`,
        customerId: original.customerId,
        priority: original.priority,
        description: original.description ?? undefined,
        deliveryDate: original.deliveryDate ?? undefined,
      });
      toast.success(`Duplicated as ${created.job.orderNumber}`, {
        description: created.job.title,
      });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to duplicate job");
    }
  }

  async function archiveJob(jobId: string, archive: boolean) {
    try {
      await jobsApi.update(jobId, { archived: archive });
      toast.success(archive ? "Job archived" : "Job restored");
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update job");
    }
  }

  // Close the right-click context menu on any outside click / scroll / Esc
  React.useEffect(() => {
    if (!contextMenu) return;
    function close() {
      setContextMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Job Orders</h1>
          <p className="text-sm text-muted-foreground">
            Track cabinetry production jobs through the full pipeline.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* View mode segmented control */}
          <div className="flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="View mode">
            {([
              { id: "table", label: "Table", icon: TableIcon },
              { id: "board", label: "Board", icon: LayoutGrid },
              { id: "calendar", label: "Calendar", icon: CalendarDays },
            ] as const).map((m) => {
              const Icon = m.icon;
              const active = viewMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setViewMode(m.id)}
                  className={`flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors sm:px-2.5 ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  aria-pressed={active}
                  title={`${m.label} view`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              );
            })}
          </div>
          <input
            type="file"
            accept=".csv"
            id="job-import"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJobsCsv(f);
              e.target.value = "";
            }}
          />
          {/* "More" dropdown — hidden on desktop where buttons are shown inline */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="sm:hidden">
                <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                More
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => document.getElementById("job-import")?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Import
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportJobsCsv}>
                <Download className="mr-2 h-4 w-4" /> Export
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadJobTemplate}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Import / Export / Template — hidden on mobile (via More dropdown) */}
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => document.getElementById("job-import")?.click()}>
            <Upload className="mr-1.5 h-4 w-4" /> Import
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={exportJobsCsv}>
            <Download className="mr-1.5 h-4 w-4" /> Export
          </Button>
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={downloadJobTemplate} title="Download CSV template with sample data">
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Template
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Job Order
          </Button>
        </div>
      </div>

      {/* Bulk action bar — sticky at bottom (full-width on mobile) */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-0 z-30 flex flex-wrap items-center gap-2 border-t border-primary/30 bg-primary/5 p-3 shadow-lg backdrop-blur sm:bottom-3 sm:rounded-lg sm:border">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">
              {selectedIds.size}
            </span>
            selected
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Select
              onValueChange={async (status) => {
                try {
                  await bulkApi.updateJobs([...selectedIds], "status", status);
                  toast.success(`${selectedIds.size} job(s) → ${status}`);
                  setSelectedIds(new Set());
                  queryClient.invalidateQueries({ queryKey: ["jobs"] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Bulk action failed");
                }
              }}
            >
              <SelectTrigger className="h-8 w-[150px]">
                <ArrowRightCircle className="mr-1.5 h-3.5 w-3.5" />
                <span className="text-xs">Set status…</span>
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              onValueChange={async (userId) => {
                try {
                  const target = userId === "unassigned" ? "" : userId;
                  await bulkApi.updateJobs([...selectedIds], "assign", target);
                  toast.success(
                    `${selectedIds.size} job(s) ${target ? "assigned" : "unassigned"}`
                  );
                  setSelectedIds(new Set());
                  queryClient.invalidateQueries({ queryKey: ["jobs"] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Bulk action failed");
                }
              }}
            >
              <SelectTrigger className="h-8 w-[160px]">
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                <span className="text-xs">Assign to…</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">— Unassigned —</SelectItem>
                {(usersData?.users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportJobsCsv()}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await bulkApi.updateJobs([...selectedIds], showArchived ? "restore" : "archive");
                  toast.success(`${selectedIds.size} job(s) ${showArchived ? "restored" : "archived"}`);
                  setSelectedIds(new Set());
                  queryClient.invalidateQueries({ queryKey: ["jobs"] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Bulk action failed");
                }
              }}
            >
              <Archive className="mr-1.5 h-3.5 w-3.5" />
              {showArchived ? "Restore" : "Archive"}
            </Button>
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {selectedIds.size} job(s) permanently?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all selected jobs and ALL their related data (time logs, transport, F&B, expenses, tools, stock movements, measurements, cutting lists, quotes). This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        let ok = 0;
                        let fail = 0;
                        for (const id of [...selectedIds]) {
                          try {
                            await jobsApi.remove(id);
                            ok++;
                          } catch {
                            fail++;
                          }
                        }
                        toast.success(`${ok} job(s) deleted${fail > 0 ? `, ${fail} failed` : ""}`);
                        setSelectedIds(new Set());
                        queryClient.invalidateQueries({ queryKey: ["jobs"] });
                      }}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Delete {selectedIds.size} Job(s)
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div>
                <CardTitle className="text-base">All Jobs</CardTitle>
                <CardDescription>{filtered.length} jobs</CardDescription>
              </div>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 gap-1">
                  <Filter className="h-3 w-3" />
                  {activeFilterCount} active
                </Badge>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search jobs…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-8 sm:w-56"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as "all" | JobStatus)}
                disabled={showArchived}
              >
                <SelectTrigger className="h-9 w-full sm:w-40">
                  <Filter className="mr-1.5 h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={priorityFilter}
                onValueChange={(v) => setPriorityFilter(v as "all" | Priority)}
              >
                <SelectTrigger className="h-9 w-full sm:w-36">
                  <CircleAlert className="mr-1.5 h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={assignedFilter}
                onValueChange={setAssignedFilter}
              >
                <SelectTrigger className="h-9 w-full sm:w-44">
                  <UserIcon className="mr-1.5 h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assignments</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {(usersData?.users ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={showArchived ? "default" : "outline"}
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => setShowArchived((s) => !s)}
              >
                <Archive className="h-3.5 w-3.5" />
                {showArchived ? "Showing archived" : "Archived"}
              </Button>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-1.5 text-muted-foreground"
                  onClick={clearFilters}
                  title="Clear all filters"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading jobs…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <ClipboardList className="h-7 w-7 text-primary" />
                {activeFilterCount > 0 && (
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <p className="font-medium">
                  {activeFilterCount > 0
                    ? "No jobs match your filters"
                    : "No job orders yet"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activeFilterCount > 0
                    ? "Try adjusting or clearing the active filters to see more jobs."
                    : "Create your first job order to start tracking cabinetry production."}
                </p>
              </div>
              {activeFilterCount > 0 ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="mr-1.5 h-4 w-4" />
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create your first job
                </Button>
              )}
            </div>
          ) : viewMode === "table" ? (
            <div className="max-h-[65vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          filtered.length > 0 &&
                          filtered.every((j) => selectedIds.has(j.id))
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds(new Set(filtered.map((j) => j.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="min-w-[140px]">Order</TableHead>
                    <TableHead className="min-w-[110px]">Customer</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[90px]">
                      Assigned
                    </TableHead>
                    <TableHead className="min-w-[80px]">Priority</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="hidden sm:table-cell min-w-[90px]">
                      Deliver
                    </TableHead>
                    <TableHead className="text-right min-w-[52px]">Manage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((job, idx) => (
                    <TableRow
                      key={job.id}
                      className={`cursor-pointer hover:bg-muted/50 ${idx % 2 === 1 ? "bg-muted/40" : ""}`}
                      onClick={() => {
                        setSelectedJobId(job.id);
                        setDetailOpen(true);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ jobId: job.id, x: e.clientX, y: e.clientY });
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(job.id)}
                          onCheckedChange={(checked) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(job.id);
                              else next.delete(job.id);
                              return next;
                            });
                          }}
                          aria-label={`Select ${job.orderNumber}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-mono text-xs text-primary">
                            {job.orderNumber}
                          </p>
                          <p className="text-sm font-medium">{job.title}</p>
                          {(job._count?.measurements ||
                            job._count?.cuttingLists) && (
                            <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
                              {job._count?.measurements ? (
                                <span className="flex items-center gap-1">
                                  <Ruler className="h-3 w-3" />
                                  {job._count.measurements}
                                </span>
                              ) : null}
                              {job._count?.cuttingLists ? (
                                <span className="flex items-center gap-1">
                                  <Scissors className="h-3 w-3" />
                                  {job._count.cuttingLists}
                                </span>
                              ) : null}
                            </div>
                          )}
                          <JobStockStatusBadge jobId={job.id} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium">
                            {job.customer?.name ?? "—"}
                          </p>
                          {job.customer?.phone && (
                            <p className="text-xs text-muted-foreground">
                              {job.customer.phone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {job.assignedTo ? (
                          <span className="flex items-center gap-1.5 text-xs">
                            <UserIcon className="h-3 w-3 text-muted-foreground" />
                            {job.assignedTo.fullName}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={PRIORITY_BADGE[job.priority]}
                        >
                          {job.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_BADGE[job.status]}
                        >
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                        {job.deliveryDate ? (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(job.deliveryDate).toLocaleDateString()}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                                title="More actions"
                                aria-label={`More actions for job ${job.orderNumber}`}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {job.orderNumber}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedJobId(job.id);
                                  setDetailOpen(true);
                                }}
                                className="gap-2 text-xs"
                              >
                                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                View / edit details
                                <DropdownMenuShortcut>⏎</DropdownMenuShortcut>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => duplicateJob(job.id)}
                                className="gap-2 text-xs"
                              >
                                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                Duplicate
                                <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  archiveJob(job.id, !showArchived)
                                }
                                className="gap-2 text-xs"
                              >
                                <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                                {showArchived ? "Restore" : "Archive"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="gap-2 text-xs">
                                  <ArrowRightCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                  Edit status
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-44">
                                  {STATUSES.map((s) => (
                                    <DropdownMenuItem
                                      key={s}
                                      onClick={() =>
                                        updateStatus.mutate({
                                          id: job.id,
                                          status: s as JobStatus,
                                        })
                                      }
                                      disabled={
                                        s === job.status ||
                                        updateStatus.isPending
                                      }
                                      className="gap-2 text-xs"
                                    >
                                      <span
                                        className="h-2 w-2 rounded-full"
                                        style={{
                                          backgroundColor:
                                            s === job.status
                                              ? "var(--primary)"
                                              : "transparent",
                                        }}
                                      />
                                      {s}
                                      {s === job.status && (
                                        <DropdownMenuShortcut>
                                          current
                                        </DropdownMenuShortcut>
                                      )}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem
                                        onSelect={(e) => e.preventDefault()}
                                        className="gap-2 text-xs text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                        <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete job {job.orderNumber}?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will delete the job and its related data (time logs, transport, F&B, expenses, tool issues/returns, stock movements, measurements, cutting lists, quotes). You can undo this from the toast that appears for 5 seconds.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          onClick={() => {
                                            deleteJobWithUndo(job);
                                          }}
                                        >
                                          <Trash2 className="mr-1.5 h-4 w-4" />
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : viewMode === "board" ? (
            <BoardView
              jobs={filtered}
              selectedIds={selectedIds}
              onToggleSelect={(id) =>
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onJobClick={(id) => {
                setSelectedJobId(id);
                setDetailOpen(true);
              }}
              onStatusChange={(id, status) =>
                updateStatus.mutate({ id, status })
              }
              onContextMenu={(id, x, y) =>
                setContextMenu({ jobId: id, x, y })
              }
            />
          ) : (
            <CalendarView
              jobs={filtered}
              onJobClick={(id) => {
                setSelectedJobId(id);
                setDetailOpen(true);
              }}
              onContextMenu={(id, x, y) =>
                setContextMenu({ jobId: id, x, y })
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Right-click context menu (portal-free, fixed position) */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          job={jobs.find((j) => j.id === contextMenu.jobId)}
          isAdmin={isAdmin}
          showArchived={showArchived}
          onClose={() => setContextMenu(null)}
          onView={(id) => {
            setSelectedJobId(id);
            setDetailOpen(true);
            setContextMenu(null);
          }}
          onDuplicate={(id) => {
            duplicateJob(id);
            setContextMenu(null);
          }}
          onArchive={(id, archive) => {
            archiveJob(id, archive);
            setContextMenu(null);
          }}
          onSetStatus={(id, status) => {
            updateStatus.mutate({ id, status });
            setContextMenu(null);
          }}
          onDelete={(id) => {
            // Close the context menu and trigger the undo-aware delete.
            setContextMenu(null);
            const job = jobs.find((j) => j.id === id);
            if (!job) {
              toast.error("Job not found");
              return;
            }
            if (
              window.confirm(
                "Delete this job? You can undo this from the toast that appears for 5 seconds."
              )
            ) {
              deleteJobWithUndo(job);
            }
          }}
        />
      )}

      <CreateJobDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        customers={customersData?.customers ?? []}
        technicians={usersData?.users.filter((u) => u.role === "Technician") ?? []}
      />

      <JobManagementSheet
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

function CreateJobDialog({
  open,
  onOpenChange,
  customers,
  technicians,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customers: { id: string; name: string }[];
  technicians: { id: string; fullName: string }[];
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState("");
  const [customerId, setCustomerId] = React.useState("");
  const [assignedToId, setAssignedToId] = React.useState("");
  const [priority, setPriority] = React.useState<Priority>("Normal");
  const [deliveryDate, setDeliveryDate] = React.useState("");
  const [description, setDescription] = React.useState("");

  // Dirty state: true if any field has been changed from defaults
  const isDirty = React.useMemo(() => {
    return (
      title.trim() !== "" ||
      customerId !== "" ||
      assignedToId !== "" ||
      priority !== "Normal" ||
      deliveryDate !== "" ||
      description.trim() !== ""
    );
  }, [title, customerId, assignedToId, priority, deliveryDate, description]);

  // beforeunload warning when there are unsaved changes
  React.useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // Intercept close attempts to warn user about unsaved changes
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next && isDirty) {
        const ok = window.confirm(
          "You have unsaved changes. Close anyway? Your edits will be lost."
        );
        if (!ok) return;
      }
      onOpenChange(next);
    },
    [isDirty, onOpenChange]
  );

  const create = useMutation({
    mutationFn: () =>
      jobsApi.create({
        title: title.trim(),
        customerId,
        assignedToId: assignedToId || undefined,
        priority,
        deliveryDate: deliveryDate || undefined,
        description: description || undefined,
      }),
    onSuccess: (data) => {
      toast.success("Job order created", {
        description: `${data.job.orderNumber} — ${data.job.title}`,
      });
      setTitle("");
      setCustomerId("");
      setAssignedToId("");
      setPriority("Normal");
      setDeliveryDate("");
      setDescription("");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[500px] max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-warm">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>New Job Order</DialogTitle>
              <DialogDescription>
                Create a new cabinetry production job.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !customerId) {
              toast.error("Title and customer are required");
              return;
            }
            create.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="job-title">
              Job Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="job-title"
              placeholder="e.g. Kitchen renovation — Oak cabinets"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>
                Customer <span className="text-destructive">*</span>
              </Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {customers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No customers yet — add one first.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Assign Technician</Label>
              <Select
                value={assignedToId}
                onValueChange={setAssignedToId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Priority)}
              >
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label htmlFor="job-delivery">Delivery Date</Label>
              <Input
                id="job-delivery"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-desc">Description</Label>
            <Textarea
              id="job-desc"
              placeholder="Scope, materials, special instructions…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create Job
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Board View — simple inline kanban ============ */
const BOARD_COLUMNS: { status: JobStatus; tint: string; dot: string }[] = [
  { status: "Pending", tint: "border-amber-500/40 bg-amber-500/5", dot: "bg-amber-500" },
  { status: "In Production", tint: "border-orange-500/40 bg-orange-500/5", dot: "bg-orange-500" },
  { status: "Cutting", tint: "border-rose-500/40 bg-rose-500/5", dot: "bg-rose-500" },
  { status: "Completed", tint: "border-emerald-500/40 bg-emerald-500/5", dot: "bg-emerald-500" },
];

function BoardView({
  jobs,
  selectedIds,
  onToggleSelect,
  onJobClick,
  onStatusChange,
  onContextMenu,
}: {
  jobs: JobOrder[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onJobClick: (id: string) => void;
  onStatusChange: (id: string, status: JobStatus) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
}) {
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
      {BOARD_COLUMNS.map((col) => {
        const colJobs = jobs.filter((j) => j.status === col.status);
        return (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(col.status);
            }}
            onDragLeave={() => setDragOver((c) => (c === col.status ? null : c))}
            onDrop={() => {
              if (draggedId) {
                onStatusChange(draggedId, col.status);
                setDraggedId(null);
              }
              setDragOver(null);
            }}
            className={`flex max-h-[65vh] flex-col rounded-lg border p-2 transition-colors ${col.tint} ${
              dragOver === col.status ? "ring-2 ring-primary/40" : ""
            }`}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <span className="text-xs font-semibold">{col.status}</span>
              </div>
              <span className="rounded-full bg-card px-1.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                {colJobs.length}
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto scrollbar-warm pr-1">
              {colJobs.length === 0 ? (
                <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-border/60 text-[10px] text-muted-foreground">
                  Drop here
                </div>
              ) : (
                colJobs.map((job) => {
                  const selected = selectedIds.has(job.id);
                  return (
                    <div
                      key={job.id}
                      draggable
                      onDragStart={() => setDraggedId(job.id)}
                      onDragEnd={() => setDraggedId(null)}
                      onClick={() => onJobClick(job.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onContextMenu(job.id, e.clientX, e.clientY);
                      }}
                      className={`group cursor-pointer rounded-md border bg-card p-2 text-left shadow-sm transition-all hover:shadow-md ${
                        selected ? "border-primary ring-1 ring-primary/40" : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[10px] text-primary">
                            {job.orderNumber}
                          </p>
                          <p className="truncate text-xs font-medium">
                            {job.title}
                          </p>
                        </div>
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => onToggleSelect(job.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${job.orderNumber}`}
                          className="h-3.5 w-3.5"
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={`h-4 px-1 text-[9px] ${PRIORITY_BADGE[job.priority]}`}
                        >
                          {job.priority}
                        </Badge>
                        {job.assignedTo ? (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <UserIcon className="h-2.5 w-2.5" />
                            {job.assignedTo.fullName.split(" ")[0]}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </div>
                      {job.deliveryDate && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Calendar className="h-2.5 w-2.5" />
                          {new Date(job.deliveryDate).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============ Calendar View — simple month grid ============ */
function CalendarView({
  jobs,
  onJobClick,
  onContextMenu,
}: {
  jobs: JobOrder[];
  onJobClick: (id: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
}) {
  const [cursor, setCursor] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  // Build a 6-week grid starting on Sunday
  const firstOfMonth = new Date(year, month, 1);
  const startDay = firstOfMonth.getDay(); // 0..6 (Sun..Sat)
  const gridStart = new Date(year, month, 1 - startDay);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }

  function jobsOnDay(d: Date): JobOrder[] {
    return jobs.filter((j) => {
      if (!j.deliveryDate) return false;
      const dd = new Date(j.deliveryDate);
      return (
        dd.getFullYear() === d.getFullYear() &&
        dd.getMonth() === d.getMonth() &&
        dd.getDate() === d.getDate()
      );
    });
  }

  const today = new Date();
  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            title="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              const now = new Date();
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            title="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {days.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const dayJobs = jobsOnDay(d);
          return (
            <div
              key={i}
              className={`flex min-h-[88px] flex-col gap-1 rounded-md border p-1 ${
                inMonth ? "border-border bg-card" : "border-border/40 bg-muted/30"
              } ${isToday(d) ? "ring-1 ring-primary" : ""}`}
            >
              <span
                className={`text-[10px] font-medium ${
                  isToday(d)
                    ? "text-primary"
                    : inMonth
                      ? "text-foreground"
                      : "text-muted-foreground/60"
                }`}
              >
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayJobs.slice(0, 3).map((j) => (
                  <button
                    key={j.id}
                    onClick={() => onJobClick(j.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onContextMenu(j.id, e.clientX, e.clientY);
                    }}
                    className={`truncate rounded px-1 py-0.5 text-left text-[9px] font-medium transition-colors ${
                      j.status === "Completed"
                        ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25"
                        : j.status === "Cancelled"
                          ? "bg-zinc-500/15 text-zinc-600 hover:bg-zinc-500/25"
                          : "bg-primary/15 text-primary hover:bg-primary/25"
                    }`}
                    title={`${j.orderNumber} · ${j.title} · ${j.status}`}
                  >
                    {j.orderNumber}
                  </button>
                ))}
                {dayJobs.length > 3 && (
                  <span className="px-1 text-[9px] text-muted-foreground">
                    +{dayJobs.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Right-click Context Menu (fixed position) ============ */
function ContextMenu({
  x,
  y,
  job,
  isAdmin,
  showArchived,
  onClose,
  onView,
  onDuplicate,
  onArchive,
  onSetStatus,
  onDelete,
}: {
  x: number;
  y: number;
  job: JobOrder | undefined;
  isAdmin: boolean;
  showArchived: boolean;
  onClose: () => void;
  onView: (id: string) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string, archive: boolean) => void;
  onSetStatus: (id: string, status: JobStatus) => void;
  onDelete: (id: string) => void;
}) {
  if (!job) return null;
  // Clamp to viewport so the menu never goes off-screen
  const menuW = 200;
  const menuH = 280;
  const left = Math.min(x, window.innerWidth - menuW - 8);
  const top = Math.min(y, window.innerHeight - menuH - 8);

  return (
    <div
      className="fixed z-50 min-w-[200px] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenuLabel className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="truncate">{job.orderNumber}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <button
        type="button"
        onClick={() => onView(job.id)}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
      >
        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        View Details
        <span className="ml-auto text-[10px] text-muted-foreground">⏎</span>
      </button>
      {/* Edit Status submenu (inline, expanded) */}
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Edit status
      </div>
      <div className="max-h-44 overflow-y-auto scrollbar-warm">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={s === job.status}
            onClick={() => onSetStatus(job.id, s)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
          >
            <ArrowRightCircle className="h-3 w-3 text-muted-foreground" />
            {s}
            {s === job.status && (
              <span className="ml-auto text-[9px] text-muted-foreground">current</span>
            )}
          </button>
        ))}
      </div>
      <DropdownMenuSeparator />
      <button
        type="button"
        onClick={() => onDuplicate(job.id)}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
      >
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        Duplicate
        <span className="ml-auto text-[10px] text-muted-foreground">⌘D</span>
      </button>
      <button
        type="button"
        onClick={() => onArchive(job.id, !showArchived)}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
      >
        <Archive className="h-3.5 w-3.5 text-muted-foreground" />
        {showArchived ? "Restore" : "Archive"}
      </button>
      {isAdmin && (
        <>
          <DropdownMenuSeparator />
          <button
            type="button"
            onClick={() => onDelete(job.id)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
            <span className="ml-auto text-[10px] opacity-70">⌫</span>
          </button>
        </>
      )}
      <DropdownMenuSeparator />
      <button
        type="button"
        onClick={onClose}
        className="flex w-full items-center justify-center gap-1 rounded-sm px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent"
      >
        <X className="h-3 w-3" />
        Close
      </button>
    </div>
  );
}

/**
 * Small inline badge that summarises a job's material requirement status.
 * - gray dot  → no requirements recorded yet
 * - green ✓   → all materials have sufficient stock
 * - amber ⚠   → at least one material has a shortage
 *
 * Lazy-loaded per job and cached by react-query so the table renders
 * quickly even when many jobs are visible.
 */
function JobStockStatusBadge({ jobId }: { jobId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["material-requirements", "job", jobId],
    queryFn: () => materialRequirementsApi.list({ jobId }),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
        <Boxes className="h-3 w-3 animate-pulse" />
        Stock…
      </span>
    );
  }

  const reqs = data?.requirements ?? [];
  if (reqs.length === 0) {
    return (
      <span
        className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground/70"
        title="No material requirements recorded for this job"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        No requirements
      </span>
    );
  }

  const shortages = reqs.filter((r) => Number(r.shortage) > 0);
  if (shortages.length === 0) {
    return (
      <span
        className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-600"
        title={`All ${reqs.length} material(s) have enough stock`}
      >
        <CheckCircle2 className="h-3 w-3" />
        Stock OK
      </span>
    );
  }

  return (
    <span
      className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-600"
      title={`${shortages.length} of ${reqs.length} material(s) have a shortage`}
    >
      <AlertTriangle className="h-3 w-3" />
      {shortages.length} shortage{shortages.length > 1 ? "s" : ""}
    </span>
  );
}
