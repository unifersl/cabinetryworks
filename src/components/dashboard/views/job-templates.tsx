"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  jobTemplatesApi,
  type JobTemplate,
} from "@/lib/api";
import { useAuth } from "@/components/providers";
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
import { Switch } from "@/components/ui/switch";
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
  LayoutTemplate,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  Clock,
  Calendar,
  Sparkles,
} from "lucide-react";

const CATEGORIES = [
  "Kitchen",
  "Wardrobe",
  "Vanity",
  "Pantry",
  "Office",
  "Other",
];

const CATEGORY_TINTS: Record<string, string> = {
  Kitchen: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  Wardrobe: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  Vanity: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  Pantry: "bg-teal-500/15 text-teal-700 border-teal-500/30",
  Office: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  Other: "bg-muted text-muted-foreground",
};

interface TemplateFormState {
  name: string;
  description: string;
  category: string;
  estimatedHours: string;
  estimatedDays: string;
  isActive: boolean;
}

const EMPTY_FORM: TemplateFormState = {
  name: "",
  description: "",
  category: "Kitchen",
  estimatedHours: "0",
  estimatedDays: "0",
  isActive: true,
};

export function JobTemplatesView() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canEdit =
    user?.role === "Admin" || user?.role === "SuperAdmin";

  const [categoryFilter, setCategoryFilter] = React.useState<
    "all" | string
  >("all");
  const [activeFilter, setActiveFilter] = React.useState<"all" | "true" | "false">(
    "all"
  );
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<JobTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<JobTemplate | null>(
    null
  );
  const [form, setForm] = React.useState<TemplateFormState>(EMPTY_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ["job-templates", categoryFilter, activeFilter],
    queryFn: () =>
      jobTemplatesApi.list({
        category: categoryFilter === "all" ? undefined : categoryFilter,
        active:
          activeFilter === "all" ? undefined : activeFilter === "true",
      }),
  });
  const templates: JobTemplate[] = data?.templates ?? [];

  const createMut = useMutation({
    mutationFn: (payload: TemplateFormState) =>
      jobTemplatesApi.create({
        name: payload.name,
        description: payload.description || undefined,
        category: payload.category || undefined,
        estimatedHours: Number(payload.estimatedHours) || 0,
        estimatedDays: Number(payload.estimatedDays) || 0,
        isActive: payload.isActive,
      }),
    onSuccess: () => {
      toast.success("Template created");
      qc.invalidateQueries({ queryKey: ["job-templates"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to create"),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<JobTemplate>;
    }) => jobTemplatesApi.update(id, patch),
    onSuccess: () => {
      toast.success("Template updated");
      qc.invalidateQueries({ queryKey: ["job-templates"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => jobTemplatesApi.remove(id),
    onSuccess: () => {
      toast.success("Template deleted");
      qc.invalidateQueries({ queryKey: ["job-templates"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  function openEdit(t: JobTemplate) {
    setEditTarget(t);
    setForm({
      name: t.name,
      description: t.description ?? "",
      category: t.category ?? "Other",
      estimatedHours: String(t.estimatedHours ?? 0),
      estimatedDays: String(t.estimatedDays ?? 0),
      isActive: t.isActive,
    });
    setCreateOpen(true);
  }

  function submit() {
    if (!form.name.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (editTarget) {
      updateMut.mutate(
        {
          id: editTarget.id,
          patch: {
            name: form.name,
            description: form.description || null,
            category: form.category || null,
            estimatedHours: Number(form.estimatedHours) || 0,
            estimatedDays: Number(form.estimatedDays) || 0,
            isActive: form.isActive,
          },
        },
        {
          onSuccess: () => {
            setCreateOpen(false);
            setEditTarget(null);
            setForm(EMPTY_FORM);
          },
        }
      );
    } else {
      createMut.mutate(form);
    }
  }

  function toggleActive(t: JobTemplate) {
    updateMut.mutate({ id: t.id, patch: { isActive: !t.isActive } });
  }

  function applyTemplate(t: JobTemplate) {
    toast.success(`Starting new job from "${t.name}" template`, {
      description: "Job creation wizard will be available in a future release.",
    });
  }

  const stats = React.useMemo(() => {
    return {
      total: templates.length,
      active: templates.filter((t) => t.isActive).length,
      categories: new Set(templates.map((t) => t.category).filter(Boolean))
        .size,
    };
  }, [templates]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <LayoutTemplate className="h-5 w-5 text-primary" />
            Job Templates
          </h1>
          <p className="text-xs text-muted-foreground">
            Pre-defined job configurations to speed up recurring work.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            New Template
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <LayoutTemplate className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total templates</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-violet-500/10 p-2">
              <LayoutTemplate className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.categories}</p>
              <p className="text-xs text-muted-foreground">Categories</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-36 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as "all" | "true" | "false")}>
          <SelectTrigger className="h-9 w-36 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Active &amp; inactive</SelectItem>
            <SelectItem value="true">Active only</SelectItem>
            <SelectItem value="false">Inactive only</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {templates.length} template{templates.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Template grid */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <LayoutTemplate className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No templates yet</p>
              <p className="text-sm text-muted-foreground">
                {canEdit
                  ? "Create your first template to streamline recurring jobs."
                  : "Ask an admin to create job templates."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card
              key={t.id}
              className={!t.isActive ? "opacity-60" : undefined}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <LayoutTemplate className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{t.name}</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t.category ? t.category : "Uncategorized"}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      CATEGORY_TINTS[t.category ?? "Other"] ?? ""
                    }`}
                  >
                    {t.category ?? "Other"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                  {t.description || "No description provided."}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {t.estimatedHours ?? 0} hr
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {t.estimatedDays ?? 0} day
                  </span>
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 px-2 text-xs"
                    onClick={() => applyTemplate(t)}
                    disabled={!t.isActive}
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    Use Template
                  </Button>
                  {canEdit && (
                    <>
                      <div className="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Switch
                          checked={t.isActive}
                          onCheckedChange={() => toggleActive(t)}
                          className="scale-90"
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 ml-auto"
                        onClick={() => openEdit(t)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteTarget(t)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) {
            setEditTarget(null);
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Edit Template" : "New Template"}
            </DialogTitle>
            <DialogDescription>
              {editTarget
                ? "Update template details."
                : "Define a reusable job configuration."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Template Name *</Label>
              <Input
                placeholder="e.g. Standard L-Shaped Kitchen"
                className="h-9 text-sm"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={2}
                placeholder="What does this template include?"
                className="text-sm"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Estimated Hours</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-9 text-sm"
                  value={form.estimatedHours}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, estimatedHours: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estimated Days</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-9 text-sm"
                  value={form.estimatedDays}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, estimatedDays: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="tpl-active"
                checked={form.isActive}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, isActive: v }))
                }
              />
              <Label htmlFor="tpl-active" className="text-xs cursor-pointer">
                Active (visible to users)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCreateOpen(false);
                setEditTarget(null);
                setForm(EMPTY_FORM);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submit}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {(createMut.isPending || updateMut.isPending) && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {editTarget ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the template{" "}
              <strong>{deleteTarget?.name}</strong>. Jobs already created from
              this template will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
