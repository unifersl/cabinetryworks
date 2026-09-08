"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Pencil,
  Minus,
  Square,
  Eraser,
  Undo2,
  Trash2,
  Download,
  Ruler,
  Spline,
  Circle as CircleIcon,
  MoveRight,
  Type,
  Slash,
  MousePointerClick,
  Maximize,
  Minimize,
} from "lucide-react";

type Tool = "select" | "pen" | "line" | "dashed" | "box" | "circle" | "arrow" | "curve" | "text" | "eraser";

interface Point {
  x: number;
  y: number;
}

interface Shape {
  id: string;
  tool: Tool;
  points: Point[];
  color: string;
  width: number;
  dimension?: number;       // mm label for lines, pen, curves
  dimensionW?: number;      // width mm for boxes/circles
  dimensionH?: number;      // height mm for boxes/circles
  textContent?: string;     // for text tool
}

const COLORS = ["#1e293b", "#ef4444", "#facc15", "#0ea5e9", "#10b981", "#8b5cf6"];

interface BlueprintSketchpadProps {
  onSave?: (dataUrl: string) => void;
}

export function BlueprintSketchpad({ onSave }: BlueprintSketchpadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [tool, setTool] = React.useState<Tool>("pen");
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [color, setColor] = React.useState("#1e293b");
  const [width, setWidth] = React.useState(2);
  const [shapes, setShapes] = React.useState<Shape[]>([]);
  const [currentShape, setCurrentShape] = React.useState<Shape | null>(null);
  const [drawing, setDrawing] = React.useState(false);
  const [dimDialog, setDimDialog] = React.useState<{
    shapeId: string;
    shapeType: Tool;
    valueW: string;
    valueH: string;
  } | null>(null);
  const [textDialog, setTextDialog] = React.useState<{
    shapeId: string;
    value: string;
  } | null>(null);
  const [hoveredShape, setHoveredShape] = React.useState<string | null>(null);
  const [canvasSize, setCanvasSize] = React.useState({ w: 900, h: 400 });

  // Track container width for responsive canvas sizing
  React.useEffect(() => {
    function updateSize() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(250, Math.min(450, Math.floor(w * 0.5)));
      setCanvasSize({ w, h });
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // ---- Drawing helpers ----

  function drawBadge(
    ctx: CanvasRenderingContext2D,
    label: string,
    x: number,
    y: number,
    canvasW: number
  ) {
    const fontSize = Math.max(10, Math.min(13, Math.floor(canvasW / 75)));
    ctx.font = `bold ${fontSize}px monospace`;
    const metrics = ctx.measureText(label);
    const padX = 5, padY = 3;
    const boxW = metrics.width + padX * 2;
    const boxH = fontSize + padY * 2;

    ctx.save();
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 4);
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 4);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  /**
   * Draw dimension labels — always horizontal, placed on edges for boxes/circles.
   */
  function drawDimensionLabels(
    ctx: CanvasRenderingContext2D,
    s: Shape,
    canvasW: number
  ) {
    const fontSize = Math.max(10, Math.min(13, Math.floor(canvasW / 75)));

    if (s.tool === "box" && s.points.length >= 2) {
      const a = s.points[0];
      const b = s.points[s.points.length - 1];
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;

      // Width label — on the TOP edge, centered horizontally, above the line
      if (s.dimensionW) {
        drawBadge(ctx, `${s.dimensionW}mm`, midX, minY - 12, canvasW);
      }
      // Height label — on the LEFT edge, centered vertically, to the left of the line
      if (s.dimensionH) {
        drawBadge(ctx, `${s.dimensionH}mm`, minX - 24, midY, canvasW);
      }
      return;
    }

    if (s.tool === "circle" && s.points.length >= 2) {
      const a = s.points[0];
      const b = s.points[s.points.length - 1];
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const rx = (maxX - minX) / 2;
      const ry = (maxY - minY) / 2;

      // Show diameter (⌀) on top edge and radius (R) on right edge
      if (s.dimensionW) {
        drawBadge(ctx, `⌀${s.dimensionW}mm`, midX, minY - 12, canvasW);
      }
      if (s.dimensionH) {
        const radius = Math.round(s.dimensionH / 2);
        drawBadge(ctx, `R${radius}mm`, maxX + 20, midY, canvasW);
      }
      return;
    }

    // Line, dashed, arrow, curve, pen — single dimension at midpoint
    if (s.dimension) {
      let cx = 0, cy = 0;
      if (s.points.length >= 2) {
        const a = s.points[0];
        const b = s.points[s.points.length - 1];
        cx = (a.x + b.x) / 2;
        cy = (a.y + b.y) / 2;
      } else if (s.points.length > 0) {
        for (const p of s.points) { cx += p.x; cy += p.y; }
        cx /= s.points.length; cy /= s.points.length;
      }
      drawBadge(ctx, `${s.dimension} mm`, cx, cy, canvasW);
    }
  }

  function isPointOnShape(p: Point, s: Shape, threshold: number = 10): boolean {
    if ((s.tool === "line" || s.tool === "dashed" || s.tool === "arrow") && s.points.length >= 2) {
      return distToSegment(p, s.points[0], s.points[s.points.length - 1]) < threshold;
    }
    if ((s.tool === "box" || s.tool === "circle") && s.points.length >= 2) {
      const a = s.points[0];
      const b = s.points[s.points.length - 1];
      const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
      const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
      if (s.tool === "box") {
        const edges = [
          { a: { x: minX, y: minY }, b: { x: maxX, y: minY } },
          { a: { x: maxX, y: minY }, b: { x: maxX, y: maxY } },
          { a: { x: maxX, y: maxY }, b: { x: minX, y: maxY } },
          { a: { x: minX, y: maxY }, b: { x: minX, y: minY } },
        ];
        for (const edge of edges) {
          if (distToSegment(p, edge.a, edge.b) < threshold) return true;
        }
        return false;
      }
      // circle — check if near the ellipse perimeter
      const rx = (maxX - minX) / 2, ry = (maxY - minY) / 2;
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      if (rx < 1 || ry < 1) return false;
      const dx = (p.x - cx) / rx;
      const dy = (p.y - cy) / ry;
      const dist = Math.abs(Math.sqrt(dx * dx + dy * dy) - 1);
      return dist * Math.min(rx, ry) < threshold;
    }
    if (s.tool === "curve" && s.points.length >= 3) {
      // Sample points along the quadratic curve
      for (let t = 0; t <= 1; t += 0.05) {
        const pt = quadBezier(s.points[0], s.points[1], s.points[2], t);
        if (Math.hypot(p.x - pt.x, p.y - pt.y) < threshold) return true;
      }
      return false;
    }
    if (s.tool === "text" && s.points.length >= 1) {
      // Check if near the text position
      return Math.hypot(p.x - s.points[0].x, p.y - s.points[0].y) < 30;
    }
    // pen / eraser
    if (s.points.length >= 2) {
      for (let i = 0; i < s.points.length - 1; i++) {
        if (distToSegment(p, s.points[i], s.points[i + 1]) < threshold) return true;
      }
    }
    return false;
  }

  function quadBezier(p0: Point, p1: Point, p2: Point, t: number): Point {
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    };
  }

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);

    // Grid
    const gridSize = Math.max(20, Math.floor(cw / 40));
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= cw; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
    }
    for (let y = 0; y <= ch; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
    }

    const drawShape = (s: Shape) => {
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (s.tool === "eraser") {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = s.width * 4;
      }

      const a = s.points[0];
      const b = s.points.length >= 2 ? s.points[s.points.length - 1] : a;

      // Line / Dashed / Arrow
      if ((s.tool === "line" || s.tool === "dashed" || s.tool === "arrow") && s.points.length >= 2) {
        if (s.tool === "dashed") ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrow head
        if (s.tool === "arrow") {
          const angle = Math.atan2(b.y - a.y, b.x - a.x);
          const arrowLen = 12;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x - arrowLen * Math.cos(angle - 0.4), b.y - arrowLen * Math.sin(angle - 0.4));
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x - arrowLen * Math.cos(angle + 0.4), b.y - arrowLen * Math.sin(angle + 0.4));
          ctx.stroke();
        }

        if (hoveredShape === s.id) {
          ctx.strokeStyle = "#0ea5e9";
          ctx.lineWidth = s.width + 4;
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      // Box
      else if (s.tool === "box" && s.points.length >= 2) {
        ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        if (hoveredShape === s.id) {
          ctx.strokeStyle = "#0ea5e9";
          ctx.lineWidth = s.width + 3;
          ctx.strokeRect(Math.min(a.x, b.x) - 2, Math.min(a.y, b.y) - 2, Math.abs(b.x - a.x) + 4, Math.abs(b.y - a.y) + 4);
        }
      }
      // Circle / Ellipse
      else if (s.tool === "circle" && s.points.length >= 2) {
        const minX = Math.min(a.x, b.x), minY = Math.min(a.y, b.y);
        const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
        ctx.beginPath();
        ctx.ellipse(minX + rx, minY + ry, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (hoveredShape === s.id) {
          ctx.strokeStyle = "#0ea5e9";
          ctx.lineWidth = s.width + 3;
          ctx.beginPath();
          ctx.ellipse(minX + rx, minY + ry, rx + 2, ry + 2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      // Curve (quadratic bezier — 3 points)
      else if (s.tool === "curve" && s.points.length >= 3) {
        const ctrl = s.points[1];
        const end = s.points[2];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(ctrl.x, ctrl.y, end.x, end.y);
        ctx.stroke();
        // Show control point while drawing
        if (s === currentShape) {
          ctx.fillStyle = "#94a3b8";
          ctx.beginPath();
          ctx.arc(ctrl.x, ctrl.y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.setLineDash([2, 2]);
          ctx.strokeStyle = "#cbd5e1";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(ctrl.x, ctrl.y); ctx.lineTo(end.x, end.y); ctx.stroke();
          ctx.setLineDash([]);
        }
        if (hoveredShape === s.id) {
          ctx.strokeStyle = "#0ea5e9";
          ctx.lineWidth = s.width + 3;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(ctrl.x, ctrl.y, end.x, end.y);
          ctx.stroke();
        }
      }
      // Text
      else if (s.tool === "text" && s.points.length >= 1 && s.textContent) {
        const fontSize = Math.max(14, Math.min(18, Math.floor(cw / 55)));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = s.color;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(s.textContent, a.x, a.y);
      }
      // Pen / Eraser (freehand)
      else if (s.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
        if (hoveredShape === s.id && s.tool === "pen") {
          ctx.strokeStyle = "#0ea5e9";
          ctx.lineWidth = s.width + 3;
          ctx.beginPath();
          ctx.moveTo(s.points[0].x, s.points[0].y);
          for (let i = 1; i < s.points.length; i++) {
            ctx.lineTo(s.points[i].x, s.points[i].y);
          }
          ctx.stroke();
        }
      }

      // Dimension labels
      if (s.tool !== "eraser" && s.tool !== "text") {
        drawDimensionLabels(ctx, s, cw);
      }
    };

    shapes.forEach(drawShape);
    if (currentShape) drawShape(currentShape);
  }, [shapes, currentShape, hoveredShape]);

  React.useEffect(() => { draw(); }, [draw, canvasSize]);

  // Keyboard: Ctrl+Z for undo, Esc to exit fullscreen
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        setShapes((s) => s.slice(0, -1));
      }
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  function getPos(e: React.PointerEvent): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function distToSegment(p: Point, a: Point, b: Point): number {
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  // Curve tool uses 3 clicks: start, control point, end
  const curveClickCount = React.useRef(0);
  const curveStart = React.useRef<Point | null>(null);
  const curveCtrl = React.useRef<Point | null>(null);

  function handlePointerDown(e: React.PointerEvent) {
    const p = getPos(e);

    // Select tool — click to select, drag to move
    if (tool === "select") {
      // Find shape under cursor
      let foundId: string | null = null;
      for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i];
        if (s.tool === "eraser") continue;
        if (isPointOnShape(p, s)) {
          foundId = s.id;
          // Calculate offset from shape's first point
          const firstPt = s.points[0];
          moveOffset.current = { x: p.x - firstPt.x, y: p.y - firstPt.y };
          break;
        }
      }
      setSelectedShape(foundId);
      if (foundId) {
        setMovingShape(foundId);
        canvasRef.current?.setPointerCapture(e.pointerId);
      }
      return;
    }

    // Text tool — place text immediately, open dialog
    if (tool === "text") {
      const newShape: Shape = {
        id: crypto.randomUUID(),
        tool: "text",
        points: [p],
        color,
        width,
        textContent: "",
      };
      setShapes((s) => [...s, newShape]);
      setTextDialog({ shapeId: newShape.id, value: "" });
      return;
    }

    // Curve tool — 3 click sequence
    if (tool === "curve") {
      curveClickCount.current++;
      if (curveClickCount.current === 1) {
        curveStart.current = p;
        setCurrentShape({
          id: crypto.randomUUID(),
          tool: "curve",
          points: [p, p, p],
          color, width,
        });
      } else if (curveClickCount.current === 2) {
        curveCtrl.current = p;
        if (currentShape && curveStart.current) {
          setCurrentShape({ ...currentShape, points: [curveStart.current, p, p] });
        }
      } else if (curveClickCount.current === 3) {
        if (currentShape && curveStart.current && curveCtrl.current) {
          const finalShape = { ...currentShape, points: [curveStart.current, curveCtrl.current, p] };
          setShapes((s) => [...s, finalShape]);
        }
        setCurrentShape(null);
        curveClickCount.current = 0;
        curveStart.current = null;
        curveCtrl.current = null;
      }
      return;
    }

    // Normal tools
    setDrawing(true);
    canvasRef.current?.setPointerCapture(e.pointerId);
    setCurrentShape({ id: crypto.randomUUID(), tool, points: [p], color, width });
  }

  function handlePointerMove(e: React.PointerEvent) {
    // Select tool — move selected shape
    if (tool === "select" && movingShape) {
      const p = getPos(e);
      const newX = p.x - moveOffset.current.x;
      const newY = p.y - moveOffset.current.y;
      setShapes((s) =>
        s.map((shape) => {
          if (shape.id !== movingShape) return shape;
          // Calculate delta from first point
          const dx = newX - shape.points[0].x;
          const dy = newY - shape.points[0].y;
          return { ...shape, points: shape.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) };
        })
      );
      return;
    }

    if (tool === "curve") {
      // Live preview for curve
      if (curveClickCount.current === 1 && currentShape) {
        const p = getPos(e);
        setCurrentShape({ ...currentShape, points: [currentShape.points[0], p, p] });
      } else if (curveClickCount.current === 2 && currentShape && curveCtrl.current) {
        const p = getPos(e);
        setCurrentShape({ ...currentShape, points: [currentShape.points[0], curveCtrl.current, p] });
      }
      return;
    }

    if (!drawing || !currentShape) {
      if (tool !== "eraser" && tool !== "text" && tool !== "curve") {
        const p = getPos(e);
        let foundId: string | null = null;
        for (const s of shapes) {
          if (s.tool === "eraser") continue;
          if (isPointOnShape(p, s)) { foundId = s.id; break; }
        }
        if (foundId !== hoveredShape) setHoveredShape(foundId);
      }
      return;
    }
    const p = getPos(e);
    if (tool === "pen" || tool === "eraser") {
      setCurrentShape({ ...currentShape, points: [...currentShape.points, p] });
    } else {
      setCurrentShape({ ...currentShape, points: [currentShape.points[0], p] });
    }
  }

  function handlePointerUp() {
    // Select tool — stop moving
    if (tool === "select") {
      setMovingShape(null);
      return;
    }
    if (tool === "curve" || tool === "text") return;
    if (!drawing || !currentShape) return;
    setDrawing(false);
    if (currentShape.points.length >= 1) {
      setShapes((s) => [...s, currentShape]);
    }
    setCurrentShape(null);
  }

  function handleClick(e: React.PointerEvent) {
    // Select tool — click to select shape, click empty area to deselect
    if (tool === "select") {
      // If a shape was already selected, check if clicking to add dimension
      if (selectedShape) {
        const p = getPos(e);
        const selShape = shapes.find((s) => s.id === selectedShape);
        if (selShape && isPointOnShape(p, selShape)) {
          // Open dimension dialog for selected shape
          const isBoxOrCircle = selShape.tool === "box" || selShape.tool === "circle";
          setDimDialog({
            shapeId: selShape.id,
            shapeType: selShape.tool,
            valueW: isBoxOrCircle ? String(selShape.dimensionW ?? "") : String(selShape.dimension ?? ""),
            valueH: isBoxOrCircle ? String(selShape.dimensionH ?? "") : "",
          });
          return;
        }
      }
      return;
    }
    if (tool === "text") return; // text handles its own click
    if (drawing || tool === "eraser" || tool === "curve") return;
    const p = getPos(e);
    for (const s of shapes) {
      if (s.tool === "eraser" || s.tool === "text") continue;
      if (isPointOnShape(p, s)) {
        const isBoxOrCircle = s.tool === "box" || s.tool === "circle";
        setDimDialog({
          shapeId: s.id,
          shapeType: s.tool,
          valueW: isBoxOrCircle ? String(s.dimensionW ?? "") : String(s.dimension ?? ""),
          valueH: isBoxOrCircle ? String(s.dimensionH ?? "") : "",
        });
        return;
      }
    }
  }

  function saveDimension() {
    if (!dimDialog) return;
    const w = Number(dimDialog.valueW);
    const h = Number(dimDialog.valueH);
    setShapes((s) =>
      s.map((shape) => {
        if (shape.id !== dimDialog.shapeId) return shape;
        if (dimDialog.shapeType === "box" || dimDialog.shapeType === "circle") {
          return { ...shape, dimensionW: w > 0 ? w : undefined, dimensionH: h > 0 ? h : undefined };
        }
        return { ...shape, dimension: w > 0 ? w : undefined };
      })
    );
    if ((dimDialog.shapeType === "box" || dimDialog.shapeType === "circle") && w > 0 && h > 0) {
      toast.success(`Dimension set: ${w}mm × ${h}mm`);
    } else if (w > 0) {
      toast.success(`Dimension set: ${w} mm`);
    }
    setDimDialog(null);
  }

  function saveText() {
    if (!textDialog) return;
    setShapes((s) =>
      s.map((shape) =>
        shape.id === textDialog.shapeId
          ? { ...shape, textContent: textDialog.value || "Text" }
          : shape
      )
    );
    setTextDialog(null);
  }

  function undo() { setShapes((s) => s.slice(0, -1)); }
  function clear() { setShapes([]); setHoveredShape(null); }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave?.(canvas.toDataURL("image/png"));
    toast.success("Sketch saved");
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `blueprint-sketch-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // Complete tool palette
  const tools: { id: Tool; icon: typeof Pencil; label: string; short: string }[] = [
    { id: "select", icon: MousePointerClick, label: "Select / Move / Edit", short: "Select" },
    { id: "pen", icon: Pencil, label: "Freehand Pen", short: "Pen" },
    { id: "line", icon: Minus, label: "Straight Line", short: "Line" },
    { id: "dashed", icon: Slash, label: "Dashed Line", short: "Dashed" },
    { id: "box", icon: Square, label: "Rectangle / Box", short: "Box" },
    { id: "circle", icon: CircleIcon, label: "Circle / Ellipse", short: "Circle" },
    { id: "arrow", icon: MoveRight, label: "Arrow", short: "Arrow" },
    { id: "curve", icon: Spline, label: "Curve (3-click: start, bend, end)", short: "Curve" },
    { id: "text", icon: Type, label: "Text Label", short: "Text" },
    { id: "eraser", icon: Eraser, label: "Eraser", short: "Eraser" },
  ];

  const showDimHint = ["pen", "line", "dashed", "box", "circle", "arrow", "curve"].includes(tool);
  const isBoxOrCircle = dimDialog?.shapeType === "box" || dimDialog?.shapeType === "circle";

  // Select tool: state for selected shape
  const [selectedShape, setSelectedShape] = React.useState<string | null>(null);
  const [movingShape, setMovingShape] = React.useState<string | null>(null);
  const moveOffset = React.useRef<Point>({ x: 0, y: 0 });

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Toolbar — icon-only with tooltips */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-muted/30 p-2">
        {/* Drawing tools — icon only, tooltip on hover */}
        <div className="flex flex-wrap gap-0.5">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTool(t.id);
                  curveClickCount.current = 0;
                  curveStart.current = null;
                  curveCtrl.current = null;
                  setCurrentShape(null);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                  tool === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
                title={`${t.short} — ${t.label}`}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>

        <Separator orientation="vertical" className="h-6 mx-0.5" />

        {/* Colors */}
        <div className="flex items-center gap-0.5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                color === c ? "border-foreground ring-2 ring-foreground/20" : "border-white"
              }`}
              style={{ backgroundColor: c }}
              title={`Color: ${c}`}
            />
          ))}
        </div>

        <Separator orientation="vertical" className="h-6 mx-0.5" />

        {/* Width slider */}
        <div className="flex items-center gap-1">
          <input type="range" min="1" max="8" value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="w-12 accent-amber-600" title={`Stroke width: ${width}px`} />
        </div>

        <Separator orientation="vertical" className="h-6 mx-0.5" />

        {/* Actions — icon only */}
        <div className="flex gap-0.5 ml-auto">
          <button onClick={undo} title="Undo (Ctrl+Z)"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Undo2 className="h-4 w-4" />
          </button>
          <button onClick={clear} title="Clear all"
            className="flex h-8 w-8 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
            >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <Separator orientation="vertical" className="h-6 mx-0.5" />

        <button onClick={download} title="Download as PNG"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Download className="h-4 w-4" />
        </button>
        <button onClick={save} title="Save sketch to Photos"
          className="flex h-8 items-center justify-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          <Ruler className="h-4 w-4" />
          <span className="hidden sm:inline">Save</span>
        </button>
        <button onClick={() => setIsFullscreen(f => !f)} title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen mode"}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
      </div>

      {/* Hint */}
      {(showDimHint || tool === "select") && (
        <div className="flex items-center gap-2 rounded-md border border-sky-500/30 bg-sky-500/5 px-2.5 py-1.5 text-[11px] sm:text-xs text-sky-700 dark:text-sky-400">
          <Ruler className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
          {tool === "select" ? (
            <span>Click a shape to select &amp; drag to move. Click again on selected shape to add dimension. Ctrl+Z to undo.</span>
          ) : tool === "curve" ? (
            <span>Click 3 points: start → bend/control → end to draw a curve.</span>
          ) : tool === "text" ? (
            <span>Click on canvas to place a text label.</span>
          ) : (
            <span>Draw shapes, then click any shape to add a dimension label. Ctrl+Z to undo.</span>
          )}
        </div>
      )}

      {/* Canvas — fullscreen overlay when toggled */}
      {isFullscreen ? (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col">
          {/* Mini toolbar in fullscreen */}
          <div className="flex items-center gap-1.5 border-b border-border bg-muted/30 p-2">
            <span className="text-xs font-medium text-muted-foreground mr-2">Sketchpad — Fullscreen</span>
            <div className="flex gap-0.5">
              {tools.map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.id}
                    onClick={() => { setTool(t.id); curveClickCount.current = 0; setCurrentShape(null); }}
                    className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                      tool === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                    }`}
                    title={t.short}>
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <div className="flex items-center gap-0.5">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-foreground ring-2 ring-foreground/20" : "border-white"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <input type="range" min="1" max="8" value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-16 accent-amber-600" />
            <div className="ml-auto flex gap-1">
              <button onClick={undo} title="Undo (Ctrl+Z)" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"><Undo2 className="h-4 w-4" /></button>
              <button onClick={clear} title="Clear" className="flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              <button onClick={save} title="Save" className="flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"><Ruler className="h-4 w-4" /> Save</button>
              <button onClick={() => setIsFullscreen(false)} title="Exit fullscreen (Esc)" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"><Minimize className="h-4 w-4" /></button>
            </div>
          </div>
          {/* Fullscreen canvas */}
          <div ref={containerRef} className="flex-1 overflow-hidden">
            <canvas
              ref={canvasRef}
              width={canvasSize.w}
              height={canvasSize.h}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onClick={handleClick as unknown as React.MouseEventHandler}
              className="touch-none block"
              style={{ cursor: tool === "eraser" ? "cell" : tool === "text" ? "text" : tool === "select" ? "default" : "crosshair" }}
            />
          </div>
        </div>
      ) : (
      <div ref={containerRef} className="w-full overflow-hidden rounded-lg border border-border">
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleClick as unknown as React.MouseEventHandler}
          className="w-full touch-none block"
          style={{ cursor: tool === "eraser" ? "cell" : tool === "text" ? "text" : tool === "select" ? "default" : "crosshair" }}
        />
      </div>
      )}

      {/* Dimension dialog */}
      <Dialog open={!!dimDialog} onOpenChange={(o) => !o && setDimDialog(null)}>
        <DialogContent showCloseButton={false} aria-describedby={undefined} className="sm:max-w-[340px]">
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5 text-primary" />
            {isBoxOrCircle ? "Enter Dimensions" : "Enter Dimension"}
          </DialogTitle>
          <div className="space-y-3 py-2">
            {isBoxOrCircle ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {dimDialog?.shapeType === "circle" ? "Enter diameter/width and height of this circle in mm." : "Enter the width and height of this box in millimeters."}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="dim-w" className="text-xs">{dimDialog?.shapeType === "circle" ? "Width ⌀ (mm)" : "Width (mm)"}</Label>
                    <Input id="dim-w" autoFocus type="number" placeholder="e.g. 800"
                      value={dimDialog?.valueW ?? ""}
                      onChange={(e) => setDimDialog((d) => d ? { ...d, valueW: e.target.value } : d)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dim-h" className="text-xs">Height (mm)</Label>
                    <Input id="dim-h" type="number" placeholder="e.g. 400"
                      value={dimDialog?.valueH ?? ""}
                      onChange={(e) => setDimDialog((d) => d ? { ...d, valueH: e.target.value } : d)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveDimension(); }} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Enter the real-world measurement for this shape in millimeters.</p>
                <Input autoFocus type="number" placeholder="e.g. 1200"
                  value={dimDialog?.valueW ?? ""}
                  onChange={(e) => setDimDialog((d) => d ? { ...d, valueW: e.target.value } : d)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveDimension(); }} />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDimDialog(null)}>Cancel</Button>
            <Button onClick={saveDimension}>Set Dimension</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Text dialog */}
      <Dialog open={!!textDialog} onOpenChange={(o) => !o && setTextDialog(null)}>
        <DialogContent showCloseButton={false} aria-describedby={undefined} className="sm:max-w-[320px]">
          <DialogTitle className="flex items-center gap-2">
            <Type className="h-5 w-5 text-primary" />
            Enter Text Label
          </DialogTitle>
          <div className="space-y-3 py-2">
            <Input autoFocus placeholder="e.g. Sink Area"
              value={textDialog?.value ?? ""}
              onChange={(e) => setTextDialog((d) => d ? { ...d, value: e.target.value } : d)}
              onKeyDown={(e) => { if (e.key === "Enter") saveText(); }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTextDialog(null)}>Cancel</Button>
            <Button onClick={saveText}>Add Text</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
