# Tasks: Archive — Completed vs Deleted + Restore + Permanent Delete

- **Feature:** 007-archive-completed-deleted-restore-permanent-delete
- **Functional Spec:** `functional-spec.md`
- **Technical Spec:** `technical-considerations.md`
- **Status:** Pending

---

## Slice 1: Rust Backend Foundation

> **Goal:** Extend the Rust backend with archive query support, fix `is_blocked` to treat `"deleted"` as non-blocking, add `status` to dependency DTOs, and fix progress computation for `"deleted"` taskref subtasks. No UI changes yet — the app stays fully runnable. All behaviour changes are covered by Rust tests.
>
> **Acceptance Criteria:** Tech §2.2.2, §2.2.3, §2.2.4, §2.2.5

- [x] Modify `task_list_impl` in `src-tauri/src/commands.rs`: when `status_filter = "archive"`, query `WHERE status IN ('done', 'deleted') ORDER BY updated_at DESC`. All other filter values continue to work as before. **[Agent: general-purpose]**
- [x] Fix `is_blocked` logic in `src-tauri/src/commands.rs` (or `db.rs`): a blocker is *unsatisfied* only if `status = 'active'`. Both `'done'` and `'deleted'` blockers are treated as non-blocking. Update `unsatisfied_blocker_names` accordingly. **[Agent: general-purpose]**
- [x] Add `status: String` field to the dependency DTO struct in `src-tauri/src/models.rs` (the struct used for `blockers` / `dependents` entries inside `TaskDto`). Populate it from the SQL query that joins `task_dependencies` with `tasks`. **[Agent: general-purpose]**
- [x] Fix progress computation: a taskref subtask counts as complete only if `ref_task.status = 'done'`; `'deleted'` counts as incomplete. **[Agent: general-purpose]**
- [x] Add Rust tests in `src-tauri/src/commands.rs` (using `test_db()` helper): **[Agent: general-purpose]**
  - `task_list` with `status_filter = "archive"` returns only `done` and `deleted` tasks, ordered by `updated_at DESC`.
  - `task_list` with `status_filter = "active"` still returns only active tasks (regression).
  - Task with a `deleted` blocker: `is_blocked = false`, `unsatisfied_blocker_names` is empty.
  - Task with an `active` blocker: `is_blocked = true` (regression).
  - Task with a `done` blocker: `is_blocked = false` (regression).
  - Progress for a task with a `deleted` taskref subtask: the deleted ref counts as incomplete.
  - Progress for a task with a `done` taskref subtask: the done ref counts as complete (regression).
  - Dependency DTO includes `status` field with the correct value for `active`, `done`, and `deleted` blockers.
- [x] **Verify:** Run `/Users/alex/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml` — all tests pass (new + existing). **[Agent: general-purpose]**

---

## Slice 2: `task_permanent_delete` Rust Command + Service Function

> **Goal:** Implement the hard-delete backend command using the `*_impl` pattern. Wire it into the Tauri app handler. Add the matching service function in `task-service.ts`. The archive tab does not exist yet, but the command is callable and tested.
>
> **Acceptance Criteria:** Tech §2.2.1, §2.3.1; Functional §2.4

- [x] Implement `task_permanent_delete_impl(conn, id)` in `src-tauri/src/commands.rs`: **[Agent: general-purpose]**
  - Guard: return error if `status NOT IN ('done', 'deleted')`.
  - Step 1: `DELETE FROM subtasks WHERE ref_task_id = ?` (cleans taskref refs in other tasks).
  - Step 2: `DELETE FROM tasks WHERE id = ?` (CASCADE handles tags, own subtasks, dep rows).
  - Both steps run in a single transaction.
- [x] Add `#[tauri::command] task_permanent_delete(...)` wrapper and register it in `src-tauri/src/main.rs` (`.invoke_handler`). **[Agent: general-purpose]**
- [x] Add Rust tests for `task_permanent_delete_impl`: **[Agent: general-purpose]**
  - Permanently deletes a `done` task — row removed from `tasks`.
  - Permanently deletes a `deleted` task — row removed.
  - Cleans up taskref subtasks in other tasks pointing to the deleted task.
  - Dep rows (both blocker and dependent directions) removed via CASCADE.
  - Returns an error when called on an `active` task (guard check).
- [x] Add `taskPermanentDelete(id: string): Promise<void>` to `src/features/tasks/task-service.ts` — invokes `task_permanent_delete`. **[Agent: general-purpose]**
- [x] **Verify:** Run `/Users/alex/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml` — all tests pass. **[Agent: general-purpose]**
- [x] **Verify:** Run `npx vitest run` — full frontend suite passes (no regressions from service addition). **[Agent: general-purpose]**

---

