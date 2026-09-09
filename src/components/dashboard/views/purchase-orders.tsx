"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseOrdersApi, inventoryApi, type PurchaseOrder } from "@/lib/api";
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
  DialogTitle,
  DialogFooter,
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
  ShoppingCart,
  Plus,
  Loader2,
  X,
  Trash2,
  CheckCircle2,
  Package,
  TrendingDown,
  DollarSign,
  Calendar,
} from "lucide-react";

const STATUS_META: Record<string, { badge: string; label: string }> = {
  draft: { badge: "bg-zinc-500/15 text-zinc-600 border-zinc-500/30", label: "Draft" },
  sent: { badge: "bg-sky-500/15 text-sky-700 border-sky-500/30", label: "Sent" },
  received: { badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", label: "Received" },
  cancelled: { badge: "bg-rose-500/15 text-rose-700 border-rose-500/30", label: "Cancelled" },
};

const STATUSES = ["draft", "sent", "received", "cancelled"];

export function PurchaseOrdersView() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<PurchaseOrder | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<"all" | string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["purchase-orders", statusFilter],
    queryFn: () =>
      purchaseOrdersApi.list(
        statusFilter === "all" ? undefined : { status: statusFilter }
      ),
  });

  const orders = data?.orders ?? [];

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      purchaseOrdersApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Purchase order updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.remove(id),
    onSuccess: () => {
      toast.success("Purchase order deleted");
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "draft" || o.status === "sent").length,
    received: orders.filter((o) => o.status === "received").length,
    totalValue: orders.reduce((s, o) => s + Number(o.totalCost), 0),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Purchase Orders
          </h1>
          <p className="text-sm text-muted-foreground">
            Generate supplier orders for low-stock materials.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          New Purchase Order
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total POs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <TrendingDown className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.received}</p>
              <p className="text-xs text-muted-foreground">Received</p>
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

      {/* PO table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">All Purchase Orders</CardTitle>
              <CardDescription>{orders.length} orders</CardDescription>
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
              Loading purchase orders…
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <ShoppingCart className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No purchase orders yet</p>
                <p className="text-sm text-muted-foreground">
                  Create a PO to restock low inventory items.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="min-w-[110px]">PO #</TableHead>
                    <TableHead className="min-w-[140px]">Supplier</TableHead>
                    <TableHead className="hidden sm:table-cell min-w-[80px]">Items</TableHead>
                    <TableHead className="text-right min-w-[100px]">Total</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="text-right min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((po) => {
                    const meta = STATUS_META[po.status] ?? STATUS_META.draft;
                    return (
                      <TableRow key={po.id} className="hover:bg-muted/40">
                        <TableCell>
                          <p className="font-mono text-xs text-primary">
                            {po.poNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(po.createdAt).toLocaleDateString()}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {po.supplier}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          {po.items.length} item(s)
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          ${Number(po.totalCost).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={meta.badge}>
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {po.status !== "received" && po.status !== "cancelled" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 text-xs"
                                onClick={() =>
                                  updateStatus.mutate({ id: po.id, status: "received" })
                                }
                                disabled={updateStatus.isPending}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Mark Received
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleting(po)}
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

      <CreatePODialog open={createOpen} onOpenChange={setCreateOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete purchase order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {deleting?.poNumber}
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
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreatePODialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: invData } = useQuery({
    queryKey: ["inventory"],
    queryFn: inventoryApi.list,
  });

  const [supplier, setSupplier] = React.useState("");
  const [expectedDate, setExpectedDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<
    Array<{
      inventoryItemId?: string;
      itemName: string;
      quantity: string;
      unit: string;
      unitCost: string;
    }>
  >([]);

  // Auto-populate with low-stock items
  React.useEffect(() => {
    if (open && items.length === 0 && invData) {
      const lowStock = (invData.items ?? []).filter(
        (i) => Number(i.stockLevel) <= Number(i.reorderPoint) && Number(i.reorderPoint) > 0
      );
      if (lowStock.length > 0) {
        setItems(
          lowStock.map((i) => ({
            inventoryItemId: i.id,
            itemName: i.name,
            quantity: String(Math.max(0, Number(i.reorderPoint) - Number(i.stockLevel)) + Number(i.reorderPoint)),
            unit: i.unit,
            unitCost: String(i.unitCost),
          }))
        );
        if (lowStock[0].supplier && !supplier) {
          setSupplier(lowStock[0].supplier ?? "");
        }
      }
    }
  }, [open, invData]);

  function addItem() {
    setItems((arr) => [
      ...arr,
      { itemName: "", quantity: "1", unit: "sheet", unitCost: "0" },
    ]);
  }
  function updateItem(i: number, patch: Partial<(typeof items)[0]>) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function removeItem(i: number) {
    setItems((arr) => arr.filter((_, idx) => idx !== i));
  }

  const create = useMutation({
    mutationFn: () =>
      purchaseOrdersApi.create({
        supplier: supplier.trim(),
        expectedDate: expectedDate || undefined,
        notes: notes || undefined,
        items: items
          .filter((i) => i.itemName.trim())
          .map((i) => ({
            inventoryItemId: i.inventoryItemId,
            itemName: i.itemName,
            quantity: Number(i.quantity) || 0,
            unit: i.unit,
            unitCost: Number(i.unitCost) || 0,
          })),
      }),
    onSuccess: () => {
      toast.success("Purchase order created");
      setSupplier("");
      setExpectedDate("");
      setNotes("");
      setItems([]);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[600px]">
        <DialogTitle className="sr-only">Create purchase order</DialogTitle>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ShoppingCart className="h-5 w-5 text-primary" />
            New Purchase Order
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!supplier.trim()) {
              toast.error("Supplier is required");
              return;
            }
            if (!items.some((i) => i.itemName.trim())) {
              toast.error("Add at least one item");
              return;
            }
            create.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="po-supplier">
                Supplier <span className="text-destructive">*</span>
              </Label>
              <Input
                id="po-supplier"
                placeholder="e.g. Panel Supplies Co"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-date">Expected Date</Label>
              <Input
                id="po-date"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add item
              </Button>
            </div>
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                No items. Low-stock inventory will auto-populate when available.
              </div>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto scrollbar-warm rounded-md border p-2">
                {items.map((it, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-1.5">
                    <Input
                      className="col-span-5 h-8"
                      placeholder="Item name"
                      value={it.itemName}
                      onChange={(e) => updateItem(i, { itemName: e.target.value })}
                    />
                    <Input
                      className="col-span-2 h-8 text-center"
                      type="number"
                      min="0"
                      placeholder="Qty"
                      value={it.quantity}
                      onChange={(e) => updateItem(i, { quantity: e.target.value })}
                    />
                    <Input
                      className="col-span-2 h-8"
                      placeholder="Unit"
                      value={it.unit}
                      onChange={(e) => updateItem(i, { unit: e.target.value })}
                    />
                    <Input
                      className="col-span-2 h-8"
                      type="number"
                      step="0.01"
                      placeholder="Cost"
                      value={it.unitCost}
                      onChange={(e) => updateItem(i, { unitCost: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-span-1 h-8 w-8 text-destructive"
                      onClick={() => removeItem(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="po-notes">Notes</Label>
            <Textarea
              id="po-notes"
              rows={2}
              placeholder="Internal notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="mr-2 h-4 w-4" />
              )}
              Create PO
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
