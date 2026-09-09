"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  materialRequirementsApi,
  jobsApi,
  type MaterialRequirement,
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
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import {
  PackageSearch,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Layers,
  PackageX,
} from "lucide-react";

const STATUS_TINTS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  fulfilled: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  shortage: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  ordered: "bg-sky-500/15 text-sky-700 border-sky-500/30",
};

interface JobLite {
  id: string;
  orderNumber: string;
  title: string;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return n.toFixed(n % 1 === 0 ? 0 : 2);
}

export function MaterialPlanningView() {
  const qc = useQueryClient();
  const [jobId, setJobId] = React.useState<string>("");

  const { data: jobsData } = useQuery({
    queryKey: ["jobs", "for-mrp"],
    queryFn: () => jobsApi.list(),
  });
  const jobs: JobLite[] = (jobsData as { jobs?: JobLite[] })?.jobs ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["material-requirements", jobId],
    queryFn: () =>
      materialRequirementsApi.list({
        jobId: jobId || undefined,
      }),
    enabled: !!jobId,
  });
  const requirements: MaterialRequirement[] = data?.requirements ?? [];

  const generateMut = useMutation({
    mutationFn: (id: string) =>
      materialRequirementsApi.generate({
        jobId: id,
        regenerate: true,
      }),
    onSuccess: (resp) => {
      const count = resp.requirements.length;
      if (count === 0) {
        toast.info("No cutting list items found for this job");
      } else {
        toast.success(`Generated ${count} material requirement(s)`);
      }
      qc.invalidateQueries({ queryKey: ["material-requirements"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to generate"),
  });

  const selectedJob = jobs.find((j) => j.id === jobId);

  const stats = React.useMemo(
    () => ({
      total: requirements.length,
      shortage: requirements.filter((r) => r.shortage > 0).length,
      fulfilled: requirements.filter((r) => r.status === "fulfilled").length,
      totalShortageQty: requirements.reduce((acc, r) => acc + r.shortage, 0),
    }),
    [requirements]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <PackageSearch className="h-5 w-5 text-primary" />
            Material Planning
          </h1>
          <p className="text-xs text-muted-foreground">
            Auto-calculate material requirements from cutting lists &amp; check stock.
          </p>
        </div>
      </div>

      {/* Job selector + generate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Generate Requirements</CardTitle>
          <CardDescription className="text-xs">
            Pick a job, then auto-generate material requirements from its cutting lists.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Select Job</Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select a job…" />
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
          <Button
            size="sm"
            onClick={() => {
              if (!jobId) {
                toast.error("Please select a job first");
                return;
              }
              generateMut.mutate(jobId);
            }}
            disabled={!jobId || generateMut.isPending}
          >
            {generateMut.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-4 w-4" />
            )}
            Generate Requirements
          </Button>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Materials needed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-rose-500/10 p-2">
              <PackageX className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.shortage}</p>
              <p className="text-xs text-muted-foreground">Shortage count</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.fulfilled}</p>
              <p className="text-xs text-muted-foreground">Fulfilled</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {fmt(stats.totalShortageQty)}
              </p>
              <p className="text-xs text-muted-foreground">Total shortage qty</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requirements table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Requirements
            {selectedJob ? ` — ${selectedJob.orderNumber}` : ""}
          </CardTitle>
          <CardDescription className="text-xs">
            {requirements.length} row{requirements.length === 1 ? "" : "s"}
            {selectedJob ? ` for ${selectedJob.title}` : " — select a job above"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!jobId ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <PackageSearch className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Select a job to view requirements</p>
                <p className="text-sm text-muted-foreground">
                  Use the selector above to pick a job, then generate.
                </p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : requirements.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <PackageSearch className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No requirements generated yet</p>
                <p className="text-sm text-muted-foreground">
                  Click “Generate Requirements” to auto-calculate from cutting lists.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs min-w-[160px]">Material</TableHead>
                    <TableHead className="h-8 text-xs text-right min-w-[90px]">Required</TableHead>
                    <TableHead className="h-8 text-xs text-right min-w-[90px]">Available</TableHead>
                    <TableHead className="h-8 text-xs text-right min-w-[90px]">Shortage</TableHead>
                    <TableHead className="h-8 text-xs min-w-[80px]">Unit</TableHead>
                    <TableHead className="h-8 text-xs min-w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requirements.map((r) => {
                    const hasShortage = r.shortage > 0;
                    return (
                      <TableRow key={r.id} className={hasShortage ? "bg-rose-500/5" : ""}>
                        <TableCell className="py-2 text-xs font-medium">
                          {r.material}
                        </TableCell>
                        <TableCell className="py-2 text-right text-xs tabular-nums">
                          {fmt(r.requiredQty)}
                        </TableCell>
                        <TableCell className="py-2 text-right text-xs tabular-nums">
                          {fmt(r.availableQty)}
                        </TableCell>
                        <TableCell
                          className={`py-2 text-right text-xs tabular-nums font-semibold ${
                            hasShortage ? "text-rose-700" : "text-muted-foreground"
                          }`}
                        >
                          {fmt(r.shortage)}
                        </TableCell>
                        <TableCell className="py-2 text-xs">{r.unit}</TableCell>
                        <TableCell className="py-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${
                              STATUS_TINTS[r.status] ?? ""
                            }`}
                          >
                            {r.status}
                          </Badge>
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
    </div>
  );
}
