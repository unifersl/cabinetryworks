"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { userPermissionsApi, usersApi, type SessionUser } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  ShieldCheck, Crown, Wrench, Briefcase, Boxes, Eye,
  Search, Lock, Check, X, RefreshCw, Loader2,
} from "lucide-react";
import type { Role } from "@/lib/types";

// All modules — core + add-on
const ALL_MODULES = [
  // Core (always visible)
  { id: "overview", label: "Overview", group: "Core" },
  { id: "job-orders", label: "Job Orders", group: "Core" },
  { id: "customers", label: "Customers", group: "Core" },
  { id: "attendance", label: "Attendance", group: "Core" },
  { id: "measurements", label: "Site Measurements", group: "Core" },
  { id: "blueprints", label: "Site Notebook Builder", group: "Core" },
  { id: "cutting-lists", label: "Factory Cutting Lists", group: "Core" },
  { id: "inventory", label: "Inventory", group: "Core" },
  { id: "suppliers", label: "Suppliers", group: "Core" },
  { id: "quotes", label: "Quotes & Costing", group: "Core" },
  { id: "users", label: "User Management", group: "Core" },
  { id: "reports", label: "Reports", group: "Core" },
  { id: "settings", label: "System Settings", group: "Core" },
  { id: "audit", label: "Audit Log", group: "Core" },
  { id: "user-guide", label: "User Guide", group: "Core" },
  // Add-on modules
  { id: "scheduling", label: "Production Schedule", group: "Add-on" },
  { id: "quality-control", label: "Quality Control", group: "Add-on" },
  { id: "deliveries", label: "Delivery & Install", group: "Add-on" },
  { id: "documents", label: "Documents", group: "Add-on" },
  { id: "templates", label: "Job Templates", group: "Add-on" },
  { id: "warranty", label: "Warranty", group: "Add-on" },
  { id: "barcodes", label: "Barcode/QR", group: "Add-on" },
  { id: "forecasting", label: "Forecasting", group: "Add-on" },
  { id: "calendar", label: "Unified Calendar", group: "Add-on" },
  { id: "punch-list", label: "Punch List", group: "Add-on" },
  { id: "change-orders", label: "Change Orders", group: "Add-on" },
  { id: "communications", label: "Communication Log", group: "Add-on" },
  { id: "subcontractors", label: "Subcontractors", group: "Add-on" },
  { id: "equipment", label: "Equipment", group: "Add-on" },
  { id: "milestones", label: "Milestones", group: "Add-on" },
  { id: "mrp", label: "MRP", group: "Add-on" },
  { id: "site-visits", label: "Site Visits", group: "Add-on" },
] as const;

const ROLE_LABELS: Record<string, string> = {
  SuperAdmin: "Super Admin",
  Admin: "Admin",
  Manager: "Manager",
  Storekeeper: "Storekeeper",
  Auditor: "Auditor",
  Technician: "Technician",
};

const ROLE_ICONS: Record<string, typeof Crown> = {
  SuperAdmin: Crown,
  Admin: ShieldCheck,
  Manager: Briefcase,
  Storekeeper: Boxes,
  Auditor: Eye,
  Technician: Wrench,
};

