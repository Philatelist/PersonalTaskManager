<!--
This document describes HOW to build the feature at an architectural level.
It is NOT a copy-paste implementation guide.

DO:
- Describe data models (table names, key columns, relationships)
- Describe API contracts (endpoints, request/response shapes)
- Reference file paths where code will live
- Note critical configuration requirements

DON'T:
- Include full code implementations
- Write complete schema definitions
- Provide copy-paste config files
-->

# Technical Specification: Main Grid View, Pagination & Card Visuals

- **Functional Specification:** `context/spec/002-main-grid-view-pagination-card-visuals/functional-spec.md`
- **Status:** Completed
- **Author(s):** AI-assisted

---

## 1. High-Level Technical Approach

This is a **frontend-only feature**. No Rust backend or database changes are required — the existing `task_list` Tauri command already returns active tasks ordered by PriorityRank with subtasks included (for progress computation).

The implementation replaces the current Smoke UI (plain list in `App.tsx`) with a responsive CSS Grid layout. Key technical decisions:

- **Styling:** CSS Modules (scoped per component, e.g., `TaskCard.module.css`). Native Vite support, zero runtime overhead.
- **Grid layout:** CSS Grid with dynamic column count computed from viewport dimensions and a strict ~120px minimum card size.
- **Progress ring:** SVG circle with `stroke-dasharray` — no dependencies, accessible, testable.
- **Routing:** State-based (`selectedTaskId` in App). Clicking a card sets the ID; a detail view placeholder renders instead of the grid. No router dependency.
- **Pagination:** Client-side slicing of the full task list. The `useTasks` hook already fetches all active tasks; a new `useGridLayout` hook handles page math.

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1. Component Hierarchy

```
App
├── GridView                         # Main grid screen (visible when no task selected)
│   ├── TaskGrid                     # CSS Grid container + adaptive layout
│   │   └── TaskCard (×N)           # Individual square card
│   │       ├── ProgressRing         # SVG circular progress (when subtasks exist)
│   │       └── TaskProgress*        # Existing checkbox (when no subtasks, reused)
│   ├── PaginationBar               # Prev/Next + "Page X of Y" (conditional)
│   └── EmptyState                  # "No active tasks" message (conditional)
└── TaskDetailPlaceholder           # Placeholder when selectedTaskId is set (future spec)
```

*`TaskProgress` from Feature 001 is reused for the checkbox-only case. The `ProgressRing` is a new SVG component for the visual ring display.

### 2.2. New Files and Responsibilities

| File Path | Responsibility |
|-----------|---------------|
| `src/features/tasks/GridView.tsx` | Top-level grid screen: orchestrates data fetching via `useTasks`, pagination state, and conditionally renders `TaskGrid`, `PaginationBar`, or `EmptyState`. |
| `src/features/tasks/GridView.module.css` | Layout styles for the grid screen container. |
| `src/features/tasks/TaskGrid.tsx` | CSS Grid container. Receives the current page's tasks and column count. Renders `TaskCard` instances. |
| `src/features/tasks/TaskGrid.module.css` | CSS Grid layout: `grid-template-columns: repeat(cols, 1fr)`, `aspect-ratio: 1`, gap. |
| `src/features/tasks/TaskCard.tsx` | Single square card. Displays priority number, title (1-line truncated), due date with overdue icon, and progress ring or checkbox. Handles click → `onSelect(taskId)`. Checkbox click calls `stopPropagation()` to prevent navigation. |
| `src/features/tasks/TaskCard.module.css` | Card visual styling: square aspect ratio, content layout, text truncation, overdue icon color. |
| `src/features/tasks/ProgressRing.tsx` | SVG circular progress indicator. Accepts `progress` (0–1), renders two circles (background track + filled arc via `stroke-dasharray`). |
| `src/features/tasks/ProgressRing.module.css` | SVG sizing and stroke styles. |
| `src/features/tasks/PaginationBar.tsx` | Prev/Next buttons + "Page X of Y" text. Receives `currentPage`, `totalPages`, `onPageChange`. |
| `src/features/tasks/PaginationBar.module.css` | Pagination bar layout and button styles. |
| `src/features/tasks/EmptyState.tsx` | Simple centered message for zero tasks. |
| `src/features/tasks/EmptyState.module.css` | Empty state styling. |
| `src/features/tasks/use-grid-layout.ts` | Hook: computes `columns`, `rows`, and `cardsPerPage` from a container ref's dimensions and the ~120px minimum. Returns reactive layout metrics. |

