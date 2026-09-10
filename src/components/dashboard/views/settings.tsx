"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi, usersApi, auditApi, backupApi } from "@/lib/api";
import { useAuth } from "@/components/providers";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  Save,
  Loader2,
  Factory,
  Ruler,
  Package,
  Phone,
  Building2,
  Trash2,
  ToggleLeft,
  Download,
  Upload,
  Database,
  HardDrive,
  Cloud,
  FileJson,
  Users,
  ShieldCheck,
  Settings2,
  Sparkles,
  Gift,
} from "lucide-react";
import { NAV_ITEMS, getModuleToggles, setModuleToggles, APP_VERSION, APP_VERSION_DATE, NEW_MODULES_V2 } from "../nav-config";

const DEFAULTS = {
  factory_name: "CabinetryWorks Manufacturing",
  default_material: "MDF 18mm",
  default_thickness: "18mm",
  default_edge_banding: "1mm PVC",
  standard_ceiling_ht: "2700mm",
  production_lead_days: "14",
  sheet_size_sqm: "2.88",
  currency: "USD",
  tax_rate: "0",
  contact_phone: "",
  contact_email: "",
  address: "",
  workshop_address: "",
  notes: "",
};

/* Bento field component — compact label + input in a tight row */
function BentoField({
  label,
  icon: Icon,
  children,
  span,
}: {
  label: string;
  icon?: any;
  children: React.ReactNode;
  span?: string;
}) {
  return (
    <div className={`space-y-1 ${span ?? ""}`}>
      <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </Label>
      {children}
    </div>
  );
}

export function SettingsView() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
  });
  const [form, setForm] = React.useState<Record<string, string>>(DEFAULTS);

  React.useEffect(() => {
    if (data?.settings) {
      setForm({ ...DEFAULTS, ...data.settings });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => settingsApi.update(form),
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading settings…
      </div>
    );
  }

  const activeUsers = usersData?.users.filter((u: any) => u.status === "active").length ?? 0;
  const totalUsers = usersData?.users.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Compact header with inline save */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Settings2 className="h-5 w-5 text-primary" />
            System Settings
          </h1>
          <p className="text-xs text-muted-foreground">
            Factory defaults, modules, backup & system config
          </p>
        </div>
        <Button
          type="submit"
          form="settings-form"
          disabled={save.isPending}
          size="sm"
        >
          {save.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Bento grid */}
      <form
        id="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {/* Company Profile — spans 2 cols on large */}
          <Card className="md:col-span-2 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-primary" />
                Company Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <BentoField label="Factory Name" span="col-span-2">
                <Input value={form.factory_name ?? ""} onChange={(e) => set("factory_name", e.target.value)} className="h-8 text-sm" />
              </BentoField>
              <BentoField label="Phone" icon={Phone}>
                <Input value={form.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} className="h-8 text-sm" />
              </BentoField>
              <BentoField label="Email">
                <Input type="email" value={form.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} className="h-8 text-sm" />
              </BentoField>
              <BentoField label="Business Address" span="col-span-2">
                <Textarea rows={1} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} className="text-sm" />
              </BentoField>
              <BentoField label="Workshop Address" icon={Factory} span="col-span-2">
                <Textarea rows={1} value={form.workshop_address ?? ""} onChange={(e) => set("workshop_address", e.target.value)} className="text-sm" />
              </BentoField>
            </CardContent>
          </Card>

          {/* Production Defaults — 1 col */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Factory className="h-4 w-4 text-primary" />
                Production Defaults
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <BentoField label="Material" icon={Package}>
                <Input value={form.default_material ?? ""} onChange={(e) => set("default_material", e.target.value)} className="h-8 text-sm" />
              </BentoField>
              <BentoField label="Thickness">
                <Input value={form.default_thickness ?? ""} onChange={(e) => set("default_thickness", e.target.value)} className="h-8 text-sm" />
              </BentoField>
              <BentoField label="Edge Banding">
                <Input value={form.default_edge_banding ?? ""} onChange={(e) => set("default_edge_banding", e.target.value)} className="h-8 text-sm" />
              </BentoField>
              <BentoField label="Ceiling Ht" icon={Ruler}>
                <Input value={form.standard_ceiling_ht ?? ""} onChange={(e) => set("standard_ceiling_ht", e.target.value)} className="h-8 text-sm" />
              </BentoField>
              <BentoField label="Lead Time (days)">
                <Input type="number" min={1} value={form.production_lead_days ?? ""} onChange={(e) => set("production_lead_days", e.target.value)} className="h-8 text-sm" />
              </BentoField>
              <BentoField label="Sheet Size (m²)">
                <Input type="number" min="0.1" step="0.01" value={form.sheet_size_sqm ?? ""} onChange={(e) => set("sheet_size_sqm", e.target.value)} className="h-8 text-sm" />
              </BentoField>
            </CardContent>
          </Card>

          {/* Financial + Notes — 1 col */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-primary" />
                Financial & Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <BentoField label="Currency">
                  <Input value={form.currency ?? ""} onChange={(e) => set("currency", e.target.value)} className="h-8 text-sm" />
                </BentoField>
                <BentoField label="Tax Rate (%)">
                  <Input type="number" min={0} step="0.1" value={form.tax_rate ?? ""} onChange={(e) => set("tax_rate", e.target.value)} className="h-8 text-sm" />
                </BentoField>
              </div>
              <BentoField label="General Notes">
                <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} className="text-sm" />
              </BentoField>
            </CardContent>
          </Card>

          {/* System Stats — 1 col */}
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-primary" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Registered Users
                </span>
                <Badge variant="secondary" className="text-xs">{totalUsers}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Active Users
                </span>
                <Badge variant="default" className="text-xs bg-emerald-600">{activeUsers}</Badge>
              </div>
              <Separator className="my-2" />
              <AuditRetention />
            </CardContent>
          </Card>

          {/* Module Toggles — spans 2 cols */}
          <Card className="md:col-span-2 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ToggleLeft className="h-4 w-4 text-primary" />
                Module Visibility
              </CardTitle>
              <CardDescription className="text-xs">
                Toggle optional modules. Changes apply immediately.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ModuleTogglesGrid />
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Backup & Restore — full width below the grid */}
      {/* What's New — changelog */}
      <WhatsNewSection />

      <BackupSection />

      {/* Demo Data — SuperAdmin only */}
      <DemoDataSection />
    </div>
  );
}

