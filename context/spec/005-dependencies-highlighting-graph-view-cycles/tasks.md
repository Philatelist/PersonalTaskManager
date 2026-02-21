# Tasks: Dependencies + Highlighting + Graph View + Cycles

- **Functional Spec:** `functional-spec.md`
- **Technical Spec:** `technical-considerations.md`
- **Status:** Pending

---

## Slice 1: Dependency Data Layer + Basic CRUD

**Goal:** A `task_dependencies` table exists and dependencies can be created/deleted from the backend. No UI yet — testable via Rust unit tests only. The app remains runnable with no visible changes.

**Acceptance Criteria:** Spec §2.1 — dependency creation, self-dep rejection, duplicate rejection, CASCADE delete, stored independently from subtasks.

- [x] **Sub-task 1:** Add new migration to `src-tauri/src/db.rs` — append the next available migration (`NNN_create_task_dependencies_table`) with the `task_dependencies` table: `id`, `blocker_task_id`, `dependent_task_id`, `created_at`, UNIQUE constraint, CHECK for self-loop prevention, CASCADE on both FKs, indexes on both FK columns. Write a db.rs test to verify table creation, constraints (self-loop rejected, duplicate rejected), and CASCADE delete behavior. Run `cargo test`. **[Agent: general-purpose]**

- [x] **Sub-task 2:** Add `DependencyEdgeDto` and `DependencyDto` structs to `src-tauri/src/models.rs` with `Serialize, Deserialize, Clone, Debug` and `rename_all = "camelCase"`. Add new computed fields to `TaskDto`: `is_cyclic: bool`, `is_blocked: bool`, `unsatisfied_blocker_names: Vec<String>`. For now, default these to `false`/empty in existing code paths so the app compiles and runs. Add `blockers: Vec<DependencyDto>` and `dependents: Vec<DependencyDto>` to `TaskDto` (default empty). Add `TaskListResult` struct with `tasks: Vec<TaskDto>` and `dependencies: Vec<DependencyEdgeDto>`. Run `cargo test`. **[Agent: general-purpose]**

- [x] **Sub-task 3:** Add `create_dependency_impl` and `delete_dependency_impl` to `src-tauri/src/commands.rs`. `create_dependency_impl(conn, blocker_task_id, dependent_task_id)`: validate both tasks exist and are not deleted, check self-dependency, insert row, return `DependencyEdgeDto` + `is_cyclic: false` (SCC not yet implemented). `delete_dependency_impl(conn, dependency_id)`: delete row by id. Add Tauri command wrappers `dependency_create` and `dependency_delete` (with `backup_state.maybe_backup()`). Register both in `lib.rs` invoke_handler. Write Rust tests: happy path create, self-dep rejected, duplicate rejected, both-tasks-must-exist, deleted-task rejected, happy path delete, delete nonexistent. Run `cargo test`. **[Agent: general-purpose]**

- [x] **Sub-task 4: Verify** — Run full test suite (`cargo test` + `pnpm test`). Confirm all existing tests still pass plus the new dependency tests. The app should compile and run with no visible UI changes. **[Agent: general-purpose]**

---

## Slice 2: SCC Algorithm + Computed Flags

**Goal:** Tarjan's SCC algorithm is implemented. `task_list_impl` and `get_task_impl` return computed `isCyclic`, `isBlocked`, `unsatisfiedBlockerNames` flags and a flat dependency edge list. Fully testable via Rust tests.

**Acceptance Criteria:** Spec §2.6 — cycle detection over dependency-only graph; computed flags for §2.3 badge logic.

- [x] **Sub-task 1:** Implement `compute_sccs(conn: &Connection) -> Result<Vec<Vec<String>>, String>` in `commands.rs`. Load all edges from `task_dependencies` only (not subtask refs). Build adjacency list. Run Tarjan's algorithm. Return only SCCs of size > 1. Add helper functions `task_is_cyclic(sccs, task_id) -> bool` and `is_in_same_scc(sccs, task_a, task_b) -> bool`. Write Rust tests: no edges → empty, single edge (no cycle), A→B→A cycle, A→B→C→A cycle, two separate SCCs, mixed cyclic and non-cyclic nodes. Run `cargo test`. **[Agent: general-purpose]**

