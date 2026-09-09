"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { suppliersApi, type Supplier } from "@/lib/api";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Truck,
  Plus,
  Loader2,
  X,
  Pencil,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Globe,
  User as UserIcon,
  FileText,
  Package,
  ShoppingCart,
} from "lucide-react";

export function SuppliersView() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Supplier | null>(null);
  const [deleting, setDeleting] = React.useState<Supplier | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: suppliersApi.list,
  });
  const suppliers = data?.suppliers ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => suppliersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Undo-aware delete: optimistically remove + Undo toast (5s) ----
  const undoRef = React.useRef<{
    supplier: Supplier;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);

  function deleteSupplierWithUndo(supplier: Supplier) {
    const timeoutId = setTimeout(() => {
      deleteMutation.mutate(supplier.id);
      undoRef.current = null;
    }, 5000);
    undoRef.current = { supplier, timeoutId };

    // Optimistically remove from cache
    queryClient.setQueryData<{ suppliers: Supplier[] } | undefined>(
      ["suppliers"],
      (old) =>
        old
          ? { ...old, suppliers: old.suppliers.filter((s) => s.id !== supplier.id) }
          : old
    );

    // Close the confirmation dialog immediately
    setDeleting(null);

    toast(`Supplier "${supplier.name}" deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          if (undoRef.current) {
            clearTimeout(undoRef.current.timeoutId);
            const restored = undoRef.current.supplier;
            queryClient.setQueryData<{ suppliers: Supplier[] } | undefined>(
              ["suppliers"],
              (old) => {
                if (!old) return { suppliers: [restored] };
                if (old.suppliers.some((s) => s.id === restored.id)) return old;
                return { ...old, suppliers: [restored, ...old.suppliers] };
              }
            );
            toast.success("Supplier restored");
            undoRef.current = null;
          }
        },
      },
      duration: 5000,
    });
  }

  function handleEdit(supplier: Supplier) {
    setEditing(supplier);
    setModalOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Truck className="h-5 w-5 text-primary" />
            Suppliers
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage supplier directory and contact information.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{suppliers.length}</p>
              <p className="text-xs text-muted-foreground">Total Suppliers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-teal-500/10 p-2">
              <Package className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {suppliers.reduce((s, sup) => s + (sup.inventoryCount ?? 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground">Inventory Items</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-violet-500/10 p-2">
              <ShoppingCart className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {suppliers.reduce((s, sup) => s + (sup.poCount ?? 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground">Purchase Orders</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suppliers grid */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading suppliers…
        </div>
      ) : suppliers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <Truck className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No suppliers yet</p>
              <p className="text-sm text-muted-foreground">
                Add suppliers to track contacts and link to inventory.
              </p>
            </div>
            <Button onClick={() => { setEditing(null); setModalOpen(true); }} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add First Supplier
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {suppliers.map((supplier) => {
            const initials = supplier.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <Card key={supplier.id} className="group transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-border">
                        <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{supplier.name}</CardTitle>
                        {supplier.contactName && (
                          <CardDescription className="truncate">
                            {supplier.contactName}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(supplier)}
                        aria-label={`Edit supplier ${supplier.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleting(supplier)}
                        aria-label={`Delete supplier ${supplier.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {supplier.email && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <a href={`mailto:${supplier.email}`} className="hover:text-foreground hover:underline truncate">
                        {supplier.email}
                      </a>
                    </p>
                  )}
                  {supplier.phone && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <a href={`tel:${supplier.phone}`} className="hover:text-foreground hover:underline">
                        {supplier.phone}
                      </a>
                    </p>
                  )}
                  {supplier.website && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline truncate">
                        {supplier.website}
                      </a>
                    </p>
                  )}
                  {supplier.address && (
                    <p className="flex items-start gap-2 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{supplier.address}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(supplier.inventoryCount ?? 0) > 0 && (
                      <Badge variant="outline" className="text-xs">
                        <Package className="mr-1 h-3 w-3" />
                        {supplier.inventoryCount} items
                      </Badge>
                    )}
                    {(supplier.poCount ?? 0) > 0 && (
                      <Badge variant="outline" className="text-xs">
                        <ShoppingCart className="mr-1 h-3 w-3" />
                        {supplier.poCount} POs
                      </Badge>
                    )}
                    {supplier.paymentTerms && (
                      <Badge variant="outline" className="text-xs">
                        <FileText className="mr-1 h-3 w-3" />
                        {supplier.paymentTerms}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <SupplierDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        supplier={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete{" "}
              <span className="font-medium text-foreground">{deleting?.name}</span>.
              You can undo this from the toast that appears.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteSupplierWithUndo(deleting);
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

function SupplierDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplier: Supplier | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [paymentTerms, setPaymentTerms] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (supplier) {
      setName(supplier.name);
      setContactName(supplier.contactName ?? "");
      setEmail(supplier.email ?? "");
      setPhone(supplier.phone ?? "");
      setAddress(supplier.address ?? "");
      setWebsite(supplier.website ?? "");
      setPaymentTerms(supplier.paymentTerms ?? "");
      setNotes(supplier.notes ?? "");
    } else {
      setName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setAddress("");
      setWebsite("");
      setPaymentTerms("");
      setNotes("");
    }
  }, [supplier]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        contactName: contactName || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        website: website || null,
        paymentTerms: paymentTerms || null,
        notes: notes || null,
      };
      if (supplier) {
        return suppliersApi.update(supplier.id, payload);
      }
      return suppliersApi.create(payload);
    },
    onSuccess: () => {
      toast.success(supplier ? "Supplier updated" : "Supplier added");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast.error(supplier ? "Update failed" : "Create failed", {
        description: e.message,
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[480px]">
        <DialogTitle className="sr-only">Supplier</DialogTitle>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Truck className="h-5 w-5 text-primary" />
            {supplier ? "Edit Supplier" : "Add Supplier"}
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
            if (!name.trim()) {
              toast.error("Supplier name is required");
              return;
            }
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="sup-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sup-name"
              placeholder="e.g. Panel Supplies Co"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sup-contact" className="flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5" /> Contact Name
              </Label>
              <Input
                id="sup-contact"
                placeholder="John Smith"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-phone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Phone
              </Label>
              <Input
                id="sup-phone"
                placeholder="+1 555 0100"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sup-email" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email
              </Label>
              <Input
                id="sup-email"
                type="email"
                placeholder="sales@supplier.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-website" className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" /> Website
              </Label>
              <Input
                id="sup-website"
                placeholder="https://…"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sup-address" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Address
            </Label>
            <Textarea
              id="sup-address"
              rows={2}
              placeholder="Street, City, State"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sup-terms" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Payment Terms
            </Label>
            <Input
              id="sup-terms"
              placeholder="e.g. Net 30, COD"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sup-notes">Notes</Label>
            <Textarea
              id="sup-notes"
              rows={2}
              placeholder="Internal notes about this supplier…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Truck className="mr-2 h-4 w-4" />
              )}
              {supplier ? "Save Changes" : "Add Supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
