# Technical Specification: Archive — Completed vs Deleted + Restore + Permanent Delete

- **Functional Specification:** `context/spec/007-archive-completed-deleted-restore-permanent-delete/functional-spec.md`
- **Status:** Draft
- **Author(s):** AWOS

---

## 1. High-Level Technical Approach

The existing soft-delete (`status = 'deleted'`) and done (`status = 'done'`) flows are already in place. This feature exposes those statuses as a first-class **Archive** tab and adds:

1. A new **`task_permanent_delete`** Rust command that hard-deletes a task (with pre-cleanup of taskref references).
2. An extended **`task_list`** command accepting `statusFilter = "archive"` to retrieve both `done` and `deleted` tasks.
3. A small correction to the **`is_blocked` / progress** logic to treat `"deleted"` blockers and taskref refs consistently with the spec.
4. A **tab UI** on the main grid (Active / Archive) wired to the appropriate status filter.
5. **Archive-mode cards and detail view**: different context menu items, read-only editing, Restore + Permanently Delete actions.

No database schema changes are required. All status values already exist in the `tasks.status` CHECK constraint (`'active'|'done'|'deleted'`).

---

## 2. Proposed Solution & Implementation Plan (The "How")

---

### 2.1 Database — No Schema Changes

The existing schema already supports this feature:

| Table | Relevant behaviour |
|---|---|
| `tasks` | `status` CHECK allows `'active'`, `'done'`, `'deleted'`. `priority_rank` (fractional index string) is preserved on archive and restored intact. |
| `task_dependencies` | Both `blocker_task_id` and `dependent_task_id` FK to `tasks` with **CASCADE DELETE** — hard-deleting a task automatically removes its dependency rows in both directions. |
| `task_tags` | FK to `tasks` with **CASCADE DELETE** — auto-removed on hard delete. |
| `subtasks` (own subtasks) | `task_id` FK to `tasks` with **CASCADE** — auto-removed on hard delete. |
| `subtasks` (taskref refs) | `ref_task_id` FK to `tasks` with **NO ACTION** — prevents hard-deleting a referenced task. Must be cleaned up first. |

---

### 2.2 Backend (Rust) Changes

All changes follow the existing `*_impl` / `#[tauri::command]` wrapper pattern.

#### 2.2.1 New command: `task_permanent_delete`

**File:** `src-tauri/src/commands.rs`

Signature: `task_permanent_delete(id: String) -> Result<(), String>`

Logic (in `task_permanent_delete_impl`):
1. `DELETE FROM subtasks WHERE ref_task_id = ?` — removes taskref subtasks in other tasks pointing to this task (bypasses the NO ACTION constraint).
2. `DELETE FROM tasks WHERE id = ?` — hard-deletes the task; CASCADE handles its own tags, subtasks, and dependency rows.

The command only succeeds if the task exists and has `status IN ('done', 'deleted')`. An attempt to permanently delete an active task should return an error (server-side guard).

#### 2.2.2 Modify `task_list` — archive status filter

**File:** `src-tauri/src/commands.rs`

Current behaviour: `statusFilter: Option<String>` defaults to `"active"` if None, queries `WHERE status = ?`.

Change: if `statusFilter = "archive"`, use `WHERE status IN ('done', 'deleted')` with ordering `ORDER BY updated_at DESC` (most recently archived first). All other status filter values continue to work as before.

#### 2.2.3 Correct `is_blocked` logic — treat `"deleted"` as non-blocking

**File:** `src-tauri/src/commands.rs` (or `db.rs` where blockers are evaluated)

Current: a blocker is *unsatisfied* if its `status != 'done'`.
Change: a blocker is *unsatisfied* if its `status = 'active'` (i.e., both `done` and `deleted` are treated as non-blocking). Update `unsatisfied_blocker_names` accordingly.

#### 2.2.4 Add `status` to dependency DTOs

**File:** `src-tauri/src/models.rs`

The `DependencyDto` (or whatever struct represents blocker/dependent entries returned inside `TaskDto.blockers` / `TaskDto.dependents`) must include a `status: String` field so the frontend can render "(Completed)" / "(Deleted)" labels without a secondary fetch.

If blockers are currently returned as `{ id, title }`, extend to `{ id, title, status }`.

#### 2.2.5 Correct progress computation for `"deleted"` taskref subtasks

**File:** `src-tauri/src/commands.rs` (or `db.rs`)

Current: a taskref subtask counts as **complete** if `ref_task.status = 'done'`.
Change: only `status = 'done'` counts as complete. `status = 'deleted'` counts as **incomplete** (the subtask is not done; the referenced task was discarded). This affects the `progress` float in `TaskDto`.

