# Functional Specification: Task Details View + Notes (Markdown)

- **Roadmap Item:** Task Detail View (Phase 2) — Expanded Task View + Subtasks
- **Status:** Draft
- **Author:** AI-assisted

---

## 1. Overview and Rationale (The "Why")

The grid gives the user a big-picture view of all active tasks — but each card shows only a title, priority number, due date, and progress indicator. There is currently **no way to open a task and work with its full context**. The user cannot read or edit the task description, manage subtasks, adjust tags, or change due dates. The grid is the front door, but the rooms behind it are empty.

**Problem:** Without a detail view, the user must keep all task context in their head or in an external tool. They can see *what* their tasks are, but not *why* they matter, *how* they break down into steps, or *what notes* they've captured. The product's promise — "a calm, focused space to see all their goals clearly and think deeply about how to accomplish them" — is unfulfilled if the user can only see task titles.

**Desired outcome:** The user clicks any task card in the grid and enters a full-page detail view showing the task's complete context: an editable title, a rich-text notes area with Markdown support, a list of subtasks they can add/check off/reorder/delete, tags they can manage, a due date they can set or clear, and status controls to mark the task done or reactivate it. All changes autosave immediately. A back button returns to the grid with the same page and scroll position preserved.

**Success looks like:**
- The user clicks a card titled "Research paper outline" and immediately sees their notes, subtask checklist, tags, and due date — all in one place.
- They type notes in Markdown, toggle to rendered view to review formatting, and switch back to continue editing — no save button needed.
- They add three subtask checklist items, check off the first one, and return to the grid where the card now shows 33% progress.
- They mark the task Done from the detail view and are returned to the grid where the card is no longer visible among active tasks.

---

## 2. Functional Requirements (The "What")

### 2.1. Navigation and Layout

The detail view MUST replace the grid entirely when a task is opened. It is a full-page view, not a side panel.

**Opening the detail view:**
- Clicking a task card's title or body area (not the drag handle or checkbox) in the grid MUST navigate to the detail view for that task.
- The detail view MUST reuse already-loaded task data from the grid when possible to avoid redundant fetches. If the task is not present in memory (e.g., future deep link / direct navigation), it MUST fetch by ID.
- If the task is deleted or not found, the user MUST be redirected back to the grid with a non-blocking toast notification ("Task not found").

**Returning to the grid:**
- A **back button** (or navigation element) MUST be displayed at the top of the detail view.
- Clicking the back button MUST return the user to the grid view.
- The grid MUST return to the same page the user was on before opening the detail view.
- The grid MUST restore the scroll position in addition to the page number.

**Layout structure:**
- The detail view MUST display a single task's full context in a vertically scrollable layout.
- From top to bottom, the view MUST contain: back button, task title, metadata area (status, due date, tags, priority number, timestamps), notes/description editor, and subtasks section.

**Acceptance Criteria:**
- [ ] Clicking a task card in the grid opens the full-page detail view for that task.
- [ ] The detail view reuses already-loaded task data when available and fetches by ID only when necessary.
- [ ] If the task is not found or deleted, the user is redirected to the grid with a "Task not found" toast.
- [ ] The detail view displays all task fields: title, description, subtasks, tags, due date, status, priority number, timestamps.
- [ ] A back button is visible at the top of the detail view.
- [ ] Clicking the back button returns to the grid view on the same page and scroll position the user was viewing.
- [ ] The detail view is vertically scrollable when content exceeds the viewport.

### 2.2. Task Title Editing

The task title MUST be displayed as a large heading and be editable inline.

**Display mode:** The title MUST appear as a prominent heading at the top of the detail view (below the back button).

**Edit mode:** Clicking the title heading MUST transform it into an editable text input field, pre-populated with the current title. The input MUST auto-focus and select all text for easy replacement.

**Saving:** The title MUST autosave when the user clicks away (blur) or presses Enter. If the user clears the title entirely (empty string), the update MUST be rejected — the title MUST revert to its previous value. The title field MUST NOT accept an empty string.

