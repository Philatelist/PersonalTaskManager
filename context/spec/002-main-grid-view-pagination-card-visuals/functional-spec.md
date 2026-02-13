# Functional Specification: Main Grid View, Pagination & Card Visuals

- **Roadmap Item:** Grid-Based Task Overview (Phase 1)
- **Status:** Completed
- **Author:** AI-assisted

---

## 1. Overview and Rationale (The "Why")

The main grid view is the **primary screen** of the Personal Task Manager — the first thing the user sees when they open the app. It answers the question: *"What am I working on, and what matters most?"*

**Problem:** The target user (a polymath managing goals across many domains) needs to see all active work at a glance. Traditional task managers bury tasks in nested lists, folders, or boards that fragment the big picture. The user loses track of priorities because they can't see everything at once.

**Desired outcome:** Every active task is visible as a square card in a responsive grid. The user can instantly scan priorities (position = priority), spot overdue deadlines, and gauge progress — all without opening a single task. When the user has many tasks (>100), the grid paginates cleanly rather than becoming unusable.

**Success looks like:**
- The user opens the app and immediately sees all active tasks ranked by priority.
- Overdue deadlines jump out visually (red icon).
- Progress on complex tasks is visible at a glance (progress ring).
- The grid adapts gracefully from 1 task to 100+ tasks without manual configuration.

---

## 2. Functional Requirements (The "What")

### 2.1. Grid Layout

The main screen MUST display all active tasks as **square cards** arranged in a responsive grid.

