# Technical Specification: Dependencies + Highlighting + Graph View + Cycles

- **Functional Specification:** `context/spec/005-dependencies-highlighting-graph-view-cycles/functional-spec.md`
- **Status:** Draft
- **Author(s):** AI-assisted

---

## 1. High-Level Technical Approach

This feature introduces a first-class dependency system (separate from subtasks) with four major technical workstreams:

1. **Data layer (Rust + SQLite):** New `task_dependencies` table, CRUD commands following the existing `*_impl` pattern, and Tarjan's SCC algorithm in pure Rust for cycle detection and blocking enforcement.
2. **Task Detail UI (React):** New `DependencySection` component with "Blocked by" / "Blocks" sub-lists, search modal for adding dependencies, and blocking-enforcement guard on the "Mark done" action.
3. **Grid enhancements (React):** Blocked/Cyclic badges on `TaskCard`, hover highlighting state managed in `GridView`.
4. **Graph View (React):** Full-screen overlay using `@xyflow/react` (React Flow) with dagre auto-layout (top-to-bottom), draggable nodes, dependency + taskref edge rendering, and cycle highlighting.

**Key design decisions:**
- SCC computation happens **backend-only**, over the **dependency graph only** (not taskref subtask edges). The backend returns pre-computed, deterministic flags per task: `isCyclic`, `isBlocked`, and `unsatisfiedBlockerNames`. The frontend never replicates SCC logic — it trusts the backend.
- The "Dependencies + Subtask refs" toggle in Graph View is a **visualization overlay only** — it does not affect blocking enforcement, SCC computation, or any business logic.
- `task_list` returns all tasks plus a **flat edge list** (`dependencies: Vec<DependencyEdgeDto>`) and **per-task computed flags** (`isCyclic`, `isBlocked`, `unsatisfiedBlockerNames`). Dependencies are assembled in a single-pass bulk query — no per-task N+1 queries.
- Both hover highlighting and blocking enforcement operate on **direct (1-hop) dependencies only** — no transitive lookups.
- Graph auto-layout uses **top-to-bottom** (dagre TB) — blockers at top, dependents flow downward.
- No new Rust crate dependencies. The SCC algorithm is implemented in pure Rust (~50 lines).
- One new npm dependency: `@xyflow/react` (+ `dagre` for auto-layout).

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 Data Model / Database Changes

**New migration: `NNN_create_task_dependencies_table`**

Appended to the existing `MIGRATIONS` array in `src-tauri/src/db.rs`. Use the next available migration number (currently 001–003 exist, so 004 unless another feature has claimed it — check the array at implementation time to avoid collisions).

| Column | Type | Constraints |
|---|---|---|
| `id` | TEXT | PRIMARY KEY NOT NULL |
| `blocker_task_id` | TEXT | NOT NULL, FK → tasks(id) ON DELETE CASCADE |
| `dependent_task_id` | TEXT | NOT NULL, FK → tasks(id) ON DELETE CASCADE |
| `created_at` | TEXT | NOT NULL |

Additional constraints:
- `UNIQUE(blocker_task_id, dependent_task_id)` — prevents duplicate edges.
- `CHECK(blocker_task_id != dependent_task_id)` — prevents self-loops at DB level.
- Index on `blocker_task_id` and index on `dependent_task_id` for query performance.

**Why CASCADE on both FKs:** Deleting a task automatically removes all its dependency rows in both directions. This matches the spec: "Deleting a task removes all dependencies involving that task." No application-level cleanup needed.

### 2.2 Rust Backend: Models

**New structs in `models.rs`:**

`DependencyEdgeDto` — a lightweight edge representation for the flat edge list. Fields: `id`, `blocker_task_id`, `dependent_task_id`, `created_at`. Serde `rename_all = "camelCase"`.

`DependencyDto` — a rich dependency row for the task detail view. Fields: `id`, `blocker_task_id`, `dependent_task_id`, `blocker_title` (Option\<String\>), `blocker_status` (Option\<String\>), `dependent_title` (Option\<String\>), `dependent_status` (Option\<String\>), `created_at`. Serde `rename_all = "camelCase"`.

**Extended `TaskDto` — new computed fields:**

