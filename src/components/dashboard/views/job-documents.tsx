"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  jobDocumentsApi,
  jobsApi,
  type JobDocument,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Loader2,
  Trash2,
  Eye,
  Download,
  File,
  FileType2,
  Paperclip,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui-helpers";

const DOC_TYPES = [
  { value: "document", label: "Document", tint: "bg-slate-500/15 text-slate-700 border-slate-500/30" },
  { value: "contract", label: "Contract", tint: "bg-violet-500/15 text-violet-700 border-violet-500/30" },
  { value: "drawing", label: "Drawing", tint: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  { value: "permit", label: "Permit", tint: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  { value: "warranty", label: "Warranty", tint: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  { value: "other", label: "Other", tint: "bg-muted text-muted-foreground" },
];

function typeInfo(type: string) {
  return (
    DOC_TYPES.find((t) => t.value === type) ?? {
      label: type || "Document",
      tint: "bg-muted text-muted-foreground",
    }
  );
}

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function fmtSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(fileType?: string | null) {
  const t = (fileType ?? "").toLowerCase();
  if (["pdf"].includes(t)) return FileText;
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(t)) return File;
  if (["dwg", "dxf"].includes(t)) return FileType2;
  return Paperclip;
}

interface JobLite {
  id: string;
  orderNumber: string;
  title: string;
}

interface DocFormState {
  jobId: string;
  name: string;
  type: string;
  notes: string;
  dataUrl: string;
  fileType: string;
  fileSize: number;
}

const EMPTY_FORM: DocFormState = {
  jobId: "",
  name: "",
  type: "document",
  notes: "",
  dataUrl: "",
  fileType: "",
  fileSize: 0,
};

export function JobDocumentsView() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = React.useState<"all" | string>("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<JobDocument | null>(
    null
  );
  const [form, setForm] = React.useState<DocFormState>(EMPTY_FORM);

  const { data: jobsData } = useQuery({
    queryKey: ["jobs", "for-documents"],
    queryFn: () => jobsApi.list(),
  });
  const jobs: JobLite[] = (jobsData as { jobs?: JobLite[] })?.jobs ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["job-documents", typeFilter],
    queryFn: () =>
      jobDocumentsApi.list({
        type: typeFilter === "all" ? undefined : typeFilter,
      }),
  });
  const documents: JobDocument[] = data?.documents ?? [];

  const createMut = useMutation({
    mutationFn: (payload: DocFormState) =>
      jobDocumentsApi.create({
        jobId: payload.jobId,
        name: payload.name,
        type: payload.type,
        dataUrl: payload.dataUrl,
        fileType: payload.fileType || undefined,
        fileSize: payload.fileSize || undefined,
        notes: payload.notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Document uploaded");
      qc.invalidateQueries({ queryKey: ["job-documents"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to upload"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => jobDocumentsApi.remove(id),
    onSuccess: () => {
      toast.success("Document deleted");
      qc.invalidateQueries({ queryKey: ["job-documents"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  async function handleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      // Determine file type
      let ft = "";
      const match = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
      if (match) ft = match[1];
      else if (dataUrl.startsWith("data:")) {
        const m = dataUrl.match(/^data:([a-zA-Z0-9.+-]+)\//);
        if (m) ft = m[1];
      }
      setForm((f) => ({
        ...f,
        name: f.name || file.name,
        dataUrl,
        fileType: ft,
        fileSize: file.size,
      }));
    };
    reader.onerror = () => toast.error("Failed to read file");
    reader.readAsDataURL(file);
  }

  function submit() {
    if (!form.jobId) {
      toast.error("Please select a job");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Please enter a document name");
      return;
    }
    if (!form.dataUrl) {
      toast.error("Please select a file to upload");
      return;
    }
    createMut.mutate(form);
  }

  function viewDoc(d: JobDocument) {
    try {
      const w = window.open();
      if (!w) {
        toast.error("Pop-up blocked. Allow pop-ups to view.");
        return;
      }
      if (d.dataUrl.startsWith("data:")) {
        // For images & PDFs, write an iframe wrapper
        w.document.write(
          `<html><head><title>${d.name}</title></head><body style="margin:0;padding:0"><iframe src="${d.dataUrl}" style="width:100vw;height:100vh;border:0"></iframe></body></html>`
        );
        w.document.close();
      } else {
        w.location.href = d.dataUrl;
      }
    } catch {
      toast.error("Failed to open document");
    }
  }

  function downloadDoc(d: JobDocument) {
    try {
      const a = document.createElement("a");
      a.href = d.dataUrl;
      a.download = `${d.name}.${d.fileType ?? "bin"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast.error("Failed to download");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <FileText className="h-5 w-5 text-primary" />
            Documents
          </h1>
          <p className="text-xs text-muted-foreground">
            Contracts, drawings, permits &amp; warranty documents per job.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setForm(EMPTY_FORM);
            setCreateOpen(true);
          }}
        >
          <Upload className="mr-1 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-40 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {DOC_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {documents.length} document{documents.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Document grid */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={FileText}
              title="No documents found"
              description="Upload a contract, drawing or permit to get started."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setCreateOpen(true);
                  }}
                >
                  <Upload className="mr-1 h-4 w-4" />
                  Upload Document
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((d) => {
            const ti = typeInfo(d.type);
            const Icon = fileIcon(d.fileType);
            return (
              <Card key={d.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <Icon className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{d.name}</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {d.job?.orderNumber ?? "—"} · v{d.version}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${ti.tint}`}
                    >
                      {ti.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <FileType2 className="h-3 w-3" />
                      {(d.fileType ?? "—").toUpperCase()}
                    </span>
                    <span>{fmtSize(d.fileSize)}</span>
                    <span>{fmtDate(d.createdAt)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {d.job?.title ?? "—"}
                  </div>
                  {d.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {d.notes}
                    </p>
                  )}
                  <div className="flex items-center gap-1 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => viewDoc(d)}
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => downloadDoc(d)}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Download
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 ml-auto text-destructive"
                      onClick={() => setDeleteTarget(d)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Files are stored as base64 data URLs. Max size 5 MB.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Job *</Label>
              <Select
                value={form.jobId}
                onValueChange={(v) => setForm((f) => ({ ...f, jobId: v }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select job…" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No jobs available
                    </SelectItem>
                  ) : (
                    jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.orderNumber} — {j.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Document Name *</Label>
                <Input
                  placeholder="e.g. Signed Contract"
                  className="h-9 text-sm"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
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
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">File *</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  className="h-9 text-xs"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>
              {form.dataUrl && (
                <p className="text-xs text-emerald-600">
                  ✓ Loaded ({fmtSize(form.fileSize)}) · {form.fileType.toUpperCase()}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                rows={2}
                placeholder="Optional notes…"
                className="text-sm"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCreateOpen(false);
                setForm(EMPTY_FORM);
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={createMut.isPending}>
              {createMut.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Upload
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
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.name}</strong>{" "}
              (v{deleteTarget?.version}) from{" "}
              <strong>{deleteTarget?.job?.orderNumber ?? "—"}</strong>. This
              action cannot be undone.
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