**Cancellation:** Pressing Escape while editing the title MUST cancel the edit and revert to the previous value without saving.

**Acceptance Criteria:**
- [ ] The title is displayed as a large heading.
- [ ] Clicking the title transforms it into an editable text input.
- [ ] The input auto-focuses and selects all text on activation.
- [ ] Changes autosave on blur or Enter.
- [ ] An empty title is rejected and reverts to the previous value.
- [ ] Pressing Escape cancels the edit without saving.

### 2.3. Notes/Description Editor (Markdown)

The task description MUST support Markdown formatting with an inline toggle between edit mode and rendered view.

**Rendered view (default):** When the detail view opens, the description MUST be displayed as rendered Markdown. If there is no description, a placeholder text (e.g., "Click to add notes...") MUST be shown. Clicking the rendered content or the placeholder MUST switch to edit mode.

**Edit mode:** A plain-text editor MUST appear showing the raw Markdown source. The editor MUST be a multi-line text area that grows to fit its content (no fixed height with internal scrolling unless content is very long). The editor MUST auto-focus when activated.

**Formatting toolbar:** A toolbar MUST appear above the editor in edit mode with buttons for:
- Bold (wraps selection in `**`)
- Italic (wraps selection in `*`)
- Heading (inserts `# ` at line start or cycles through `#`, `##`, `###`)
- Bullet list (inserts `- ` at line start)
- Numbered list (inserts `1. ` at line start)
- Code (wraps selection in backticks `` ` `` for inline, or triple backticks ` ``` ` for blocks if selection spans multiple lines)
- Link (wraps selection in `[text](url)` format, prompting for URL if needed)

Each toolbar button MUST insert the appropriate Markdown syntax at the cursor position or around the current selection. If there is no selection, the button MUST insert a placeholder (e.g., `**bold text**`) with the placeholder text selected for easy replacement.

**Supported Markdown features (rendering):** The rendered view MUST support: headings (`#` through `###`), bold (`**`), italic (`*`), unordered lists (`-`), ordered lists (`1.`), links (`[text](url)`), inline code (`` ` ``), and fenced code blocks (` ``` `).

**Markdown security:** Markdown rendering MUST sanitize HTML. Raw HTML input MUST NOT be rendered. Links MUST open with `rel="noopener noreferrer"` and `target="_blank"`.

**Switching back to rendered view:** Clicking outside the editor area (or pressing Escape) MUST exit edit mode and display the updated rendered Markdown. The content MUST autosave on exit from edit mode.

**Autosave during editing:** While in edit mode, the description MUST autosave periodically after the user pauses typing (debounce of approximately 1 second). This ensures no data loss if the app is closed while editing. The debounce MUST be cancel-safe on unmount (no state updates after navigation).

**Unsaved edit protection:** If the user navigates back while actively editing and a debounce save is pending, the system MUST flush the pending save before unmount — ensuring no typed content is lost.

**Performance:** The notes editor MUST handle at least 10,000 characters without noticeable typing lag.

**Acceptance Criteria:**
- [ ] The description is rendered as formatted Markdown by default.
- [ ] An empty description shows a clickable placeholder ("Click to add notes...").
- [ ] Clicking the rendered description or placeholder enters edit mode.
- [ ] Edit mode shows the raw Markdown source in a multi-line text area.
- [ ] A formatting toolbar with Bold, Italic, Heading, Bullet List, Numbered List, Code, and Link buttons is displayed in edit mode.
- [ ] Each toolbar button inserts the correct Markdown syntax at the cursor position or around the selection.
- [ ] Clicking outside the editor or pressing Escape exits edit mode and renders the updated Markdown.
- [ ] The description autosaves with a debounce (~1 second) while the user types.
- [ ] The debounce is cancel-safe on unmount (no stale state updates).
- [ ] Pending saves are flushed before navigation (no data loss on back button).
- [ ] Supported Markdown: headings, bold, italic, unordered lists, ordered lists, links, inline code, fenced code blocks.
- [ ] Raw HTML in Markdown input is sanitized and not rendered.
- [ ] Links open with `rel="noopener noreferrer"` and `target="_blank"`.
- [ ] The editor handles at least 10,000 characters without noticeable typing lag.