- `is_cyclic: bool` — `true` if this task participates in an SCC of size > 1 in the **dependency-only** graph.
- `is_blocked: bool` — `true` if this task has at least one direct blocker whose status ≠ "done" AND that blocker is NOT in the same SCC as this task. Computed entirely by the backend — the frontend uses this directly for the "Blocked" badge.
- `unsatisfied_blocker_names: Vec<String>` — titles of the unsatisfied direct non-cyclic blockers. Used for the badge tooltip and the blocking-rejected error message.

These three fields make the UI fully deterministic: the frontend renders badges based on `isBlocked` and `isCyclic` without needing to replicate SCC logic.

**`TaskListResult` (new response struct for `task_list`):**

- `tasks: Vec<TaskDto>` — all tasks with their per-task computed flags.
- `dependencies: Vec<DependencyEdgeDto>` — flat list of all dependency edges. Used by the frontend for hover highlighting (lookup by task ID) and graph view (edge rendering).

For `task_get` (single-task detail view), the response remains `TaskDto` but with two additional inline arrays: `blockers: Vec<DependencyDto>` and `dependents: Vec<DependencyDto>` (rich DTOs with titles/statuses for display in the Dependencies section).

### 2.3 Rust Backend: Commands

All new commands follow the established `*_impl` + `#[tauri::command]` wrapper pattern. Mutating commands call `backup_state.maybe_backup()`.

**`create_dependency_impl(conn, blocker_task_id, dependent_task_id) → Result<CreateDependencyResult, String>`**

Steps:
1. Validate both tasks exist and are not deleted.
2. Self-dependency check (`blocker_task_id != dependent_task_id`) — return error string if violated.
3. Insert into `task_dependencies` with new UUID + timestamp.
4. Run `compute_sccs(conn)` on the **dependency-only** graph.
5. Check if the new edge creates/expands an SCC (i.e., both `blocker_task_id` and `dependent_task_id` are in the same SCC of size > 1).
6. Return `CreateDependencyResult { dependency: DependencyEdgeDto, is_cyclic: bool }`.

The Tauri wrapper is `dependency_create`.

**`delete_dependency_impl(conn, dependency_id) → Result<(), String>`**

Steps:
1. Delete the row from `task_dependencies` by `id`.
2. Return Ok or error if not found.

The Tauri wrapper is `dependency_delete`.

**Modified `get_task_impl`** — after fetching the task, also fetch:
- Blockers (direct only): `SELECT d.*, t.title, t.status FROM task_dependencies d LEFT JOIN tasks t ON t.id = d.blocker_task_id WHERE d.dependent_task_id = ?`
- Dependents (direct only): `SELECT d.*, t.title, t.status FROM task_dependencies d LEFT JOIN tasks t ON t.id = d.dependent_task_id WHERE d.blocker_task_id = ?`
- Compute `is_cyclic`, `is_blocked`, `unsatisfied_blocker_names` via `compute_sccs(conn)` + direct blocker filtering.

**Modified `task_list_impl`** — returns `TaskListResult`:
1. Fetch all tasks (existing query).
2. **Single bulk query** to fetch ALL dependency edges: `SELECT id, blocker_task_id, dependent_task_id, created_at FROM task_dependencies`. No per-task queries — this is one pass.
3. Run `compute_sccs(conn)` **once** over the full dependency graph to get all SCCs.
4. For each task, compute the three flags in memory:
   - `is_cyclic`: does this task appear in any SCC of size > 1?
   - Build a lookup from the bulk edge list: for each task, find its direct blockers. Filter to those with status ≠ "done" AND not in the same SCC as the task.
   - `is_blocked`: are there any such unsatisfied non-cyclic direct blockers?
   - `unsatisfied_blocker_names`: titles of those blockers (for tooltip).
5. Return `TaskListResult { tasks, dependencies }` — tasks carry per-task flags; dependencies is the flat edge list for frontend use (hover highlighting, graph view).

**Modified `update_task_impl`** — when `status = Some("done".to_string())`:
1. Fetch all **direct** blockers of the task (1-hop only, no transitive).
2. Run `compute_sccs(conn)` to get the SCC membership set.
3. Filter blockers: keep only those whose status ≠ "done" AND who are NOT in the same SCC as the current task.
4. If any remain, return error: `"BlockedByUnsatisfiedDependencies: Task A, Task B"` (listing unsatisfied blocker titles).
5. Otherwise, proceed with the status update as before.