export function UserCentralView() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
  });
  const users = (usersData?.users ?? []).filter((u: SessionUser) => u.role !== "SuperAdmin");

  const { data: permsData, isLoading: permsLoading } = useQuery({
    queryKey: ["user-permissions", selectedUserId],
    queryFn: () => userPermissionsApi.list(selectedUserId || undefined),
    enabled: !!selectedUserId,
  });

  // Build a map of userId → Map<moduleId, allowed>
  const permsMap = React.useMemo(() => {
    const map = new Map<string, Map<string, boolean>>();
    for (const p of permsData?.permissions ?? []) {
      if (!map.has(p.userId)) map.set(p.userId, new Map());
      map.get(p.userId)!.set(p.moduleId, p.allowed);
    }
    return map;
  }, [permsData]);

  const toggleMutation = useMutation({
    mutationFn: ({ userId, moduleId, allowed }: { userId: string; moduleId: string; allowed: boolean }) =>
      userPermissionsApi.set(userId, moduleId, allowed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
    },
    onError: (e: Error) => toast.error("Failed to update permission", { description: e.message }),
  });

  const resetMutation = useMutation({
    mutationFn: ({ userId, moduleId }: { userId: string; moduleId: string }) =>
      userPermissionsApi.reset(userId, moduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
      toast.success("Permission reset to role default");
    },
    onError: (e: Error) => toast.error("Failed to reset permission", { description: e.message }),
  });

  const filteredUsers = users.filter(
    (u: SessionUser) =>
      !search ||
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase()),
  );

  // Group modules
  const coreModules = ALL_MODULES.filter((m) => m.group === "Core");
  const addonModules = ALL_MODULES.filter((m) => m.group === "Add-on");

  function getPermission(userId: string, moduleId: string): "granted" | "revoked" | "default" {
    const userPerms = permsMap.get(userId);
    if (!userPerms) return "default";
    const val = userPerms.get(moduleId);
    if (val === undefined) return "default";
    return val ? "granted" : "revoked";
  }

  function handleToggle(userId: string, moduleId: string, current: "granted" | "revoked" | "default") {
    // If default → grant; if granted → revoke; if revoked → reset to default
    if (current === "default") {
      toggleMutation.mutate({ userId, moduleId, allowed: true });
      toast.success(`Granted "${moduleId}"`);
    } else if (current === "granted") {
      toggleMutation.mutate({ userId, moduleId, allowed: false });
      toast.success(`Revoked "${moduleId}"`);
    } else {
      resetMutation.mutate({ userId, moduleId });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <ShieldCheck className="h-5 w-5 text-primary" />
            User Central Panel
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Assign or revoke modules and features for any user. SuperAdmin only.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: User list */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Select User</CardTitle>
            <CardDescription className="text-xs">
              {users.length} users (SuperAdmin excluded — always full access)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-8"
                />
              </div>
            </div>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-1 px-2 pb-2">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No users found</div>
                ) : (
                  filteredUsers.map((u: SessionUser) => {
                    const RoleIcon = ROLE_ICONS[u.role] ?? Wrench;
                    const isSelected = selectedUserId === u.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-transparent hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <RoleIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-sm">{u.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">@{u.username} · {ROLE_LABELS[u.role] ?? u.role}</p>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Permission matrix for selected user */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            {selectedUserId ? (
              (() => {
                const u = users.find((x: SessionUser) => x.id === selectedUserId);
                if (!u) return null;
                const RoleIcon = ROLE_ICONS[u.role] ?? Wrench;
                return (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <RoleIcon className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-base">{u.fullName}</CardTitle>
                        <CardDescription className="text-xs">
                          @{u.username} · {ROLE_LABELS[u.role] ?? u.role} · Role-based defaults apply unless overridden
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div>
                <CardTitle className="text-base">Module Permissions</CardTitle>
                <CardDescription className="text-xs">Select a user to manage their module access</CardDescription>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selectedUserId ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="rounded-full bg-muted p-4">
                  <ShieldCheck className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium text-sm">No user selected</p>
                <p className="text-xs text-muted-foreground">
                  Select a user from the left panel to manage their module permissions.
                </p>
              </div>
            ) : permsLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Legend */}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Granted (override)</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Revoked (override)</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Role default</span>
                </div>

                {/* Core modules */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Core Modules</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {coreModules.map((mod) => {
                      const state = getPermission(selectedUserId, mod.id);
                      return (
                        <PermissionRow
                          key={mod.id}
                          label={mod.label}
                          moduleId={mod.id}
                          state={state}
                          onToggle={() => handleToggle(selectedUserId, mod.id, state)}
                          isLoading={toggleMutation.isPending || resetMutation.isPending}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Add-on modules */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Add-on Modules</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {addonModules.map((mod) => {
                      const state = getPermission(selectedUserId, mod.id);
                      return (
                        <PermissionRow
                          key={mod.id}
                          label={mod.label}
                          moduleId={mod.id}
                          state={state}
                          onToggle={() => handleToggle(selectedUserId, mod.id, state)}
                          isLoading={toggleMutation.isPending || resetMutation.isPending}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PermissionRow({
  label,
  moduleId,
  state,
  onToggle,
  isLoading,
}: {
  label: string;
  moduleId: string;
  state: "granted" | "revoked" | "default";
  onToggle: () => void;
  isLoading: boolean;
}) {
  const colors = {
    granted: "border-emerald-500/40 bg-emerald-500/5",
    revoked: "border-rose-500/40 bg-rose-500/5",
    default: "border-border bg-card",
  };
  const dotColors = {
    granted: "bg-emerald-500",
    revoked: "bg-rose-500",
    default: "bg-slate-400",
  };
  const labels = {
    granted: "Granted",
    revoked: "Revoked",
    default: "Default",
  };

  return (
    <div className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 ${colors[state]}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{label}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className={`h-2 w-2 rounded-full ${dotColors[state]}`} />
          <span className="text-[9px] text-muted-foreground">{labels[state]}</span>
          {state !== "default" && (
            <button
              onClick={() => {
                // Reset to default — third click
                onToggle();
              }}
              className="ml-1 text-[9px] text-primary hover:underline"
              disabled={isLoading}
            >
              Reset
            </button>
          )}
        </div>
      </div>
      <Switch
        checked={state !== "revoked"}
        onCheckedChange={onToggle}
        disabled={isLoading}
        aria-label={`Toggle ${label}`}
      />
    </div>
  );
}
