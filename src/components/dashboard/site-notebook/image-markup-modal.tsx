"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  X, Pencil, Type, Undo2, Trash2, Save, Download,
  Minimize, Maximize, HelpCircle,
  ArrowRight, Square, Circle, Ruler, Minus,
} from "lucide-react";

interface ImageMarkupModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  imageUrl: string | null;
  onSave?: (dataUrl: string) => void;
}

type Tool = "pencil" | "line" | "arrow" | "rectangle" | "circle" | "dimension" | "text";
type StrokeColor = "#ef4444" | "#facc15" | "#22c55e" | "#3b82f6" | "#ffffff" | "#1e293b";

const COLORS: { value: StrokeColor; label: string; border: string }[] = [
  { value: "#ef4444", label: "Red", border: "border-red-500" },
  { value: "#facc15", label: "Yellow", border: "border-yellow-500" },
  { value: "#22c55e", label: "Green", border: "border-green-500" },
  { value: "#3b82f6", label: "Blue", border: "border-blue-500" },
  { value: "#ffffff", label: "White", border: "border-slate-300" },
  { value: "#1e293b", label: "Black", border: "border-slate-700" },
];

interface ToolDef { id: Tool; label: string; icon: React.ComponentType<{ className?: string }>; hint: string; }
const TOOLS: ToolDef[] = [
  { id: "pencil", label: "Pencil", icon: Pencil, hint: "Freehand draw (drag to sketch)" },
  { id: "line", label: "Line", icon: Minus, hint: "Straight line — click start, drag to end" },
  { id: "arrow", label: "Arrow", icon: ArrowRight, hint: "Annotated arrow (drag to point at something)" },
  { id: "rectangle", label: "Rectangle", icon: Square, hint: "Box outline — drag to size (for area highlight)" },
  { id: "circle", label: "Circle", icon: Circle, hint: "Circle outline — drag to size (for spot highlight)" },
  { id: "dimension", label: "Dimension", icon: Ruler, hint: "Dimension line with mm label — drag, then type the measurement" },
  { id: "text", label: "Text", icon: Type, hint: "Text label — click where you want it, type, press Enter" },
];

interface Stroke {
  tool: Tool;
  color: StrokeColor;
  width: number;
  points: { x: number; y: number }[];
  text?: string;
}

