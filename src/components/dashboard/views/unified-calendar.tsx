"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  jobsApi,
  productionSchedulesApi,
  deliveriesApi,
  attendanceApi,
  stockTransfersApi,
  type ProductionSchedule,
  type DeliveryRecord,
  type AttendanceRecord,
  type StockTransfer,
  type JobOrder,
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
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Briefcase,
  Factory,
  Truck,
  UserCheck,
  ArrowLeftRight,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui-helpers";

type EventKind = "job" | "production" | "delivery" | "attendance" | "transfer";

interface CalEvent {
  id: string;
  kind: EventKind;
  date: string; // ISO date string
  title: string;
  subtitle?: string;
  meta?: string;
}

const KIND_META: Record<
  EventKind,
  { label: string; dot: string; tint: string; icon: typeof Briefcase }
> = {
  job: {
    label: "Jobs",
    dot: "bg-sky-500",
    tint: "bg-sky-500/15 text-sky-700 border-sky-500/30",
    icon: Briefcase,
  },
  production: {
    label: "Production",
    dot: "bg-emerald-500",
    tint: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    icon: Factory,
  },
  delivery: {
    label: "Deliveries",
    dot: "bg-amber-500",
    tint: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    icon: Truck,
  },
  attendance: {
    label: "Attendance",
    dot: "bg-violet-500",
    tint: "bg-violet-500/15 text-violet-700 border-violet-500/30",
    icon: UserCheck,
  },
  transfer: {
    label: "Transfers",
    dot: "bg-cyan-500",
    tint: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30",
    icon: ArrowLeftRight,
  },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDateKey(d: Date): string {
  // Local date in YYYY-MM-DD (no timezone shift)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function fmtFullDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function UnifiedCalendarView() {
  const [cursor, setCursor] = React.useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = React.useState<string | null>(
    toDateKey(new Date())
  );

  const monthParam = React.useMemo(() => {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, [cursor]);

  // Fetch all data sources in parallel
  const { data: jobsData } = useQuery({
    queryKey: ["jobs", "for-calendar"],
    queryFn: () => jobsApi.list({ includeArchived: true }),
  });
  const { data: prodData } = useQuery({
    queryKey: ["production-schedules", "for-calendar"],
    queryFn: () => productionSchedulesApi.list(),
  });
  const { data: delData } = useQuery({
    queryKey: ["deliveries", "for-calendar"],
    queryFn: () => deliveriesApi.list(),
  });
  const { data: attData } = useQuery({
    queryKey: ["attendance", "for-calendar", monthParam],
    queryFn: () => attendanceApi.list({ month: monthParam }),
  });
  const { data: trData } = useQuery({
    queryKey: ["stock-transfers", "for-calendar"],
    queryFn: () => stockTransfersApi.list(),
  });

  const jobs: JobOrder[] = (jobsData as { jobs?: JobOrder[] })?.jobs ?? [];
  const schedules: ProductionSchedule[] = prodData?.schedules ?? [];
  const deliveries: DeliveryRecord[] = delData?.deliveries ?? [];
  const attendance: AttendanceRecord[] = attData?.records ?? [];
  const transfers: StockTransfer[] = trData?.transfers ?? [];

  // Build a flat list of events
  const events = React.useMemo<CalEvent[]>(() => {
    const list: CalEvent[] = [];

    for (const j of jobs) {
      if (j.deliveryDate) {
        list.push({
          id: `job-${j.id}`,
          kind: "job",
          date: toDateKey(new Date(j.deliveryDate)),
          title: `${j.orderNumber} — Delivery`,
          subtitle: j.title,
          meta: j.priority,
        });
      }
    }

    for (const s of schedules) {
      list.push({
        id: `prod-${s.id}`,
        kind: "production",
        date: toDateKey(new Date(s.scheduledDate)),
        title: s.stage,
        subtitle: s.job?.orderNumber,
        meta: s.workstation ?? undefined,
      });
    }

    for (const d of deliveries) {
      list.push({
        id: `del-${d.id}`,
        kind: "delivery",
        date: toDateKey(new Date(d.scheduledDate)),
        title: `${d.type === "installation" ? "Installation" : "Delivery"} — ${d.job?.orderNumber ?? ""}`,
        subtitle: d.driverName ?? undefined,
        meta: d.status,
      });
    }

    for (const a of attendance) {
      list.push({
        id: `att-${a.id}`,
        kind: "attendance",
        date: toDateKey(new Date(a.date)),
        title: a.worker?.name ?? "Worker",
        subtitle: a.status.replace(/_/g, " "),
        meta: a.workLocation ?? undefined,
      });
    }

    for (const t of transfers) {
      list.push({
        id: `tr-${t.id}`,
        kind: "transfer",
        date: toDateKey(new Date(t.createdAt)),
        title: t.transferNo,
        subtitle: `${t.fromWarehouse?.name ?? "?"} → ${t.toWarehouse?.name ?? "?"}`,
        meta: t.status,
      });
    }

    return list;
  }, [jobs, schedules, deliveries, attendance, transfers]);

  // Index events by date key
  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const arr = map.get(ev.date) ?? [];
      arr.push(ev);
      map.set(ev.date, arr);
    }
    return map;
  }, [events]);

  // Build the grid of weeks for the visible month
  const grid = React.useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startDay = firstOfMonth.getDay(); // 0..6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: { key: string; day: number; inMonth: boolean }[] = [];
    // Leading days from previous month
    for (let i = startDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const date = new Date(year, month - 1, d);
      cells.push({ key: toDateKey(date), day: d, inMonth: false });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      cells.push({ key: toDateKey(date), day: d, inMonth: true });
    }
    // Trailing days to fill the last week
    let nextDay = 1;
    while (cells.length % 7 !== 0) {
      const date = new Date(year, month + 1, nextDay);
      cells.push({ key: toDateKey(date), day: nextDay, inMonth: false });
      nextDay++;
    }
    return cells;
  }, [cursor]);

  const isLoading =
    !jobsData && !prodData && !delData && !attData && !trData;

  const todayKey = toDateKey(new Date());

  function goPrev() {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  }
  function goNext() {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  }
  function goToday() {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayKey);
  }

  // Aggregate counts per kind for the visible month (for header summary)
  const monthCounts = React.useMemo(() => {
    const counts: Record<EventKind, number> = {
      job: 0,
      production: 0,
      delivery: 0,
      attendance: 0,
      transfer: 0,
    };
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    for (const ev of events) {
      const d = parseDateKey(ev.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        counts[ev.kind] += 1;
      }
    }
    return counts;
  }, [events, cursor]);

  const selectedEvents = selectedDate
    ? eventsByDate.get(selectedDate) ?? []
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <CalendarRange className="h-5 w-5 text-primary" />
            Unified Calendar
          </h1>
          <p className="text-xs text-muted-foreground">
            Jobs, production, deliveries, attendance & transfers in one view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={goPrev} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={goToday}>
            Today
          </Button>
          <Button size="sm" variant="outline" onClick={goNext} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          {(Object.keys(KIND_META) as EventKind[]).map((k) => {
            const m = KIND_META[k];
            const Icon = m.icon;
            return (
              <div
                key={k}
                className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs"
              >
                <span className={`inline-block h-2 w-2 rounded-full ${m.dot}`} />
                <Icon className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{m.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  ({monthCounts[k]})
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Calendar grid */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
            </CardTitle>
            <CardDescription className="text-xs">
              Click a day to see all events for that date.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((w) => (
                    <div
                      key={w}
                      className="px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {w}
                    </div>
                  ))}
                  {grid.map((cell) => {
                    const dayEvents = eventsByDate.get(cell.key) ?? [];
                    const kindsPresent = new Set(dayEvents.map((e) => e.kind));
                    const isToday = cell.key === todayKey;
                    const isSelected = cell.key === selectedDate;
                    return (
                      <button
                        key={cell.key}
                        onClick={() => setSelectedDate(cell.key)}
                        className={`group relative flex min-h-[68px] flex-col items-start gap-1 rounded-md border p-1.5 text-left transition-colors sm:min-h-[80px] ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : cell.inMonth
                            ? "border-border bg-background hover:bg-muted/50"
                            : "border-border/50 bg-muted/20 text-muted-foreground"
                        }`}
                      >
                        <span
                          className={`text-xs font-semibold tabular-nums ${
                            isToday
                              ? "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-primary-foreground"
                              : ""
                          }`}
                        >
                          {cell.day}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {(Object.keys(KIND_META) as EventKind[]).map((k) =>
                            kindsPresent.has(k) ? (
                              <span
                                key={k}
                                title={KIND_META[k].label}
                                className={`inline-block h-1.5 w-1.5 rounded-full ${KIND_META[k].dot}`}
                              />
                            ) : null
                          )}
                        </div>
                        {dayEvents.length > 0 && (
                          <span className="line-clamp-1 text-[10px] text-muted-foreground">
                            {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Day detail panel */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {selectedDate
                ? fmtFullDate(parseDateKey(selectedDate))
                : "Select a day"}
            </CardTitle>
            <CardDescription className="text-xs">
              {selectedEvents.length} event{selectedEvents.length === 1 ? "" : "s"} on this day
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3">
            {selectedEvents.length === 0 ? (
              <EmptyState
                icon={CalendarRange}
                title="No events scheduled"
                description="Select a day with a marker dot to view its events."
                className="py-10"
              />
            ) : (
              <div className="max-h-[460px] space-y-2 overflow-y-auto scrollbar-warm pr-1">
                {selectedEvents.map((ev) => {
                  const m = KIND_META[ev.kind];
                  const Icon = m.icon;
                  return (
                    <div
                      key={`${ev.kind}-${ev.id}`}
                      className="rounded-md border border-border bg-background p-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <div className={`rounded-md p-1.5 ${m.tint} border`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">
                            {ev.title}
                          </p>
                          {ev.subtitle && (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {ev.subtitle}
                            </p>
                          )}
                          {ev.meta && (
                            <Badge
                              variant="outline"
                              className={`mt-1 text-[10px] capitalize ${m.tint}`}
                            >
                              {ev.meta.replace(/_/g, " ")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
