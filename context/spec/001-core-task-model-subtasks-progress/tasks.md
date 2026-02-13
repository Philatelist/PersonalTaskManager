# Tasks: Core Task Model, Subtasks & Progress

- **Specification:** `context/spec/001-core-task-model-subtasks-progress/`
- **Status:** Draft

---

- [x] **Slice 1: Create and retrieve a task with a minimal Smoke UI**
  *The smallest end-to-end: scaffold project, persist one task, read it back, and display it in a working UI.*
  *Acceptance criteria covered: task created with only title; defaults applied; created_at/updated_at set.*
  - [x] Scaffold Tauri v2 project with React 18 + TypeScript + Vite frontend and Rust backend. Configure pnpm, ESLint, Prettier, Vitest. Verify `pnpm tauri dev` starts without errors. **[Agent: general-purpose]**
  - [x] Create SQLite database initialization module in Rust: open/create DB file in app data directory, set `PRAGMA foreign_keys = ON`, enable WAL mode on every connection. **[Agent: general-purpose]**
  - [x] Create `tasks` table migration (all columns: id UUID, title, description, priority_rank, status, due_date, created_at, updated_at). Execute on app startup. **[Agent: general-purpose]**
  - [x] Implement fractional indexing utility in Rust: `generate_key_between(a: Option<&str>, b: Option<&str>) -> String`. **[Agent: general-purpose]**
  - [x] Implement `task_create` Tauri command: accepts `{ title }`, generates UUID, assigns `priority_rank` (append to end via fractional index), sets status = "active", sets `created_at`/`updated_at`, persists in SQLite transaction, returns `TaskDto`. **[Agent: general-purpose]**
  - [x] Implement `task_get` Tauri command: accepts `{ id }`, returns `TaskDto`. **[Agent: general-purpose]**
  - [x] Implement `task_list` Tauri command: returns tasks with status = "active", ordered by `priority_rank`. **[Agent: general-purpose]**
  - [x] Create frontend `types.ts` with `Task`, `TaskStatus`, `Subtask`, `SubtaskType`. Create `task-service.ts` with Tauri invoke wrappers: `taskCreate`, `taskGet`, `taskList`. **[Agent: general-purpose]**
  - [x] Build a minimal **Smoke UI** screen in React: a text input + "Add Task" button that calls `taskCreate`, and a list below that calls `taskList` on mount and after each creation, rendering each task's title and status. No styling required — functional correctness only. **[Agent: general-purpose]**
  - [x] **Verify:** Rust unit tests against in-memory SQLite: create task with title only → defaults correct; retrieve by ID → all fields match; list returns ordered results. Run `cargo test`. Then run `pnpm tauri dev`, type a task title into the input, click "Add Task", and confirm it appears in the rendered list with status "active". Repeat with a second task to verify ordering. **[Agent: general-purpose]**

- [x] **Slice 2: Full task CRUD — update, soft delete, tags, all fields**
  *Complete the task lifecycle. User can create rich tasks, modify them, and soft-delete.*
  *Acceptance criteria covered: all task fields; status transitions; tags CRUD; soft delete; updated_at on mutation.*
  - [x] Create `task_tags` table migration (id, task_id FK CASCADE, tag, unique constraint on (task_id, tag), index on tag). **[Agent: general-purpose]**
  - [x] Extend `task_create` to accept optional `description`, `tags[]`, `due_date`. Insert tags into `task_tags` within the same transaction. **[Agent: general-purpose]**
  - [x] Implement `task_update` Tauri command: partial update of title, description, status, due_date. Auto-set `updated_at`. Return updated `TaskDto`. **[Agent: general-purpose]**
  - [x] Implement `task_delete` Tauri command: set status to "deleted" (soft delete). **[Agent: general-purpose]**
  - [x] Extend `task_get` and `task_list` to join and return tags. Add `status_filter` and `tag_filter` parameters to `task_list`. **[Agent: general-purpose]**
  - [x] Update `task-service.ts`: add `taskUpdate`, `taskDelete` wrappers; extend `taskCreate` and `taskList` signatures. **[Agent: general-purpose]**
  - [x] **Verify:** Rust unit tests: create with all fields → verify; update title/status → `updated_at` changes; soft delete → excluded from default list but retrievable by ID; tags: add multiple, verify uniqueness constraint, remove one; filter by status and by tag. Run `cargo test`. In the Smoke UI: create a task, then use browser dev tools or a temporary button to call `taskDelete` and confirm the task disappears from the list on refresh. **[Agent: general-purpose]**

