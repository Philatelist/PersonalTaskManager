# Technical Specification: Core Task Model, Subtasks & Progress

- **Functional Specification:** `context/spec/001-core-task-model-subtasks-progress/functional-spec.md`
- **Status:** Draft
- **Author(s):** Poe (AI-assisted)

---

## 1. High-Level Technical Approach

This feature implements the foundational data model for the entire application. It spans two layers:

1. **Rust backend (Tauri v2):** A SQLite database with three normalized tables (`tasks`, `subtasks`, `task_tags`). Tauri commands expose fine-grained CRUD operations plus dedicated reorder commands. Every mutation is immediately persisted within a SQLite transaction (no explicit save action). Daily backups are created on the first write of each day.

2. **TypeScript frontend (React 18):** TypeScript types mirror the data model. A service layer calls Tauri commands via `invoke()`. Progress is a pure derived value computed from subtask state. The frontend is organized by feature (`src/features/tasks/`).

No new architectural components are introduced — this uses the existing Tauri + SQLite + React stack as defined in the architecture document.

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1. Data Model / Database Schema

Three tables in SQLite. Foreign keys are enforced via `PRAGMA foreign_keys = ON` (set on every connection open).

**`tasks`**

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | Primary key |
| `title` | TEXT | Required, non-empty |
| `description` | TEXT | Optional, Markdown content |
| `priority_rank` | TEXT | Fractional index string for ordering (e.g., "a0", "aV") |
| `status` | TEXT | One of: "active", "done", "deleted". Default: "active" |
| `due_date` | TEXT | Optional, ISO 8601 date (YYYY-MM-DD), no time component |
| `created_at` | TEXT | ISO 8601 timestamp, set on creation, immutable |
| `updated_at` | TEXT | ISO 8601 timestamp, updated on every mutation |

**`subtasks`**

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | Primary key |
| `task_id` | TEXT | FK → `tasks.id`, ON DELETE CASCADE |
| `type` | TEXT | "checklist" or "taskref" |
| `label` | TEXT | Text label for checklist subtasks; NULL for taskref |
| `is_done` | INTEGER (nullable) | 0 or 1 for checklist (user-toggled); NULL for taskref (completion is computed, never stored) |
| `ref_task_id` | TEXT | FK → `tasks.id`, ON DELETE NO ACTION. NULL for checklist; required for taskref |
| `sort_order` | INTEGER | Position within the parent task's subtask list |
| `created_at` | TEXT | ISO 8601 timestamp |

- `is_done` is **nullable**: for `type = "checklist"`, it stores the user-toggled value (0 or 1). For `type = "taskref"`, it is always NULL in the database. The completion state for taskref subtasks is **computed at read time** by joining against the referenced task's status.
- Updates to `is_done` are **forbidden** for taskref subtasks (enforced at the command layer).
- `ref_task_id` uses **ON DELETE NO ACTION**: if a referenced task is hard-deleted, the subtask row remains with a dangling reference. The read layer detects this (referenced task has status "deleted" or row is missing) and surfaces "Referenced task deleted" in the DTO.
- `task_id` uses **ON DELETE CASCADE**: if a parent task is hard-deleted, all its subtasks are removed automatically.

**`task_tags`**

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | Primary key |
| `task_id` | TEXT | FK → `tasks.id`, ON DELETE CASCADE |
| `tag` | TEXT | Free-form tag string (e.g., "engineering") |

- Unique constraint on `(task_id, tag)` to prevent duplicate tags per task.
- Index on `task_tags.tag` for efficient filtering by tag across tasks.

**Key design decisions:**
- **PriorityRank uses fractional indexing** (string-based). Inserting between two tasks generates a new string between them without renumbering other rows. Periodic renumbering only if strings grow excessively long (>20 chars).
- **TaskRef completion is computed on read**, not stored. When reading subtasks, a LEFT JOIN against the referenced task's status determines completion. This avoids stale data and eliminates update cascading.

### 2.2. Tauri Command API

All commands are exposed via `#[tauri::command]` and called from the frontend via `invoke()`.

**Task commands:**

| Command | Parameters | Returns | Notes |
|---|---|---|---|
| `task_create` | `{ title, description?, priority_rank?, tags?, due_date? }` | `TaskDto` | If `priority_rank` omitted, appends to end |
| `task_get` | `{ id }` | `TaskDto` with subtasks and tags | Subtasks include computed `ref_task_title`, `ref_task_status`, and `is_done` for taskref type (via LEFT JOIN) |
| `task_list` | `{ status_filter?, tag_filter? }` | `TaskDto[]` | Ordered by `priority_rank`. Default filter: status = "active" |
| `task_update` | `{ id, title?, description?, status?, due_date? }` | `TaskDto` | Partial update; `updated_at` set automatically |
| `task_delete` | `{ id }` | `void` | Sets status to "deleted" (soft delete) |
| `task_reorder` | `{ task_id, after_id? }` | `void` | Moves task after `after_id` (or to top if null). Computes new fractional index |

**Subtask commands:**

| Command | Parameters | Returns | Notes |
|---|---|---|---|
| `subtask_create` | `{ task_id, type, label?, ref_task_id? }` | `SubtaskDto` | Validates: checklist requires `label`; taskref requires `ref_task_id` |
| `subtask_update` | `{ id, label?, is_done? }` | `SubtaskDto` | Checklist only. Rejects updates to `is_done` for taskref type |
| `subtask_delete` | `{ id }` | `void` | Hard delete |
| `subtask_reorder` | `{ task_id, ordered_ids[] }` | `void` | Batch reorder: accepts full ordered list of subtask IDs for the given task |

