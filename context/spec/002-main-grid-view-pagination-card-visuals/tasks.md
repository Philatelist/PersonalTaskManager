# Tasks: Main Grid View, Pagination & Card Visuals

- **Specification:** `context/spec/002-main-grid-view-pagination-card-visuals/`
- **Status:** Approved

---

- [x] **Slice 1: Static grid of task cards with priority number and title**
  *The smallest end-to-end: replace the Smoke UI with a CSS Grid of square cards showing priority number and title. No pagination, no progress ring, no due date — just the grid layout proving adaptive sizing works.*
  *Acceptance criteria covered: square cards in responsive grid; adaptive sizing; priority number; single-line title with ellipsis; card ordering by PriorityRank; grid reflow on resize.*
  - [x] Create `src/features/tasks/TaskCard.tsx` and `src/features/tasks/TaskCard.module.css`. The card is a square `<article>` using `aspect-ratio: 1`. Display priority number (top-left, muted) and title (centered, single line, `text-overflow: ellipsis`). Accept `priorityIndex`, `task`, and `onSelect` props. Clicking the card fires `onSelect(task.id)`. **[Agent: general-purpose]**
  - [x] Create `src/features/tasks/TaskGrid.tsx` and `src/features/tasks/TaskGrid.module.css`. CSS Grid container using `grid-template-columns: repeat(cols, 1fr)` with `gap`. Receives `tasks[]`, `columns`, and `onSelectTask` props. Renders `TaskCard` for each task with its 1-based priority index. **[Agent: general-purpose]**
  - [x] Create `src/features/tasks/useGridLayout.ts` hook. Uses `ResizeObserver` on a container ref to measure available width/height. Computes `cols = max(floor(width / 120), 1)`, `rows = max(floor(height / 120), 1)`, `cardsPerPage = min(cols * rows, 100)`. Debounces at 50ms. Returns `{ cols, cardsPerPage, containerRef }`. **[Agent: general-purpose]**
  - [x] Create `src/features/tasks/GridView.tsx` and `src/features/tasks/GridView.module.css`. Top-level grid screen: uses `useTasks()` for data and `useGridLayout()` for layout metrics. Slices tasks for page 1 only (pagination in Slice 3). Passes `columns` and page tasks to `TaskGrid`. Container div uses `containerRef` from the hook. **[Agent: general-purpose]**
  - [x] Refactor `src/App.tsx`: replace the Smoke UI with `<GridView onSelectTask={setSelectedTaskId} />` and add `selectedTaskId` state. When a task is selected, render a `TaskDetailPlaceholder` (minimal: "Back" button + task ID text). **[Agent: general-purpose]**
  - [x] **Verify:** Write Vitest unit tests for `useGridLayout` (mock `ResizeObserver`): 800×600 container → correct cols/rows/cardsPerPage; narrow container (200px wide) → 1 column; verify minimum 120px respected; cap at 100. Write RTL component tests for `TaskCard`: renders priority number and truncated title; click fires `onSelect`. Run `pnpm test`. Then run `pnpm tauri dev` — create 3–5 tasks and confirm they appear as square cards in a grid, resize the window and confirm reflow. Click a card → shows placeholder detail view; click Back → returns to grid. **[Agent: general-purpose]**

- [x] **Slice 2: Card visuals — due date with overdue icon, progress ring, and completion checkbox**
  *Enrich the cards with the remaining content: due date (with red overdue icon), SVG progress ring (tasks with subtasks), and completion checkbox (tasks without subtasks). Checking the box marks the task Done and removes it from the grid.*
  *Acceptance criteria covered: due date display; overdue red warning icon; progress ring for subtask tasks; completion checkbox for no-subtask tasks; checkbox toggles Done; checkbox click doesn't trigger card navigation.*
  - [x] Create `src/features/tasks/ProgressRing.tsx` and `src/features/tasks/ProgressRing.module.css`. SVG component: two `<circle>` elements (background track + progress arc via `stroke-dasharray`/`stroke-dashoffset`, rotated -90deg). Props: `progress` (0–1), `size` (default 32). Wrapped in `<span role="progressbar" aria-valuenow={percent}>`. **[Agent: general-purpose]**
  - [x] Extend `TaskCard.tsx` to display: (a) due date at the bottom — formatted as short date (e.g., "Feb 15"), with a red "⚠" icon when `dueDate < today`; (b) `ProgressRing` when the task has subtasks (progress > null), or a completion checkbox (reuse `TaskProgress` pattern) when no subtasks. The checkbox `onClick` MUST call `event.stopPropagation()` to prevent card navigation. Checking the box calls `taskUpdate(id, { status: "done" })` and then `onUpdated()` to refresh the grid. **[Agent: general-purpose]**
  - [x] **Verify:** Write Vitest tests for `ProgressRing`: renders at 0%, 50%, 100%; correct `stroke-dashoffset`; `role="progressbar"` present. Write RTL tests for the extended `TaskCard`: due date shown when present; overdue icon appears for past dates; no icon for future dates; no date area when `dueDate` is null; progress ring rendered when subtasks exist; checkbox rendered when no subtasks; checkbox click calls `taskUpdate` and does NOT fire `onSelect`; card click fires `onSelect`. Run `pnpm test`. Then `pnpm tauri dev` — create tasks with/without due dates and subtasks; verify visuals. Mark a no-subtask task done via checkbox; confirm it disappears from grid. **[Agent: general-purpose]**

