"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customersApi } from "@/lib/api";
import type { Customer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
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
  Plus,
  Search,
  Pencil,
  Trash2,
  Building2,
  Mail,
  Phone,
  MapPin,
  Loader2,
  X,
  ClipboardList,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui-helpers";
import { CustomerDetailSheet } from "../customers/customer-detail-sheet";

export function CustomersView({
  focusCustomerId,
  onFocusConsumed,
}: {
  focusCustomerId?: string | null;
  onFocusConsumed?: () => void;
} = {}) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Customer | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Customer | null>(null);
  const [search, setSearch] = React.useState("");
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  // Handle focus from global search
  React.useEffect(() => {
    if (focusCustomerId) {
      setDetailId(focusCustomerId);
      setDetailOpen(true);
      onFocusConsumed?.();
    }
  }, [focusCustomerId, onFocusConsumed]);

  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: customersApi.list,
  });
  const customers = data?.customers ?? [];

  const filtered = React.useMemo(
    () =>
      customers.filter(
        (c) =>
          !search ||
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (c.phone ?? "").toLowerCase().includes(search.toLowerCase())
      ),
    [customers, search]
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e: Error) => toast.error("Delete failed", { description: e.message }),
  });

  // ---- Undo-aware delete: optimistically remove + Undo toast (5s) ----
  const undoRef = React.useRef<{
    customer: Customer;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);

  function deleteCustomerWithUndo(customer: Customer) {
    // Capture for undo
    const timeoutId = setTimeout(() => {
      deleteMutation.mutate(customer.id);
      undoRef.current = null;
    }, 5000);
    undoRef.current = { customer, timeoutId };

    // Optimistically remove from cache
    queryClient.setQueryData<{ customers: Customer[] } | undefined>(
      ["customers"],
      (old) =>
        old
          ? { ...old, customers: old.customers.filter((c) => c.id !== customer.id) }
          : old
    );

    // Close the confirmation dialog immediately
    setDeleting(null);

    toast(`Customer "${customer.name}" deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          if (undoRef.current) {
            clearTimeout(undoRef.current.timeoutId);
            const restored = undoRef.current.customer;
            queryClient.setQueryData<{ customers: Customer[] } | undefined>(
              ["customers"],
              (old) => {
                if (!old) return { customers: [restored] };
                if (old.customers.some((c) => c.id === restored.id)) return old;
                return { ...old, customers: [restored, ...old.customers] };
              }
            );
            toast.success("Customer restored");
            undoRef.current = null;
          }
        },
      },
      duration: 5000,
    });
  }

  function handleEdit(c: Customer) {
    setEditing(c);
    setEditOpen(true);
  }

  const stats = {
    total: customers.length,
    withEmail: customers.filter((c) => c.email).length,
    withPhone: customers.filter((c) => c.phone).length,
    withJobs: customers.filter((c) => (c._count?.jobOrders ?? 0) > 0).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Customers</h1>
          <p className="text-xs text-muted-foreground">
            Manage client relationships and contact details.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Total Customers" value={stats.total} icon={Building2} tint="bg-primary/10 text-primary" />
        <MiniStat label="With Email" value={stats.withEmail} icon={Mail} tint="bg-teal-500/10 text-teal-600" />
        <MiniStat label="With Phone" value={stats.withPhone} icon={Phone} tint="bg-violet-500/10 text-violet-600" />
        <MiniStat label="Active Jobs" value={stats.withJobs} icon={ClipboardList} tint="bg-amber-500/10 text-amber-600" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">All Customers</CardTitle>
              <CardDescription>
                {filtered.length} of {customers.length} shown
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, email, phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8 sm:w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading customers…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={search ? "No customers match your search" : "No customers yet"}
              description={
                search
                  ? "Try adjusting your search."
                  : "Add your first customer to get started."
              }
              action={
                !search ? (
                  <Button onClick={() => setCreateOpen(true)} variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Customer
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="max-h-[60vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[180px]">Customer</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[160px]">Contact</TableHead>
                    <TableHead className="hidden lg:table-cell min-w-[180px]">Address</TableHead>
                    <TableHead className="text-center min-w-[70px]">Jobs</TableHead>
                    <TableHead className="text-right min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c, idx) => {
                    const initials = c.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    const jobCount = c._count?.jobOrders ?? 0;
                    return (
                      <TableRow
                        key={c.id}
                        className={`cursor-pointer hover:bg-muted/50 ${idx % 2 === 1 ? "bg-muted/40" : ""}`}
                        onClick={() => {
                          setDetailId(c.id);
                          setDetailOpen(true);
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-border">
                              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{c.name}</p>
                              {c.email && (
                                <p className="truncate text-xs text-muted-foreground md:hidden">
                                  {c.email}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="space-y-0.5">
                            {c.email && (
                              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {c.email}
                              </p>
                            )}
                            {c.phone && (
                              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {c.phone}
                              </p>
                            )}
                            {!c.email && !c.phone && (
                              <span className="text-xs text-muted-foreground/60">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden max-w-[220px] truncate text-xs text-muted-foreground lg:table-cell">
                          {c.address ? (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{c.address}</span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {jobCount > 0 ? (
                            <Badge variant="outline" className="bg-primary/5">
                              {jobCount}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div
                            className="flex justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(c)}
                              aria-label={`Edit ${c.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleting(c)}
                              disabled={jobCount > 0}
                              aria-label={`Delete ${c.name}`}
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

      <CustomerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />
      <CustomerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        customer={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove{" "}
              <span className="font-medium text-foreground">{deleting?.name}</span>{" "}
              from your records. You can undo this from the toast that appears.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteCustomerWithUndo(deleting);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete customer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CustomerDetailSheet
        customerId={detailId}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setDetailId(null);
        }}
      />
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number;
  icon: typeof Building2;
  tint: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3 sm:p-4">
        <div className={`shrink-0 rounded-lg p-2 ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold tabular-nums truncate sm:text-2xl">{value}</p>
          <p className="text-[11px] text-muted-foreground sm:text-xs">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "create" | "edit";
  customer?: Customer | null;
}

function CustomerDialog({ open, onOpenChange, mode, customer }: CustomerDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setName(customer?.name ?? "");
      setPhone(customer?.phone ?? "");
      setEmail(customer?.email ?? "");
      setAddress(customer?.address ?? "");
      setNotes(customer?.notes ?? "");
    }
  }, [open, customer]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (mode === "edit" && customer) {
        return customersApi.update(customer.id, payload);
      }
      return customersApi.create(payload);
    },
    onSuccess: () => {
      toast.success(mode === "edit" ? "Customer updated" : "Customer added");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast.error(mode === "edit" ? "Update failed" : "Create failed", {
        description: e.message,
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[480px] max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-warm">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>
                  {mode === "edit" ? "Edit Customer" : "Add Customer"}
                </DialogTitle>
                <DialogDescription className="mt-0.5">
                  {mode === "edit"
                    ? "Update contact and address details."
                    : "Record a new client for your jobs."}
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              toast.error("Customer name is required");
              return;
            }
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="c-name">
              Customer Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="c-name"
              placeholder="e.g. Sarah & Mike Wilson"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={mutation.isPending}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-phone">Phone</Label>
              <Input
                id="c-phone"
                placeholder="+1 555 0100"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
                type="email"
                placeholder="customer@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={mutation.isPending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-address">Address</Label>
            <Input
              id="c-address"
              placeholder="Street, City"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-notes">Notes</Label>
            <Textarea
              id="c-notes"
              placeholder="Project preferences, access instructions…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={mutation.isPending}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Building2 className="mr-2 h-4 w-4" />
              )}
              {mode === "edit" ? "Save Changes" : "Add Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
