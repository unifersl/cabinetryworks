"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Pencil,
  Eraser,
  Square,
  Minus,
  Trash2,
  Download,
  Camera,
  PanelTop,
  Undo2,
  Ruler,
} from "lucide-react";

type Tool = "pen" | "rect" | "line" | "eraser";

interface Stroke {
  tool: Tool;
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

const COLORS = [
  "#b45309", // amber
  "#0f766e", // teal
  "#9f1239", // rose
  "#1e293b", // slate
  "#7c3aed", // violet
];

export function BlueprintsView() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [tool, setTool] = React.useState<Tool>("pen");
  const [color, setColor] = React.useState(COLORS[0]);
  const [width, setWidth] = React.useState(3);
  const [strokes, setStrokes] = React.useState<Stroke[]>([]);
  const drawing = React.useRef(false);
  const current = React.useRef<Stroke | null>(null);
  const [dims, setDims] = React.useState({ w: 800, h: 500 });
  const [grid, setGrid] = React.useState(true);

  // Resize canvas to container
  React.useEffect(() => {
    function resize() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setDims({
        w: Math.max(320, Math.floor(rect.width)),
        h: 480,
      });
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // background
    ctx.fillStyle = "#fafaf9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // grid
    if (grid) {
      ctx.strokeStyle = "rgba(180,83,9,0.12)";
      ctx.lineWidth = 1;
      const step = 25;
      for (let x = 0; x <= canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    const drawStroke = (s: Stroke) => {
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (s.tool === "eraser") {
        ctx.strokeStyle = "#fafaf9";
        ctx.lineWidth = s.width * 4;
      }
      if (s.tool === "rect" && s.points.length >= 2) {
        const a = s.points[0];
        const b = s.points[s.points.length - 1];
        ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
        return;
      }
      if (s.tool === "line" && s.points.length >= 2) {
        const a = s.points[0];
        const b = s.points[s.points.length - 1];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        return;
      }
      if (s.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
    };

    strokes.forEach(drawStroke);
    if (current.current) drawStroke(current.current);
  }, [strokes, grid]);

  React.useEffect(() => {
    draw();
  }, [draw, dims]);

  function pos(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(e: React.PointerEvent) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pos(e);
    current.current = { tool, color, width, points: [p] };
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current || !current.current) return;
    const p = pos(e);
    if (tool === "pen" || tool === "eraser") {
      current.current.points.push(p);
    } else {
      current.current.points = [current.current.points[0], p];
    }
    draw();
  }

  function end() {
    if (!drawing.current || !current.current) return;
    drawing.current = false;
    if (current.current.points.length >= 1) {
      setStrokes((s) => [...s, current.current!]);
    }
    current.current = null;
  }

  function undo() {
    setStrokes((s) => s.slice(0, -1));
  }
  function clear() {
    setStrokes([]);
    toast.success("Canvas cleared");
  }
  function exportPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `elevation-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("Blueprint exported as PNG");
  }

  const tools: { id: Tool; icon: typeof Pencil; label: string }[] = [
    { id: "pen", icon: Pencil, label: "Freehand" },
    { id: "line", icon: Minus, label: "Line" },
    { id: "rect", icon: Square, label: "Rectangle" },
    { id: "eraser", icon: Eraser, label: "Eraser" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Photo Markup &amp; Elevation Blueprints
          </h1>
          <p className="text-sm text-muted-foreground">
            Sketch cabinet elevations and annotate on-site dimensions.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={undo} size="sm">
            <Undo2 className="mr-1.5 h-4 w-4" />
            Undo
          </Button>
          <Button variant="outline" onClick={clear} size="sm">
            <Trash2 className="mr-1.5 h-4 w-4" />
            Clear
          </Button>
          <Button onClick={exportPng} size="sm">
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr]">
        {/* Tool palette */}
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <PanelTop className="h-4 w-4 text-primary" />
              Tools
            </CardTitle>
            <CardDescription className="text-xs">
              Select a tool &amp; draw on the canvas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {tools.map((t) => {
                const Icon = t.icon;
                const active = tool === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTool(t.id)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs transition-all ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      color === c
                        ? "border-foreground ring-2 ring-foreground/20"
                        : "border-white"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">
                Stroke width: {width}px
              </Label>
              <input
                type="range"
                min={1}
                max={12}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <button
              onClick={() => setGrid((g) => !g)}
              className={`flex w-full items-center justify-center gap-1.5 rounded-lg border p-2 text-xs transition-colors ${
                grid
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <Ruler className="h-3.5 w-3.5" />
              {grid ? "Grid: ON" : "Grid: OFF"}
            </button>

            <div className="rounded-lg bg-muted/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              <Camera className="mb-1 h-3.5 w-3.5" />
              Tip: sketch cabinet elevations, mark cut-outs, and annotate
              dimensions before exporting.
            </div>
          </CardContent>
        </Card>

        {/* Canvas */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Elevation Canvas</CardTitle>
              <span className="text-xs text-muted-foreground">
                {dims.w} × {dims.h}px
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <div ref={containerRef} className="w-full">
              <canvas
                ref={canvasRef}
                width={dims.w}
                height={dims.h}
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={end}
                onPointerLeave={end}
                className="w-full touch-none rounded-lg border border-border shadow-inner"
                style={{ cursor: tool === "eraser" ? "cell" : "crosshair" }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