### 2.4. Subtask Management

The detail view MUST display a subtask list with full create, read, update, delete, and reorder capabilities.

**Subtask display:** All subtasks MUST be displayed in a vertical list below the notes section, ordered by their sort order. Each subtask MUST show:
- A **checkbox** indicating completion state (checked = done, unchecked = not done).
- The subtask **label** (for checklist type) or the **referenced task's title** (for taskref type).
- For taskref subtasks: a visual indicator of the referenced task's status (e.g., a small status badge). A taskref subtask is automatically "done" when the referenced task's status is "done".
- If a referenced task has been soft-deleted, the taskref subtask MUST display as "Deleted task" (grayed out) and remain non-toggleable.
- A **delete button** (e.g., an X icon) visible on hover or always visible.

**Adding a checklist subtask:** An "Add subtask" input MUST be displayed at the bottom of the subtask list. The user types a label and presses Enter to add a new checklist subtask. The input MUST clear after adding. The new subtask MUST appear at the bottom of the list. The task card's progress in the grid MUST update after returning.

**Adding a taskref subtask:** A "Link task" button MUST be available that opens a search/select interface for existing tasks. The interface MUST provide a search input that filters active tasks by title, with a dropdown of matching results. The user selects a task from the results to create the taskref subtask.

**Taskref integrity rules:**
- A task MUST NOT be allowed to reference itself as a taskref subtask.
- A taskref MUST NOT create a direct circular reference (if task A has a taskref to task B, task B MUST NOT be allowed to add a taskref back to task A).
- If either rule is violated, the system MUST reject the addition and show a non-blocking error notification.

**Toggling completion:** Clicking a checklist subtask's checkbox MUST toggle its `isDone` state and persist immediately. For taskref subtasks, the checkbox MUST reflect the referenced task's status and MUST NOT be directly toggleable — it updates when the referenced task's status changes.

**Deleting a subtask:** Clicking the delete button on a subtask MUST remove it immediately and persist the deletion. No confirmation dialog is needed (the action is low-stakes and the subtask data is minimal).

**Reordering subtasks:** The user MUST be able to drag subtasks to reorder them within the list. A drag handle (similar to the grid card handles) MUST be provided on each subtask. The reordered list MUST persist via the `subtask_reorder` backend command. Subtask drag-reorder MUST remain smooth with at least 100 subtasks.

**Empty state:** If there are no subtasks, the area MUST show the "Add subtask" input with no list above it.

**Acceptance Criteria:**
- [ ] All subtasks are displayed in a vertical list ordered by sort order.
- [ ] Each checklist subtask shows a checkbox and its label.
- [ ] Each taskref subtask shows the referenced task's title and status indicator.
- [ ] Taskref subtasks for soft-deleted referenced tasks display as "Deleted task" and are non-toggleable.
- [ ] Taskref subtask checkbox reflects referenced task status and is not directly toggleable.
- [ ] An "Add subtask" input allows creating new checklist subtasks by typing and pressing Enter.
- [ ] New subtasks appear at the bottom of the list.
- [ ] A "Link task" mechanism allows adding taskref subtasks by searching and selecting existing tasks.
- [ ] A task cannot reference itself as a taskref subtask.
- [ ] Direct circular taskref references are rejected with a notification.
- [ ] Clicking a checklist subtask's checkbox toggles its completion state and persists immediately.
- [ ] A delete button on each subtask removes it immediately with no confirmation.
- [ ] Subtasks can be dragged to reorder within the list.
- [ ] Reordering persists via the backend.
- [ ] Subtask drag-reorder remains smooth with at least 100 subtasks.
- [ ] An empty subtask list shows only the "Add subtask" input.

