# Functional Specification: Archive — Completed vs Deleted + Restore + Permanent Delete

- **Roadmap Item:** Archive: Completed vs Deleted + Restore + Permanent Delete
- **Status:** Draft
- **Author:** AWOS

---

## 1. Overview and Rationale (The "Why")

### 1.1. Problem

Active tasks that are Done or Deleted currently remain accessible in the main grid, which clutters the user's view and obscures what still needs attention. The user needs a clear, low-friction way to move finished and discarded tasks out of the way — while retaining the ability to revisit them, recover them if needed, or erase them permanently.

### 1.2. Purpose

This feature introduces an **Archive tab** on the main grid that separates completed and deleted tasks from active ones. The archive makes two distinct outcomes visible — work that was **finished** versus work that was **abandoned** — without permanently destroying any data unless the user explicitly chooses to.

### 1.3. Success Criteria

- The user can always identify which archived tasks were finished versus discarded at a glance.
- Restoring a task brings it back exactly where the user left it in priority order.
- Permanently deleting from the archive is a deliberate, confirmed action.
- Active tasks that referenced an archived task continue to function without errors.

---

## 2. Functional Requirements (The "What")

---

### §2.1 — Archive Tab on the Main Grid

The main grid view MUST have two tabs: **Active** and **Archive**.

- The **Active** tab (default) shows all tasks with status `active`, including blocked and cyclic tasks — exactly as today.
- The **Archive** tab shows all tasks with status `done` or `deleted`.
- Both tabs share the same page layout (grid of cards, same visual structure) but archive cards are non-draggable (priority reordering does not apply to archived tasks).
- The archive tab MUST NOT be paginated in a way that limits access; if there are more than 100 archived tasks, it paginates consistently with the active grid.

**Acceptance Criteria:**

- [ ] Given the user is on the main grid, a tab control with "Active" and "Archive" is visible.
- [ ] Clicking "Active" shows only tasks with status `active`.
- [ ] Clicking "Archive" shows tasks with status `done` or `deleted`.
- [ ] The active tab is selected by default on app load.
- [ ] A task moved to Done or Deleted disappears from the Active tab and appears in the Archive tab immediately (without requiring a page reload).

---

### §2.2 — Visual Distinction: Completed vs Deleted in the Archive

The archive MUST clearly distinguish **Completed** (Done) tasks from **Deleted** tasks so the user can tell at a glance why each task is archived.

- Done tasks are displayed with a **green "Completed" badge** in the card.
- Deleted tasks are displayed with a **grey "Deleted" badge** in the card.
- Both badge types appear in the top-right corner of the card.
- No other urgency indicators (border stripe, overdue text) are shown on archived cards, consistent with the `done`/`deleted` suppression in Feature 006.

**Acceptance Criteria:**

- [ ] A card with status `done` shows a green "Completed" badge and no "Deleted" badge.
- [ ] A card with status `deleted` shows a grey "Deleted" badge and no "Completed" badge.
- [ ] No urgency border or overdue text is shown on any archived card.

---

### §2.3 — Restoring a Task from the Archive

The user MUST be able to restore any archived task (Done or Deleted) back to active status.

- The restore action is available from:
  1. A **"Restore" button** in the task's context menu on the archive card.
  2. A **"Restore" button** inside the task detail view when the task is archived.
- Restoring a task sets its status back to `active`.
- The task is re-inserted into the active priority list **at its original priority rank**. If that rank is occupied, existing tasks shift down by one position to accommodate it.
- After restore, the task appears in the Active tab and disappears from the Archive tab.
- No confirmation dialog is required for restore (it is reversible by archiving again).

**Acceptance Criteria:**

- [ ] Given the user is on the Archive tab, a context menu on each card includes a "Restore" option.
- [ ] Clicking "Restore" sets the task status to `active` and moves it to the Active tab.
- [ ] The restored task appears at its original priority rank in the active grid, with other tasks adjusted if necessary.
- [ ] A restored task that was previously `deleted` returns to `active` (not to `deleted`) — both Done and Deleted tasks restore to `active`.
- [ ] After restoring, the Archive tab no longer shows that task.

---

### §2.4 — Permanent Delete from the Archive

The user MUST be able to permanently and irreversibly delete a task, but **only from the Archive** — not from the Active tab.

- Permanent delete is available from:
  1. A **"Permanently Delete" option** in the task's context menu on the archive card.
  2. A **"Permanently Delete" button** inside the task detail view when the task is archived.
- Clicking "Permanently Delete" MUST show a **confirmation dialog** before proceeding, as this action is irreversible.
  - Dialog text: *"Permanently delete '[Task Title]'? This cannot be undone."*
  - Two buttons: **"Delete Forever"** (destructive) and **"Cancel"**.
