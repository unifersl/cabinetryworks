"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  communicationsApi,
  customersApi,
  jobsApi,
  type CommunicationLog,
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
  MessageSquare,
  Plus,
  Loader2,
  Trash2,
  Phone,
  Mail,
  Users,
  MapPin,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui-helpers";

const TYPES = [
  {
    value: "call",
    label: "Call",
    icon: Phone,
    tint: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  },
  {
    value: "email",
    label: "Email",
    icon: Mail,
    tint: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  },
  {
    value: "meeting",
    label: "Meeting",
    icon: Users,
    tint: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  },
  {
    value: "site_visit",
    label: "Site Visit",
    icon: MapPin,
    tint: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  },
  {
    value: "message",
    label: "Message",
    icon: MessageSquare,
    tint: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  },
];

function typeInfo(t: string) {
  return TYPES.find((x) => x.value === t) ?? TYPES[0];
}

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
interface CustomerLite {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface CommsFormState {
  customerId: string;
  jobId: string;
  type: string;
  subject: string;
  summary: string;
  actionItems: string;
}

const EMPTY_FORM: CommsFormState = {
  customerId: "",
  jobId: "",
  type: "call",
  subject: "",
  summary: "",
  actionItems: "",
};

export function CommunicationsView() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = React.useState<"all" | string>("all");
  const [customerFilter, setCustomerFilter] = React.useState<"all" | string>("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<CommunicationLog | null>(null);
  const [form, setForm] = React.useState<CommsFormState>(EMPTY_FORM);

  const { data: jobsData } = useQuery({
    queryKey: ["jobs", "for-comms"],
    queryFn: () => jobsApi.list(),
  });
  const jobs: JobLite[] = (jobsData as { jobs?: JobLite[] })?.jobs ?? [];

  const { data: customersData } = useQuery({
    queryKey: ["customers", "for-comms"],
    queryFn: () => customersApi.list(),
  });
  const customers: CustomerLite[] =
    (customersData as { customers?: CustomerLite[] })?.customers ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["communications", typeFilter, customerFilter],
    queryFn: () =>
      communicationsApi.list({
        type: typeFilter === "all" ? undefined : typeFilter,
        customerId: customerFilter === "all" ? undefined : customerFilter,
      }),
  });
  const comms: CommunicationLog[] = data?.communications ?? [];

  const createMut = useMutation({
    mutationFn: (payload: CommsFormState) =>
      communicationsApi.create({
        customerId: payload.customerId || null,
        jobId: payload.jobId || null,
        type: payload.type,
        subject: payload.subject,
        summary: payload.summary || undefined,
        actionItems: payload.actionItems || undefined,
      }),
    onSuccess: () => {
      toast.success("Communication logged");
      qc.invalidateQueries({ queryKey: ["communications"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to log"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => communicationsApi.remove(id),
    onSuccess: () => {
      toast.success("Communication deleted");
      qc.invalidateQueries({ queryKey: ["communications"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  function submit() {
    if (!form.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    createMut.mutate(form);
  }

  const stats = React.useMemo(
    () => ({
      total: comms.length,
      calls: comms.filter((c) => c.type === "call").length,
      emails: comms.filter((c) => c.type === "email").length,
      meetings: comms.filter((c) => c.type === "meeting").length,
    }),
    [comms]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <MessageSquare className="h-5 w-5 text-primary" />
            Communication Log
          </h1>
          <p className="text-xs text-muted-foreground">
            Track every customer call, email &amp; meeting.
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
          Log Entry
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total entries</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-sky-500/10 p-2">
              <Phone className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.calls}</p>
              <p className="text-xs text-muted-foreground">Calls</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-violet-500/10 p-2">
              <Mail className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.emails}</p>
              <p className="text-xs text-muted-foreground">Emails</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Users className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.meetings}</p>
              <p className="text-xs text-muted-foreground">Meetings</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Entries</CardTitle>
              <CardDescription className="text-xs">
                {comms.length} entr{comms.length === 1 ? "y" : "ies"} shown
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-36 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={customerFilter}
                onValueChange={setCustomerFilter}
              >
                <SelectTrigger className="h-9 w-44 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
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
          ) : comms.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No communications logged"
              description="Log calls, emails, and meetings to keep a complete history."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Log Entry
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs min-w-[100px]">Type</TableHead>
                    <TableHead className="h-8 text-xs min-w-[160px]">Subject</TableHead>
                    <TableHead className="h-8 text-xs min-w-[160px]">Customer / Job</TableHead>
                    <TableHead className="h-8 text-xs min-w-[120px]">By</TableHead>
                    <TableHead className="h-8 text-xs min-w-[100px]">Date</TableHead>
                    <TableHead className="h-8 text-xs text-right min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comms.map((c) => {
                    const ti = typeInfo(c.type);
                    const Icon = ti.icon;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="py-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${ti.tint}`}
                          >
                            <Icon className="mr-1 h-3 w-3" />
                            {ti.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-xs max-w-[240px]">
                          <div className="font-medium truncate">{c.subject}</div>
                          {c.summary && (
                            <div className="text-muted-foreground truncate">
                              {c.summary}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-xs">
                          {c.customer?.name ?? c.job?.orderNumber ?? (
                            <span className="text-muted-foreground italic">
                              Unlinked
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-xs">
                          {c.communicatedBy ?? "—"}
                        </TableCell>
                        <TableCell className="py-2 text-xs">
                          {fmtDate(c.communicatedAt)}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setDeleting(c)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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
            <DialogTitle>Log Communication</DialogTitle>
            <DialogDescription>
              Record a customer interaction for future reference.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Customer</Label>
                <Select
                  value={form.customerId}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      customerId: v === "_none" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="No customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No customer</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Job</Label>
                <Select
                  value={form.jobId}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      jobId: v === "_none" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="No job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No job</SelectItem>
                    {jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.orderNumber} — {j.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subject *</Label>
              <Input
                placeholder="Brief subject line…"
                className="h-9 text-sm"
                value={form.subject}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subject: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Summary</Label>
              <Textarea
                rows={3}
                placeholder="What was discussed…"
                className="text-sm"
                value={form.summary}
                onChange={(e) =>
                  setForm((f) => ({ ...f, summary: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Action Items</Label>
              <Textarea
                rows={2}
                placeholder="One per line (e.g. Send revised quote)"
                className="text-sm"
                value={form.actionItems}
                onChange={(e) =>
                  setForm((f) => ({ ...f, actionItems: e.target.value }))
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
              Log Entry
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
            <AlertDialogTitle>Delete communication entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the entry
              {" “"}
              <span className="font-medium text-foreground">
                {deleting?.subject}
              </span>
              {". "}
              This action cannot be undone.
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