---

### 2.3 Frontend Changes

#### 2.3.1 `task-service.ts`

**File:** `src/features/tasks/task-service.ts`

Add:
- `taskPermanentDelete(id: string): Promise<void>` — invokes `task_permanent_delete`.
- The existing `taskList` already accepts `statusFilter`; callers just need to pass `"archive"`.

#### 2.3.2 Archive tab state — `GridView.tsx`

**File:** `src/features/tasks/GridView.tsx`

Add an in-memory tab state: `"active" | "archive"` (default: `"active"`, resets on app reload).

Render a two-tab control above the grid:
- **Active** tab → fetches with `statusFilter: "active"` (current behaviour).
- **Archive** tab → fetches with `statusFilter: "archive"`.

The tab selection triggers a re-fetch (or separate hook call). Dependency highlighting (hover state) is only active on the Active tab; disable it on the Archive tab.

Archive tab: drag-and-drop is suppressed (the drag handle is not rendered on archive cards).

#### 2.3.3 Archive badge — `TaskCard.tsx`

**File:** `src/features/tasks/TaskCard.tsx`

When the card's `task.status` is `'done'` or `'deleted'`, render a status badge in the top-right corner of the card (inside the card's existing layout):
- `status = 'done'` → green badge, text "Completed".
- `status = 'deleted'` → grey badge, text "Deleted".

The drag handle is conditionally hidden when `task.status !== 'active'`.

Urgency border stripe and overdue text are already suppressed for non-active statuses (Feature 006). No additional change needed here.

#### 2.3.4 Context menu — `TaskCardContextMenu.tsx`

**File:** `src/features/tasks/TaskCardContextMenu.tsx`

The context menu items are determined by `task.status`:

| Status | Menu items |
|---|---|
| `active` | Move to Top, Move to Bottom, (existing Delete for soft-delete if present) |
| `done` or `deleted` | **Restore**, **Permanently Delete** |

"Permanently Delete" triggers the `ConfirmDialog` component before calling `taskPermanentDelete`.

#### 2.3.5 Task detail view — `TaskDetailView.tsx`

**File:** `src/features/tasks/TaskDetailView.tsx`

When `task.status` is `'done'` or `'deleted'` (i.e., the detail view is opened from the Archive tab):

- **Read-only mode**: `EditableTitle`, `MarkdownEditor`, `TagEditor`, `DueDatePicker` are rendered in a non-editable / display-only state (suppress click-to-edit interactions; pass a read-only flag or replace with static display elements).
- **StatusActions** is replaced by two buttons: **Restore** and **Permanently Delete**.
  - Restore: calls `taskUpdate(id, { status: "active" })` — reuses the existing `taskUpdate` command; no new command needed.
  - Permanently Delete: opens `ConfirmDialog`; on confirm, calls `taskPermanentDelete(id)`, then calls `onBack()` to return to the grid.
- SubtaskSection and DependencySection remain visible (read-only).

#### 2.3.6 New component: `ConfirmDialog.tsx`

**File:** `src/features/tasks/ConfirmDialog.tsx`

A modal dialog with:
- Props: `title: string`, `message: string`, `confirmLabel: string`, `onConfirm: () => void`, `onCancel: () => void`.
- Renders over the current view (fixed overlay).
- Two buttons: confirm (destructive red styling) and cancel.
- Used by both the context menu and the detail view for the permanent delete action.

#### 2.3.7 Dependency section — `DependencySection.tsx`

**File:** `src/features/tasks/DependencySection.tsx`

Blockers and dependents now include a `status` field. Update the rendering of each entry:
- `status = 'done'` → append `"(Completed)"` label (muted green).
- `status = 'deleted'` → append `"(Deleted)"` label (muted grey).
- `status = 'active'` → no label (current behaviour).

The "is blocked" badge on the card/detail view is already driven by the backend's `is_blocked` field (corrected in §2.2.3 to exclude deleted blockers).

#### 2.3.8 Subtask item — deleted taskref display

**File:** `src/features/tasks/SubtaskItem.tsx`

`SubtaskDto` already has `ref_task_status: Option<String>`. Update the taskref subtask display:
- `ref_task_status = "done"` → checked, normal display (existing behaviour).
- `ref_task_status = "deleted"` → unchecked, append `"(Deleted)"` label (muted grey); the checkbox is not interactive.
- Progress computation (wherever it lives — frontend `progress.ts` or derived from `TaskDto.progress`) must exclude `"deleted"` refs from the "complete" count. (If progress is computed server-side in `TaskDto.progress`, the fix is in §2.2.5.)

---

