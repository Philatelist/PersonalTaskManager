# Functional Specification: Core Task Model, Subtasks & Progress

- **Roadmap Item:** Task Management Core (Phase 1) + Subtasks (Phase 2)
- **Status:** Draft
- **Author:** Poe (AI-assisted)

---

## 1. Overview and Rationale (The "Why")

The Personal Task Manager's fundamental unit is the **task** — a concrete goal or problem the user wants to work on. Unlike traditional task managers that reduce everything to shallow checklists, this product treats each task as a meaningful object with rich context.

**Problem:** Existing tools fail the polymath user in three ways: (1) tasks are too shallow to capture the complexity of real goals, (2) there's no way to break a goal into steps while keeping the big picture visible, and (3) progress across multi-step goals is invisible or requires manual tracking.

**Desired outcome:** The user has a clear, structured model for every goal — from a simple one-off task (completed with a single checkbox) to a complex multi-step effort (with subtasks driving a visible progress indicator). The task model is the foundation upon which all other features (grid view, detail view, AI chat, dependencies) are built.

**Success looks like:**
- Every task the user creates captures enough context to be meaningful (title, description, tags, priority rank, status, optional due date).
- Complex goals can be decomposed into subtasks — including references to other tasks — and progress is calculated automatically.
- The user always knows how far along a task is at a glance.

---

## 2. Functional Requirements (The "What")

### 2.1. Task Fields

A task consists of the following fields:

- **Title** (required): A short, descriptive name for the task.
- **Description** (optional): A Markdown-formatted text field. Rendered as rich text in the detail view (supports bold, lists, links, code blocks, etc.).
- **PriorityRank** (required): A deterministic ordering value used for drag-and-drop positioning within the grid. Each task has a unique rank that defines its visual position relative to other tasks. No abstract "High/Medium/Low" labels — the order itself is the priority.
- **Status** (required, default: Active): One of: `Active` | `Done` | `Deleted`.
  - `Active`: The task is live and visible in the main grid.
  - `Done`: The task is complete. Visible in an archive/completed view.
  - `Deleted`: The task has been removed. Visible in an archive/deleted view. Not shown in the main grid.
- **Tags** (optional): Zero or more free-form text tags (e.g., "engineering", "health", "research"). The user types any tag they want; there is no predefined list. Multiple tags per task are supported.
- **Due Date** (optional): A target date for task completion. No time component — date only.
- **Created At** (automatic): Timestamp set when the task is created.
- **Updated At** (automatic): Timestamp updated whenever any task field changes.

**Acceptance Criteria:**
- [ ] A task can be created with only a title; all other fields use defaults or are optional.
- [ ] The description field supports Markdown and renders formatted text in the detail view.
- [ ] PriorityRank provides a unique, deterministic ordering for all tasks. Reordering via drag-and-drop updates the rank values.
- [ ] Status is one of: Active, Done, or Deleted.
- [ ] Transitioning to Done or Deleted removes the task from the main grid view. Done tasks appear in a completed archive view; Deleted tasks appear in a deleted archive view.
- [ ] Tags are free-form strings. The user can add multiple tags to a single task and remove them individually.
- [ ] Due date is optional and stores a date without a time component.
- [ ] Created At is set automatically on creation and never changes.
- [ ] Updated At is set automatically on every modification.

### 2.2. Subtasks

A task may contain zero or more **subtasks**. Subtasks are one level deep only (no nesting of subtasks within subtasks). There are two types:

**Checklist subtask:**
- A text label with a checkbox (done / not done).
- The user can add, edit, reorder, and delete checklist subtasks.
- The user can toggle the checkbox to mark it complete or incomplete.

**TaskRef subtask:**
- A reference to another existing task in the system.
- Displays the referenced task's **title and current status** (e.g., "Build API layer — Active").
- A taskRef subtask is considered **completed automatically** when the referenced task's status is `Done`.
- A taskRef subtask is considered **incomplete** when the referenced task's status is `Active`.
- If the referenced task's status is `Deleted`, the subtask displays **"Referenced task deleted"** and is treated as **incomplete**. The user can manually remove or replace the broken reference.
- The displayed title and status update automatically when the referenced task changes.

**Acceptance Criteria:**
- [ ] A task can have zero or more subtasks.
- [ ] Subtasks are one level deep only — a subtask cannot have its own subtasks.
- [ ] Checklist subtasks can be created, edited (text label), reordered, deleted, and toggled (done/not done).
- [ ] TaskRef subtasks can be created by selecting an existing task from the system.
- [ ] A taskRef subtask displays the referenced task's title and current status.
- [ ] A taskRef subtask's completion state is derived automatically from the referenced task's status (Done = complete, anything else = incomplete).
- [ ] If a referenced task is Deleted, the taskRef subtask displays "Referenced task deleted" and is treated as incomplete. No auto-removal occurs.
- [ ] The user can manually remove or replace a broken taskRef subtask.
- [ ] Subtasks of both types can be freely intermixed within a single task.

### 2.3. Progress Calculation & Display

Progress provides at-a-glance visibility into how far along a task is.

**Tasks WITH subtasks:**
- Progress is calculated as: `completed subtasks / total subtasks`.
- Displayed as a progress indicator (e.g., progress ring or bar) on the task card.
- Both checklist and taskRef subtasks count equally in the calculation.

**Tasks WITHOUT subtasks:**
- No progress indicator is shown.
- Instead, a **task-level completion checkbox** is displayed on the card.
- Checking the checkbox sets the task status to `Done`.
- Unchecking the checkbox sets the task status back to `Active`.

**Acceptance Criteria:**
- [ ] For tasks with subtasks, progress equals (completed subtasks / total subtasks), displayed as a visual indicator on the task card.
- [ ] Both checklist subtasks (manually toggled) and taskRef subtasks (auto-completed when referenced task is Done) contribute to the progress calculation.
- [ ] For tasks with zero subtasks, a single completion checkbox is displayed on the card instead of a progress indicator.
- [ ] Checking the completion checkbox sets the task status to Done.
- [ ] Unchecking the completion checkbox sets the task status to Active (not to any "previous" status).
- [ ] When subtasks are added to a task that previously had none, the completion checkbox is replaced by the progress indicator.
- [ ] When all subtasks are removed from a task, the progress indicator is replaced by the completion checkbox.

---

## 3. Scope and Boundaries

### In-Scope

- The complete task data model (all fields listed above).
- Subtask model (checklist and taskRef types).
- Progress calculation logic.
- Task creation, editing, and deletion.
- Status transitions (Active, Done, Deleted).
- Display rules for progress (with subtasks) vs. completion checkbox (without subtasks).
- PriorityRank ordering for drag-and-drop positioning.

### Out-of-Scope

The following are separate roadmap items and will be addressed in their own specifications:

- Grid-based card layout and visual design (Phase 1 — Grid-Based Task Overview).
- Task detail view UI (Phase 2 — Expanded Task View).
- Task dependencies / blocks / blocked-by relationships (Phase 2 — Task Dependencies).
- Filtering, sorting, and visual indicators (Phase 2 — Priority & Status Management).
- AI-assisted chat per task (Phase 3).
- Application shell, navigation, and local storage engine (Phase 1 — Local Data & App Shell).
- Storage implementation details (covered by architecture/tech spec).