## Slice 3: Archive Tab + Card Visuals

> **Goal:** Add the Active / Archive tab toggle to `GridView`. Wire the Archive tab to fetch tasks with `statusFilter: "archive"`. Render Completed/Deleted badges on archive cards. Suppress the drag handle on archive cards. Disable dependency highlighting on the archive tab.
>
> **Acceptance Criteria:** Functional §2.1, §2.2, §2.6

- [x] Add in-memory `activeTab: "active" | "archive"` state (default `"active"`) to `src/features/tasks/GridView.tsx`. Render a two-tab control ("Active" / "Archive") above the grid. **[Agent: general-purpose]**
- [x] When `activeTab = "archive"`, fetch tasks with `statusFilter: "archive"`. When `activeTab = "active"`, fetch as before (`statusFilter: "active"`). Dependency highlighting (hover state) is disabled on the archive tab. **[Agent: general-purpose]**
- [x] Modify `src/features/tasks/TaskCard.tsx`: when `task.status` is `'done'` or `'deleted'`, render a status badge in the top-right area of the card: **[Agent: general-purpose]**
  - `'done'` → green badge, text "Completed", `data-testid="badge-completed"`.
  - `'deleted'` → grey badge, text "Deleted", `data-testid="badge-deleted"`.
  - Drag handle (`data-drag-handle`) is hidden when `task.status !== 'active'`.
- [x] Add `.badgeCompleted` and `.badgeDeleted` CSS classes to `src/features/tasks/TaskCard.module.css` (green and grey pill styles). **[Agent: general-purpose]**
- [ ] Add/update tests in `src/features/tasks/GridView.test.tsx`: **[Agent: general-purpose]**
  - Tab control renders with "Active" and "Archive" labels.
  - Clicking "Archive" tab calls `taskList` with `statusFilter: "archive"`.
  - Clicking "Active" tab calls `taskList` with `statusFilter: "active"`.
  - Default tab on render is "Active".
- [ ] Add/update tests in `src/features/tasks/TaskCard.test.tsx`: **[Agent: general-purpose]**
  - Card with `status = "done"` renders "Completed" badge; no "Deleted" badge.
  - Card with `status = "deleted"` renders "Deleted" badge; no "Completed" badge.
  - Card with `status = "active"` renders neither badge.
  - Card with `status = "done"` or `"deleted"` has no drag handle element.
  - Card with `status = "active"` still has a drag handle (regression).
- [ ] **Verify:** Run `npx vitest run` — all tests pass. **[Agent: general-purpose]**

---

## Slice 4: ConfirmDialog + Restore + Permanently Delete (Context Menu and Detail View)

> **Goal:** Implement the `ConfirmDialog` modal component. Update the context menu to show Restore and Permanently Delete for archived cards. Update `TaskDetailView` to show read-only mode and Restore + Permanently Delete actions when the task is archived. All entry points for restore and permanent delete are covered in this slice.
>
> **Acceptance Criteria:** Functional §2.3, §2.4, §2.6 (detail view read-only)

- [ ] Create `src/features/tasks/ConfirmDialog.tsx`: a modal overlay with props `title`, `message`, `confirmLabel`, `onConfirm`, `onCancel`. Confirm button uses destructive (red) styling. `data-testid="confirm-dialog"`, `data-testid="confirm-btn"`, `data-testid="cancel-btn"`. **[Agent: general-purpose]**
- [ ] Create `src/features/tasks/ConfirmDialog.module.css` with overlay, dialog box, and button styles. **[Agent: general-purpose]**
- [ ] Modify `src/features/tasks/TaskCardContextMenu.tsx`: when `task.status` is `'done'` or `'deleted'`, show "Restore" and "Permanently Delete" options instead of the active-mode items. **[Agent: general-purpose]**
  - "Restore" calls `taskUpdate(id, { status: "active" })` then triggers a grid refresh.
  - "Permanently Delete" opens `ConfirmDialog`; on confirm, calls `taskPermanentDelete(id)` then triggers a grid refresh.
- [ ] Modify `src/features/tasks/TaskDetailView.tsx`: detect archived state (`task.status === 'done' || task.status === 'deleted'`): **[Agent: general-purpose]**
  - Pass `readOnly={true}` (or equivalent) to `EditableTitle`, `MarkdownEditor`, `TagEditor`, `DueDatePicker` so they suppress edit interactions.
  - Replace `StatusActions` with two buttons: "Restore" (`data-testid="restore-btn"`) and "Permanently Delete" (`data-testid="perm-delete-btn"`).
  - "Restore": calls `taskUpdate(id, { status: "active" })`, then calls `onBack()`.
  - "Permanently Delete": opens `ConfirmDialog`; on confirm, calls `taskPermanentDelete(id)`, then calls `onBack()`.
