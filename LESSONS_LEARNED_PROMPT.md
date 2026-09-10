This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.

Below is a set of **LESSONS LEARNED** from building a similar production Next.js app. These are real bugs and solutions discovered during development. **Read them carefully and apply them from the START** to avoid hours of debugging. Treat every item below as a mandatory engineering rule for this project, not a suggestion.

---

## LESSONS LEARNED — Technical Fixes (CRITICAL — Read Before Building)

These are real bugs and solutions discovered during production of a similar app. Apply them from the START to avoid hours of debugging.

### 1. Database Connection (Vercel + Supabase)
- **Problem**: Prisma's internal Rust engine can't connect to Supabase from Vercel serverless. Direct connection (port 5432) fails because Supabase free tier uses IPv6. Pooler URL with special chars in password fails URL parsing.
- **Solution**: Use `@prisma/adapter-pg` with `pg.Pool` using EXPLICIT params (not connectionString):
```typescript
// src/lib/db.ts — CORRECT pattern
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({
  host: 'aws-0-REGION.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.PROJECT_REF',
  password: 'PASSWORD_WITH_SPECIAL_CHARS', // raw, no URL encoding
  max: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter, log: ['error'] })
```
- **schema.prisma**: Must include `previewFeatures = ["driverAdapters"]` in generator block
- **vercel.json**: Build command must include `prisma generate`
- **package.json**: Add `"postinstall": "prisma generate"` script
- **Supabase**: Use Transaction Pooler (port 6543), NOT direct connection (port 5432)

### 2. Drag Handler Delta Error (Elevation Canvas)
- **Problem**: Using `m.x + deltaX` where `m.x` is the CURRENT position (changes every React re-render) causes cabinets to "fly away" from the cursor with increasing speed.
- **Solution**: Store ORIGINAL positions of ALL selected modules at drag start in a `Map`:
```typescript
const dragData = React.useRef<{
  origPositions?: Map<string, { x: number; y: number; w: number; h: number }>;
}>(null);

// In onModuleDown:
const origPositions = new Map();
for (const m of modules) {
  if (sel.has(m.id)) origPositions.set(m.id, { x: m.x, y: m.y, w: m.width, h: m.height });
}

// In onCanvasMove (move handler):
const orig = dd.origPositions?.get(m.id);
let nx = orig.x + deltaX; // CORRECT: always from original, never compounding
let ny = orig.y + deltaY;
```

### 3. Inspector Popup Close Behavior
- **Problem**: Clicking on a cabinet after opening the inspector closes it instantly (window click listener fires).
- **Solution**: Add `onClick={(e) => e.stopPropagation()}` on the cabinet div + check `data-cabinet-module` and `data-inspector-popup` attributes in the close handler:
```typescript
function close(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.closest("[data-inspector-popup]")) return; // don't close inside popup
  if (target.closest("[data-cabinet-module]")) return; // don't close on cabinet
  if (target.closest("input, select, textarea, button, [role='combobox']")) return; // don't close on controls
  setInspector(null);
}
```

### 4. Mobile Drag-Drop Fallback
- **Problem**: HTML5 drag-drop API (`draggable`, `onDragStart`, `onDrop`) does NOT work on touch devices.
- **Solution**: Add `tapToAdd()` function — tapping a palette button adds the cabinet to canvas at next available position:
```typescript
function tapToAdd(type: string) {
  const item = PALETTE.find((p) => p.type === type);
  const newMod = createEmptyModule(code);
  newMod.type = type; newMod.width = item.w; newMod.height = item.h;
  const lastMod = modules[modules.length - 1];
  newMod.x = lastMod ? Math.min(totalW - item.w, lastMod.x + lastMod.width + 20) : 100;
  newMod.y = Math.min(totalH - item.h, 100);
  commitModules([...modules, newMod]);
  toast.success(`${item.label} added`);
}
// Add onClick to palette buttons: onClick={() => isTouch && tapToAdd(item.type)}
```

### 5. Snap Logic (Best Candidate Per Axis)
- **Problem**: Old snap checked ALL 3 edges (left/right/center) against ALL other cabinets' 3 edges = 9×N candidates, last match wins → chaotic jumping.
- **Solution**: Collect all candidates, find the SINGLE best (smallest |diff|) per axis. Only snap if within threshold. Check bounding-box overlap (only snap to cabinets in same vertical/horizontal band).

### 6. Stock Sync Pattern (CRITICAL)
- **Pattern**: Every stock operation MUST follow this exact sequence:
```typescript
// 1. Update StockLot (FIFO for deductions, create/update for additions)
// 2. Recalculate InventoryItem.stockLevel
const totalAgg = await tx.stockLot.aggregate({
  where: { itemId },
  _sum: { quantity: true },
});
await tx.inventoryItem.update({
  where: { id: itemId },
  data: { stockLevel: Number(totalAgg._sum.quantity ?? 0) },
});
```
- Never write directly to `InventoryItem.stockLevel` without updating `StockLot` first.