**DTO shape for `task_get` subtasks:**

The `TaskDto` returned by `task_get` includes a `subtasks` array where each subtask DTO contains:
- All stored fields (`id`, `task_id`, `type`, `label`, `sort_order`, `created_at`)
- `is_done`: for checklist, the stored value; for taskref, computed from `ref_task_status === "done"`
- `ref_task_id`: the referenced task ID (null for checklist)
- `ref_task_title`: the referenced task's current title (null for checklist; "Referenced task deleted" if missing/deleted)
- `ref_task_status`: the referenced task's current status (null for checklist; null if missing/deleted)

### 2.3. Frontend Structure (Feature-Based)

```
src/
  features/
    tasks/
      types.ts          — Task, Subtask, SubtaskType, TaskStatus TypeScript types
      task-service.ts    — Tauri invoke wrappers (taskCreate, taskUpdate, etc.)
      use-tasks.ts       — React hook: fetches and caches the active task list
      use-task.ts        — React hook: fetches a single task with subtasks
      progress.ts        — Pure function: computeProgress(subtasks) → number | null
```

**Key TypeScript types** (in `types.ts`):

- `TaskStatus = "active" | "done" | "deleted"`
- `SubtaskType = "checklist" | "taskref"`
- `Task { id, title, description, priorityRank, status, tags, dueDate, subtasks, createdAt, updatedAt }`
- `Subtask { id, taskId, type, label, isDone, refTaskId, refTaskTitle?, refTaskStatus?, sortOrder }`

**Progress calculation** (in `progress.ts`):
- `computeProgress(subtasks: Subtask[]): number | null`
- Returns `null` if subtasks array is empty (triggers completion checkbox mode).
- Returns `completedCount / totalCount` (0.0–1.0) otherwise.
- A checklist subtask is completed when `isDone === true`.
- A taskref subtask is completed when `refTaskStatus === "done"`.

### 2.4. Persistence Behavior

- **Immediate persist:** Every mutation command writes to SQLite within a transaction. No debounce, no explicit save. The database is always up to date.
- **Atomic writes:** All Tauri commands that modify data wrap operations in a SQLite transaction. If any step fails, the entire operation rolls back.
- **Foreign keys:** `PRAGMA foreign_keys = ON` is set on every database connection open.
- **Daily backups:** On the first write of each day, the Rust backend checks if a backup file `backups/ptm-YYYY-MM-DD.sqlite` exists in the app data directory. If not, it copies the current database file before proceeding with the write. **Best-effort behavior:** if the backup copy fails (e.g., disk space), the write proceeds anyway and a warning is logged. The app should never block user actions due to a backup failure. A future improvement may use the SQLite backup API or `VACUUM INTO` for more robust hot backups.

---

## 3. Impact and Risk Analysis

**System Dependencies:**
- This is the foundational data layer. All future features (grid UI, detail view, dependencies, AI chat) will depend on these tables and commands.
- The `task_tags` table and tagging model will be consumed by future filtering/sorting features.
- The subtask model (especially taskRef) creates read-time coupling between tasks. Performance is acceptable because it's a single-user local database with realistic upper bounds (~100 active tasks, ~50 subtasks per task).

**Potential Risks & Mitigations:**

| Risk | Impact | Mitigation |
|---|---|---|
| Fractional index strings growing unbounded after many reorders | Performance degradation on sort | Periodic renumbering when any string exceeds 20 characters. Triggered lazily during `task_reorder`. |
| Broken taskRef when referenced task is deleted | Stale UI, confusing subtask state | Computed join: taskRef reads the referenced task's current status. Deleted/missing tasks show "Referenced task deleted" and are treated as incomplete. `ON DELETE NO ACTION` preserves the subtask row. |
| SQLite file corruption | Data loss | Daily backups (copy on first write of day). SQLite WAL mode for crash resilience. |
| Backup failure blocking user workflow | App freezes or errors on write | Best-effort backup: if copy fails, log warning and proceed with write. Never block user actions. |
| Large number of subtasks per task degrading performance | Slow task detail loading | Acceptable for v1 (realistic upper bound ~50 subtasks). Index on `subtasks.task_id`. |
| Dangling ref_task_id after hard delete | Orphaned taskRef subtask | `ON DELETE NO ACTION` keeps the subtask. Read layer detects missing/deleted reference and surfaces appropriate message. User can manually remove. |

---

## 4. Testing Strategy

**Rust unit tests** (Cargo test):
- CRUD operations for tasks, subtasks, and tags against an in-memory SQLite database.
- Fractional index generation and renumbering logic.
- TaskRef completion derivation via LEFT JOIN (referenced task Done → subtask complete; Active → incomplete; Deleted → incomplete with "Referenced task deleted").
- Soft delete behavior (status = "deleted" but row remains).
- Foreign key cascade behavior (deleting parent task cascades to subtasks and tags).
- `is_done` update rejection for taskref subtasks.
- Daily backup trigger logic (first write of day check, best-effort on failure).
- Subtask batch reorder with `subtask_reorder`.

**TypeScript unit tests** (Vitest):
- `computeProgress()`: empty subtasks → null; mixed checklist/taskref → correct ratio; all done → 1.0; none done → 0.0; broken taskref (refTaskStatus = null) → treated as incomplete.
- Type mapping between Tauri responses and frontend types.

**React component tests** (Vitest + React Testing Library):
- Task with zero subtasks renders completion checkbox; toggling sets status to Done/Active.
- Task with subtasks renders progress indicator, not checkbox.
- Adding first subtask switches from checkbox to progress indicator.
- Removing last subtask switches from progress indicator to checkbox.