- [x] **Slice 3: Task reordering via drag-and-drop rank**
  *User can reorder tasks. Fractional indexing ensures no mass renumbering.*
  *Acceptance criteria covered: PriorityRank unique/deterministic; reorder via drag-and-drop updates rank.*
  - [x] Implement `task_reorder` Tauri command: accepts `{ task_id, after_id? }`. Computes new fractional index between `after_id` and the next task (or at top/bottom). Updates task's `priority_rank` in transaction. **[Agent: general-purpose]**
  - [x] Implement periodic renumbering: during `task_reorder`, if any key exceeds 20 characters, renumber all active tasks deterministically within the same transaction. **[Agent: general-purpose]**
  - [x] Add `taskReorder` wrapper to `task-service.ts`. **[Agent: general-purpose]**
  - [x] **Verify:** Rust unit tests: create 5 tasks → verify initial order; reorder to top/middle/bottom → `task_list` reflects new order; trigger renumbering with repeated adjacent inserts → keys shortened, order preserved. Run `cargo test`. **[Agent: general-purpose]**

- [x] **Slice 4: Checklist subtasks — add, toggle, edit, delete, reorder**
  *First subtask type, fully wired. User can break a task into checkable steps.*
  *Acceptance criteria covered: subtasks one level deep; checklist CRUD; toggle done; reorder; cascade delete.*
  - [x] Create `subtasks` table migration (id, task_id FK CASCADE, type, label, is_done nullable, ref_task_id FK NO ACTION, sort_order, created_at). **[Agent: general-purpose]**
  - [x] Implement `subtask_create` command: validate checklist requires `label`, set `is_done = 0`, assign `sort_order` (append), return `SubtaskDto`. **[Agent: general-purpose]**
  - [x] Implement `subtask_update` command: allow `label` and `is_done` edits for checklist type. Return `SubtaskDto`. **[Agent: general-purpose]**
  - [x] Implement `subtask_delete` command: hard delete the row. **[Agent: general-purpose]**
  - [x] Implement `subtask_reorder` command: accept `{ task_id, ordered_ids[] }`, update `sort_order` for all subtasks of that task. **[Agent: general-purpose]**
  - [x] Extend `task_get` to LEFT JOIN subtasks, ordered by `sort_order`. **[Agent: general-purpose]**
  - [x] Add subtask wrappers to `task-service.ts`: `subtaskCreate`, `subtaskUpdate`, `subtaskDelete`, `subtaskReorder`. **[Agent: general-purpose]**
  - [x] **Verify:** Rust unit tests: create checklist subtask → verify fields and defaults; toggle `is_done` → verify; edit label → verify; delete → verify removed; reorder 3 subtasks → verify new `sort_order`; `task_get` returns subtasks sorted; cascade: delete parent task → subtasks removed. Run `cargo test`. **[Agent: general-purpose]**