- [x] **Sub-task 2:** Update `create_dependency_impl` to call `compute_sccs` after inserting the edge and set `is_cyclic` on the result to `true` if both `blocker_task_id` and `dependent_task_id` are in the same SCC. Write Rust tests: creating a non-cyclic dep returns `is_cyclic: false`, creating A→B then B→A returns `is_cyclic: true`. Run `cargo test`. **[Agent: general-purpose]**

- [x] **Sub-task 3:** Update `task_list_impl` to return `TaskListResult`. After fetching all tasks: (a) single bulk query for all dependency edges, (b) run `compute_sccs` once, (c) for each task compute `is_cyclic`, `is_blocked`, `unsatisfied_blocker_names` in memory from the edge list + SCCs + task statuses. Write a helper function `compute_dependency_flags(tasks, edges, sccs)` to keep logic testable. Return `TaskListResult { tasks, dependencies }`. Update the Tauri command wrapper `task_list` to return the new result type. Write Rust tests: task with no deps has all flags false/empty; task with unsatisfied non-cyclic blocker has `is_blocked: true`; task with only cyclic blockers has `is_blocked: false, is_cyclic: true`; task with mix of cyclic + non-cyclic has both `is_blocked: true, is_cyclic: true`; satisfied blocker (done) → `is_blocked: false`. Run `cargo test`. **[Agent: general-purpose]**

- [x] **Sub-task 4:** Update `get_task_impl` to populate `blockers` and `dependents` (rich `DependencyDto` arrays with JOINed titles/statuses), and compute `is_cyclic`, `is_blocked`, `unsatisfied_blocker_names`. Write Rust tests: task with blockers returns correct rich DTOs; task with dependents returns correct rich DTOs; computed flags match expected values. Run `cargo test`. **[Agent: general-purpose]**

- [x] **Sub-task 5: Verify** — Run full test suite (`cargo test` + `pnpm test`). Note: frontend tests may need minor fixes if `toTask()` or `useTasks` break due to the new `TaskListResult` shape — apply minimal fixes to keep them green (default new fields). The app should compile and run. **[Agent: general-purpose]**

---

## Slice 3: Frontend Types/Service + DependencySection UI

**Goal:** The user can see and manage dependencies in the task detail view. "Add blocker" / "Add dependent" buttons, search modal, dependency rows with remove (×), visual distinction for completed/deleted blockers.

**Acceptance Criteria:** Spec §2.2 — all managing-dependencies acceptance criteria.

- [x] **Sub-task 1:** Update `types.ts`: add `DependencyEdge` and `Dependency` interfaces, extend `Task` with `isCyclic`, `isBlocked`, `unsatisfiedBlockerNames`, `blockers`, `dependents`. Update `task-service.ts`: add `DependencyEdgeResponse`, `DependencyResponse` interfaces and converter functions. Update `toTask()` to map new fields (with safe defaults for optional arrays). Update `taskList()` to return `{ tasks, dependencies }` matching the new `TaskListResult` backend shape. Add `dependencyCreate()` and `dependencyDelete()` service functions. Update `use-tasks.ts` (or `useTasks` hook) to expose `dependencies` alongside `tasks`. Fix any existing tests that break from the type/shape changes. Run `pnpm test`. **[Agent: general-purpose]**

- [x] **Sub-task 2:** Create `DependencySearchModal.tsx` + `DependencySearchModal.module.css`. Clone the pattern from `TaskRefSearchModal`: portal overlay, search input, scrollable task list. Props: `{ taskId, existingIds, onSelect, onClose }`. Exclude self and tasks in `existingIds`. Does NOT exclude potential cycles (cycles are allowed). Write tests for DependencySearchModal: search filtering, self-exclusion, existing-id exclusion, selection callback, Escape closes. Run `pnpm test`. **[Agent: general-purpose]**

