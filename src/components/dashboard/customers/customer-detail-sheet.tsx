"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { customersApi, statementsApi } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  X,
  Loader2,
  Phone,
  Mail,
  MapPin,
  FileText,
  ClipboardList,
  Calendar,
  User as UserIcon,
  TrendingUp,
  Clock,
  CheckCircle2,
  DollarSign,
  Printer,
  Receipt,
} from "lucide-react";

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

export function CustomerDetailSheet({
  customerId,
  open,
  onOpenChange,
}: {
  customerId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-detail", customerId],
    queryFn: () => customersApi.get(customerId!),
    enabled: !!customerId && open,
  });

  const customer = data?.customer;

  const initials = customer?.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const jobs = customer?.jobOrders ?? [];
  const totalJobs = customer?._count?.jobOrders ?? 0;
  const completedJobs = jobs.filter((j) => j.status === "Completed").length;
  const activeJobs = jobs.filter(
    (j) => j.status !== "Completed" && j.status !== "Cancelled"
  ).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto scrollbar-warm p-0 sm:max-w-xl"
      >
        <SheetTitle className="sr-only">Customer details</SheetTitle>
        {isLoading || !customer ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="border-b border-border bg-gradient-to-br from-primary/5 to-background p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold leading-tight">
                      {customer.name}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Customer since{" "}
                      {customer.createdAt
                        ? new Date(customer.createdAt).toLocaleDateString(
                            undefined,
                            { year: "numeric", month: "long" }
                          )
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-warm">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 p-5 pb-3">
                <StatBox
                  icon={ClipboardList}
                  label="Total Jobs"
                  value={totalJobs}
                  tint="text-orange-600 bg-orange-500/10"
                />
                <StatBox
                  icon={Clock}
                  label="Active"
                  value={activeJobs}
                  tint="text-amber-600 bg-amber-500/10"
                />
                <StatBox
                  icon={CheckCircle2}
                  label="Completed"
                  value={completedJobs}
                  tint="text-emerald-600 bg-emerald-500/10"
                />
              </div>

              {/* Contact info */}
              <div className="px-5 pb-3">
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <UserIcon className="h-3.5 w-3.5" />
                    CONTACT INFORMATION
                  </div>
                  <div className="space-y-2 text-sm">
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4 shrink-0" />
                        <a
                          href={`tel:${customer.phone}`}
                          className="hover:text-foreground hover:underline"
                        >
                          {customer.phone}
                        </a>
                      </div>
                    )}
                    {customer.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4 shrink-0" />
                        <a
                          href={`mailto:${customer.email}`}
                          className="hover:text-foreground hover:underline"
                        >
                          {customer.email}
                        </a>
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{customer.address}</span>
                      </div>
                    )}
                    {!customer.phone &&
                      !customer.email &&
                      !customer.address && (
                        <p className="text-xs text-muted-foreground/60">
                          No contact information on file.
                        </p>
                      )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {customer.notes && (
                <div className="px-5 pb-3">
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      NOTES
                    </div>
                    <p className="text-sm leading-relaxed">{customer.notes}</p>
                  </div>
                </div>
              )}

              <Separator className="my-2" />

              {/* Job history */}
              <div className="p-5 pt-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Job History
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    {jobs.length} of {totalJobs} shown
                  </Badge>
                </div>

                {jobs.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <div className="rounded-full bg-muted p-3">
                      <ClipboardList className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No jobs yet</p>
                    <p className="max-w-xs text-xs text-muted-foreground">
                      Jobs assigned to this customer will appear here with a
                      timeline of their production status.
                    </p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 h-full w-px bg-border" />
                    <div className="space-y-4">
                      {jobs.map((job) => (
                        <div key={job.id} className="relative flex gap-4">
                          <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-background bg-card">
                            <div
                              className={`h-3 w-3 rounded-full ${
                                job.status === "Completed"
                                  ? "bg-emerald-500"
                                  : job.status === "Cancelled"
                                    ? "bg-zinc-400"
                                    : "bg-primary"
                              }`}
                            />
                          </div>
                          <div className="min-w-0 flex-1 rounded-lg border border-border bg-card p-3 transition-shadow hover:shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-mono text-xs text-primary">
                                  {job.orderNumber}
                                </p>
                                <p className="truncate text-sm font-medium">
                                  {job.title}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={`shrink-0 ${STATUS_BADGE[job.status]}`}
                              >
                                {job.status}
                              </Badge>
                            </div>
                            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {job.createdAt
                                  ? new Date(job.createdAt).toLocaleDateString()
                                  : "—"}
                              </span>
                              <span className="font-medium">{job.priority}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator className="my-2" />

              {/* Financial Statement */}
              <CustomerStatementSection customerId={customer.id} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <div className={`mx-auto mb-1 w-fit rounded-md p-1.5 ${tint}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function CustomerStatementSection({ customerId }: { customerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-statement", customerId],
    queryFn: () => statementsApi.get(customerId),
  });

  if (isLoading) {
    return (
      <div className="p-5 pt-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading financial summary…
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, quotes } = data;

  return (
    <div className="p-5 pt-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Receipt className="h-4 w-4 text-primary" />
          Financial Statement
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => window.print()}
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Total Jobs</p>
          <p className="text-xl font-bold">{summary.totalJobs}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Active</p>
          <p className="text-xl font-bold text-amber-600">{summary.activeJobs}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Completed</p>
          <p className="text-xl font-bold text-emerald-600">{summary.completedJobs}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Quotes</p>
          <p className="text-xl font-bold">{summary.totalQuotes}</p>
        </div>
      </div>

      {/* Quote totals */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-primary/5 p-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total Quoted</span>
          </div>
          <p className="mt-1 text-lg font-bold text-primary">
            ${summary.totalQuoted.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-muted-foreground">Accepted</span>
          </div>
          <p className="mt-1 text-lg font-bold text-emerald-600">
            ${summary.totalAccepted.toFixed(2)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {summary.acceptedQuotes} of {summary.totalQuotes} quotes
          </p>
        </div>
        <div className="rounded-lg border border-border bg-amber-500/5 p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-muted-foreground">Pending</span>
          </div>
          <p className="mt-1 text-lg font-bold text-amber-600">
            {summary.pendingQuotes}
          </p>
          <p className="text-[10px] text-muted-foreground">awaiting response</p>
        </div>
      </div>

      {/* Quote history table */}
      {quotes.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">QUOTE HISTORY</p>
          <div className="max-h-48 overflow-y-auto scrollbar-warm rounded-md border border-border">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/60">
                <TableRow>
                  <TableHead className="h-8 text-xs">Quote #</TableHead>
                  <TableHead className="h-8 text-right text-xs">Total</TableHead>
                  <TableHead className="h-8 text-xs">Status</TableHead>
                  <TableHead className="h-8 text-xs">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="py-1.5 font-mono text-xs text-primary">
                      {q.quoteNumber}
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                      ${Number(q.total).toFixed(2)}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          q.status === "accepted"
                            ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                            : q.status === "rejected"
                              ? "bg-rose-500/15 text-rose-700 border-rose-500/30"
                              : q.status === "sent"
                                ? "bg-sky-500/15 text-sky-700 border-sky-500/30"
                                : "bg-zinc-500/15 text-zinc-600 border-zinc-500/30"
                        }`}
                      >
                        {q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground">
                      {new Date(q.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
