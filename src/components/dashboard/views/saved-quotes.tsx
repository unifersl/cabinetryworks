"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { quotesApi, type SavedQuote } from "@/lib/api";
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
  FileText,
  Loader2,
  Trash2,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
} from "lucide-react";

const STATUS_META: Record<string, { badge: string; icon: typeof FileText; label: string }> = {
  draft: { badge: "bg-zinc-500/15 text-zinc-600 border-zinc-500/30", icon: FileText, label: "Draft" },
  sent: { badge: "bg-sky-500/15 text-sky-700 border-sky-500/30", icon: Send, label: "Sent" },
  accepted: { badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: CheckCircle2, label: "Accepted" },
  rejected: { badge: "bg-rose-500/15 text-rose-700 border-rose-500/30", icon: XCircle, label: "Rejected" },
  expired: { badge: "bg-amber-500/15 text-amber-700 border-amber-500/30", icon: Clock, label: "Expired" },
};

const STATUSES = ["draft", "sent", "accepted", "rejected", "expired"];

export function SavedQuotesView() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState<"all" | string>("all");
  const [deleting, setDeleting] = React.useState<SavedQuote | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["quotes", statusFilter],
    queryFn: () =>
      quotesApi.list(
        statusFilter === "all" ? undefined : { status: statusFilter }
      ),
  });

  const quotes = data?.quotes ?? [];

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      quotesApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Quote status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quotesApi.remove(id),
    onSuccess: () => {
      toast.success("Quote deleted");
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = {
    total: quotes.length,
    accepted: quotes.filter((q) => q.status === "accepted").length,
    pending: quotes.filter((q) => q.status === "draft" || q.status === "sent").length,
    totalValue: quotes.reduce((s, q) => s + Number(q.total), 0),
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <FileText className="h-5 w-5 text-primary" />
          Saved Quotes
        </h1>
        <p className="text-sm text-muted-foreground">
          Track quote history and manage status workflow.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Quotes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.accepted}</p>
              <p className="text-xs text-muted-foreground">Accepted</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-violet-500/10 p-2">
              <DollarSign className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                ${stats.totalValue.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Value</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quotes table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">All Quotes</CardTitle>
              <CardDescription>{quotes.length} quotes</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading quotes…
            </div>
          ) : quotes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No saved quotes yet</p>
                <p className="text-sm text-muted-foreground">
                  Save quotes from the Quotes &amp; Costing view to track them here.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="min-w-[120px]">Quote</TableHead>
                    <TableHead className="hidden sm:table-cell min-w-[120px]">Job</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[140px]">Customer</TableHead>
                    <TableHead className="text-right min-w-[100px]">Total</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="text-right min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((q) => {
                    const meta = STATUS_META[q.status] ?? STATUS_META.draft;
                    const StatusIcon = meta.icon;
                    return (
                      <TableRow key={q.id} className="hover:bg-muted/40">
                        <TableCell>
                          <p className="font-mono text-xs text-primary">
                            {q.quoteNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(q.createdAt).toLocaleDateString()}
                          </p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <p className="font-mono text-xs">{q.job?.orderNumber}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {q.job?.title}
                          </p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {q.customer?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          ${Number(q.total).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={meta.badge}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {meta.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Select
                              value={q.status}
                              onValueChange={(v) =>
                                updateStatus.mutate({ id: q.id, status: v })
                              }
                            >
                              <SelectTrigger className="h-7 w-[110px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleting(q)}
                            >
                              <Trash2 className="h-4 w-4" />
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

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete quote?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete quote{" "}
              <span className="font-medium text-foreground">
                {deleting?.quoteNumber}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMutation.mutate(deleting.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete quote"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