**Register in `lib.rs`:** Add `commands::dependency_create` and `commands::dependency_delete` to the `tauri::generate_handler![]` list.

### 2.4 Rust Backend: SCC Algorithm (Tarjan's)

**New private function in `commands.rs`:**

`fn compute_sccs(conn: &Connection) → Result<Vec<Vec<String>>, String>`

Implementation approach:
1. Load all edges from the `task_dependencies` table only — **taskref subtask edges are excluded**. SCC operates over the dependency graph exclusively.
2. Build an adjacency list (`HashMap<String, Vec<String>>`).
3. Run Tarjan's strongly connected components algorithm.
4. Return only SCCs of size > 1 (these are the cyclic groups).

**Scope clarification:** The "Dependencies + Subtask refs" toggle in Graph View adds taskref edges for visualization purposes only. Those edges are never fed into `compute_sccs` and have no effect on blocking enforcement, `isCyclic`, or `isBlocked` flags.

This function is called from:
- `create_dependency_impl` — to detect if the new edge creates a cycle (for the warning flag).
- `get_task_impl` / `task_list_impl` — to compute `is_cyclic`, `is_blocked`, `unsatisfied_blocker_names` per task.
- `update_task_impl` — to determine which direct blockers are cyclic (for blocking enforcement).

**Performance note:** Tarjan's is O(V + E). With ≤ hundreds of tasks and typically sparse dependency graphs, this runs in microseconds. No caching needed for this scale.

**Helper functions:**

`fn is_in_same_scc(sccs: &[Vec<String>], task_a: &str, task_b: &str) → bool` — checks if two tasks appear in the same SCC. Used by blocking enforcement and `is_blocked` computation.

`fn task_is_cyclic(sccs: &[Vec<String>], task_id: &str) → bool` — checks if a task appears in any SCC of size > 1. Used to set the `is_cyclic` flag.

### 2.5 Frontend: Types & Service

**`types.ts` additions:**

```
DependencyEdge { id, blockerTaskId, dependentTaskId }
Dependency { id, blockerTaskId, dependentTaskId, blockerTitle, blockerStatus, dependentTitle, dependentStatus }
```

Extended `Task`: add `isCyclic: boolean`, `isBlocked: boolean`, `unsatisfiedBlockerNames: string[]`. For the detail view, add `blockers: Dependency[]`, `dependents: Dependency[]`.

**`task-service.ts` additions:**

- New internal `DependencyEdgeResponse` and `DependencyResponse` interfaces matching the Rust DTO shapes.
- New `toDependencyEdge()` and `toDependency()` converters.
- Update `toTask()` to map the new computed fields (`isCyclic`, `isBlocked`, `unsatisfiedBlockerNames`) and, when present, `blockers`/`dependents`.
- `taskList()` now returns `{ tasks: Task[], dependencies: DependencyEdge[] }` (updated `TaskListResult` type). The `useTasks` hook exposes the `dependencies` edge list alongside `tasks`.
- New exported functions:
  - `dependencyCreate(blockerTaskId, dependentTaskId): Promise<{ dependency: DependencyEdge; isCyclic: boolean }>`
  - `dependencyDelete(id: string): Promise<void>`

### 2.6 Frontend: DependencySection Component

**New file: `src/features/tasks/DependencySection.tsx`** (+ `.module.css`)

Modeled after `SubtaskSection` but simpler (no drag-and-drop, no inline text input).

Props: `{ taskId: string; blockers: Dependency[]; dependents: Dependency[]; onUpdated: () => void }`

Structure:
- Section label: "Dependencies"
- Sub-section "Blocked by": list of blocker rows + "Add blocker" button.
- Sub-section "Blocks": list of dependent rows + "Add dependent" button.
- Each row shows: task title (or "Deleted task" if status is null/deleted), status badge, checkmark/strikethrough if done, remove (×) button.
- "Add blocker" opens `DependencySearchModal` in "blocker" mode.
- "Add dependent" opens `DependencySearchModal` in "dependent" mode.
- On adding a dependency that returns `isCyclic: true`, show a warning Toast.