### 2.3. Adaptive Grid Layout Algorithm

The `useGridLayout` hook encapsulates the sizing math.

**Invariant:** Cards MUST never shrink below `MIN_CARD_SIZE` (120px) per side. If the total number of active tasks cannot fit on screen at this minimum size, pagination is used instead of shrinking cards further.

**Inputs:** container element ref (for measuring available width and height).

**Algorithm:**
1. Measure available `width` and `height` of the grid container (via `ResizeObserver`).
2. Compute `maxCols = max(floor(width / MIN_CARD_SIZE), 1)`.
3. Compute `maxRows = max(floor(height / MIN_CARD_SIZE), 1)`.
4. `cardsPerPage = min(maxCols * maxRows, 100)` — cap at 100 per global invariant.
5. For a given page of tasks:
   - `cols = maxCols` (always use the full column count — never reduce columns based on task count, which would cause a single-column layout).
   - `rows = ceil(pageTaskCount / cols)`.
   - Cards fill left-to-right, top-to-bottom naturally via CSS Grid.
   - CSS Grid's `1fr` column tracks ensure cards grow evenly to fill available space (they may be larger than 120px but never smaller).
6. Return `{ cols, cardsPerPage, totalPages: ceil(totalTasks / cardsPerPage) }`.

**Reactivity:** The hook uses `ResizeObserver` to re-compute on window/container resize. Values are debounced (50ms) to avoid layout thrashing.

### 2.4. TaskCard Content Layout

Each card is a square `<article>` element using CSS `aspect-ratio: 1` with the following internal layout:

```
┌─────────────────────┐
│  #1                  │   ← Priority number (top-left, small)
│                      │
│  Build the API       │   ← Title (centered, 1-line, ellipsis overflow)
│                      │
│  Feb 15 ⚠           │   ← Due date + overdue icon (bottom-left, conditional)
│              [ring]  │   ← Progress ring OR checkbox (bottom-right)
└─────────────────────┘
```

- Priority number: top-left corner, muted color, small font.
- Title: centered vertically and horizontally, single line with `text-overflow: ellipsis; white-space: nowrap; overflow: hidden`.
- Due date: bottom area. Formatted as short date (e.g., "Feb 15"). Overdue check: `new Date(task.dueDate) < startOfToday()`. Red warning icon: an inline SVG or Unicode character (e.g., "⚠") styled red.
- Progress ring / checkbox: bottom-right. Uses `ProgressRing` for tasks with subtasks, or the existing `TaskProgress` component's checkbox for tasks without.
- **Interaction:** Clicking anywhere on the card fires `onSelect(taskId)` to navigate to the detail view. The checkbox `onClick` handler MUST call `event.stopPropagation()` so that toggling completion does not also trigger card navigation.

### 2.5. ProgressRing SVG Component

**Props:** `progress: number` (0–1), `size?: number` (default 32px).

**Implementation:** Two concentric SVG `<circle>` elements:
- Background circle: light gray stroke (full circumference).
- Progress circle: colored stroke with `stroke-dasharray` = `circumference` and `stroke-dashoffset` = `circumference * (1 - progress)`. Rotated -90deg so the arc starts at the top.
- Semantic: wrapped in a `<span role="progressbar" aria-valuenow={percent}>`.

### 2.6. State-Based Routing in App.tsx

`App.tsx` will be refactored from the current Smoke UI to:

```
function App() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  if (selectedTaskId) {
    return <TaskDetailPlaceholder
              taskId={selectedTaskId}
              onBack={() => setSelectedTaskId(null)} />;
  }

  return <GridView onSelectTask={setSelectedTaskId} />;
}
```

The `TaskDetailPlaceholder` is a minimal "back" button + task ID display, to be replaced by a real detail view in a later spec.

### 2.7. Pagination State Management

Pagination is managed inside `GridView` with simple `useState<number>(1)` for `currentPage`. The `useGridLayout` hook provides `cardsPerPage`; the view slices `tasks` accordingly:

