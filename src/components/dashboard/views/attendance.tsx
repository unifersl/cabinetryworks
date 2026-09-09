// @ts-nocheck
"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workersApi, attendanceApi, jobsApi, ATTENDANCE_STATUSES, type Worker, type AttendanceRecord } from "@/lib/api";
import { useAuth } from "@/components/providers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Calendar, Users, Plus, Pencil, Trash2, Download, Printer, Loader2,
  UserPlus, Clock, ChevronLeft, ChevronRight, X, Briefcase,
} from "lucide-react";

// ---- helpers ----
function monthLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtMonth(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function fmtDate(y: number, m: number, day: number) {
  return `${y}-${pad(m + 1)}-${pad(day)}`;
}
function isWeekend(y: number, m: number, day: number) {
  const dow = new Date(y, m, day).getDay();
  return dow === 0 || dow === 6;
}
function statusInfo(status: string) {
  return ATTENDANCE_STATUSES.find((s) => s.value === status) ?? ATTENDANCE_STATUSES[0];
}

export function AttendanceView() {
  const { user } = useAuth();
  const canEdit = user?.role === "Admin" || user?.role === "SuperAdmin";
  const [tab, setTab] = React.useState("calendar");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Calendar className="h-5 w-5 text-primary shrink-0" />
            <span>Attendance Tracking</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Worker attendance — factory &amp; on-site — synced with Job Orders
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="calendar" className="gap-1.5 text-xs sm:text-sm">
            <Calendar className="h-3.5 w-3.5" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="workers" className="gap-1.5 text-xs sm:text-sm">
            <Users className="h-3.5 w-3.5" />
            Workers
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-1.5 text-xs sm:text-sm">
            <Clock className="h-3.5 w-3.5" />
            Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <CalendarTab canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="workers" className="space-y-4">
          <WorkersTab canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="summary" className="space-y-4">
          <SummaryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================================================
 *  Calendar Tab — month grid: workers × days
 * ========================================================== */
function CalendarTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedJob, setSelectedJob] = React.useState<string>("all");
  const [editingCell, setEditingCell] = React.useState<{
    workerId: string;
    workerName: string;
    date: string;
    record?: AttendanceRecord;
  } | null>(null);

  const y = currentMonth.getFullYear();
  const m = currentMonth.getMonth();
  const dim = daysInMonth(currentMonth);
  const days = Array.from({ length: dim }, (_, i) => i + 1);

  const { data: workersData } = useQuery({
    queryKey: ["workers", "active"],
    queryFn: () => workersApi.list({ status: "active" }),
  });
  const workers = workersData?.workers ?? [];

  const { data: jobsData } = useQuery({
    queryKey: ["jobs", "for-attendance"],
    queryFn: () => jobsApi.list(),
  });
  const jobs = (jobsData as any)?.jobs ?? [];

  const { data: attData, isLoading } = useQuery({
    queryKey: ["attendance", "month", fmtMonth(currentMonth)],
    queryFn: () => attendanceApi.list({ month: fmtMonth(currentMonth) }),
  });

  const records = attData?.records ?? [];
  const summary = attData?.summary ?? [];

  // Build lookup: { workerId_date: record[] } — supports multiple records per day (multi-job)
  const recordMap = React.useMemo(() => {
    const map: Record<string, AttendanceRecord[]> = {};
    for (const r of records) {
      const d = new Date(r.date);
      const key = `${r.workerId}_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [records]);

  // Get the primary (first) record for a cell, or all records for multi-job display
  function getCellRecords(workerId: string, date: string): AttendanceRecord[] {
    return recordMap[`${workerId}_${date}`] ?? [];
  }

  // Summary lookup by workerId
  const summaryMap = React.useMemo(() => {
    const map: Record<string, any> = {};
    for (const s of summary) map[s.workerId] = s;
    return map;
  }, [summary]);

  const upsertMut = useMutation({
    mutationFn: (payload: Partial<AttendanceRecord> & { workerId: string; date: string }) =>
      attendanceApi.upsert(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", "month", fmtMonth(currentMonth)] });
    },
    onError: () => toast.error("Failed to save attendance"),
  });

  function quickSet(workerId: string, workerName: string, day: number, status: string) {
    if (!canEdit) return;
    const date = fmtDate(y, m, day);
    const existing = recordMap[`${workerId}_${date}`];
    upsertMut.mutate({
      workerId,
      date,
      status,
      clockIn: existing?.clockIn ?? null,
      clockOut: existing?.clockOut ?? null,
      jobId: selectedJob !== "all" ? selectedJob : existing?.jobId ?? null,
    });
  }

  function exportCSV() {
    const header = ["Worker", "Code", "Role", ...days.map((d) => pad(d)), "Total Days", "Total Hours"];
    const rows = workers.map((w) => {
      const s = summaryMap[w.id];
      const cells = days.map((d) => {
        const r = recordMap[`${w.id}_${fmtDate(y, m, d)}`];
        return r ? statusInfo(r.status).symbol : "";
      });
      return [w.name, w.code ?? "", w.role ?? "", ...cells, String(s?.totalDays ?? 0), String(s?.totalHours ?? 0)];
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${fmtMonth(currentMonth)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = workers.map((wk) => {
      const s = summaryMap[wk.id];
      const cells = days.map((d) => {
        const r = recordMap[`${wk.id}_${fmtDate(y, m, d)}`];
        return `<td style="text-align:center">${r ? statusInfo(r.status).symbol : ""}</td>`;
      }).join("");
      return `<tr><td>${wk.name}</td><td>${wk.code ?? ""}</td>${cells}<td style="text-align:center;font-weight:bold">${s?.totalDays ?? 0}</td><td style="text-align:center;font-weight:bold">${s?.totalHours ?? 0}</td></tr>`;
    }).join("");
    const dayHeaders = days.map((d) => `<th style="width:28px">${d}</th>`).join("");
    w.document.write(`<html><head><title>Attendance ${monthLabel(currentMonth)}</title>
      <style>body{font-family:Arial;padding:16px;font-size:10px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:2px 3px}th{background:#f0f0f0}h1{font-size:16px}</style>
      </head><body><h1>Attendance — ${monthLabel(currentMonth)}</h1>
      <table><tr><th>Worker</th><th>Code</th>${dayHeaders}<th>Days</th><th>Hrs</th></tr>${rows}</table>
      <p style="margin-top:12px">Legend: P=Present A=Absent H=Half Day SL=Short Leave FL=Full Leave S=Sick HO=Holiday</p>
      </body></html>`);
    w.document.close();
    w.print();
  }

  return (
    <div className="space-y-3">
      {/* Toolbar — single compact row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Month navigation */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1.5 py-1">
          <button onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[110px] text-center text-sm font-semibold">{monthLabel(currentMonth)}</span>
          <button onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => { const d = new Date(); setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="ml-1 rounded px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10">
            Today
          </button>
        </div>

        {/* Legend — inline compact */}
        <div className="flex flex-wrap items-center gap-1">
          {ATTENDANCE_STATUSES.map((s) => (
            <span key={s.value} className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${s.color}`}>
              {s.symbol} {s.label}
            </span>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 ml-auto">
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <Briefcase className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All jobs</SelectItem>
              {jobs.map((j: any) => (
                <SelectItem key={j.id} value={j.id}>{j.orderNumber} — {j.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8" onClick={exportCSV} disabled={workers.length === 0}>
            <Download className="mr-1 h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={printReport} disabled={workers.length === 0}>
            <Printer className="mr-1 h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>

      {/* Worker count + hint */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{workers.length} workers</span>
        <span>Click any cell to set attendance → scroll right for all days</span>
      </div>

      {/* Calendar grid — with scroll indicator */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : workers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="rounded-full bg-muted p-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">No workers yet</p>
            <p className="text-sm text-muted-foreground">Add workers in the Workers tab to start tracking attendance.</p>
          </div>
        </div>
      ) : (
        <div className="relative rounded-lg border border-border overflow-hidden">
          {/* Scroll hint gradient on right edge */}
          <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-8 bg-gradient-to-l from-muted/80 to-transparent" />
          <div className="overflow-x-auto scrollbar-warm">
            <table className="border-collapse text-xs">
              <thead>
                <tr className="bg-muted/60">
                  <th className="sticky left-0 z-10 border-b border-r border-border bg-muted/60 px-2 py-1.5 text-left font-semibold min-w-[130px] text-xs">Worker</th>
                  {days.map((d) => (
                    <th key={d} className={`border-b border-r border-border px-0 py-1 text-center font-mono text-[9px] min-w-[26px] ${isWeekend(y, m, d) ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                      {d}
                    </th>
                  ))}
                  <th className="sticky right-0 z-10 border-b border-l border-border bg-muted/60 px-2 py-1 text-center font-semibold text-[10px] min-w-[50px]">Days</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w, wIdx) => {
                  const s = summaryMap[w.id];
                  return (
                    <tr key={w.id} className={`${wIdx % 2 === 0 ? "bg-card" : "bg-muted/20"} hover:bg-primary/5`}>
                      <td className={`sticky left-0 z-10 border-r border-border px-2 py-1 ${wIdx % 2 === 0 ? "bg-card" : "bg-muted/20"}`}>
                        <div className="font-medium text-xs truncate">{w.name}</div>
                        <div className="text-[8px] text-muted-foreground">{w.code ?? ""} {w.role ? `· ${w.role}` : ""}</div>
                      </td>
                      {days.map((d) => {
                        const date = fmtDate(y, m, d);
                        const cellRecords = getCellRecords(w.id, date);
                        const primaryRecord = cellRecords[0];
                        const si = primaryRecord ? statusInfo(primaryRecord.status) : null;
                        const multiJob = cellRecords.length > 1;
                        return (
                          <td
                            key={d}
                            className={`border-r border-border p-0 text-center ${isWeekend(y, m, d) ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}`}
                          >
                            <button
                              disabled={!canEdit}
                              onClick={() => setEditingCell({ workerId: w.id, workerName: w.name, date, record: primaryRecord })}
                              className={`relative flex h-7 min-w-[26px] items-center justify-center text-[9px] font-bold transition-colors ${
                                si ? si.color : "text-transparent hover:bg-primary/10"
                              } ${canEdit ? "cursor-pointer" : "cursor-default"}`}
                              title={cellRecords.length > 0
                                ? cellRecords.map(r => `${statusInfo(r.status)?.label}${r.job?.orderNumber ? ` (${r.job.orderNumber})` : ""}${r.clockIn ? ` ${r.clockIn}-${r.clockOut}` : ""}${r.hoursWorked ? ` ${r.hoursWorked}h` : ""}`).join(" + ")
                                : "Click to set"}
                            >
                              {si?.symbol ?? ""}
                              {multiJob && (
                                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-primary text-[7px] font-bold text-primary-foreground">
                                  {cellRecords.length}
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-10 border-l border-border px-2 py-1 text-center font-bold tabular-nums text-xs bg-muted/30">
                        {s?.totalDays ?? 0}d / {s?.totalHours ?? 0}h
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick-set buttons (for selected worker/day) */}
      {canEdit && editingCell && (
        <CellEditDialog
          cell={editingCell}
          jobs={jobs}
          onClose={() => setEditingCell(null)}
          onSave={(payload) => {
            upsertMut.mutate(payload);
            setEditingCell(null);
          }}
          onClear={() => {
            if (editingCell.record) {
              attendanceApi.remove(editingCell.record.id).then(() => {
                qc.invalidateQueries({ queryKey: ["attendance", "month", fmtMonth(currentMonth)] });
                toast.success("Attendance cleared");
              });
            }
            setEditingCell(null);
          }}
        />
      )}
    </div>
  );
}

/* ---- Cell edit dialog — click a cell to open ---- */
function CellEditDialog({
  cell,
  jobs,
  onClose,
  onSave,
  onClear,
}: {
  cell: { workerId: string; workerName: string; date: string; record?: AttendanceRecord };
  jobs: any[];
  onClose: () => void;
  onSave: (payload: Partial<AttendanceRecord> & { workerId: string; date: string }) => void;
  onClear: () => void;
}) {
  const [status, setStatus] = React.useState(cell.record?.status ?? "present");
  const [clockIn, setClockIn] = React.useState(cell.record?.clockIn ?? "08:00");
  const [clockOut, setClockOut] = React.useState(cell.record?.clockOut ?? "17:00");
  const [breakStart, setBreakStart] = React.useState(cell.record?.breakStart ?? "12:00");
  const [breakEnd, setBreakEnd] = React.useState(cell.record?.breakEnd ?? "12:30");
  const [jobId, setJobId] = React.useState(cell.record?.jobId ?? "none");
  const [workLocation, setWorkLocation] = React.useState(cell.record?.workLocation ?? "");
  const [notes, setNotes] = React.useState(cell.record?.notes ?? "");

  // Auto-calc hours preview
  function calcHours() {
    const toMin = (t: string) => { const m = t.match(/^(\d{1,2}):(\d{2})$/); return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null; };
    const ci = toMin(clockIn); const co = toMin(clockOut);
    if (ci === null || co === null || co <= ci) return 0;
    let gross = co - ci;
    const bs = toMin(breakStart); const be = toMin(breakEnd);
    if (bs !== null && be !== null && be > bs) gross -= (be - bs);
    return Math.round((gross / 60) * 100) / 100;
  }

  const hours = calcHours();

  function handleSave() {
    onSave({
      workerId: cell.workerId,
      date: cell.date,
      status,
      clockIn: clockIn || null,
      clockOut: clockOut || null,
      breakStart: breakStart || null,
      breakEnd: breakEnd || null,
      jobId: jobId && jobId !== "none" ? jobId : null,
      workLocation: workLocation || null,
      notes: notes || null,
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {cell.workerName}
          </DialogTitle>
          <DialogDescription>
            {new Date(cell.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Status — click-to-select buttons */}
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <div className="flex flex-wrap gap-1">
              {ATTENDANCE_STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStatus(s.value)}
                  className={`rounded border px-2 py-1 text-[11px] font-bold transition-all ${
                    status === s.value ? `${s.color} ring-2 ring-offset-1 ring-primary` : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {s.symbol} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time fields */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Time In</Label>
              <Input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Time Out</Label>
              <Input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Break Start</Label>
              <Input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Break End</Label>
              <Input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          {/* Hours preview */}
          <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-center">
            <span className="text-xs text-muted-foreground">Net Hours: </span>
            <span className="text-lg font-bold text-primary tabular-nums">{hours}h</span>
          </div>

          {/* Job link */}
          <div className="space-y-1">
            <Label className="text-xs">Job / Project (for onsite work)</Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select job…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No job —</SelectItem>
                {jobs.map((j: any) => (
                  <SelectItem key={j.id} value={j.id}>{j.orderNumber} — {j.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Work Location</Label>
            <Input placeholder="e.g. Factory / Site A" value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} className="h-9 text-sm" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Input placeholder="Optional notes…" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>

        <DialogFooter>
          {cell.record && (
            <Button variant="outline" size="sm" className="text-destructive mr-auto" onClick={onClear}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 *  Workers Tab — CRUD
 * ========================================================== */
function WorkersTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Worker | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["workers"],
    queryFn: () => workersApi.list(),
  });
  const workers = data?.workers ?? [];

  const createMut = useMutation({
    mutationFn: (p: Partial<Worker> & { name: string }) => workersApi.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workers"] }); qc.invalidateQueries({ queryKey: ["workers", "active"] }); toast.success("Worker added"); setDialogOpen(false); },
    onError: (e: Error) => toast.error(e.message || "Operation failed"),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Worker> }) => workersApi.update(id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workers"] }); qc.invalidateQueries({ queryKey: ["workers", "active"] }); toast.success("Worker updated"); setDialogOpen(false); },
    onError: (e: Error) => toast.error(e.message || "Operation failed"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => workersApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workers"] }); qc.invalidateQueries({ queryKey: ["workers", "active"] }); toast.success("Worker deleted"); },
    onError: (e: Error) => toast.error(e.message || "Operation failed"),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Workers ({workers.length})</h3>
          <p className="text-sm text-muted-foreground">Manage workers for attendance tracking</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Add Worker
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading workers…</div>
      ) : workers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="rounded-full bg-muted p-4"><Users className="h-8 w-8 text-muted-foreground" /></div>
          <div><p className="font-medium">No workers yet</p><p className="text-sm text-muted-foreground">Add workers to start tracking attendance.</p></div>
          {canEdit && <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><UserPlus className="mr-2 h-4 w-4" /> Add First Worker</Button>}
        </div>
      ) : (
        <div className="overflow-auto scrollbar-warm rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card shadow-sm">
              <tr>
                <th className="min-w-[80px] px-3 py-2 text-left font-semibold">Code</th>
                <th className="min-w-[160px] px-3 py-2 text-left font-semibold">Name</th>
                <th className="min-w-[120px] px-3 py-2 text-left font-semibold">Role</th>
                <th className="min-w-[90px] px-3 py-2 text-left font-semibold">Type</th>
                <th className="min-w-[120px] px-3 py-2 text-left font-semibold">Phone</th>
                <th className="min-w-[90px] px-3 py-2 text-right font-semibold">Rate/hr</th>
                <th className="min-w-[90px] px-3 py-2 text-center font-semibold">Status</th>
                {canEdit && <th className="min-w-[100px] px-3 py-2 text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {workers.map((w, idx) => (
                <tr key={w.id} className={`border-t border-border hover:bg-muted/50 ${idx % 2 === 1 ? "bg-muted/40" : ""}`}>
                  <td className="px-3 py-2 font-mono text-xs">{w.code ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{w.name}</td>
                  <td className="px-3 py-2 text-xs">{w.role ?? "—"}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{w.type}</Badge></td>
                  <td className="px-3 py-2 text-xs">{w.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{w.hourlyRate > 0 ? `${w.hourlyRate.toLocaleString()}` : "—"}</td>
                  <td className="px-3 py-2 text-center"><Badge variant={w.status === "active" ? "default" : "secondary"} className="text-[10px]">{w.status}</Badge></td>
                  {canEdit && (
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(w); setDialogOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(w.id)} disabled={deleteMut.isPending}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogOpen && (
        <WorkerDialog
          worker={editing}
          onClose={() => setDialogOpen(false)}
          onSubmit={(p) => editing ? updateMut.mutate({ id: editing.id, patch: p }) : createMut.mutate(p as any)}
          loading={createMut.isPending || updateMut.isPending}
        />
      )}
    </div>
  );
}

function WorkerDialog({ worker, onClose, onSubmit, loading }: {
  worker: Worker | null;
  onClose: () => void;
  onSubmit: (p: Partial<Worker> & { name: string }) => void;
  loading: boolean;
}) {
  const [name, setName] = React.useState(worker?.name ?? "");
  const [code, setCode] = React.useState(worker?.code ?? "");
  const [role, setRole] = React.useState(worker?.role ?? "");
  const [phone, setPhone] = React.useState(worker?.phone ?? "");
  const [type, setType] = React.useState(worker?.type ?? "factory");
  const [status, setStatus] = React.useState(worker?.status ?? "active");
  const [hourlyRate, setHourlyRate] = React.useState(worker ? String(worker.hourlyRate) : "");

  function save() {
    if (!name.trim()) { toast.error("Name is required"); return; }
    onSubmit({
      name: name.trim(),
      code: code.trim() || undefined,
      role: role.trim() || undefined,
      phone: phone.trim() || undefined,
      type, status,
      hourlyRate: hourlyRate ? Number(hourlyRate) : 0,
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{worker ? "Edit Worker" : "Add Worker"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" autoFocus />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Code</Label>
            <Input placeholder="W001" value={code} onChange={(e) => setCode(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Role</Label>
            <Input placeholder="Carpenter" value={role} onChange={(e) => setRole(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="factory">Factory</SelectItem>
                <SelectItem value="onsite">On-site</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Hourly Rate (LKR)</Label>
            <Input type="number" min="0" placeholder="0" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={loading}>{loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{worker ? "Update" : "Add"} Worker</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 *  Summary Tab — monthly per-worker summary
 * ========================================================== */
function SummaryTab() {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", "month", fmtMonth(currentMonth)],
    queryFn: () => attendanceApi.list({ month: fmtMonth(currentMonth) }),
  });
  const summary = data?.summary ?? [];

  function exportCSV() {
    const rows = [
      ["Worker", "Present", "Absent", "Half Day", "Short Leave", "Full Leave", "Sick", "Holiday", "Total Days", "Total Hours"],
      ...summary.map((s) => [s.workerName, String(s.present), String(s.absent), String(s.halfDay), String(s.shortLeave), String(s.fullLeave), String(s.sick), String(s.holiday), String(s.totalDays), String(s.totalHours)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-summary-${fmtMonth(currentMonth)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-semibold">{monthLabel(currentMonth)}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" className="h-8" onClick={exportCSV} disabled={summary.length === 0}>
          <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading summary…</div>
      ) : summary.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="rounded-full bg-muted p-4"><Clock className="h-8 w-8 text-muted-foreground" /></div>
          <div><p className="font-medium">No attendance data</p><p className="text-sm text-muted-foreground">No records for {monthLabel(currentMonth)}.</p></div>
        </div>
      ) : (
        <div className="overflow-auto scrollbar-warm rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card shadow-sm">
              <tr>
                <th className="min-w-[160px] px-3 py-2 text-left font-semibold">Worker</th>
                <th className="min-w-[40px] px-2 py-2 text-center font-semibold"><span className="text-green-600">P</span></th>
                <th className="min-w-[40px] px-2 py-2 text-center font-semibold"><span className="text-red-600">A</span></th>
                <th className="min-w-[40px] px-2 py-2 text-center font-semibold"><span className="text-amber-600">H</span></th>
                <th className="min-w-[40px] px-2 py-2 text-center font-semibold"><span className="text-sky-600">SL</span></th>
                <th className="min-w-[40px] px-2 py-2 text-center font-semibold"><span className="text-purple-600">FL</span></th>
                <th className="min-w-[40px] px-2 py-2 text-center font-semibold"><span className="text-orange-600">S</span></th>
                <th className="min-w-[40px] px-2 py-2 text-center font-semibold"><span className="text-slate-600">HO</span></th>
                <th className="min-w-[60px] px-3 py-2 text-center font-semibold">Days</th>
                <th className="min-w-[70px] px-3 py-2 text-center font-semibold">Hours</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s, idx) => (
                <tr key={s.workerId} className={`border-t border-border hover:bg-muted/50 ${idx % 2 === 1 ? "bg-muted/40" : ""}`}>
                  <td className="px-3 py-2 font-medium">{s.workerName}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{s.present || ""}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{s.absent || ""}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{s.halfDay || ""}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{s.shortLeave || ""}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{s.fullLeave || ""}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{s.sick || ""}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{s.holiday || ""}</td>
                  <td className="px-3 py-2 text-center font-bold tabular-nums">{s.totalDays}</td>
                  <td className="px-3 py-2 text-center font-bold tabular-nums">{s.totalHours}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 font-bold">
                <td className="px-3 py-2">Total</td>
                <td className="px-2 py-2 text-center tabular-nums">{summary.reduce((a, s) => a + s.present, 0)}</td>
                <td className="px-2 py-2 text-center tabular-nums">{summary.reduce((a, s) => a + s.absent, 0)}</td>
                <td className="px-2 py-2 text-center tabular-nums">{summary.reduce((a, s) => a + s.halfDay, 0)}</td>
                <td className="px-2 py-2 text-center tabular-nums">{summary.reduce((a, s) => a + s.shortLeave, 0)}</td>
                <td className="px-2 py-2 text-center tabular-nums">{summary.reduce((a, s) => a + s.fullLeave, 0)}</td>
                <td className="px-2 py-2 text-center tabular-nums">{summary.reduce((a, s) => a + s.sick, 0)}</td>
                <td className="px-2 py-2 text-center tabular-nums">{summary.reduce((a, s) => a + s.holiday, 0)}</td>
                <td className="px-3 py-2 text-center tabular-nums">{summary.reduce((a, s) => a + s.totalDays, 0)}</td>
                <td className="px-3 py-2 text-center tabular-nums">{summary.reduce((a, s) => a + s.totalHours, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