export function ImageMarkupModal({
  open,
  onOpenChange,
  imageUrl,
  onSave,
}: ImageMarkupModalProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = React.useState<Tool>("pencil");
  const [color, setColor] = React.useState<StrokeColor>("#ef4444");
  const [width, setWidth] = React.useState(3);
  const [strokes, setStrokes] = React.useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = React.useState<Stroke | null>(null);
  const [drawing, setDrawing] = React.useState(false);
  const [textInput, setTextInput] = React.useState("");
  const [textPos, setTextPos] = React.useState<{ x: number; y: number } | null>(null);
  const [dimDialog, setDimDialog] = React.useState<{ pos: { x: number; y: number }; start: { x: number; y: number }; end: { x: number; y: number }; value: string } | null>(null);
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const [canvasSize, setCanvasSize] = React.useState({ w: 800, h: 500 });
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);

  // Load image when modal opens
  React.useEffect(() => {
    if (open && imageUrl) {
      setStrokes([]);
      setImgLoaded(false);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imgRef.current = img;
        const maxW = 900;
        const maxH = 600;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        setCanvasSize({ w: Math.round(img.width * scale), h: Math.round(img.height * scale) });
        setImgLoaded(true);
      };
      img.onerror = () => {
        setImgLoaded(false);
        toast.error("Failed to load image");
      };
      img.src = imageUrl;
    }
  }, [open, imageUrl]);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      setStrokes([]);
      setCurrentStroke(null);
      setDrawing(false);
      setTextPos(null);
      setDimDialog(null);
      setIsFullscreen(false);
      setShowHelp(false);
    }
  }, [open]);

  // --- Drawing helpers ---
  function drawArrowHead(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, size: number) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const headLen = Math.max(8, size * 3);
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  function drawDimensionLabel(ctx: CanvasRenderingContext2D, s: Stroke) {
    if (s.points.length < 2) return;
    const [a, b] = [s.points[0], s.points[1]];
    // Main line
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    // Tick marks at both ends (perpendicular)
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const perp = angle + Math.PI / 2;
    const tick = 6;
    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.moveTo(p.x - tick * Math.cos(perp), p.y - tick * Math.sin(perp));
      ctx.lineTo(p.x + tick * Math.cos(perp), p.y + tick * Math.sin(perp));
      ctx.stroke();
    }
    // Label text — always horizontal, with a white background pill
    if (s.text) {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.font = "bold 13px sans-serif";
      const tw = ctx.measureText(s.text).width;
      const padX = 5, padY = 3;
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1;
      const bx = mx - tw / 2 - padX, by = my - 9 - padY, bw = tw + padX * 2, bh = 18 + padY * 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = s.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.text, mx, my);
      ctx.restore();
    }
  }

  // Redraw canvas
  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    if (imgRef.current) {
      ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
    }

    // Draw strokes
    const drawStroke = (s: Stroke) => {
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Shadow for white strokes on light backgrounds
      if (s.color === "#ffffff") {
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 2;
      } else {
        ctx.shadowBlur = 0;
      }

      // Text tool
      if (s.tool === "text" && s.text && s.points.length > 0) {
        ctx.font = "bold 16px sans-serif";
        ctx.shadowColor = "rgba(0,0,0,0.7)";
        ctx.shadowBlur = 3;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(s.text, s.points[0].x, s.points[0].y);
        ctx.shadowBlur = 0;
        return;
      }

      // Dimension tool
      if (s.tool === "dimension") {
        drawDimensionLabel(ctx, s);
        return;
      }

      // Single point — nothing to draw for shape tools
      if (s.points.length < 2) {
        ctx.shadowBlur = 0;
        return;
      }

      const [a, b] = [s.points[0], s.points[1]];

      if (s.tool === "pencil") {
        // Freehand: connect all points
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
      } else if (s.tool === "line") {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else if (s.tool === "arrow") {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        drawArrowHead(ctx, a.x, a.y, b.x, b.y, s.width);
      } else if (s.tool === "rectangle") {
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
        ctx.strokeRect(x, y, w, h);
      } else if (s.tool === "circle") {
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
        const r = Math.max(1, Math.max(rx, ry));
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
    };

    strokes.forEach(drawStroke);
    if (currentStroke) drawStroke(currentStroke);
  }, [strokes, currentStroke]);

  React.useEffect(() => {
    if (imgLoaded) draw();
  }, [draw, imgLoaded, canvasSize]);

  // Keyboard shortcuts
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        setStrokes((s) => s.slice(0, -1));
        setCurrentStroke(null);
      }
      if (e.key === "Escape") {
        if (dimDialog) { setDimDialog(null); return; }
        if (textPos) { setTextPos(null); setTextInput(""); return; }
        if (isFullscreen) setIsFullscreen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dimDialog, textPos, isFullscreen]);

  function getPos(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (tool === "text") {
      const p = getPos(e);
      setTextPos(p);
      return;
    }
    setDrawing(true);
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = getPos(e);
    setCurrentStroke({ tool, color, width, points: [p] });
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drawing || !currentStroke) return;
    const p = getPos(e);
    if (currentStroke.tool === "pencil") {
      // Freehand: append all points
      setCurrentStroke({ ...currentStroke, points: [...currentStroke.points, p] });
    } else {
      // Shape tools: only keep start + current end
      setCurrentStroke({ ...currentStroke, points: [currentStroke.points[0], p] });
    }
  }

  function handlePointerUp() {
    if (!drawing || !currentStroke) return;
    setDrawing(false);
    if (currentStroke.tool === "dimension" && currentStroke.points.length >= 2) {
      // Open dimension dialog
      setDimDialog({
        start: currentStroke.points[0],
        end: currentStroke.points[1],
        pos: {
          x: (currentStroke.points[0].x + currentStroke.points[1].x) / 2,
          y: (currentStroke.points[0].y + currentStroke.points[1].y) / 2,
        },
        value: "",
      });
      setCurrentStroke(null);
      return;
    }
    if (currentStroke.points.length >= 1) {
      setStrokes((s) => [...s, currentStroke]);
    }
    setCurrentStroke(null);
  }

  function commitText() {
    if (!textInput.trim() || !textPos) return;
    setStrokes((s) => [
      ...s,
      { tool: "text", color, width, points: [textPos], text: textInput.trim() },
    ]);
    setTextInput("");
    setTextPos(null);
  }

  function commitDimension() {
    if (!dimDialog) return;
    const val = dimDialog.value.trim() || "?";
    setStrokes((s) => [
      ...s,
      {
        tool: "dimension",
        color,
        width,
        points: [dimDialog.start, dimDialog.end],
        text: val,
      },
    ]);
    setDimDialog(null);
  }

  function undo() {
    setStrokes((s) => s.slice(0, -1));
    setCurrentStroke(null);
  }

  function clear() {
    setStrokes([]);
    setCurrentStroke(null);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave?.(dataUrl);
    toast.success("Markup saved to photo");
    onOpenChange(false);
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `photo-markup-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  const cursorFor: Record<Tool, string> = {
    pencil: "crosshair",
    line: "crosshair",
    arrow: "crosshair",
    rectangle: "crosshair",
    circle: "crosshair",
    dimension: "crosshair",
    text: "text",
  };

  // The toolbar (shared between normal and fullscreen)
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
      {/* Tools — icon buttons with tooltips */}
      <div className="flex gap-0.5">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setTool(t.id); setTextPos(null); }}
              title={`${t.label} — ${t.hint}`}
              aria-label={t.label}
              className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                tool === t.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      <Separator orientation="vertical" className="h-6 mx-0.5" />

      {/* Colors */}
      <div className="flex items-center gap-1">
        {COLORS.map((c) => (
          <button
            key={c.value}
            onClick={() => setColor(c.value)}
            className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
              color === c.value ? "border-foreground ring-2 ring-foreground/20" : c.border
            }`}
            style={{ backgroundColor: c.value }}
            aria-label={c.label}
            title={c.label}
          />
        ))}
      </div>

      <Separator orientation="vertical" className="h-6 mx-0.5" />

      {/* Stroke width */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground hidden sm:inline">Width:</span>
        <input
          type="range" min="1" max="10" value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          className="w-16 accent-primary"
          title={`Stroke width: ${width}px`}
        />
        <span className="text-[10px] font-mono w-6">{width}px</span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button onClick={() => setShowHelp(s => !s)} title="How to use"
          className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
            showHelp ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
          }`}>
          <HelpCircle className="h-4 w-4" />
        </button>
        <button onClick={undo} title="Undo (Ctrl+Z)"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted">
          <Undo2 className="h-4 w-4" />
        </button>
        <button onClick={clear} title="Clear all"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </button>
        <Separator orientation="vertical" className="h-6 mx-0.5" />
        <button onClick={download} title="Download as PNG"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted">
          <Download className="h-4 w-4" />
        </button>
        <button onClick={() => setIsFullscreen(f => !f)} title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
          className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
            isFullscreen ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
          }`}>
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  const helpPanel = showHelp && (
    <div className="border-b border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-muted-foreground">
      <b className="text-amber-800 dark:text-amber-400">How to use:</b>{" "}
      <b>Pencil</b> freehand · <b>Line</b>/<b>Arrow</b> drag start→end · <b>Rectangle</b>/<b>Circle</b> drag to size · <b>Dimension</b> drag then type mm label · <b>Text</b> click to place, type, Enter. <b>Ctrl+Z</b> undo · <b>Esc</b> cancel.
    </div>
  );

  const canvasArea = (
    <div className="flex items-center justify-center bg-muted/20 p-3" style={{ minHeight: 300 }}>
      {!imgLoaded ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading image…
        </div>
      ) : (
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="max-w-full touch-none rounded-lg border border-border shadow-lg"
            style={{ cursor: cursorFor[tool] }}
          />
          {/* Text input overlay */}
          {textPos && (
            <div
              className="absolute"
              style={{
                left: `${(textPos.x / canvasSize.w) * 100}%`,
                top: `${(textPos.y / canvasSize.h) * 100}%`,
                transform: "translate(0, -100%)",
              }}
            >
              <input
                autoFocus
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitText();
                  if (e.key === "Escape") { setTextInput(""); setTextPos(null); }
                }}
                onBlur={commitText}
                placeholder="Type & Enter…"
                className="w-44 rounded border-2 border-primary bg-card px-2 py-1 text-sm shadow-lg outline-none"
                style={{ color }}
              />
            </div>
          )}
          {/* Dimension input overlay */}
          {dimDialog && (
            <div
              className="absolute"
              style={{
                left: `${(dimDialog.pos.x / canvasSize.w) * 100}%`,
                top: `${(dimDialog.pos.y / canvasSize.h) * 100}%`,
                transform: "translate(-50%, -180%)",
              }}
            >
              <div className="flex items-center gap-1.5 rounded-lg border-2 border-primary bg-card p-1.5 shadow-xl">
                <Input
                  autoFocus
                  type="text"
                  value={dimDialog.value}
                  onChange={(e) => setDimDialog((d) => d ? { ...d, value: e.target.value } : d)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitDimension();
                    if (e.key === "Escape") setDimDialog(null);
                  }}
                  placeholder="e.g. 800mm"
                  className="h-7 w-28 text-xs"
                />
                <Button size="sm" className="h-7 px-2" onClick={commitDimension}>
                  <Label className="sr-only">Add dimension</Label>
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Fullscreen overlay — rendered via portal-like fixed div
  if (isFullscreen && open) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col bg-white">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Pencil className="h-4 w-4 text-primary" />
            Photo Markup — Fullscreen
          </h2>
          <Button size="sm" onClick={save} className="h-8">
            <Save className="mr-1.5 h-4 w-4" />
            Save & Close
          </Button>
        </div>
        {toolbar}
        {helpPanel}
        <div className="flex-1 overflow-auto bg-muted/20 p-3">
          {canvasArea}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="sm:max-w-[1000px] p-0">
        <DialogTitle className="sr-only">Photo markup</DialogTitle>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Pencil className="h-5 w-5 text-primary" />
            Photo Markup
            <span className="text-xs font-normal text-muted-foreground">
              {strokes.length} annotation{strokes.length === 1 ? "" : "s"}
            </span>
          </h2>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}>
              <Save className="mr-1.5 h-4 w-4" />
              Save
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {toolbar}
        {helpPanel}
        {canvasArea}
      </DialogContent>
    </Dialog>
  );
}