- On confirmation, the task record is permanently removed from the database.
- The task disappears from the Archive tab immediately.
- Any taskRef subtask entries or dependency links in other tasks that referenced the permanently deleted task are **silently removed** (the reference is cleaned up automatically; the user does not need to manually fix anything).

**Acceptance Criteria:**

- [ ] The Active tab context menu does NOT offer a "Permanently Delete" option — only the Archive tab does.
- [ ] Clicking "Permanently Delete" on an archived card triggers a confirmation dialog with the task's title and "Delete Forever" / "Cancel" buttons.
- [ ] Clicking "Cancel" closes the dialog and takes no action.
- [ ] Clicking "Delete Forever" removes the task from the database and from the Archive tab.
- [ ] After permanent deletion, no other task shows a broken reference or error related to the deleted task — its taskRef subtask entries and dependency links are silently removed from any referencing task.
- [ ] Permanent delete is not available from any active task (the option is absent from the context menu and detail view for active tasks).

---

### §2.5 — Archived Tasks in Dependencies and taskRef Subtasks

When a task is archived (Done or Deleted), other tasks that depend on it or reference it as a subtask continue to show that reference — but MUST indicate its archived state clearly.

#### Dependencies panel (blocked-by / blocking)
- If task A is blocked by task B, and task B is archived (Done or Deleted), task A's detail view MUST still show task B in its "Blocked By" list.
- Task B's entry in the list MUST be labelled with its archived status:
  - Done: *"Task B Title (Completed)"*
  - Deleted: *"Task B Title (Deleted)"*
- A **Done** dependency counts as **satisfied** (it no longer blocks task A, consistent with the existing behaviour where `done` status satisfies a dependency).
- A **Deleted** dependency is treated as **removed/no longer relevant**: it does NOT block task A. The entry remains visible so the user is aware, but it does not contribute to `isBlocked`.

#### taskRef subtasks
- If a subtask in task A is a taskRef pointing to task B, and task B is archived:
  - Done: the subtask shows as **checked** (complete), consistent with existing behaviour.
  - Deleted: the subtask entry MUST be visually marked as *"(Deleted)"* and treated as **incomplete** (unchecked) — it does not count toward progress as if it were done, since the work was discarded rather than completed.

**Acceptance Criteria:**

- [ ] A task blocked by a `done` dependency shows that dependency as satisfied (non-blocking); the entry is visible with a "Completed" label.
- [ ] A task blocked by a `deleted` dependency shows that dependency as present but non-blocking; the entry is visible with a "Deleted" label.
- [ ] A taskRef subtask pointing to a `done` task shows as checked/complete.
- [ ] A taskRef subtask pointing to a `deleted` task shows as unchecked with a "(Deleted)" marker — it does not count as complete for progress calculation.
- [ ] When a permanently deleted task's references are cleaned up, the referencing task's deps/subtask list no longer shows any entry for it.

---

### §2.6 — Archiving Behaviour (How Tasks Enter the Archive)

This section clarifies how tasks move to the archive, to ensure consistency with existing features.

- A task enters the archive (status = `done`) when the user marks it as complete via the checkbox on the active card or the status control in the detail view — **existing behaviour**.
- A task enters the archive (status = `deleted`) when the user selects "Delete" from the active task's context menu or the detail view — **existing behaviour** (soft-delete).
- The archive is **not** a manual drag target; the user cannot drag a card from Active to Archive.
- An archived task's title, notes, subtasks, and all metadata remain intact and viewable in the task detail view from within the archive.

**Acceptance Criteria:**

- [ ] Marking a task as done from the active grid immediately moves it to the Archive tab under the "Completed" category.
- [ ] Deleting an active task (soft-delete) immediately moves it to the Archive tab under the "Deleted" category.
- [ ] Clicking an archived card opens the task detail view in read-only context (the user can view notes, subtasks, and deps) with Restore and Permanently Delete actions available.

---

## 3. Scope and Boundaries

### In-Scope

- Archive tab on the main grid (Active / Archive tabs).
- Visual distinction between Completed and Deleted tasks in the archive.
- Restore action (from archive to active, at original priority rank).
- Permanent delete (from archive only, with confirmation dialog).
- Cascade cleanup of taskRef and dependency references on permanent delete.
- Visual labelling of archived tasks in other tasks' deps and taskRef subtask lists.
- Archived task detail view (read-only with Restore + Permanently Delete actions).

### Out-of-Scope

- Search and filtering of archived tasks (separate feature).
- AI integration.
- Bulk restore or bulk permanent delete.
- Export or reporting of archived tasks.
- Undo of permanent delete (it is explicitly irreversible).
- Any cloud sync or multi-device access.