### 2.5. Tags Management

Tags MUST be displayed as visual chips/badges with inline editing capabilities.

**Display:** Each tag MUST appear as a small chip/badge element. Tags MUST be displayed in alphabetical order.

**Adding a tag:** A text input (or a "+" button that reveals an input) MUST be provided. The user types a tag name and presses Enter to add it. Duplicate tags MUST be silently ignored (the backend already deduplicates). The input MUST clear after adding. The new tag MUST appear among the existing chips in alphabetical order.

**Removing a tag:** Each tag chip MUST include a remove icon (e.g., "x"). Clicking it MUST remove the tag immediately and persist the change.

**Autosave:** Tag additions and removals MUST persist immediately (no debounce needed — each action is a discrete operation).

**Acceptance Criteria:**
- [ ] Tags are displayed as chips/badges in alphabetical order.
- [ ] A text input allows adding new tags by typing and pressing Enter.
- [ ] Duplicate tags are silently ignored.
- [ ] Each tag chip has a remove icon that deletes the tag immediately.
- [ ] Tag changes persist immediately.

### 2.6. Due Date Management

The due date MUST be viewable and editable via a click-to-edit pattern with a date picker.

**Display:** If a due date is set, it MUST be displayed as a formatted date string (e.g., "Feb 15, 2025"). If the due date is in the past (overdue), it MUST be visually highlighted (e.g., red text or an overdue indicator). If no due date is set, placeholder text (e.g., "No due date") MUST be shown.

**Editing:** Clicking the due date or placeholder MUST open a native date picker (HTML `<input type="date">`). Selecting a date MUST update the due date and persist immediately.

**Clearing:** A clear/remove button MUST be available to remove the due date entirely. Clearing the due date MUST persist immediately.

**Acceptance Criteria:**
- [ ] A set due date is displayed as a formatted date string.
- [ ] Overdue dates are visually highlighted.
- [ ] No due date shows placeholder text.
- [ ] Clicking the due date or placeholder opens a date picker.
- [ ] Selecting a date persists immediately.
- [ ] A clear button removes the due date and persists immediately.

### 2.7. Status Management

The detail view MUST include controls to change the task's status.

**Status display:** The current status (Active, Done) MUST be visually indicated (e.g., a badge or label).

**Status actions:**
- For an **Active** task: A "Mark as Done" button MUST be available. Clicking it MUST change the status to "done", persist immediately, and navigate back to the grid. The grid MUST preserve the previously selected page, even though the task disappears from the active view.
- For a **Done** task (if the detail view is accessed for a done task): A "Reactivate" button MUST be available. Clicking it MUST change the status back to "active", persist immediately, and return the user to the grid page where the task now belongs based on its priority.
- A **"Delete"** action MUST be available (e.g., in a secondary/danger area). Clicking it MUST show a confirmation prompt ("Are you sure you want to delete this task?"). On confirmation, the task MUST be soft-deleted (status = "deleted"), persisted, and the user navigated back to the grid.

**Acceptance Criteria:**
- [ ] The current status is visually displayed.
- [ ] An active task has a "Mark as Done" button that changes status to "done" and returns to the grid.
- [ ] The grid preserves the previously selected page after marking a task done.
- [ ] A done task has a "Reactivate" button that changes status to "active" and navigates to the correct grid page.
- [ ] A "Delete" action with confirmation prompt soft-deletes the task and returns to the grid.
- [ ] All status changes persist immediately.

### 2.8. Priority Number Display

The task's global priority number MUST be displayed in the detail view (read-only).

**Display:** The priority number (e.g., "#3") MUST be shown in the metadata area. It is derived from the task's position in the global active-task list and is not editable from the detail view (reordering is done from the grid).

**Acceptance Criteria:**
- [ ] The task's global priority number is displayed.
- [ ] The priority number is read-only in the detail view.

### 2.9. Timestamps Display

The task's creation and last-updated timestamps MUST be displayed.

