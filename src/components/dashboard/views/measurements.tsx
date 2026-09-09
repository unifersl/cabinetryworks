"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { measurementsApi, jobsApi, cuttingListsApi, materialRequirementsApi } from "@/lib/api";
import type { SiteMeasurement } from "@/lib/types";
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
import { toast } from "sonner";
import {
  Plus,
  Ruler,
  Loader2,
  Calendar,
  User as UserIcon,
  X,
  DoorOpen,
  ArrowDownToLine,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

/**
 * Parse a "wall lengths" string like "L1:3200 L2:2400 L3:1800" or "3200, 2400"
 * into an array of millimetre numbers.
 */
function parseWallMm(input?: string | null): number[] {
  if (!input) return [];
  // Find all numeric tokens (with optional decimals), ignoring labels
  const matches = input.match(/\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches.map((m) => parseFloat(m)).filter((n) => Number.isFinite(n) && n > 0);
}

/** Parse a ceiling height string like "2700mm" or "2.7m" into mm. */
function parseCeilingMm(input?: string | null): number {
  if (!input) return 0;
  const m = input.match(/(\d+(?:\.\d+)?)\s*(m{1,2})?/i);
  if (!m) return 0;
  const val = parseFloat(m[1]);
  if (!Number.isFinite(val) || val <= 0) return 0;
  // If the unit string starts with "mm", the value is already in mm
  if (m[2] && m[2].toLowerCase() === "mm") return val;
  // If unit string is "m" (single m), convert m → mm
  if (m[2] && m[2].toLowerCase() === "m") return val * 1000;
  // Heuristic: very small numbers (≤10) are likely metres
  if (val <= 10) return val * 1000;
  return val;
}

const ROOM_TYPES = [
  "Kitchen",
  "Wardrobe",
  "Vanity",
  "Pantry",
  "Laundry",
  "Other",
];

const STATUS_BADGE: Record<string, string> = {
  Draft: "bg-zinc-500/15 text-zinc-600 border-zinc-500/30",
  Submitted: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  Approved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
};

export function MeasurementsView() {
  const { data, isLoading } = useQuery({
    queryKey: ["measurements"],
    queryFn: () => measurementsApi.list(),
  });
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Site Measurements</h1>
          <p className="text-sm text-muted-foreground">
            Capture on-site measurements for cabinetry production.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          New Measurement
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <Card className="col-span-full">
            <CardContent className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading measurements…
            </CardContent>
          </Card>
        ) : (data?.measurements ?? []).length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <Ruler className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No measurements yet</p>
                <p className="text-sm text-muted-foreground">
                  Capture your first on-site measurement.
                </p>
              </div>
              <Button onClick={() => setOpen(true)} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                New Measurement
              </Button>
            </CardContent>
          </Card>
        ) : (
          (data?.measurements ?? []).map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <DoorOpen className="h-4 w-4 text-primary" />
                      {m.roomType ?? "Measurement"}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {m.job?.orderNumber} · {m.job?.title}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className={STATUS_BADGE[m.status]}>
                    {m.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {m.wallLength && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Ruler className="h-3.5 w-3.5" />
                    Walls: <span className="font-medium text-foreground">{m.wallLength}</span>
                  </div>
                )}
                {m.ceilingHt && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    Ceiling: <span className="font-medium text-foreground">{m.ceilingHt}</span>
                  </div>
                )}
                {m.takenBy && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <UserIcon className="h-3.5 w-3.5" />
                    {m.takenBy.fullName}
                  </div>
                )}
                {m.createdAt && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(m.createdAt).toLocaleDateString()}
                  </div>
                )}
                {m.notes && (
                  <p className="mt-2 line-clamp-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                    {m.notes}
                  </p>
                )}
                <GenerateRequirementsButton measurement={m} />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CreateMeasurementDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function CreateMeasurementDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: jobsData } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => jobsApi.list(),
  });
  const [jobId, setJobId] = React.useState("");
  const [roomType, setRoomType] = React.useState("Kitchen");
  const [wallLength, setWallLength] = React.useState("");
  const [ceilingHt, setCeilingHt] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const create = useMutation({
    mutationFn: () =>
      measurementsApi.create({
        jobId,
        roomType,
        wallLength: wallLength || undefined,
        ceilingHt: ceilingHt || undefined,
        notes: notes || undefined,
        status: "Submitted",
      }),
    onSuccess: () => {
      toast.success("Measurement captured");
      setJobId("");
      setRoomType("Kitchen");
      setWallLength("");
      setCeilingHt("");
      setNotes("");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["measurements"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>New Site Measurement</DialogTitle>
              <DialogDescription>
                Record dimensions captured on-site.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!jobId) {
              toast.error("Please select a job");
              return;
            }
            create.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>
              Job <span className="text-destructive">*</span>
            </Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Select job order" />
              </SelectTrigger>
              <SelectContent>
                {(jobsData?.jobs ?? []).map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.orderNumber} — {j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Room Type</Label>
              <Select value={roomType} onValueChange={setRoomType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_TYPES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-ceiling">Ceiling Height</Label>
              <Input
                id="m-ceiling"
                placeholder="e.g. 2700mm"
                value={ceilingHt}
                onChange={(e) => setCeilingHt(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-walls">Wall Lengths</Label>
            <Input
              id="m-walls"
              placeholder="e.g. L1:3200 L2:2400 L3:1800"
              value={wallLength}
              onChange={(e) => setWallLength(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-notes">Notes</Label>
            <Textarea
              id="m-notes"
              placeholder="Obstructions, openings, special conditions…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Save Measurement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Per-measurement "Generate Material Requirements" button.
 *
 * Parses the measurement's wall lengths + ceiling height, creates a single
 * "Wall Panel" cutting-list entry for the linked job, then calls the
 * material-requirements auto-calc to check stock availability for that job.
 *
 * Lower-priority enhancement — kept minimal and resilient: if the user hasn't
 * filled in wall or ceiling values, the button falls back to a plain
 * "regenerate from existing cutting lists" call.
 */
function GenerateRequirementsButton({ measurement }: { measurement: SiteMeasurement }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{
    open: boolean;
    requirements: Array<{
      material: string;
      cuttingListId?: string | null;
      requiredQty: number;
      availableQty: number;
      shortage: number;
      unit: string;
      status: string;
    }>;
  }>({ open: false, requirements: [] });

  async function handleGenerate() {
    if (!measurement.jobId) {
      toast.error("This measurement is not linked to a job — cannot generate requirements");
      return;
    }
    setBusy(true);
    try {
      const walls = parseWallMm(measurement.wallLength);
      const ceiling = parseCeilingMm(measurement.ceilingHt);

      // Only create a Wall Panel cutting-list entry if we have BOTH wall
      // length(s) and a ceiling height. Otherwise just regenerate from
      // whatever cutting lists already exist for the job.
      if (walls.length > 0 && ceiling > 0) {
        const totalWallMm = walls.reduce((s, w) => s + w, 0);
        const items = walls.map((wallMm, idx) => ({
          part: `Wall Panel ${idx + 1} (auto from measurement)`,
          qty: 1,
          length: String(Math.round(wallMm)),
          width: String(Math.round(ceiling)),
          thickness: "18mm",
          edge: "—",
        }));
        await cuttingListsApi.create({
          jobId: measurement.jobId,
          panelName: `Site Measurement — ${measurement.roomType ?? "Room"}`,
          material: "Standard Board",
          items,
          status: "Submitted",
        });
        toast.success(
          `Created cutting list with ${walls.length} wall panel(s) — total ${totalWallMm}mm × ${ceiling}mm`
        );
      }

      const res = await materialRequirementsApi.generate({
        jobId: measurement.jobId,
        regenerate: true,
      });

      await queryClient.invalidateQueries({
        queryKey: ["material-requirements", "job", measurement.jobId],
      });
      await queryClient.invalidateQueries({ queryKey: ["cutting-lists"] });

      setResult({ open: true, requirements: res.requirements });

      const totalShortage = (res.summary?.totalShortage ?? 0) as number;
      if (totalShortage > 0) {
        toast.warning(`Material requirements generated — ${totalShortage} shortage(s) found`, {
          description: `${res.requirements.length} material(s) checked`,
        });
      } else if (res.requirements.length > 0) {
        toast.success(`Material requirements generated — no shortages`, {
          description: `${res.requirements.length} material(s) checked`,
        });
      } else {
        toast.info("No material requirements could be generated — add cutting list items first");
      }
    } catch (err) {
      console.error("[measurements] generate requirements failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate material requirements");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="mt-2 h-8 w-full gap-1.5 text-xs"
        onClick={handleGenerate}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ClipboardCheck className="h-3.5 w-3.5" />
        )}
        Generate Material Requirements
      </Button>

      <Dialog open={result.open} onOpenChange={(v) => setResult((s) => ({ ...s, open: v }))}>
        <DialogContent showCloseButton={false} className="sm:max-w-[520px] max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-warm">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Material Requirements
                </DialogTitle>
                <DialogDescription>
                  Auto-generated for {measurement.job?.orderNumber ?? "this job"} from the measurement and cutting lists.
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setResult((s) => ({ ...s, open: false }))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {result.requirements.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No material requirements were generated. Try adding cutting list entries first.
            </p>
          ) : (
            <ul className="space-y-2">
              {result.requirements.map((r) => {
                const hasShortage = Number(r.shortage) > 0;
                return (
                  <li
                    key={`${r.material}-${r.cuttingListId ?? "none"}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.material}</p>
                      <p className="text-xs text-muted-foreground">
                        Need {Number(r.requiredQty).toFixed(2)} {r.unit} · have {Number(r.availableQty).toFixed(2)} {r.unit}
                      </p>
                    </div>
                    {hasShortage ? (
                      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 shrink-0">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Shortage {Number(r.shortage).toFixed(2)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 shrink-0">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        OK
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setResult((s) => ({ ...s, open: false }))}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
