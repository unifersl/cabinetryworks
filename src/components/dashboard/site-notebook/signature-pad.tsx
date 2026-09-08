"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  PenLine,
  Trash2,
  Check,
  User,
  Wrench,
} from "lucide-react";
import type { SignatureData } from "@/lib/site-notebook-types";

interface SignaturePadProps {
  value: SignatureData;
  onChange: (value: SignatureData) => void;
}

export function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = React.useState(false);
  const [hasSignature, setHasSignature] = React.useState(!!value.signatureDataUrl);

  // Load existing signature
  React.useEffect(() => {
    if (value.signatureDataUrl) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = value.signatureDataUrl;
    }
  }, [value.signatureDataUrl]);

  function getPos(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function startDraw(e: React.PointerEvent) {
    setDrawing(true);
    canvasRef.current?.setPointerCapture(e.pointerId);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function draw(e: React.PointerEvent) {
    if (!drawing) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const p = getPos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e293b";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasSignature(true);
  }

  function stopDraw() {
    setDrawing(false);
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange({ ...value, signatureDataUrl: null, signedAt: null });
  }

  function confirm() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasSignature) {
      toast.error("Please draw a signature first");
      return;
    }
    if (!value.clientName.trim()) {
      toast.error("Enter client name before confirming");
      return;
    }
    if (!value.technicianName.trim()) {
      toast.error("Enter technician name before confirming");
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    onChange({
      ...value,
      signatureDataUrl: dataUrl,
      signedAt: new Date().toISOString(),
    });
    toast.success("Signature confirmed and bound to site record");
  }

  return (
    <div className="space-y-4">
      {/* Name fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sig-client" className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            Client Name
          </Label>
          <Input
            id="sig-client"
            placeholder="Client full name"
            value={value.clientName}
            onChange={(e) => onChange({ ...value, clientName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sig-tech" className="flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            Technician Name
          </Label>
          <Input
            id="sig-tech"
            placeholder="Technician full name"
            value={value.technicianName}
            onChange={(e) => onChange({ ...value, technicianName: e.target.value })}
          />
        </div>
      </div>

      <Separator />

      {/* Signature canvas */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <PenLine className="h-3.5 w-3.5" />
            Client Signature
          </Label>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10"
              onClick={clear}
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={confirm}
            >
              <Check className="h-3 w-3" />
              Confirm
            </Button>
          </div>
        </div>
        <div className="rounded-lg border-2 border-dashed border-border bg-white p-1">
          <canvas
            ref={canvasRef}
            width={600}
            height={200}
            onPointerDown={startDraw}
            onPointerMove={draw}
            onPointerUp={stopDraw}
            onPointerLeave={stopDraw}
            className="w-full touch-none rounded-md"
            style={{ cursor: "crosshair", minHeight: 150 }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Draw signature above. Click{" "}
          <span className="font-medium">Confirm</span> to bind to the site record.
        </p>
      </div>

      {/* Signed indicator */}
      {value.signedAt && value.signatureDataUrl && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <Check className="h-4 w-4 text-emerald-600" />
          <div className="text-xs">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">
              Signature confirmed
            </p>
            <p className="text-muted-foreground">
              {value.clientName} · {value.technicianName} ·{" "}
              {new Date(value.signedAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