**Layout rules:**
- The grid MUST fill 100% of the available viewport (below any app header/navigation).
- Cards MUST maintain a **square aspect ratio** at all times.
- The grid MUST be **adaptive and proportional**:
  - 1 task: the card fills the available space (capped at a reasonable maximum so it doesn't look absurd).
  - N tasks: cards are evenly distributed across rows and columns, shrinking proportionally as N grows.
- Cards MUST NOT shrink below a **minimum readable size of approximately 120px** per side.
- If displaying all tasks at the minimum size would exceed the viewport, **pagination** MUST be used instead of shrinking further (see 2.3).
- The grid MUST reflow responsively when the window is resized.

**Card ordering:**
- Cards MUST be ordered by **PriorityRank** (as defined in Feature 001).
- The first card (top-left) is the highest priority task.
- Cards flow left-to-right, top-to-bottom.

**Acceptance Criteria:**
- [x] Active tasks are displayed as square cards in a responsive grid filling the viewport.
- [x] Cards maintain a square aspect ratio regardless of window size.
- [x] With 1 task, the card occupies a large portion of the viewport (capped at a sensible maximum).
- [x] With N tasks, cards distribute evenly and shrink proportionally.
- [x] Cards never shrink below ~120px per side.
- [x] Cards are ordered by PriorityRank: highest priority at top-left, flowing left-to-right, top-to-bottom.
- [x] The grid reflows correctly when the window is resized.

### 2.2. Card Content

Each card MUST display exactly four elements:

1. **Priority number:** The card's 1-based position index in the sorted task list. The #1 card is the highest priority. This number is derived from the task's sort position (PriorityRank order), not stored separately. When tasks are reordered, numbers update automatically.

2. **Title:** The task title, displayed as a **single line**. If the title is too long to fit, it MUST be truncated with an ellipsis ("...").

3. **Due date (conditional):** If the task has a due date set, it MUST be displayed on the card as a short date string (e.g., "Feb 15" or "2025-02-15"). If the due date is **overdue** (strictly before today's date), a **red warning icon** MUST appear alongside the date text. If the task has no due date, this area is left blank or hidden.

4. **Progress indicator OR completion checkbox:**
   - If the task has **one or more subtasks**: display a **progress ring** (circular progress indicator) showing the ratio of completed subtasks to total subtasks (as defined in Feature 001's progress calculation).
   - If the task has **zero subtasks**: display a **completion checkbox**. Checking it sets the task status to `Done` (which removes it from the grid). Unchecking is not applicable since Done tasks are not shown in the grid.

**Acceptance Criteria:**
- [x] Each card shows the priority number (1-based position index).
- [x] Priority numbers update automatically when tasks are reordered.
- [x] Each card shows the task title on a single line, truncated with ellipsis if it overflows.
- [x] If a task has a due date, the date is displayed on the card.
- [x] If a task's due date is before today, a red warning icon appears next to the date.
- [x] If a task has no due date, no date or icon is shown.
- [x] Tasks with subtasks display a progress ring showing completed/total ratio.
- [x] Tasks without subtasks display a completion checkbox.
- [x] Checking the completion checkbox sets the task status to Done and the task disappears from the grid.

### 2.3. Pagination

When the number of active tasks exceeds what can be displayed at the minimum card size (~120px), the grid MUST paginate.

**Pagination rules:**
- The **maximum cards per page** is determined dynamically by how many ~120px square cards fit in the current viewport. The theoretical maximum is 100 cards per page (per global invariant).
- If all active tasks fit on one page, no pagination controls are shown.
- If tasks span multiple pages, a **simple pagination bar** MUST appear below the grid.

**Pagination controls:**
- A **"Previous"** button (disabled on the first page).
- A **"Next"** button (disabled on the last page).
- A **"Page X of Y"** text indicator showing the current page and total pages.

**Behavior:**
- Navigating to a different page replaces the grid content immediately (no animation required).
- The current page SHOULD be preserved during the session. If the user leaves and returns to the grid, starting on page 1 is acceptable.
- If a task is removed from the current page (e.g., marked Done), the grid SHOULD update in place. If the current page becomes empty, navigate to the previous page.

**Acceptance Criteria:**
- [x] The maximum cards per page is calculated dynamically based on viewport size and ~120px minimum card size, capped at 100.
- [x] If all active tasks fit on one page, no pagination controls appear.
- [x] If tasks span multiple pages, Previous/Next buttons and a "Page X of Y" indicator appear.
- [x] The Previous button is disabled on page 1; the Next button is disabled on the last page.
- [x] Page navigation replaces the grid content with the appropriate subset of tasks.
- [x] Removing a task from the grid (e.g., marking Done) updates the current page; if the page becomes empty, the user is moved to the previous page.

### 2.4. Card Interaction

- Clicking a card MUST navigate to (or open) the **task detail view** for that task.
  - Note: The detail view itself is defined in a separate specification. This spec only requires that clicking a card triggers navigation to it.
- The completion checkbox (on cards without subtasks) MUST be independently clickable without triggering the card click / detail view navigation.

**Acceptance Criteria:**
- [x] Clicking anywhere on a card (except the checkbox) opens the task detail view.
- [x] Clicking the completion checkbox toggles the task status without opening the detail view.

### 2.5. Empty State

If the user has zero active tasks, the grid MUST display a friendly **empty state** message (e.g., "No active tasks. Create one to get started!") instead of a blank screen.

**Acceptance Criteria:**
- [x] When there are zero active tasks, a clear empty-state message is shown instead of a blank grid.

---

## 3. Scope and Boundaries

### In-Scope

- Responsive square-card grid layout with adaptive sizing.
- Card content: priority number, 1-line title, due date with overdue icon, progress ring / completion checkbox.
- Pagination when tasks exceed viewport capacity (max 100 per page).
- Simple Previous/Next pagination controls with page indicator.
- Card click to open task detail view.
- Checkbox interaction on cards without subtasks.
- Empty state for zero active tasks.
- Grid reflow on window resize.

### Out-of-Scope

The following are separate roadmap items and will be addressed in their own specifications:

- **Drag-and-drop reorder** within the grid (separate topic for reorder algorithm and UX).
- **Task detail view** UI and content (Phase 2 — Expanded Task View).
- **Task dependencies** / blocks / blocked-by relationships (Phase 2 — Task Dependencies).
- **Filtering, sorting, and visual indicators** beyond what's defined here (Phase 2 — Priority & Status Management).
- **Graph view** of tasks.
- **AI-assisted chat** per task (Phase 3).
- **Application shell / navigation chrome** (separate spec).
- **Archive view** for Done/Deleted tasks.
- Card animations or transitions.
- Keyboard navigation within the grid.