### 2.4 Logic / Algorithms

#### Priority rank on restore

A restored task retains its original `priority_rank` (fractional index string) — no recomputation needed. On `taskUpdate(id, { status: "active" })`, the backend updates `status` only; `priority_rank` is unchanged. Because fractional indexing is order-preserving, the task naturally reappears at its original sorted position among active tasks. No collision is possible (fractional index strings are unique).

#### Permanent delete — operation order

```
BEGIN TRANSACTION
  1. DELETE FROM subtasks WHERE ref_task_id = :id
  2. DELETE FROM tasks WHERE id = :id   ← CASCADE handles tags, own subtasks, deps
COMMIT
```

Both steps run in a single transaction to avoid partial cleanup on failure.

---

## 3. Impact and Risk Analysis

### System Dependencies

| Area | Impact |
|---|---|
| `task_list` | Adding "archive" filter changes the query path; existing callers unaffected (they pass `"active"` or omit). |
| `is_blocked` | Changing the unsatisfied-blocker logic from `!= 'done'` to `== 'active'` may affect existing tests. Deleted blockers were previously counted as blockers — this is a bug fix consistent with the spec. |
| Progress computation | Excluding `"deleted"` refs from progress is a behaviour change. Existing tests that use deleted refs as "complete" will need updating. |
| `task_permanent_delete` | New command; additive. No existing callers. |
| Cascade deletes | Dependency cleanup via DB CASCADE on hard-delete is automatic. The only manual step is cleaning `ref_task_id` subtasks (handled in step 1 of the permanent delete transaction). |

### Potential Risks & Mitigations

| Risk | Mitigation |
|---|---|
| FK violation on hard delete if `ref_task_id` subtasks are not cleaned first | Handled: step 1 of the transaction deletes those rows before the tasks DELETE. |
| User accidentally permanent-deletes a task | Mitigation: confirmation dialog required. Action is irreversible by design (spec §2.4). |
| Restoring a task whose `priority_rank` has been "orphaned" by extensive reordering | Fractional index is order-preserving; orphaned values still produce a valid sort position. No error possible. Edge case: if the rank collides exactly (extremely unlikely with fractional indexing), the task appears adjacent to its previous neighbours. No data corruption. |
| Active tasks' dep/subtask lists showing stale data after permanent delete | Mitigation: after `taskPermanentDelete`, the frontend should call `refresh()` on the active task's detail view if open, or the dep list is re-fetched on next open. Real-time cleanup is handled server-side (cascade + subtask pre-delete). |
| `DependencyDto` status field missing from existing API response | This is a required additive change to `models.rs`. Existing consumers of `TaskDto` are unaffected (they don't use the new field yet). |

---

## 4. Testing Strategy

### Rust (cargo test, in-memory SQLite)

- `task_permanent_delete_impl`:
  - Permanently deletes a `done` task — row removed from `tasks`.
  - Permanently deletes a `deleted` task — row removed.
  - Cleans up `ref_task_id` subtasks in other tasks before deleting.
  - Deps rows (both blocker and dependent) removed via CASCADE.
  - Returns error if task is `active` (guard check).
- `task_list_impl` with `statusFilter = "archive"`:
  - Returns only `done` and `deleted` tasks.
  - Results ordered by `updated_at DESC`.
- `is_blocked` with `deleted` blocker:
  - Task with a `deleted` blocker reports `is_blocked = false`.
  - `unsatisfied_blocker_names` excludes `deleted` blockers.
- Progress computation with `deleted` taskref:
  - A taskref subtask with `ref_task_status = "deleted"` does not count as complete.

### Frontend (Vitest + React Testing Library)

- `GridView.test.tsx`: tab renders; clicking Archive fetches archived tasks; clicking Active restores original fetch.
- `TaskCard.test.tsx` (archive mode): "Completed" badge for `done`; "Deleted" badge for `deleted`; no drag handle; no urgency border.
- `TaskCardContextMenu.test.tsx`: archive card shows "Restore" and "Permanently Delete"; active card does not show these.
- `ConfirmDialog.test.tsx`: renders title/message/buttons; onConfirm called on "Delete Forever"; onCancel called on "Cancel".
- `TaskDetailView.test.tsx` (archived task): read-only fields; Restore button triggers `taskUpdate`; Permanently Delete opens dialog then calls `taskPermanentDelete`.
- `DependencySection.test.tsx`: blocker with `status = "done"` shows "(Completed)" label; `status = "deleted"` shows "(Deleted)" label.
- `SubtaskItem.test.tsx`: taskref with `ref_task_status = "deleted"` is unchecked with "(Deleted)" marker; does not count toward progress.
