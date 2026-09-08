"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, type CreateUserPayload } from "@/lib/api";
import type { Role } from "@/lib/types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  X,
  UserPlus,
  Loader2,
  ShieldCheck,
  Wrench,
  Crown,
  Briefcase,
  Boxes,
  Eye,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";
import type { User } from "@/lib/types";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (user: User) => void;
}

const ROLE_OPTIONS: {
  value: Role;
  label: string;
  icon: typeof Crown;
  desc: string;
}[] = [
  {
    value: "SuperAdmin",
    label: "Super Admin",
    icon: Crown,
    desc: "Full system control incl. settings & restore",
  },
  {
    value: "Admin",
    label: "Admin",
    icon: ShieldCheck,
    desc: "Manage users, jobs & cutting lists",
  },
  {
    value: "Manager",
    label: "Manager",
    icon: Briefcase,
    desc: "All operations, backup only (no restore)",
  },
  {
    value: "Storekeeper",
    label: "Storekeeper",
    icon: Boxes,
    desc: "Stock operations (no delete without permission)",
  },
  {
    value: "Auditor",
    label: "Auditor",
    icon: Eye,
    desc: "Reports & viewing only (read-only)",
  },
  {
    value: "Technician",
    label: "Technician",
    icon: Wrench,
    desc: "Site measurement & cut list entry",
  },
];

interface FormState {
  username: string;
  fullName: string;
  password: string;
  role: Role;
  email: string;
  phone: string;
}

const EMPTY_FORM: FormState = {
  username: "",
  fullName: "",
  password: "",
  role: "Technician",
  email: "",
  phone: "",
};

export function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateUserDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [stage, setStage] = React.useState<
    "idle" | "primary" | "fallback" | "done"
  >("idle");

  const reset = React.useCallback(() => {
    setForm(EMPTY_FORM);
    setStage("idle");
  }, []);

  // Close handler also resets the form
  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  /**
   * ROBUST USER CREATION — mirrors the Supabase blueprint exactly:
   *  1. Generate an explicit UUID in the frontend BEFORE sending the payload.
   *  2. Map the complete payload (id, p_id, username, full_name, password,
   *     role, status, created_at).
   *  3. Try the primary handler (POST /api/users, the RPC-equivalent).
   *     On failure, fall back to the direct insert endpoint
   *     (POST /api/users/direct).
   *  4. Post-creation: success toast, clear inputs, close modal, refetch list.
   */
  const createMutation = useMutation({
    mutationFn: async () => {
      // 1. Explicit frontend UUID — guarantees the non-null id constraint.
      const newUserId = crypto.randomUUID();

      // 2. Map complete payload (both id and p_id carry the UUID, matching the
      //    Supabase pattern where p_id is the RPC param name).
      const userPayload: CreateUserPayload = {
        id: newUserId,
        p_id: newUserId,
        username: form.username.trim(),
        fullName: form.fullName.trim(),
        full_name: form.fullName.trim(),
        password: form.password,
        role: form.role,
        status: "active",
        created_at: new Date().toISOString(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
      };

      // 3. Try primary handler first.
      setStage("primary");
      try {
        return await usersApi.create(userPayload);
      } catch (primaryErr) {
        // Fallback to direct table insertion if RPC/primary fails or throws.
        console.warn(
          "Primary create handler failed, falling back to direct table insert:",
          primaryErr
        );
        setStage("fallback");
        const fallback = await usersApi.createDirect(userPayload);
        return fallback;
      }
    },
    onSuccess: (data) => {
      // 4. Post-creation actions.
      setStage("done");
      toast.success("User created", {
        description: `${data.user.fullName} (@${data.user.username}) added as ${data.user.role}.`,
      });
      // Clear form inputs
      reset();
      // Close modal
      onOpenChange(false);
      // Trigger instant user list re-fetch
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      onCreated?.(data.user);
    },
    onError: (err: Error) => {
      setStage("idle");
      toast.error("Failed to create user", {
        description: err.message,
      });
    },
  });

  const valid =
    form.username.trim() &&
    form.fullName.trim() &&
    form.password.length >= 6;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      toast.error("Please complete all required fields", {
        description: "Password must be at least 6 characters.",
      });
      return;
    }
    createMutation.mutate();
  }

  const submitting = createMutation.isPending;
  const isFallback = stage === "fallback";

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton={false} className="sm:max-w-[480px] max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-warm">
          {/* Explicit DialogTitle present (accessibility safeguard) */}
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription className="mt-0.5">
                    Add a team member to the operations console.
                  </DialogDescription>
                </div>
              </div>
              {/* Explicit close button with X icon import (console stability) */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cu-username">
                  Username <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cu-username"
                  placeholder="e.g. jsmith"
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                  required
                  disabled={submitting}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cu-fullname">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cu-fullname"
                  placeholder="e.g. Jane Smith"
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fullName: e.target.value }))
                  }
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cu-password">
                Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cu-password"
                type="password"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                required
                disabled={submitting}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Passwords are bcrypt-hashed before storage.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <div className="grid grid-cols-1 gap-2">
                {ROLE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = form.role === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, role: opt.value }))
                      }
                      disabled={submitting}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      <div
                        className={`rounded-md p-1.5 ${
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {opt.desc}
                        </p>
                      </div>
                      {selected && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cu-email">Email</Label>
                <Input
                  id="cu-email"
                  type="email"
                  placeholder="optional"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cu-phone">Phone</Label>
                <Input
                  id="cu-phone"
                  placeholder="optional"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  disabled={submitting}
                />
              </div>
            </div>

            {isFallback && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                <Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin" />
                <span>
                  Primary handler unavailable — using direct-insert fallback to
                  guarantee the record is saved.
                </span>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !valid}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isFallback ? "Saving via fallback…" : "Creating…"}
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create User
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation that a fallback path was taken — informational */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry creation?</AlertDialogTitle>
            <AlertDialogDescription>
              The previous attempt entered the fallback path. Confirm to retry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                createMutation.mutate();
              }}
            >
              Retry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