/* Compact module toggle grid */
function ModuleTogglesGrid() {
  const [toggles, setToggles] = React.useState<Record<string, boolean>>({});
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    setToggles(getModuleToggles());
  }, [refreshKey]);

  const toggleableItems = NAV_ITEMS.filter((n) => n.toggleable);

  function handleToggle(id: string, enabled: boolean) {
    const newToggles = { ...toggles, [id]: enabled };
    setToggles(newToggles);
    setModuleToggles(newToggles);
    toast.success(`${enabled ? "Enabled" : "Disabled"}: ${toggleableItems.find((t) => t.id === id)?.label ?? id}`);
    setRefreshKey((k) => k + 1);
    setTimeout(() => window.location.reload(), 500);
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {toggleableItems.map((item) => {
        const Icon = item.icon;
        // New modules (v2) default OFF, existing ones default ON
        const isV2New = NEW_MODULES_V2.includes(item.id);
        const isEnabled = isV2New ? toggles[item.id] === true : toggles[item.id] !== false;
        return (
          <div
            key={item.id}
            className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 transition-colors relative ${
              isEnabled ? "border-border bg-card" : "border-border bg-muted/30 opacity-70"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className={`rounded-md p-1 shrink-0 ${isEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-medium leading-tight">{item.label}</span>
              {item.isNew && (
                <span className="rounded-full bg-emerald-500 px-1 py-0.5 text-[7px] font-bold leading-none text-white shrink-0">
                  NEW
                </span>
              )}
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => handleToggle(item.id, checked)}
            />
          </div>
        );
      })}
    </div>
  );
}

function AuditRetention() {
  const queryClient = useQueryClient();
  const [days, setDays] = React.useState("90");

  const cleanup = useMutation({
    mutationFn: () => auditApi.retention(Number(days)),
    onSuccess: (data) => {
      toast.success(`Deleted ${data.deleted} audit entries older than ${data.days} days`);
      queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min="1"
        value={days}
        onChange={(e) => setDays(e.target.value)}
        className="h-7 w-14 text-xs"
        disabled={cleanup.isPending}
      />
      <span className="text-[10px] text-muted-foreground">days</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        disabled={cleanup.isPending}
        onClick={() => {
          if (confirm(`Delete all audit entries older than ${days} days? This cannot be undone.`)) {
            cleanup.mutate();
          }
        }}
      >
        {cleanup.isPending ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Trash2 className="mr-1 h-3 w-3" />
        )}
        Cleanup
      </Button>
    </div>
  );
}

/* ============ Backup & Restore Section ============ */
function BackupSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin" || user?.role === "SuperAdmin";
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);

  const { data: backupList, refetch } = useQuery({
    queryKey: ["backups"],
    queryFn: () => backupApi.list(),
    enabled: isAdmin,
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch("/api/backup/export", { method: "GET" });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cabinetryworks-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast.success("Backup exported — file downloaded");
      refetch();
    },
    onError: () => toast.error("Backup export failed"),
  });

  function handleImport(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data.data || typeof data.data !== "object") {
          toast.error("Invalid backup file format");
          return;
        }
        if (!confirm(`Restore ${data.totalRecords ?? "all"} records from backup dated ${data.timestamp ?? "unknown"}? This will overwrite existing data.`)) {
          return;
        }
        setImporting(true);
        const result = await backupApi.import(data.data);
        toast.success(`Restore complete: ${result.totalImported} imported, ${result.totalSkipped} skipped`);
        refetch();
      } catch {
        toast.error("Failed to read backup file");
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  }

  if (!isAdmin) return null;

  const backups = backupList?.backups ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-primary" />
              Data Backup & Restore
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Auto-backup on logout · Cloud-compatible JSON · Manual anytime
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="default" size="sm" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
              {exportMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
              Backup
            </Button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              Restore
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Left: Cloud info + backup info */}
          <div className="space-y-2">
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-2.5 text-xs">
              <p className="flex items-center gap-1.5 font-medium text-blue-700 dark:text-blue-400">
                <Cloud className="h-3.5 w-3.5" />
                Cloud Compatible
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Upload JSON to Google Drive, Mega, or Mediafire for off-site storage.
              </p>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <FileJson className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                <p>Includes all data: users, jobs, inventory, attendance, expenses, and more.</p>
                <p className="mt-0.5">Auto-backup triggers on every logout.</p>
              </div>
            </div>
          </div>

          {/* Right: Backup history */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <HardDrive className="h-3.5 w-3.5" />
              Server Backups ({backups.length})
            </p>
            {backups.length > 0 ? (
              <div className="max-h-32 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-1.5 text-left">Date</th>
                      <th className="p-1.5 text-left">Type</th>
                      <th className="p-1.5 text-right">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.slice(0, 15).map((b) => (
                      <tr key={b.filename} className="border-t border-border">
                        <td className="p-1.5 font-mono">{b.date}</td>
                        <td className="p-1.5">
                          <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${
                            b.type.includes("auto") ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                          }`}>
                            {b.type}
                          </span>
                        </td>
                        <td className="p-1.5 text-right tabular-nums text-muted-foreground">
                          {b.size > 0 ? `${(b.size / 1024).toFixed(1)} KB` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                No backups yet. Click "Backup" to create one.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============ What's New / Changelog Section ============ */
function WhatsNewSection() {
  const newModules = NAV_ITEMS.filter((n) => n.isNew);

  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              What's New in v{APP_VERSION}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {newModules.length} new modules added · Released {APP_VERSION_DATE}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
            v{APP_VERSION}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {newModules.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5">
                <div className="rounded-md bg-emerald-500/10 p-1.5 shrink-0">
                  <Icon className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold">{item.label}</p>
                    <span className="rounded-full bg-emerald-500 px-1 py-0.5 text-[7px] font-bold leading-none text-white shrink-0">NEW</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs">
          <p className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <Gift className="h-3.5 w-3.5" />
            How to enable new modules
          </p>
          <p className="mt-1 text-muted-foreground">
            All new modules are OFF by default. Toggle them ON above in the Module Visibility section.
            The sidebar will reload and show the new modules. Each module has its own data — no existing data is affected.
          </p>
        </div>

        <Separator className="my-3" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Also added: Session timeout (8h), inactivity auto-logout (30min), password policy, 27 drag-drop elevation components, multi-job attendance, nesting feature, A4 reports, backup/restore, tablet/touch support</span>
        </div>

        <Separator className="my-3" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">CabinetryWorks v{APP_VERSION} · {APP_VERSION_DATE}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              localStorage.removeItem("kcm-whatsnew-v2-dismissed");
              toast.success("What's New banner will show again on Overview");
            }}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            Show "What's New" banner again
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============ Demo Data Section — SuperAdmin only ============ */
function DemoDataSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdminUser = user?.role === "SuperAdmin";

  // Check if demo data exists
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ["demo-data-status"],
    queryFn: async () => {
      const res = await fetch("/api/demo-data", { method: "GET" });
      if (!res.ok) throw new Error("Failed to check demo data status");
      return (await res.json()) as { hasDemoData: boolean; counts?: { customers: number; jobs: number; inventory: number } };
    },
    enabled: isSuperAdminUser,
  });

  const [seedOpen, setSeedOpen] = React.useState(false);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await fetch("/api/demo-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Seed failed");
      toast.success(
        `Demo data loaded — ${data.counts.customers} customers, ${data.counts.jobs} jobs, ${data.counts.inventory} inventory items`
      );
      setSeedOpen(false);
      // Invalidate queries so lists refresh
      queryClient.invalidateQueries({ queryKey: ["demo-data-status"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to seed demo data");
    } finally {
      setSeeding(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      const res = await fetch("/api/demo-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Remove failed");
      const d = data.deleted;
      toast.success(
        `Demo data removed — ${d.customers} customers, ${d.jobs} jobs, ${d.inventory} inventory items`
      );
      setRemoveOpen(false);
      queryClient.invalidateQueries({ queryKey: ["demo-data-status"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove demo data");
    } finally {
      setRemoving(false);
    }
  }

  if (!isSuperAdminUser) return null;

  const hasDemo = statusData?.hasDemoData === true;
  const counts = statusData?.counts;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-amber-600" />
              Demo Data
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Load sample customers, jobs &amp; inventory for testing. Safe to remove anytime — users are kept.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={`text-xs shrink-0 ${
              hasDemo
                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {statusLoading ? "Checking…" : hasDemo ? "Demo data loaded" : "No demo data"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-border bg-card p-3 text-xs">
          <p className="font-medium text-foreground">What gets created:</p>
          <ul className="mt-1.5 space-y-0.5 text-muted-foreground list-disc ml-4">
            <li>8 sample customers (prefixed with &quot;DEMO -&quot;)</li>
            <li>21 sample job orders spread across all statuses</li>
            <li>Site measurements &amp; cutting lists for production jobs</li>
            <li>6 inventory items, 3 categories &amp; a demo warehouse (WH-DEMO)</li>
          </ul>
        </div>

        {hasDemo && counts && (
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Badge variant="secondary" className="bg-card border border-border">{counts.customers} customers</Badge>
            <Badge variant="secondary" className="bg-card border border-border">{counts.jobs} jobs</Badge>
            <Badge variant="secondary" className="bg-card border border-border">{counts.inventory} inventory items</Badge>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setSeedOpen(true)}
            disabled={seeding || removing || hasDemo}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {seeding ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            Load Demo Data
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRemoveOpen(true)}
            disabled={seeding || removing || !hasDemo}
            className="border-red-500/40 text-red-700 hover:bg-red-50 hover:text-red-800"
          >
            {removing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
            Remove Demo Data
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Demo records are tagged with a &quot;DEMO -&quot; prefix on customer names and a &quot;DEMO-&quot; prefix on inventory codes, so they can be safely identified and removed without affecting real data.
        </p>

        {/* Seed confirmation */}
        <AlertDialog open={seedOpen} onOpenChange={setSeedOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Load demo data?</AlertDialogTitle>
              <AlertDialogDescription>
                This will create 8 sample customers, 21 job orders, measurements, cutting lists, and 6 inventory items in a demo warehouse. All demo data is clearly tagged and can be removed anytime.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={seeding}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleSeed();
                }}
                disabled={seeding}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {seeding ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load Demo Data"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Remove confirmation */}
        <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove all demo data?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all customers, jobs, measurements, cutting lists, inventory items, and the demo warehouse tagged with demo prefixes. <span className="font-semibold text-foreground">Real users and real data are kept.</span> This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleRemove();
                }}
                disabled={removing}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {removing ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Removing…
                  </>
                ) : (
                  "Remove Demo Data"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