### 7. Admin Override Pattern
- **Pattern**: For Goods Issue, Goods Return, Stock Request, Cutting List, Outside Purchase:
```typescript
const isAdmin = canManageUsers(session.role);
if (!jobId) {
  if (!isAdmin) return 400: "Job is required";
  if (notes.length < 5) return 400: "Admin override requires a reason (min 5 chars)";
}
// For Goods Return: if admin override (no job), skip "items must be issued" validation
if (jobId && !isAdmin) {
  // validate items were previously issued for this job
}
```

### 8. Goods Return Validation
- **Pattern**: Items must have been previously issued OR outside-purchased for the exact same job:
```typescript
// Aggregate issued qty per item for this job
// Subtract already-returned qty
// Add outside-purchased (received) qty
// If return qty > available → 400 error
// If item not issued at all → 400: "Item was not issued for this job"
```

### 9. Login Security
- **No demo credentials on login screen** — replace with "Contact your system administrator"
- **Login response** must NOT include password field
- **Session cookie** must NOT contain password — only uid, role, username, fullName, ts
- **Session timeout**: 8 hours max age, 30 min inactivity → auto-logout
- **Session expiry warning**: Show dialog 5 min before timeout with "Stay logged in" button + live countdown

### 10. View Persistence
- **Problem**: App always returns to Overview on page refresh.
- **Solution**: Save active view to localStorage, restore on init:
```typescript
const [active, setActive] = React.useState(() => {
  const saved = localStorage.getItem("kcm-active-view");
  return saved || "overview";
});
// In handleNavigate:
localStorage.setItem("kcm-active-view", target);
```

### 11. Form Dirty State
- **Pattern**: Track `isDirty` state, warn before closing:
```typescript
React.useEffect(() => {
  function onBeforeUnload(e: BeforeUnloadEvent) {
    if (isDirty) { e.preventDefault(); e.returnValue = ""; }
  }
  window.addEventListener("beforeunload", onBeforeUnload);
  return () => window.removeEventListener("beforeunload", onBeforeUnload);
}, [isDirty]);
// In dialog onOpenChange: if (!open && isDirty) { if (!confirm("Unsaved changes. Close?")) return; }
```

### 12. Undo Toasts for Deletes
- **Pattern**: Optimistic delete + 5-second Undo window:
```typescript
const deletedRef = React.useRef<{id, data} | null>(null);
// On delete: store in ref, remove from list, toast with Undo action
toast(`Deleted`, { action: { label: "Undo", onClick: () => { /* restore */ } }, duration: 5000 });
// After 5s: actually call API to delete
setTimeout(() => { api.remove(id); }, 5000);
```

### 13. Friendly API Errors
- **Pattern**: Map Prisma error codes to user-friendly messages:
```typescript
function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Foreign key constraint")) return "This item is in use and cannot be deleted.";
  if (msg.includes("Unique constraint")) return "An item with this name already exists.";
  if (msg.includes("Unauthorized")) return "Your session has expired. Please log in again.";
  if (msg.includes("Forbidden")) return "You don't have permission for this action.";
  return msg;
}
```