- [ ] Create `src/features/tasks/ConfirmDialog.test.tsx`: **[Agent: general-purpose]**
  - Renders with correct title and message.
  - Clicking "Cancel" calls `onCancel`; does not call `onConfirm`.
  - Clicking the confirm button calls `onConfirm`; does not call `onCancel`.
- [ ] Add/update tests in `src/features/tasks/TaskCardContextMenu.test.tsx`: **[Agent: general-purpose]**
  - Archive card context menu shows "Restore" and "Permanently Delete".
  - Active card context menu does not show "Restore" or "Permanently Delete".
  - Clicking "Restore" calls `taskUpdate` with `status: "active"`.
  - Clicking "Permanently Delete" shows the `ConfirmDialog`.
- [ ] Add/update tests in `src/features/tasks/TaskDetailView.test.tsx` (archived task): **[Agent: general-purpose]**
  - "Restore" button is rendered for a `done` task; clicking it calls `taskUpdate` with `status: "active"` and then `onBack`.
  - "Restore" button is rendered for a `deleted` task.
  - "Permanently Delete" button is rendered; clicking it opens `ConfirmDialog`; confirming calls `taskPermanentDelete` then `onBack`.
  - "Permanently Delete" is NOT rendered for an `active` task.
  - `EditableTitle` is in read-only mode for archived tasks (clicking does not open an edit input).
- [ ] **Verify:** Run `npx vitest run` — all tests pass. **[Agent: general-purpose]**

---

## Slice 5: Archived Task Labels in Dependencies and Subtasks

> **Goal:** Show "(Completed)" / "(Deleted)" labels on archived entries in the dependency panel. Show "(Deleted)" marker on deleted taskref subtasks in `SubtaskItem`. Both changes rely on data already available in the DTO (`DependencyDto.status` from Slice 1, `SubtaskDto.ref_task_status` already present).
>
> **Acceptance Criteria:** Functional §2.5

- [ ] Modify `src/features/tasks/DependencySection.tsx`: for each blocker/dependent entry, read its `status` field and append a label: `'done'` → "(Completed)" (muted green, `data-testid="dep-label-completed"`); `'deleted'` → "(Deleted)" (muted grey, `data-testid="dep-label-deleted"`); `'active'` → no label. **[Agent: general-purpose]**
- [ ] Modify `src/features/tasks/SubtaskItem.tsx`: when `ref_task_status = "deleted"`, render the taskref subtask as unchecked with a `"(Deleted)"` marker (`data-testid="ref-deleted-label"`); the checkbox is non-interactive. When `ref_task_status = "done"`, render as checked (existing behaviour). **[Agent: general-purpose]**
- [ ] Add/update tests in `src/features/tasks/DependencySection.test.tsx`: **[Agent: general-purpose]**
  - Blocker with `status = "done"` shows "(Completed)" label; no "(Deleted)" label.
  - Blocker with `status = "deleted"` shows "(Deleted)" label; no "(Completed)" label.
  - Blocker with `status = "active"` shows no label (regression).
- [ ] Add/update tests in `src/features/tasks/SubtaskItem.test.tsx`: **[Agent: general-purpose]**
  - Taskref subtask with `ref_task_status = "deleted"` is unchecked and shows "(Deleted)" marker.
  - Taskref subtask with `ref_task_status = "deleted"` checkbox is not interactive (click does not fire onChange).
  - Taskref subtask with `ref_task_status = "done"` is checked (regression).
  - Taskref subtask with `ref_task_status = "active"` is unchecked, no "(Deleted)" marker (regression).
- [ ] **Verify:** Run `npx vitest run` — all tests pass. **[Agent: general-purpose]**

---

## Slice 6: Full Regression Verification

> **Goal:** Confirm the complete frontend and Rust test suites pass end-to-end with all feature 007 changes in place. No new code changes in this slice — verification only.
>
> **Acceptance Criteria:** All prior slices integrated; no regressions

- [ ] **Verify:** Run `npx vitest run` — full frontend test suite passes (all test files). **[Agent: general-purpose]**
- [ ] **Verify:** Run `/Users/alex/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml` — all Rust tests pass. **[Agent: general-purpose]**

---

## Recommendations

| Task/Slice | Issue | Recommendation |
|---|---|---|
| All slices | Assigned to `general-purpose` — no Rust or React specialist agent available | Acceptable: changes are straightforward Rust (SQLite + Tauri command pattern) and React (existing patterns). No specialist agent required. |
| Verification | No browser MCP available for visual UI testing | Tests use Vitest + React Testing Library (DOM assertions). Manual visual check recommended after Slice 3 (tab UI + badges) and Slice 4 (ConfirmDialog) to verify visual styling in the Tauri webview. |