- [x] **Sub-task 3:** Create `DependencySection.tsx` + `DependencySection.module.css`. Props: `{ taskId, blockers, dependents, onUpdated }`. Render "Dependencies" section label. Two sub-sections: "Blocked by" (blocker rows + "Add blocker" button) and "Blocks" (dependent rows + "Add dependent" button). Each row: task title, status badge, remove (×) button. Completed blockers shown with strikethrough/checkmark. Deleted-task rows shown as "Deleted task" grayed out. "Add blocker" opens DependencySearchModal, calls `dependencyCreate(selectedId, taskId)`, then `onUpdated()`. "Add dependent" opens DependencySearchModal, calls `dependencyCreate(taskId, selectedId)`, then `onUpdated()`. Remove (×) calls `dependencyDelete(id)`, then `onUpdated()`. Write tests for DependencySection: renders blocker list, renders dependent list, add-blocker flow, add-dependent flow, remove dependency, completed blocker visual, deleted task visual. Run `pnpm test`. **[Agent: general-purpose]**

- [ ] **Sub-task 4:** Integrate `DependencySection` into `TaskDetailView.tsx`. Place it below the Subtasks section and above the StatusActions. Pass `taskId`, `task.blockers`, `task.dependents`, and `onUpdated={refresh}`. Run `pnpm test`. **[Agent: general-purpose]**

- [ ] **Sub-task 5: Verify** — Run full test suite (`cargo test` + `pnpm test`). Verify dependencies can be added, viewed, and removed in the task detail view. Confirm existing subtask and task features still work. **[Agent: general-purpose]**

---

## Slice 4: Blocking Enforcement

**Goal:** A task with unsatisfied direct non-cyclic blockers cannot be marked as "done". The backend rejects the transition and the frontend shows an error toast. Other status transitions (e.g., delete) remain allowed.

**Acceptance Criteria:** Spec §2.1 — blocking semantics; Spec §2.6 — cyclic blockers don't enforce blocking.

- [ ] **Sub-task 1:** Modify `update_task_impl` in `commands.rs`. When `status = Some("done")`: fetch direct blockers, run `compute_sccs`, filter to unsatisfied non-cyclic blockers, if any remain return error `"BlockedByUnsatisfiedDependencies: Task A, Task B"`. Non-"done" transitions (e.g., delete) skip this check entirely. Write Rust tests: blocked task → "done" rejected with correct blocker names; task with only cyclic blockers → "done" allowed; task with satisfied blockers → "done" allowed; task with mixed cyclic + non-cyclic → "done" rejected (lists only non-cyclic names); "deleted" transition always allowed regardless of blockers. Run `cargo test`. **[Agent: general-purpose]**

- [ ] **Sub-task 2:** Update `handleMarkDone` in `TaskDetailView.tsx`. Wrap the `taskUpdate` call in try/catch. If the error message contains `"BlockedByUnsatisfiedDependencies"`, show a Toast: "Cannot mark as done. Blocked by: [names]". Write a frontend test: mock `taskUpdate` to reject with `BlockedByUnsatisfiedDependencies`, verify toast appears with blocker names. Run `pnpm test`. **[Agent: general-purpose]**

- [ ] **Sub-task 3: Verify** — Run full test suite (`cargo test` + `pnpm test`). Confirm blocking enforcement works end-to-end and all other features remain unaffected. **[Agent: general-purpose]**

---

## Slice 5: Blocked & Cyclic Badges on Grid Cards

**Goal:** Grid cards show a "Blocked" badge (when `isBlocked`) and/or a "Cyclic" warning indicator (when `isCyclic`). Badge tooltip shows unsatisfied blocker names.

**Acceptance Criteria:** Spec §2.3 — all blocked/cyclic indicator acceptance criteria.