### 14. Responsive CSS Globals (Append to globals.css)
```css
/* Mobile-first base */
html { font-size: 14px; }
@media (min-width: 768px) { html { font-size: 15px; } }
@media (min-width: 1280px) { html { font-size: 16px; } }

body { overflow-x: hidden; overscroll-behavior: none; }

/* Mobile: reduce card padding */
@media (max-width: 640px) {
  [data-slot="card"] { border-radius: 0.375rem !important; }
  [data-slot="card-header"] { padding: 0.75rem 1rem !important; }
  [data-slot="card-content"] { padding: 0.75rem 1rem !important; }
  table { font-size: 11px; }
  th, td { padding: 4px 6px !important; }
  input, select, textarea { min-height: 2.5rem; }
}

/* Touch targets */
@media (pointer: coarse) {
  button, a, [role="button"], input, select { min-height: 44px; min-width: 44px; }
  button.h-7, button.h-8 { min-height: 40px; min-width: 40px; }
}

/* Tabs scroll horizontally on mobile */
@media (max-width: 640px) {
  [role="tablist"] { overflow-x: auto; scrollbar-width: none; }
  [role="tablist"]::-webkit-scrollbar { display: none; }
  [role="tab"] { white-space: nowrap; flex-shrink: 0; }
}

/* Dialogs full-screen on mobile */
@media (max-width: 640px) {
  [data-radix-dialog-content] {
    width: 100vw !important; max-width: 100vw !important;
    height: 100vh !important; max-height: 100vh !important;
    margin: 0 !important; border-radius: 0 !important;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 15. Pen Tool (Freehand Drawing)
- **Problem**: Pen tool was implemented as 3-click curve (same as curve tool).
- **Solution**: Pen = press-drag-release (freehand), Curve = 3-click (start, control, end). They are SEPARATE tools:
  - Pen: `onPointerDown` starts drawing, `onPointerMove` adds points, `onPointerUp` finalizes
  - Pen rendering: `ctx.moveTo` + `ctx.lineTo` for each point (connected path)
  - Pen hit detection: line-segment distance (not quadratic bezier sampling)

### 16. Cutting List Layout
- **Pattern**: Use CSS Grid with explicit column widths (not `grid-cols-12`):
```css
grid-cols-[28px_1fr_12px_1fr_44px_1.5fr_1fr_28px]
/* # | Length | × | Width | Qty | Material | Note | Delete */
```
- Add column headers above entries
- Add summary bar: total pieces + area (m²) + sheets needed
- Material dropdown: `overflow-hidden` on SelectTrigger (not `min-w-0` which causes truncation)

### 17. Elevation Canvas Layout (Mobile)
- **Pattern**: On mobile/tablet (< lg):
  - Toolbar: `overflow-x-auto` + `flex-nowrap` (horizontal scroll, single row)
  - Canvas: full width, `min-h-[300px]`
  - Properties panel: below canvas (stacked, not sidebar)
  - Row 2 controls: single compact row (all toggles + undo/redo + help)
- On desktop (lg+): 2/3 canvas + 1/3 properties side-by-side

### 18. Elevation Canvas Mode Badge
- Always visible on canvas — shows current snap state:
  - Amber: "SNAP: EDGES" or "SNAP: GRID 50mm"
  - Blue: "FREE MODE"
- Helps user understand why cabinets are/aren't snapping

### 19. Role Validation in API
- **Problem**: User create/update only accepted 3 roles (Admin, SuperAdmin, Technician).
- **Solution**: Accept all 6 roles in both POST and PUT:
```typescript
const VALID_ROLES = ["SuperAdmin", "Admin", "Manager", "Storekeeper", "Auditor", "Technician"];
if (!VALID_ROLES.includes(role)) return 400: "Invalid role";
```

### 20. Audit Log for All Mutations
- Every POST/PUT/DELETE in every API route MUST call `recordAudit()`
- Check: `grep -L "recordAudit" src/app/api/*/route.ts` — if any file with mutations has no audit, add it
- Auditor role: `where.NOT = { actor: { role: "SuperAdmin" } }` — hide SuperAdmin entries

### 21. Elevation Canvas Keyboard Shortcuts
```typescript
// Delete/Backspace: delete selected
// Ctrl+D: duplicate selected
// Ctrl+Z / Ctrl+Shift+Z: undo/redo
// Arrows: nudge 1mm (Shift+Arrows: 10mm)
// Ctrl+A: select all
// Esc: deselect / close inspector
// +/-: zoom in/out
// 0: reset zoom to 100%
// F: toggle fullscreen
// ?: show keyboard shortcut overlay
```
- Check `e.target` — don't fire when typing in input/textarea/select
- Check `canvasWrapRef.current.contains(document.activeElement)` — only fire when canvas has focus

### 22. Deployment Checklist
- [ ] `schema.prisma`: `provider = "postgresql"` + `previewFeatures = ["driverAdapters"]`
- [ ] `db.ts`: uses `@prisma/adapter-pg` with explicit `Pool` params
- [ ] `vercel.json`: build command includes `prisma generate`
- [ ] `package.json`: has `"postinstall": "prisma generate"` script
- [ ] Vercel env var: `DATABASE_URL` = Supabase transaction pooler URL (port 6543)
- [ ] `.env.example`: includes pooler URL format + instructions
- [ ] `DEPLOY.md`: step-by-step guide
- [ ] `supabase-migration.sql`: generated via `prisma migrate diff`
- [ ] `supabase-seed.sql`: with `CREATE EXTENSION IF NOT EXISTS "pgcrypto"` + real bcrypt hashes
- [ ] `DECIMAL(12,2)` not `DECIMAL(65,30)` in migration SQL
- [ ] `@ts-nocheck` on non-critical files with TS errors (sketchpad, report dialog, etc.)
- [ ] All API routes have `apiHandler` wrapper
- [ ] All mutations have `recordAudit()` calls
- [ ] No hardcoded passwords in source code
- [ ] No diagnostic endpoints exposed (remove `/api/db-test` etc.)