- [x] **Slice 3: Pagination — dynamic page calculation, Previous/Next controls, page preservation**
  *Add pagination when tasks exceed the viewport capacity. Pagination bar with Previous/Next buttons and "Page X of Y" indicator. Page preserved on resize (clamped only if needed). Empty page after task removal navigates to previous page.*
  *Acceptance criteria covered: dynamic max cards per page; pagination bar conditional display; Previous/Next buttons with disabled states; page indicator; resize preserves page; task removal clamps page.*
  *Key invariant: Cards MUST NEVER shrink below MIN_CARD_SIZE (120px). If all active tasks cannot fit at 120px minimum, pagination is used — never micro-cards. The `useGridLayout` hook (from Slice 1) already enforces this: `cols` and `rows` are derived from `floor(dimension / 120)`, and `cardsPerPage = cols * rows`. Tasks beyond `cardsPerPage` go to subsequent pages.*
  *Resize behavior: Do NOT reset `currentPage` to 1 on resize. Keep `currentPage` as-is and only clamp if `currentPage > totalPages`. If `totalPages` becomes 0 (no tasks), set `currentPage` to 1.*
  - [x] Create `src/features/tasks/PaginationBar.tsx` and `src/features/tasks/PaginationBar.module.css`. Receives `currentPage`, `totalPages`, `onPageChange`. Renders Previous button (disabled on page 1), "Page X of Y" text, Next button (disabled on last page). **[Agent: general-purpose]**
  - [x] Extend `GridView.tsx` with pagination state (`currentPage`). Compute `totalPages = ceil(tasks.length / cardsPerPage)`. Slice tasks for the current page: `tasks.slice((currentPage-1)*cardsPerPage, currentPage*cardsPerPage)`. Render `PaginationBar` only when `totalPages > 1`. **Resize behavior:** when `cardsPerPage` changes due to resize, preserve `currentPage` — only clamp if `currentPage > totalPages`; if `totalPages === 0`, set `currentPage = 1`. **Task removal:** if marking a task Done empties the current page, clamp `currentPage` to the new `totalPages`. The minimum card size invariant is already enforced by `useGridLayout` (cards are always ≥120px; excess tasks paginate rather than shrink). **[Agent: general-purpose]**
  - [x] **Verify:** Write RTL tests for `PaginationBar`: renders "Page 1 of 3"; Previous disabled on page 1; Next disabled on last page; click handlers fire correctly. Write RTL tests for `GridView` pagination: with 5 tasks and `cardsPerPage=20` → no pagination bar; mock `useGridLayout` to return `cardsPerPage=2` with 5 tasks → pagination shown, "Page 1 of 3"; navigate Next → shows page 2 tasks; marking task done on last page (when page becomes empty) → clamps to previous page. **Resize preservation test:** mock `useGridLayout` returning `cardsPerPage=4` with `currentPage=2`, then change to `cardsPerPage=6` → `currentPage` stays at 2 (not reset to 1); change to `cardsPerPage=6` with only 5 tasks → `currentPage` clamped to 1. **Min-size invariant test:** verify `useGridLayout` never returns `cardsPerPage` that would require cards < 120px (already tested in Slice 1, but confirm pagination engages correctly). Run `pnpm test`. Then `pnpm tauri dev` — create 20+ tasks, resize window small enough to trigger pagination, verify controls work and page is preserved across resize. **[Agent: general-purpose]**

- [x] **Slice 4: Empty state and loading indicator**
  *Handle the zero-tasks case and the loading state gracefully.*
  *Acceptance criteria covered: empty state message when zero active tasks; no blank screen on load.*
  - [x] Create `src/features/tasks/EmptyState.tsx` and `src/features/tasks/EmptyState.module.css`. Centered message: "No active tasks. Create one to get started!" **[Agent: general-purpose]**
  - [x] Extend `GridView.tsx`: if `loading` is true, show a minimal loading indicator (e.g., "Loading..." text). If `tasks.length === 0` and not loading, render `EmptyState` instead of `TaskGrid`. **[Agent: general-purpose]**
  - [x] **Verify:** Write RTL tests for `EmptyState`: renders the expected message. Write RTL tests for `GridView`: mock `useTasks` to return `loading: true` → loading indicator shown; mock with empty tasks → `EmptyState` shown; mock with tasks → `TaskGrid` shown. Run `pnpm test`. Then `pnpm tauri dev` — with no tasks, confirm empty state message. Create a task, confirm grid appears. **[Agent: general-purpose]**

---

## Subagent Coverage

All tasks are assigned to `general-purpose` since no specialist subagents exist. Verification relies on `pnpm test` and the Tauri dev server:

| Task/Slice | Issue | Recommendation |
|---|---|---|
| All Frontend sub-tasks (Slices 1–4) | Assigned to `general-purpose` — no React/TypeScript specialist | Consider adding a React/TypeScript agent in `.claude/agents/` |
| All Verification steps | No browser MCP available | UI verification done via Tauri dev server, test suites (`pnpm test`) |