- `startIndex = (currentPage - 1) * cardsPerPage`
- `pageTasks = tasks.slice(startIndex, startIndex + cardsPerPage)`
- `totalPages = ceil(tasks.length / cardsPerPage)`

**Resize behavior:** When `cardsPerPage` changes (e.g., window resize), do **not** reset to page 1. Instead, preserve `currentPage` and only clamp if `currentPage > totalPages`. If `totalPages` becomes 0 (no tasks), set `currentPage` to 1. This avoids disruptive page jumps during window resize.

**Task removal:** If marking a task Done causes the current page to become empty (all tasks on that page removed), clamp `currentPage` to the new `totalPages`.

### 2.8. No Backend Changes

The existing `task_list` command with `statusFilter: "active"` returns everything needed:
- Tasks ordered by `priority_rank`.
- Subtasks included (for progress computation via `computeProgress`).
- Due dates included.
- The `useTasks` hook already does this fetch and computes `TaskWithProgress`.

No new Tauri commands, database changes, or migrations are needed.

---

## 3. Impact and Risk Analysis

### System Dependencies

| Dependency | Impact |
|-----------|--------|
| `useTasks` hook | Reused directly — provides active tasks with computed progress. |
| `TaskProgress` component | Reused for the checkbox-only case (tasks without subtasks). |
| `computeProgress` | Reused inside `useTasks` — no changes needed. |
| `task-service.ts` | `taskUpdate` used for checkbox toggle (mark Done). No changes. |
| `App.tsx` | **Replaced**: Smoke UI list → GridView + state-based routing. |
| `styles.css` | Retained for global/root styles. Component styles move to CSS Modules. |

### Potential Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| **ResizeObserver performance** | Low | Debounce resize callbacks (50ms). Only recompute layout metrics, not re-render cards. |
| **100 cards rendering performance** | Low | Each card is a simple DOM node (no heavy children). If profiling shows issues, consider `React.memo` on `TaskCard`. |
| **CSS Grid browser support** | Very Low | CSS Grid is supported in all modern browsers and Tauri's WebView2/WebKit. |
| **Flash of empty content on load** | Medium | The `useTasks` hook already tracks `loading` state. Show a minimal loading indicator while fetching. |
| **Page number stale after task removal** | Medium | Clamp `currentPage` to `totalPages` on every render; set to 1 when `totalPages` is 0. |
| **Overdue calculation timezone** | Low | Compare `task.dueDate` (date string) against `new Date()` using local date only (strip time). Document the comparison logic clearly. |

---

## 4. Testing Strategy

### Unit Tests (Vitest)

| Test Target | Key Cases |
|------------|-----------|
| `useGridLayout` hook | Various container sizes → correct cols and cardsPerPage. Minimum card size enforced (cards never < 120px). Cap at 100. Resize triggers recalculation. Cols always equals maxCols (no single-column collapse). |
| `ProgressRing` | Renders at 0%, 50%, 100%. Correct `stroke-dashoffset`. Accessibility attributes present. |
| `TaskCard` | Renders priority number, truncated title, due date. Overdue icon appears when date < today. No icon when no due date. Click fires `onSelect`. Checkbox click calls `stopPropagation` and does not fire `onSelect`. |
| `PaginationBar` | Renders "Page 1 of 3". Previous disabled on page 1. Next disabled on last page. Click handlers fire. |
| `EmptyState` | Renders empty message. |
| `GridView` | With 0 tasks → EmptyState. With 5 tasks → TaskGrid (no pagination). With tasks exceeding cardsPerPage → pagination shown. Marking task Done removes card and refreshes. Resize preserves current page (clamped only if necessary). |

### Component Tests (React Testing Library)

- Mock `task-service` (established pattern from existing tests).
- Mock `useGridLayout` return values to control pagination behavior deterministically.
- Test card click → `onSelectTask` callback.
- Test checkbox click → `taskUpdate` called with `status: "done"`, `onSelectTask` NOT called.

### Visual/Manual Verification

- `pnpm tauri dev` with varying numbers of tasks (0, 1, 5, 20, 50, 100, 150).
- Resize window to verify grid reflow and pagination triggers.
- Check overdue icon with past/future/no due dates.