### 2.7 Frontend: DependencySearchModal Component

**New file: `src/features/tasks/DependencySearchModal.tsx`** (+ `.module.css`)

Clone of `TaskRefSearchModal` adapted for dependencies:
- Props: `{ taskId: string; existingIds: string[]; onSelect: (taskId: string) => void; onClose: () => void }`
- Fetches `taskList({ statusFilter: "active" })`.
- Excludes: self (`taskId`), tasks already in `existingIds` (prevents duplicate dependencies).
- Does NOT exclude tasks that would create cycles (cycles are allowed per spec).
- Renders a portal overlay with search + scrollable task list.
- CSS can share or clone `TaskRefSearchModal.module.css`.

### 2.8 Frontend: TaskCard Enhancements

**Modified: `src/features/tasks/TaskCard.tsx`** (+ `.module.css`)

New props added to `TaskCard`:
- `highlightState?: "blocker" | "dependent" | "dimmed" | null` — controls hover-related visual state.

New conditional elements:
- **Blocked badge**: rendered when `task.isBlocked === true`. The backend has already computed this flag accounting for SCC membership — the frontend simply checks the boolean. Tooltip text uses `task.unsatisfiedBlockerNames.join(", ")`.
- **Cyclic indicator**: rendered when `task.isCyclic === true`. A visually distinct warning triangle or label.
- Both badges can appear simultaneously (a task can be blocked by external non-cyclic tasks while also participating in a cycle).

New CSS classes:
- `.blockedBadge` — small positioned badge (e.g., red/orange).
- `.cyclicBadge` — warning indicator (e.g., amber triangle).
- `.highlightBlocker` — distinct border color (e.g., `border: 2px solid #e67e22`).
- `.highlightDependent` — distinct border color (e.g., `border: 2px solid #27ae60`).
- `.dimmed` — reduced opacity (e.g., `opacity: 0.35`).

### 2.9 Frontend: GridView Hover Highlighting

**Modified: `src/features/tasks/GridView.tsx`**

New state:
- `hoveredTaskId: string | null` — set on `mouseenter`/`mouseleave` of each `TaskCard`.

The `dependencies` flat edge list (from `useTasks`) is used to compute **direct (1-hop) only** relationships — no transitive lookups:
- Build two lookup maps from the edge list on each render (or memoize with `useMemo`):
  - `blockersByTask: Map<string, Set<string>>` — for each task, the set of task IDs that directly block it.
  - `dependentsByTask: Map<string, Set<string>>` — for each task, the set of task IDs it directly blocks.

Computed per-card `highlightState`:
- If `hoveredTaskId` is null → all cards get `null` (no highlighting).
- If `hoveredTaskId` is set:
  - The hovered card itself → `null` (retains normal appearance).
  - Cards whose `id` is in `blockersByTask.get(hoveredTaskId)` → `"blocker"` (these directly block the hovered task).
  - Cards whose `id` is in `dependentsByTask.get(hoveredTaskId)` → `"dependent"` (these are directly blocked by the hovered task).
  - All other cards → `"dimmed"`.

This computation is cheap: `Set.has()` lookups for each visible card. With ≤ 100 cards, this is negligible.

Pass `highlightState` and `onMouseEnter`/`onMouseLeave` callbacks through `TaskGrid` to each `TaskCard`.

### 2.10 Frontend: GraphView Component

**New file: `src/features/tasks/GraphView.tsx`** (+ `.module.css`)

**Dependencies:** `@xyflow/react` (npm package), `dagre` (for auto-layout computation).

**Structure:**
- Full-screen overlay (`position: fixed; inset: 0; z-index: 1000; background: var(--bg)`).
- Rendered as a React portal to `document.body`.
- Header bar: toggle control ("Dependencies only" / "Dependencies + Subtask refs"), close button.
- Main area: `<ReactFlow>` component with custom node and edge types.

**Node rendering:**
- Each active task → one node.
- Custom node component showing: task title (truncated), status badge, cyclic indicator if applicable.
- Node position: computed via dagre layout (direction: TB) on mount.