**Display:** Both `createdAt` and `updatedAt` MUST be shown in a secondary/metadata area, formatted as human-readable dates (e.g., "Created: Jan 5, 2025 · Updated: Feb 10, 2025"). These are read-only.

**Timestamp semantics:** `updatedAt` MUST change on any persisted field change, including subtask and tag modifications.

**Acceptance Criteria:**
- [ ] Created and updated timestamps are displayed in human-readable format.
- [ ] Timestamps are read-only.
- [ ] `updatedAt` reflects the most recent persisted change across all fields, subtasks, and tags.

### 2.10. Optimistic UI and Error Handling

All autosave operations (title, notes, tags, due date, status, subtasks) SHOULD use optimistic UI updates — the UI reflects the change immediately, then persists to the backend.

**Error recovery:** If a backend call fails, the UI MUST revert to the last persisted state and show a non-blocking error notification (e.g., a toast message). The user MUST NOT be left with a UI that shows unpersisted data without indication.

**Acceptance Criteria:**
- [ ] All save operations use optimistic UI updates.
- [ ] On backend failure, the UI reverts to the last persisted state.
- [ ] A non-blocking error notification is shown on save failure.

### 2.11. Accessibility

All interactive controls in the detail view MUST be accessible via keyboard.

**Requirements:**
- All interactive controls (toolbar buttons, delete icons, status buttons, tag remove icons, subtask drag handles, back button) MUST be keyboard-focusable.
- Escape MUST consistently close context menus and exit edit modes (title editing, notes editing).
- Form inputs MUST have associated labels or aria-labels.

**Acceptance Criteria:**
- [ ] All interactive controls are keyboard-focusable.
- [ ] Escape consistently exits edit modes and closes menus.
- [ ] Form inputs have associated labels or aria-labels.

---

## 3. Scope and Boundaries

### In-Scope

- Full-page task detail view replacing the grid when a task is selected.
- Back button navigation returning to the grid (preserving page and scroll position).
- Inline-editable task title with autosave.
- Markdown notes/description editor with toggle between rendered and edit views.
- Formatting toolbar for common Markdown syntax (bold, italic, heading, lists, code, link).
- Markdown rendering with HTML sanitization and safe link handling.
- Subtask list with full CRUD: add checklist items, add taskref subtasks (with task search), toggle completion, delete, drag-to-reorder.
- Taskref integrity: self-reference prevention, direct circular reference prevention, deleted-task display.
- Tags displayed as chips with add/remove functionality.
- Due date display and editing via date picker, with clear option.
- Status management: mark as done (with grid page preservation), reactivate (with correct page navigation), delete with confirmation.
- Global priority number display (read-only).
- Timestamps display (created, updated) with correct semantics.
- Optimistic UI with error recovery and non-blocking notifications.
- Autosave for all editable fields (debounced for text, immediate for discrete actions).
- Flush pending saves on navigation (no data loss).
- Keyboard accessibility for all controls.
- Performance: 10,000+ character notes without lag, 100+ subtasks with smooth reorder.

### Out-of-Scope

The following are separate roadmap items and will be addressed in their own specifications:

- **Task Dependencies** (blocks / blocked-by relationships) — Phase 2 roadmap item.
- **AI Chat Per Task** — Phase 3 roadmap item.
- **Thinking Partner Mode** — Phase 3 roadmap item.
- **Conversation History** — Phase 3 roadmap item.
- **Priority & Status Management (filtering/sorting on grid)** — separate Phase 2 roadmap item.
- **Application Shell & Navigation** — separate roadmap item.
- **Graph view** of tasks.
- **Advanced Markdown features** beyond the supported set (tables, images, footnotes, etc.).
- **Subtask nesting** (subtasks of subtasks).
- **Batch subtask operations** (multi-select, bulk delete).
- **Task duplication / cloning**.
- **Undo/redo for edits** within the detail view.
- **Keyboard shortcuts** within the detail view (beyond standard text editing and Escape).
- **Touch/mobile gestures**.
