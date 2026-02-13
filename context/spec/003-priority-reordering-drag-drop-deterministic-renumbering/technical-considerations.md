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

# Technical Specification: Priority Reordering (Drag & Drop) + Deterministic Renumbering

- **Functional Specification:** `context/spec/003-priority-reordering-drag-drop-deterministic-renumbering/functional-spec.md`
- **Status:** Completed
- **Author(s):** AI-assisted

---

## 1. High-Level Technical Approach

This feature adds three reorder interaction modes (drag-and-drop, keyboard, context menu) to the existing grid view. The **backend is already complete** — `task_reorder(task_id, after_id)` with fractional indexing and transactional renumbering exists and is tested. The work is almost entirely frontend:

1. **Add `@dnd-kit/core` + `@dnd-kit/sortable`** as the drag-and-drop library. Use its built-in keyboard sensor for Alt+Arrow reordering.
2. **Wrap `TaskGrid` in a DnD context** (`DndContext` + `SortableContext`) so cards become sortable items.
3. **Add a drag handle** to `TaskCard` via `@dnd-kit/sortable`'s `useSortable` hook with an activator element.
4. **Add a context menu component** for "Move to Top" / "Move to Bottom" actions.
5. **Fix priority number display** — change from page-relative (`index + 1`) to global (`startIndex + index + 1`), derived from the full sorted active task list.
6. **Wire all reorder events to the existing `taskReorder()` service** function, then refresh the task list.

No backend changes, no database migrations, no new Tauri commands.

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1. New Dependencies

| Package | Purpose | Approx Size |
|---|---|---|
| `@dnd-kit/core` | DnD engine: DndContext, sensors, collision detection | ~10KB gzip |
| `@dnd-kit/sortable` | Sortable preset: SortableContext, useSortable, arrayMove | ~5KB gzip |
| `@dnd-kit/utilities` | CSS utility for transform (already a dep of sortable) | ~1KB gzip |