- [x] **Slice 5: TaskRef subtasks — computed completion and broken references**
  *Second subtask type. Subtask completion is derived from the referenced task's status.*
  *Acceptance criteria covered: taskRef creation; completion derived from referenced task; deleted ref shows message; is_done update rejected for taskRef; both types intermixed.*
  - [x] Extend `subtask_create` to handle `type: "taskref"`: validate `ref_task_id` required and references existing task, set `is_done = NULL`, set `label = NULL`. **[Agent: general-purpose]**
  - [x] Extend `subtask_update` to reject `is_done` updates for taskref type (return error). **[Agent: general-purpose]**
  - [x] Update `task_get` subtask query: LEFT JOIN referenced task on `ref_task_id`. Populate DTO fields: `ref_task_title` (title or "Referenced task deleted"), `ref_task_status` (status or null), `is_done` (computed: `ref_task_status === "done"`). **[Agent: general-purpose]**
  - [x] Update frontend `Subtask` type and service layer to handle `refTaskTitle`, `refTaskStatus` optional fields. **[Agent: general-purpose]**
  - [x] **Verify:** Rust unit tests: create taskRef subtask → `is_done` NULL in DB; `task_get` computes `is_done` from ref status; set ref task to "done" → taskRef complete; soft-delete ref task → "Referenced task deleted", incomplete; reject `is_done` update on taskRef; mixed checklist + taskRef on same parent task. Run `cargo test`. **[Agent: general-purpose]**

- [x] **Slice 6: Progress calculation and completion checkbox logic**
  *User sees progress for tasks with subtasks, or a simple checkbox for tasks without.*
  *Acceptance criteria covered: progress = completed/total; checkbox for zero subtasks; checkbox toggles Active ↔ Done; switching between modes when subtasks added/removed.*
  - [x] Implement `computeProgress(subtasks)` in `progress.ts`: returns `null` for empty; ratio 0.0–1.0 otherwise. Checklist: `isDone === true`. TaskRef: `refTaskStatus === "done"`. **[Agent: general-purpose]**
  - [x] Create `use-tasks.ts` hook: fetch active task list, expose computed progress per task. **[Agent: general-purpose]**
  - [x] Create `use-task.ts` hook: fetch single task with subtasks, expose computed progress. **[Agent: general-purpose]**
  - [x] **Verify:** Vitest unit tests for `computeProgress`: empty → null; 2 checklist (1 done) → 0.5; 3 mixed (1 checklist done + 1 taskRef done + 1 taskRef incomplete) → ~0.67; all done → 1.0; none done → 0.0; broken taskRef (refTaskStatus = null) → incomplete. React component tests (RTL): zero subtasks → renders checkbox; toggle checkbox → calls `taskUpdate` with status "done"/"active"; subtasks present → renders progress indicator; add first subtask → switches to progress; remove last subtask → switches to checkbox. Run `pnpm test`. **[Agent: general-purpose]**

- [x] **Slice 7: Daily backup on first write of day**
  *Safety net: automatic best-effort backup before first mutation each day.*
  *This slice is independent of UI work and can be implemented at any point after Slice 1's database layer exists. It does not block UI-first implementation or early manual verification.*
  *Acceptance criteria covered (from tech spec persistence requirements): daily backup; best-effort; never blocks user.*
  - [x] Implement `ensure_daily_backup(db_path, backup_dir)` in Rust: check if `backups/ptm-YYYY-MM-DD.sqlite` exists; if not, copy DB file. Best-effort: on failure, log warning and return Ok. **[Agent: general-purpose]**
  - [x] Integrate into write path: track "backup done today" flag in memory; call `ensure_daily_backup` before first mutation of each session/day. **[Agent: general-purpose]**
  - [x] **Verify:** Rust unit tests: first write → backup file created with correct date name; second write same day → no duplicate; simulated failure (read-only dir) → warning logged, write succeeds. Manual: start app, create task, confirm backup file appears in app data `backups/` directory. Run `cargo test`. **[Agent: general-purpose]**

---

## Subagent Coverage

All tasks are assigned to `general-purpose` since no specialist subagents exist. Verification relies on `cargo test`, `pnpm test`, and the Smoke UI:

| Task/Slice | Issue | Recommendation |
|---|---|---|
| All Rust sub-tasks (Slices 1–5, 7) | Assigned to `general-purpose` — no Rust/Tauri specialist | Consider adding a Rust/Tauri agent in `.claude/agents/` |
| All Frontend sub-tasks (Slices 1, 2, 6) | Assigned to `general-purpose` — no React/TS specialist | Consider adding a React/TypeScript agent in `.claude/agents/` |
| All Verification steps | No browser MCP available | UI verification done via Smoke UI in dev server, test suites (`cargo test`, `pnpm test`) |