- [ ] **Sub-task 1:** Modify `TaskCard.tsx` + `TaskCard.module.css`. Add conditional "Blocked" badge element (rendered when `task.isBlocked === true`) with tooltip showing `task.unsatisfiedBlockerNames.join(", ")`. Add conditional "Cyclic" indicator (rendered when `task.isCyclic === true`), visually distinct from the blocked badge (e.g., warning triangle, different color). Both can appear simultaneously. Add CSS classes: `.blockedBadge`, `.cyclicBadge` with appropriate positioning and styling. Write frontend tests: badge renders when `isBlocked`, tooltip shows correct names, badge absent when `isBlocked: false`, cyclic indicator renders when `isCyclic`, both appear simultaneously, neither appears for tasks with no dependencies. Run `pnpm test`. **[Agent: general-purpose]**

- [ ] **Sub-task 2: Verify** — Run full test suite (`cargo test` + `pnpm test`). Confirm badges appear on grid cards as expected and don't interfere with existing card functionality (drag, click, progress ring). **[Agent: general-purpose]**

---

## Slice 6: Hover Highlighting on Grid

**Goal:** Hovering a grid card highlights its direct blockers (1-hop) with one color, its direct dependents (1-hop) with another color, dims all other cards, and clears on mouse leave.

**Acceptance Criteria:** Spec §2.4 — all hover highlighting acceptance criteria.

- [ ] **Sub-task 1:** Add `highlightState` prop to `TaskCard.tsx`. Type: `"blocker" | "dependent" | "dimmed" | null | undefined`. Apply CSS classes conditionally: `.highlightBlocker`, `.highlightDependent`, `.dimmed`. Add CSS for these classes in `TaskCard.module.css`: distinct border colors for blocker/dependent, reduced opacity for dimmed. Update `TaskGrid.tsx` to pass through `highlightState` and `onMouseEnter`/`onMouseLeave` callbacks. Write tests: each highlight state applies the correct CSS class; null/undefined applies no class. Run `pnpm test`. **[Agent: general-purpose]**

- [ ] **Sub-task 2:** Add hover highlighting state to `GridView.tsx`. State: `hoveredTaskId: string | null`. Build `blockersByTask` and `dependentsByTask` lookup maps from `dependencies` edge list (memoized via `useMemo`). Compute per-card `highlightState` based on `hoveredTaskId`. Pass `highlightState`, `onMouseEnter`, `onMouseLeave` through to `TaskGrid` → `TaskCard`. Write tests: hovering a card sets correct highlight states on related cards; mouse leave clears all highlighting; tasks with no dependencies show dimming on other cards but no highlight on self. Run `pnpm test`. **[Agent: general-purpose]**

- [ ] **Sub-task 3: Verify** — Run full test suite (`cargo test` + `pnpm test`). Confirm hover highlighting works correctly and doesn't interfere with existing card interactions. **[Agent: general-purpose]**

---

## Slice 7: Graph View

**Goal:** A "Graph View" button in the grid toolbar opens a full-screen overlay showing all active tasks as draggable nodes with dependency edges (and optionally taskref edges). Cyclic edges are highlighted. Clicking a node navigates to the task detail view.

**Acceptance Criteria:** Spec §2.5 — all graph view acceptance criteria.

- [ ] **Sub-task 1:** Install `@xyflow/react` and `dagre` npm packages. Add `@types/dagre` if needed. Run `pnpm test` to confirm no regressions from the new dependencies. **[Agent: general-purpose]**

- [ ] **Sub-task 2:** Create `GraphView.tsx` + `GraphView.module.css`. Full-screen fixed overlay rendered as a portal. Header with close button (×) and Escape key handler. Receives `tasks` and `dependencies` from `useTasks`. Builds React Flow nodes from tasks (custom node component with title, status badge, cyclic indicator). Builds dependency edges from the flat edge list (solid arrows, blocker → dependent). Runs dagre layout (TB direction) to compute initial node positions. Nodes are draggable. Clicking a node calls `onSelectTask(taskId)`. CSS: `.overlay` (position fixed, inset 0, z-index 1000), `.header`, `.closeButton`. Write tests: overlay renders with nodes for each task, close button dismisses, Escape key dismisses, clicking a node triggers onSelectTask. Run `pnpm test`. **[Agent: general-purpose]**