**Edge rendering:**
- Dependency edges: solid arrow, default color. Blocker → dependent direction. Sourced from the `dependencies` flat edge list.
- TaskRef edges (when toggle is on): dashed arrow, different color. Parent → referenced task direction. Sourced from `task.subtasks.filter(s => s.type === "taskref" && s.refTaskId)`. **These are visualization-only** — they have no effect on SCC, blocking, or any business logic.
- Cyclic edges: highlighted with a distinct color (e.g., orange/red) — identified by checking if both source and target task have `isCyclic === true` (backend-computed). Only dependency edges can be cyclic (taskref edges are never part of SCC analysis).

**Data flow:**
- Receives the full `tasks` array and `dependencies` edge list (already loaded by `useTasks`).
- Builds nodes from tasks; builds dependency edges from the flat edge list.
- For taskref edges (toggle on): iterates each task's `subtasks` for `type === "taskref"`.
- Runs dagre layout to compute node positions.

**Interactions:**
- Nodes are draggable (React Flow built-in).
- Clicking a node calls `onSelectTask(taskId)` which closes the graph and opens the task detail view.
- Escape key or close button closes the overlay.

**Toggle behavior:**
- "Dependencies only": only render dependency edges.
- "Dependencies + Subtask refs": render both dependency and taskref edges.
- Toggling re-runs the dagre layout to account for different edge sets.

### 2.11 Frontend: Blocking Enforcement in TaskDetailView

**Modified: `src/features/tasks/TaskDetailView.tsx`**

The existing `handleMarkDone` function currently calls `taskUpdate(taskId, { status: "done" })` directly. Update it to:

1. Attempt the `taskUpdate` call (the backend will reject if blocked).
2. If the backend returns an error containing `"BlockedByUnsatisfiedDependencies"`, parse out the blocker names and show a Toast: "Cannot mark as done. Blocked by: Task A, Task B".
3. Otherwise, proceed as normal (refresh).

This keeps the enforcement logic in the backend (single source of truth) while the frontend simply handles the error gracefully.

### 2.12 File Summary

| File | Action | Purpose |
|---|---|---|
| `src-tauri/src/db.rs` | Modify | Add next migration (`NNN_create_task_dependencies_table`) |
| `src-tauri/src/models.rs` | Modify | Add `DependencyEdgeDto`, `DependencyDto`, `TaskListResult`; extend `TaskDto` with isCyclic, isBlocked, unsatisfiedBlockerNames, blockers, dependents |
| `src-tauri/src/commands.rs` | Modify | Add `compute_sccs`, `create_dependency_impl`, `delete_dependency_impl`; modify `get_task_impl`, `task_list_impl`, `update_task_impl` |
| `src-tauri/src/lib.rs` | Modify | Register `dependency_create`, `dependency_delete` |
| `src/features/tasks/types.ts` | Modify | Add `Dependency` interface; extend `Task` |
| `src/features/tasks/task-service.ts` | Modify | Add `dependencyCreate`, `dependencyDelete`, `toDependency`; update `toTask` |
| `src/features/tasks/DependencySection.tsx` | **Create** | Dependencies section for task detail view |
| `src/features/tasks/DependencySection.module.css` | **Create** | Styles for dependency section |
| `src/features/tasks/DependencySearchModal.tsx` | **Create** | Search modal for adding dependencies |
| `src/features/tasks/DependencySearchModal.module.css` | **Create** | Styles for dependency search modal |
| `src/features/tasks/TaskCard.tsx` | Modify | Add blocked badge, cyclic indicator, highlight props |
| `src/features/tasks/TaskCard.module.css` | Modify | Add badge, indicator, highlight, dimmed styles |
| `src/features/tasks/TaskDetailView.tsx` | Modify | Add DependencySection; handle blocked error in handleMarkDone |
| `src/features/tasks/GridView.tsx` | Modify | Add hover state, highlight computation, graph view button |
| `src/features/tasks/GridView.module.css` | Modify | Add toolbar styles |
| `src/features/tasks/GraphView.tsx` | **Create** | Full-screen graph overlay with React Flow |
| `src/features/tasks/GraphView.module.css` | **Create** | Styles for graph overlay |
| `src/features/tasks/TaskGrid.tsx` | Modify | Pass through highlight props and hover callbacks |