Install: `pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

### 2.2. Backend — No Changes Required

The existing `reorder_task_impl` in `src-tauri/src/commands.rs` already:
- Accepts `task_id: String` and `after_id: Option<String>` (None = move to top)
- Computes a new `priority_rank` via `generate_key_between()`
- Runs reorder + renumber check atomically in a single `unchecked_transaction()`
- Triggers `renumber_active_tasks()` when any rank exceeds 20 characters
- Is exposed as `task_reorder` Tauri command

The frontend `taskReorder(taskId, afterId?)` in `task-service.ts` already wraps this command. No backend work needed.

### 2.3. Component Breakdown

#### 2.3.1. Modified: `TaskCard.tsx` — Add drag handle + sortable wrapper

- Wrap the card with `useSortable(id)` from `@dnd-kit/sortable`.
- Add a **drag handle element** (grip icon) in the top-right corner of the card, using `listeners` and `attributes` from `useSortable` applied only to the handle element (not the entire card).
- Apply `transform` and `transition` styles from `useSortable` to the card's root element for smooth drag animation.
- The handle element gets `role="button"` and `aria-roledescription="sortable"` from dnd-kit's built-in accessibility.
- New CSS class: `.dragHandle` — positioned absolute top-right, shows a 6-dot grip icon, `cursor: grab`.
- During active drag: card gets `opacity: 0.5` (ghost effect) via a `.dragging` CSS modifier class.

**New props:**
- `globalIndex: number` — replaces the current page-relative `priorityIndex` for correct global display.
- `isSortable: boolean` — controls whether the sortable wrapper is active (disabled during loading/transitions).

#### 2.3.2. Modified: `TaskGrid.tsx` — DnD context and sortable container

- Wrap the grid with `DndContext` (from `@dnd-kit/core`) and `SortableContext` (from `@dnd-kit/sortable`).
- Configure sensors:
  - **PointerSensor** with `activationConstraint: { distance: 5 }` — prevents accidental drags.
  - **KeyboardSensor** with custom `coordinateGetter` — maps Alt+ArrowUp/Down to reorder directions (one position at a time in the linear task list).
- Collision detection and sorting strategy:
  - Use `collisionDetection={closestCenter}` for stable hit detection in a grid layout.
  - Use `strategy={rectSortingStrategy}` from `@dnd-kit/sortable`, designed for multi-column grid reordering.
  - This combination is required for stable grid reordering — `closestCenter` prevents erratic snapping between rows that `closestCorners` can cause.
- Provide a **DragOverlay** for the ghost card: renders a clone of the dragged `TaskCard` with reduced opacity.
- On `onDragEnd`: compute `afterId` from the new position in the page task list, call the `onReorder(taskId, afterId)` callback.
- On `onDragCancel`: no-op (dnd-kit handles visual reset automatically).

**New props:**
- `onReorder: (taskId: string, afterId: string | null) => void` — callback for reorder events.
- `startIndex: number` — the global index offset for the current page (e.g., 0 for page 1, 10 for page 2 if cardsPerPage=10). Used to compute each card's `globalIndex`.
- `allPageTasks: Task[]` — the full task list for the current page, needed to determine `afterId` from drop position.

#### 2.3.3. Modified: `GridView.tsx` — Orchestrate reorder + refresh + concurrent safety

- Add a `reorderVersion` counter (or use `tasks` reference) as a **stale-check token**. When a drag starts, capture the current token. When the drag ends, compare — if the token changed (tasks were refreshed mid-drag), cancel the reorder.
- Implement `handleReorder(taskId, afterId)`:
  1. Call `taskReorder(taskId, afterId)` from `task-service.ts`.
  2. Call `refresh()` to reload the full task list from the backend.
  3. Priority numbers auto-update because `refresh()` fetches the new sorted order.
- Pass `startIndex = (currentPage - 1) * cardsPerPage` to `TaskGrid` for global priority numbering.
- After context menu "Move to Top": call `taskReorder(taskId, null)` (afterId=null means top), refresh, navigate to page 1.
- After context menu "Move to Bottom": call `taskReorder(taskId, lastTaskId)` where `lastTaskId` is the ID of the last active task (excluding the moved task), refresh, navigate to last page.
  - **Note:** The full task list is already available from `useTasks()`. To get `lastTaskId`, filter out the moved task and take the last element's ID: `tasks.filter(t => t.id !== taskId).at(-1)?.id`. If undefined (task is the only one), it's a no-op.
- For keyboard reorder crossing page boundaries: after refresh, if the moved task is no longer on `currentPage`, compute which page it's on and navigate there.

#### 2.3.4. New: `TaskCardContextMenu.tsx` + `TaskCardContextMenu.module.css`

- A lightweight context menu component.
- Trigger: `onContextMenu` event on the card (right-click). Must call `event.preventDefault()` to suppress the browser's native context menu, and `event.stopPropagation()` to avoid triggering card selection/navigation.
- Menu items: "Move to Top", "Move to Bottom".
- Positioning: absolute, anchored to click coordinates, clamped to viewport bounds using `Math.min(clickX, window.innerWidth - menuWidth)` and equivalent for Y.
- Dismissal: click outside, Escape key, or selecting an item.
- **Ordering:** The menu MUST close before calling the reorder action to prevent overlay artifacts (menu rendered on top of a grid that's about to re-render).
- Each item calls a callback: `onMoveToTop(taskId)` / `onMoveToBottom(taskId)`.
- Rendered via a React portal to avoid z-index/overflow issues with the grid.

#### 2.3.5. Modified: Priority Number Display (Global Indexing)

Priority numbers must always be derived from the **full sorted active task list**, NOT from the current page slice. The single source of truth for a task's priority number is its position in the global list.

Current code in `TaskGrid.tsx`:
```
priorityIndex={index + 1}  // page-relative: always starts at 1
```

Changed to:
```
globalIndex={startIndex + index + 1}  // global: page 2 starts at cardsPerPage + 1
```

`GridView` computes `startIndex = (currentPage - 1) * cardsPerPage` from the full task list and passes it to `TaskGrid`. `TaskGrid` computes each card's `globalIndex` as `startIndex + index + 1`. This ensures page 2 shows #11, #12, etc. when page 1 has 10 cards.

### 2.4. Reorder Logic — Mapping Drop Position to `afterId`

The backend API uses `afterId` (the ID of the task the moved task should be placed **after**). The frontend must map a visual drop index to the correct `afterId`:

**Same-position guard:** If the computed new global index equals the current global index of the dragged task, do NOT call `taskReorder()`, do NOT call `refresh()` — exit early. This prevents unnecessary backend writes and redundant renumber checks.

**Within a page (drag-and-drop or keyboard):**
Given the current page's task slice and the full global task list:
- Drop at position 0 on page 1: `afterId = null` (move to top).
- Drop at position 0 on page N (N > 1): `afterId = lastTaskOnPreviousPage.id`. This is `tasks[startIndex - 1].id` from the full task list.
- Drop at position `i` (i > 0) on any page: `afterId = pageTasks[i - 1].id` (the task just before the drop slot in the page).

This correctly maps the visual position to the global linear order.

**"Move to Top":** `afterId = null`.

**"Move to Bottom":**
- If the moved task is already the last task in the global list, do nothing (no backend call — early exit).
- Otherwise, compute `afterId` as `tasks.filter(t => t.id !== taskId).at(-1)?.id` — the ID of the last active task excluding the moved task. This prevents self-`afterId` bugs where the task is placed "after itself".

### 2.5. Keyboard Sensor Configuration

`@dnd-kit`'s `KeyboardSensor` supports custom key bindings via a `coordinateGetter`. However, the spec requires **Alt+Arrow** rather than plain arrow keys (which are used for grid navigation). Configuration:

- Create a custom `keyboardCoordinates` function that only responds to `Alt+ArrowUp` and `Alt+ArrowDown`.
- Alt+ArrowUp: move the sortable item one position earlier (decrement index).
- Alt+ArrowDown: move the sortable item one position later (increment index).
- Plain arrow keys: ignored by the sortable sensor (reserved for future grid focus navigation).
- On Windows, Alt+Arrow is browser back/forward — call `event.preventDefault()` in the keyboard sensor handler. Test across platforms.

After each keyboard reorder, `@dnd-kit` fires `onDragEnd` with the same payload as a pointer drag, so the same `handleReorder` logic applies.

**Focus preservation after reorder + refresh:**
Do not rely solely on React key stability for focus preservation. After `refresh()` completes and the task list updates:
1. Store `movedTaskId` in a ref before triggering the reorder.
2. After the `tasks` state updates (in a `useEffect` watching `tasks`), locate the drag handle element via `document.querySelector(`[data-task-id="${movedTaskId}"] [data-drag-handle]`)`.
3. Call `element.focus()` to explicitly restore focus.
This guarantees the user can press Alt+Arrow repeatedly to continue moving the same card without re-selecting it, even after a full refresh cycle.

### 2.6. Optimistic Reorder (Flicker Prevention)

To prevent visual flicker between the drop and backend confirmation:

1. **On drop**, immediately reorder the local `tasks` array using `arrayMove()` from `@dnd-kit/sortable`. This updates the in-memory task list to reflect the new order.
2. **Immediately recalculate** visible global priority numbers from the optimistic array. The user sees the correct numbering the instant they drop.
3. **Call `taskReorder(taskId, afterId)` asynchronously** to persist the change to the backend.
4. **Await completion**, then call `refresh()` to confirm the backend order matches the optimistic state.
5. **If the backend call fails**, revert to the previous array via `refresh()` — which fetches the true backend order, effectively undoing the optimistic update.

This ensures the user never sees stale numbers or a "jump" between drop and refresh.

### 2.7. Concurrent Change Safety

To prevent stale reorders when the task list changes mid-drag:

1. In `GridView`, maintain a `tasksVersion` ref (incremented on each `refresh()`).
2. When a drag starts (`onDragStart`), capture `dragStartVersion = tasksVersion.current`.
3. When a drag ends (`onDragEnd`), check: if `tasksVersion.current !== dragStartVersion`, discard the event (do not call `taskReorder`). The grid already shows the updated state from the concurrent refresh.
4. This handles: task deletion by another process, checkbox mark-as-done during drag, any `refresh()` triggered externally.

### 2.8. File Map

| File | Action | Responsibility |
|---|---|---|
| `src/features/tasks/TaskCard.tsx` | Modify | Add `useSortable`, drag handle, ghost styles, `globalIndex` prop |
| `src/features/tasks/TaskCard.module.css` | Modify | Add `.dragHandle`, `.dragging` styles |
| `src/features/tasks/TaskGrid.tsx` | Modify | Add `DndContext`, `SortableContext`, sensors, `DragOverlay`, `onReorder`/`startIndex` props |
| `src/features/tasks/TaskGrid.module.css` | Modify | Add drop indicator styles (dnd-kit provides CSS variables) |
| `src/features/tasks/GridView.tsx` | Modify | Add reorder handler, optimistic update, version tracking, context menu wiring, page navigation after moves |
| `src/features/tasks/TaskCardContextMenu.tsx` | **New** | Context menu with "Move to Top"/"Move to Bottom" |
| `src/features/tasks/TaskCardContextMenu.module.css` | **New** | Context menu positioning and styles |
| `src/features/tasks/use-tasks.ts` | Minor | No change — `refresh()` already returns updated order |
| `src/features/tasks/task-service.ts` | No change | `taskReorder()` already exists and is correct |
| `src-tauri/src/commands.rs` | No change | `reorder_task_impl` already complete |

---

## 3. Impact and Risk Analysis

### System Dependencies

- **`@dnd-kit` ecosystem:** New frontend dependency. Actively maintained, MIT licensed, no known security issues. If the library becomes unmaintained, the sortable abstraction is thin enough to replace.
- **Existing `TaskCard` and `TaskGrid`:** Both are modified. All existing tests must continue to pass. The `useSortable` wrapper adds DOM attributes to the card root — existing test selectors (`data-testid`) remain valid.
- **`useTasks` hook and `task-service.ts`:** Unchanged. The reorder flow is: optimistic local update → call `taskReorder()` → call `refresh()` → React re-renders with confirmed order.

### Potential Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Drag handle conflicts with card click** | Clicking the handle might fire both drag and card navigation | `useSortable` with `activationConstraint: { distance: 5 }` — a click (distance < 5px) won't start a drag. The handle itself should not have an `onClick` for card navigation. |
| **Priority number flicker after reorder** | User sees stale numbers briefly between drop and refresh | Use optimistic UI: on drop, immediately reorder the local `tasks` array using `arrayMove()` and recalculate visible global priority numbers from the optimistic array. Call `taskReorder(taskId, afterId)` asynchronously. Await completion, then call `refresh()` to confirm backend order. If backend call fails, revert to previous array via `refresh()`. This prevents visual flicker and keeps numbering stable. |
| **Keyboard sensor intercepts browser shortcuts** | Alt+Arrow might conflict with browser or OS shortcuts | On macOS, Alt+Arrow is "move word" in text fields — but we're not in a text field during grid interaction. On Windows, Alt+Arrow is browser back/forward — call `event.preventDefault()` in the keyboard sensor handler. Test across platforms. |
| **Large task lists cause slow drag** | 100 items on a page might cause jank during drag | `@dnd-kit` uses CSS transforms (no layout reflows). The `rectSortingStrategy` is optimized for grids. Profile with 100 cards during implementation. |
| **Context menu positioning at viewport edges** | Menu might render off-screen | Clamp menu position to viewport bounds using `Math.min(clickX, window.innerWidth - menuWidth)` and equivalent for Y. |
| **Race condition: refresh during reorder persist** | `taskReorder()` is async; `refresh()` might return stale data if called too quickly | Await `taskReorder()` before calling `refresh()`. Both are sequential. The backend's transaction guarantees the new rank is committed before the list query reads it. |
| **No-op reorder writes** | Dropping in same position or "Move to Bottom" on already-last task triggers unnecessary backend calls | Same-position guard (section 2.4): compare computed new index to current index, exit early if equal. Move-to-bottom guard: check if task is already last before calling backend. |

---

## 4. Testing Strategy

### Frontend Unit Tests (Vitest + React Testing Library)

**`TaskCard.test.tsx` (extend):**
- Drag handle is rendered and has correct ARIA attributes.
- Clicking the drag handle does NOT fire `onSelect`.
- `globalIndex` prop displays correct global priority number.

**`TaskGrid.test.tsx` (new/extend):**
- `DndContext` and `SortableContext` render without errors.
- Mock drag events: `onDragEnd` fires `onReorder` with correct `taskId` and `afterId`.
- Drop at position 0 on page 1 calls `onReorder(id, null)`.
- Drop at position `i` calls `onReorder(id, pageTasks[i-1].id)`.
- Keyboard sensor: Alt+ArrowUp/Down fires `onDragEnd`.
- Same-position drop does NOT fire `onReorder`.

**`TaskCardContextMenu.test.tsx` (new):**
- Right-click on card opens context menu (native menu suppressed).
- "Move to Top" calls the correct callback.
- "Move to Bottom" calls the correct callback.
- Clicking outside closes the menu.
- Escape key closes the menu.
- Menu closes before reorder action executes.

**`GridView.test.tsx` (extend):**
- Reorder handler calls `taskReorder()` then `refresh()`.
- "Move to Top" calls `taskReorder(id, null)`, navigates to page 1.
- "Move to Bottom" calls `taskReorder(id, lastTaskId)`, navigates to last page.
- "Move to Bottom" on already-last task is a no-op (no backend call).
- Priority numbers use global indexing (page 2 starts at `cardsPerPage + 1`).
- Concurrent change safety: if `tasks` changes during drag, reorder is discarded.
- Optimistic update: local array reorders immediately on drop before backend confirms.

**`GridView.test.tsx` — focus preservation:**
- After keyboard reorder, the moved card retains focus.

### Backend Tests (Already Complete)

The `reorder_task_impl` tests in `commands.rs` already cover:
- Move to top, move after, move to bottom.
- Fractional key generation between adjacent ranks.
- Renumbering trigger when keys exceed 20 characters.
- Transactional atomicity.

No new backend tests needed.

### Manual Verification

- Create 20+ tasks, resize window to trigger pagination.
- Drag a card to a new position within a page — verify all numbers update.
- Alt+ArrowUp/Down to move a card — verify focus stays on the card.
- Right-click → "Move to Top" on page 3 → verify card appears as #1 on page 1.
- Right-click → "Move to Bottom" → verify card appears last on the last page.
- Perform 50+ rapid reorders → verify no ordering glitches (renumbering works silently).
- Drop a card in its original position → verify no backend call.
- Right-click "Move to Bottom" on already-last card → verify no backend call.