- [ ] **Sub-task 3:** Add the edge toggle and taskref edges to `GraphView.tsx`. Add toggle control ("Dependencies only" / "Dependencies + Subtask refs") in the header. When "Dependencies + Subtask refs" is selected, also render taskref edges (dashed arrows, different color) sourced from `task.subtasks.filter(s => s.type === "taskref")`. Toggling re-runs dagre layout. Write tests: toggle switches edge modes, taskref edges appear only in combined mode, dependency edges appear in both modes. Run `pnpm test`. **[Agent: general-purpose]**

- [ ] **Sub-task 4:** Add cycle highlighting to `GraphView.tsx`. Dependency edges where both source and target task have `isCyclic === true` are rendered with a distinct color (e.g., orange/red). Add a small "Cycle detected" label near cyclic nodes or edges. Write tests: cyclic edges get the cyclic style class, non-cyclic edges do not. Run `pnpm test`. **[Agent: general-purpose]**

- [ ] **Sub-task 5:** Add "Graph View" button to `GridView.tsx`. Place it in a toolbar/header area above the grid. Clicking it sets `showGraph: true` which renders `<GraphView>`. When GraphView calls `onClose`, set `showGraph: false`. When GraphView calls `onSelectTask(id)`, close graph and navigate to task detail. Add CSS for the toolbar in `GridView.module.css`. Write tests: button visible, clicking opens graph overlay, closing returns to grid. Run `pnpm test`. **[Agent: general-purpose]**

- [ ] **Sub-task 6: Verify** — Run full test suite (`cargo test` + `pnpm test`). Confirm graph view works end-to-end with all interactions and doesn't interfere with existing features. **[Agent: general-purpose]**

---

## Slice 8: Cycle Warning Toast + Edge Cases + Final Verification

**Goal:** Creating a dependency that introduces a cycle shows a warning toast. All edge cases are covered: deleted-task display in dependency rows, cycle resolution re-enables blocking, CASCADE cleanup. Full acceptance criteria pass.

**Acceptance Criteria:** Spec §2.2 (cycle toast), §2.6 (cycle warning, resolution), §2.1 (CASCADE delete), §2.3 (cycle indicator disappears on resolution).

- [ ] **Sub-task 1:** Update `DependencySection.tsx` to handle the `isCyclic` flag from `dependencyCreate()`. If `isCyclic === true`, show a warning Toast: "This creates a cycle — blocking will be disabled for these tasks." Write frontend test: creating a dependency that returns `isCyclic: true` shows the cycle warning toast. Run `pnpm test`. **[Agent: general-purpose]**

- [ ] **Sub-task 2:** Write Rust tests for edge cases: (a) CASCADE — deleting a task removes all its dependency rows in both directions, (b) cycle resolution — removing a dependency that dissolves an SCC makes `is_cyclic` return to `false` and re-enables blocking, (c) completed blocker satisfies the dependency (blocker marked done → `is_blocked` becomes `false`). Run `cargo test`. **[Agent: general-purpose]**

- [ ] **Sub-task 3:** Write frontend tests for remaining edge cases: (a) dependencies involving deleted tasks show "Deleted task" in grayed-out text in DependencySection, (b) removing a dependency that resolves a cycle causes the cyclic badge to disappear on grid refresh, (c) completing a blocker causes the blocked badge to disappear on grid refresh. Run `pnpm test`. **[Agent: general-purpose]**

- [ ] **Sub-task 4: Final Verify** — Run full test suite (`cargo test` + `pnpm test`). Walk through all acceptance criteria from functional-spec.md §2.1–§2.6 and confirm each is covered by at least one test. Update this tasks.md to mark all checkboxes complete. **[Agent: general-purpose]**

---

## Recommendations

| Task/Slice | Issue | Recommendation |
|---|---|---|
| All sub-tasks | Assigned to `general-purpose` — no Rust or React specialist agent available | Consider adding `rust-expert` and `react-expert` agents for better delegation in future features |
| All verification sub-tasks | No browser MCP available for visual UI verification | Testing relies on Vitest + React Testing Library (unit/component tests). Manual visual QA should be done by the user after each slice. |
