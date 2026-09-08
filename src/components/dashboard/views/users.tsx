"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import type { User, Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { CreateUserDialog } from "../users/create-user-dialog";
import { EditUserDialog } from "../users/edit-user-dialog";
import { useAuth } from "@/components/providers";
import { toast } from "sonner";
import {
  UserPlus,
  Search,
  Pencil,
  Trash2,
  ShieldCheck,
  Crown,
  Wrench,
  Briefcase,
  Boxes,
  Eye,
  Loader2,
  Users as UsersIcon,
  Mail,
  Phone,
  Filter,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui-helpers";

const ROLE_META: Record<
  Role,
  { icon: typeof Crown; badge: string; tint: string }
> = {
  SuperAdmin: {
    icon: Crown,
    badge: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    tint: "bg-amber-500/10 text-amber-600",
  },
  Admin: {
    icon: ShieldCheck,
    badge: "bg-teal-500/15 text-teal-700 border-teal-500/30",
    tint: "bg-teal-500/10 text-teal-600",
  },
  Manager: {
    icon: Briefcase,
    badge: "bg-sky-500/15 text-sky-700 border-sky-500/30",
    tint: "bg-sky-500/10 text-sky-600",
  },
  Storekeeper: {
    icon: Boxes,
    badge: "bg-orange-500/15 text-orange-700 border-orange-500/30",
    tint: "bg-orange-500/10 text-orange-600",
  },
  Auditor: {
    icon: Eye,
    badge: "bg-slate-500/15 text-slate-700 border-slate-500/30",
    tint: "bg-slate-500/10 text-slate-600",
  },
  Technician: {
    icon: Wrench,
    badge: "bg-violet-500/15 text-violet-700 border-violet-500/30",
    tint: "bg-violet-500/10 text-violet-600",
  },
};

export function UsersView() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<User | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<User | null>(null);
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<"all" | Role>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  const users = data?.users ?? [];

  const filtered = React.useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !search ||
        u.fullName.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.email ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err: Error) => {
      toast.error("Delete failed", { description: err.message });
    },
  });

  // ---- Undo-aware delete: optimistically remove + Undo toast (5s) ----
  const undoRef = React.useRef<{
    user: User;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);

  function deleteUserWithUndo(user: User) {
    const timeoutId = setTimeout(() => {
      deleteMutation.mutate(user.id);
      undoRef.current = null;
    }, 5000);
    undoRef.current = { user, timeoutId };

    // Optimistically remove from cache
    queryClient.setQueryData<{ users: User[] } | undefined>(
      ["users"],
      (old) =>
        old
          ? { ...old, users: old.users.filter((u) => u.id !== user.id) }
          : old
    );

    // Close the confirmation dialog immediately
    setDeleting(null);

    toast(`User "${user.fullName}" deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          if (undoRef.current) {
            clearTimeout(undoRef.current.timeoutId);
            const restored = undoRef.current.user;
            queryClient.setQueryData<{ users: User[] } | undefined>(
              ["users"],
              (old) => {
                if (!old) return { users: [restored] };
                if (old.users.some((u) => u.id === restored.id)) return old;
                return { ...old, users: [restored, ...old.users] };
              }
            );
            toast.success("User restored");
            undoRef.current = null;
          }
        },
      },
      duration: 5000,
    });
  }

  function handleEdit(user: User) {
    setEditing(user);
    setEditOpen(true);
  }

  const counts = React.useMemo(() => {
    return {
      total: users.length,
      admin: users.filter((u) => u.role !== "Technician").length,
      tech: users.filter((u) => u.role === "Technician").length,
      active: users.filter((u) => u.status === "active").length,
    };
  }, [users]);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">User Management</h1>
          <p className="text-xs text-muted-foreground">
            Manage console access for your team.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="w-full sm:w-auto">
          <UserPlus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          label="Total Users"
          value={counts.total}
          icon={UsersIcon}
          tint="bg-primary/10 text-primary"
        />
        <MiniStat
          label="Admins"
          value={counts.admin}
          icon={ShieldCheck}
          tint="bg-teal-500/10 text-teal-600"
        />
        <MiniStat
          label="Technicians"
          value={counts.tech}
          icon={Wrench}
          tint="bg-violet-500/10 text-violet-600"
        />
        <MiniStat
          label="Active"
          value={counts.active}
          icon={ShieldCheck}
          tint="bg-emerald-500/10 text-emerald-600"
        />
      </div>

      {/* Filters + table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">All Users</CardTitle>
              <CardDescription>
                {filtered.length} of {users.length} shown
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-8 sm:w-72"
                />
              </div>
              <Select
                value={roleFilter}
                onValueChange={(v) => setRoleFilter(v as "all" | Role)}
              >
                <SelectTrigger className="h-9 w-full sm:w-40">
                  <Filter className="mr-1.5 h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="SuperAdmin">Super Admin</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Storekeeper">Storekeeper</SelectItem>
                  <SelectItem value="Auditor">Auditor</SelectItem>
                  <SelectItem value="Technician">Technician</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading users…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title="No users found"
              description={
                search || roleFilter !== "all"
                  ? "Try adjusting your filters."
                  : "Create your first user to get started."
              }
              action={
                !search && roleFilter === "all" ? (
                  <Button onClick={() => setCreateOpen(true)} variant="outline">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create User
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="max-h-[60vh] overflow-auto scrollbar-warm">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>User</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Contact
                    </TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Joined
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u, idx) => {
                    const meta = ROLE_META[u.role];
                    const RoleIcon = meta.icon;
                    const initials = u.fullName
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    return (
                      <TableRow key={u.id} className={`hover:bg-muted/50 ${idx % 2 === 1 ? "bg-muted/40" : ""}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-border">
                              <AvatarFallback className={meta.tint}>
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {u.fullName}
                                {currentUser?.id === u.id && (
                                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                    (you)
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                @{u.username}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="space-y-0.5">
                            {u.email && (
                              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {u.email}
                              </p>
                            )}
                            {u.phone && (
                              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {u.phone}
                              </p>
                            )}
                            {!u.email && !u.phone && (
                              <span className="text-xs text-muted-foreground/60">
                                —
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`gap-1 ${meta.badge}`}
                          >
                            <RoleIcon className="h-3 w-3" />
                            {u.role === "SuperAdmin"
                              ? "Super Admin"
                              : u.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.status === "active" ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                              Active
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground"
                            >
                              {u.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                          {u.createdAt
                            ? new Date(u.createdAt).toLocaleDateString(
                                undefined,
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }
                              )
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(u)}
                              aria-label={`Edit ${u.fullName}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleting(u)}
                              disabled={currentUser?.id === u.id}
                              aria-label={`Delete ${u.fullName}`}
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

      {/* Create modal with robust user-creation logic */}
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Edit modal */}
      <EditUserDialog
        user={editing}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove{" "}
              <span className="font-medium text-foreground">
                {deleting?.fullName}
              </span>{" "}
              (@{deleting?.username}) from the console. You can undo this from
              the toast that appears.
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
                if (deleting) deleteUserWithUndo(deleting);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete user"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  icon: typeof UsersIcon;
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