---

## 3. Impact and Risk Analysis

### System Dependencies

- **`task_list` response shape changes:** Now returns `TaskListResult { tasks, dependencies }` instead of a plain task array. The `useTasks` hook and any consumers must handle the new shape. Dependencies are fetched in a single bulk query (no N+1), with per-task flags computed in one in-memory pass over the graph.
- **`update_task_impl` now has a blocking guard:** Every "mark done" action triggers SCC computation. Acceptable at this scale (microseconds).
- **Existing subtask system is unaffected.** Dependencies are a completely separate table and concept. No changes to subtask CRUD.
- **`TaskCard` props change.** All existing consumers of `TaskCard` must pass the new `highlightState` prop (defaults to `null` / no change in behavior).

### Potential Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SCC computation becomes slow with many tasks | Low (O(V+E), sparse graph) | Medium | Only computed when dependency is modified or tasks are listed. No real-time polling. Can add caching later if needed. |
| React Flow bundle size increases app size | Medium | Low | React Flow is ~45KB gzipped. Acceptable for a desktop app. Can lazy-load the GraphView component. |
| Dagre layout produces poor results for complex graphs | Medium | Low | Users can drag nodes to rearrange. Layout is a starting point, not final. |
| CASCADE delete silently removes dependency data | Low | Medium | This is the intended behavior per spec. No user confirmation needed — task deletion is already confirmed at a higher level. |
| Hover highlighting performance with 100 cards | Low | Low | Simple array lookups, no DOM-heavy operations. CSS class toggling is fast. |
| Frontend badge logic diverges from backend SCC logic | Medium | High | Mitigated by having the backend compute `isBlocked` and `isCyclic` as booleans. Frontend never computes SCCs — it trusts the backend. |

---

## 4. Testing Strategy

### Rust Backend Tests (cargo test)

Following the established `test_db()` + `*_impl` pattern:

- **Migration test:** Verify `task_dependencies` table is created with correct constraints.
- **create_dependency_impl:** Happy path, self-dependency rejected, duplicate rejected, both tasks must exist, deleted task rejected.
- **delete_dependency_impl:** Happy path, nonexistent dependency.
- **compute_sccs:** No edges → empty, single edge (no cycle), A→B→A cycle, A→B→C→A cycle, two separate SCCs, mixed cyclic and non-cyclic.
- **Blocking enforcement in update_task_impl:** Task with unsatisfied non-cyclic blocker → rejected. Task with only cyclic blockers → allowed. Task with satisfied blockers → allowed. Task with mix of cyclic + non-cyclic unsatisfied → rejected (lists only non-cyclic). Non-"done" transitions always allowed.
- **CASCADE delete:** Delete a task → its dependencies are automatically removed.
- **task_list_impl:** Verify `TaskListResult` contains correct flat edge list + per-task `is_cyclic`, `is_blocked`, `unsatisfied_blocker_names` computed from a single-pass bulk query (no N+1).
- **get_task_impl:** Verify `blockers`, `dependents` (rich DTOs), `is_cyclic`, `is_blocked`, `unsatisfied_blocker_names` are populated correctly. Verify only direct (1-hop) blockers/dependents are returned.

### Frontend Tests (Vitest + React Testing Library)

Following the established `vi.mock("./task-service")` pattern:

- **DependencySection:** Renders blocker and dependent lists, add/remove interactions, cycle warning toast, completed blocker visual distinction, deleted task display.
- **DependencySearchModal:** Search filtering, self-exclusion, duplicate exclusion, selection callback.
- **TaskCard:** Blocked badge renders when `isBlocked`, cyclic indicator renders when `isCyclic`, highlight classes applied for each `highlightState` value, tooltip shows blocker names.
- **GridView hover:** Hovering a card sets correct highlight states on all cards, mouse leave clears highlights.
- **GraphView:** Renders nodes for all tasks, renders dependency edges, toggle switches between edge modes, clicking a node triggers navigation, close button/Escape closes overlay.
- **TaskDetailView blocking:** Attempting "Mark done" on a blocked task shows error toast with blocker names.
