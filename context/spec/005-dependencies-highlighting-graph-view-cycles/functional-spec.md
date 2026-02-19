# Functional Specification: Dependencies + Highlighting + Graph View + Cycles

- **Roadmap Item:** Task Dependencies — Allow the user to link tasks to each other with "blocks" and "blocked-by" relationships, making it clear which tasks must be completed first.
- **Status:** Draft
- **Author:** AI-assisted

---

## 1. Overview and Rationale (The "Why")

### Problem

The user manages complex goals that involve multiple interconnected tasks. Without explicit dependency relationships, they must mentally track which tasks need to happen before others. This leads to:
- Starting work on tasks that are actually blocked by prerequisites
- Losing sight of which tasks are holding up downstream work
- No visual way to understand the structure and flow of related tasks

### Solution

Introduce a first-class **dependency** system that lets the user declare "Task A blocks Task B" (equivalently, "Task B is blocked by Task A"). Provide visual feedback on the grid (blocked indicators, hover highlighting) and a dedicated graph view to explore the full dependency+subtask network. Cycles are allowed but detected and warned about, with enforce-blocking disabled for tasks involved in cycles.

### Success Criteria

- The user can always see at a glance which tasks are blocked and why.
- The user can explore the full task relationship graph (dependencies and subtask references) in a visual graph view.
- Cyclic dependencies never silently corrupt the blocking logic — cycles are warned about and gracefully handled.

---

## 2. Functional Requirements (The "What")

### 2.1 Dependency Model

Dependencies are a **separate concept** from subtasks. A dependency is a directed relationship: "Task A **blocks** Task B" (equivalently, "Task B **is blocked by** Task A"). Dependencies live alongside but independently from the existing subtask/taskref mechanism.

- A task can have zero or more **blockers** (tasks it is blocked by).
- A task can have zero or more **dependents** (tasks it blocks).
- A dependency is between exactly two distinct tasks. A task MUST NOT depend on itself.
- Dependencies are a standalone relationship — they do not create subtasks.
- A task can simultaneously have a taskref subtask pointing to Task X AND a dependency on Task X. These are independent concepts.

**Blocking semantics:**
- A task MUST only be prevented from transitioning to "done" if it has at least one unsatisfied direct non-cyclic blocker.
- Other status transitions (e.g., active → deleted) are always allowed regardless of blockers.
- When the user attempts to mark a blocked task as "done", the system MUST show a notification explaining which blockers are unsatisfied and prevent the transition.

**Acceptance Criteria:**
- [ ] A dependency relationship can be created between any two distinct active tasks.
- [ ] A task cannot be made to depend on itself.
- [ ] Dependencies are stored independently from the subtask system.
- [ ] Deleting a task removes all dependencies involving that task.
- [ ] Completing a task (marking as "done") does NOT automatically remove its dependency relationships; it simply means the blocker is satisfied.
- [ ] A task with unsatisfied direct non-cyclic blockers MUST NOT be allowed to transition to "done".
- [ ] The system shows a notification listing unsatisfied blockers when the user attempts to mark a blocked task as done.
- [ ] Other status transitions (e.g., deletion) are allowed regardless of blocking state.

### 2.2 Managing Dependencies (Task Detail View)

Dependencies are managed from the **task detail view** in a dedicated "Dependencies" section, displayed below the Subtasks section and above the Status Actions.

**Adding a dependency:**
- The section displays two sub-lists: "Blocked by" (tasks that must complete before this one) and "Blocks" (tasks that are waiting on this one).
- A "Add blocker" button opens a search modal (similar to the existing TaskRefSearchModal) that lets the user search for and select another active task.
- When a task is selected, a "blocked by" dependency is created (the selected task blocks the current task).
- A "Add dependent" button works similarly but creates the reverse relationship (the current task blocks the selected task).
- If adding the dependency would create a cycle, the dependency is still created but a warning toast appears: "This creates a cycle — blocking will be disabled for these tasks."

**Viewing dependencies:**
- Each blocker is shown as a row with the blocking task's title, status, and a remove button (x).
- Each dependent is shown similarly.
- If a blocker is "done", it is shown with a checkmark or strikethrough to indicate it is satisfied.
- If a blocker or dependent has been deleted, it is shown as "Deleted task" (grayed out) and the dependency can be removed.

**Removing a dependency:**
- Clicking the remove button (x) on a blocker or dependent removes the dependency relationship immediately.

**Acceptance Criteria:**
- [ ] The task detail view shows a "Dependencies" section with "Blocked by" and "Blocks" sub-lists.
- [ ] "Add blocker" opens a search modal to select a task; selecting creates a "blocked by" relationship.
- [ ] "Add dependent" opens a search modal; selecting creates a "blocks" relationship.
- [ ] Self-dependencies are rejected (the current task is excluded from the search modal).
- [ ] Each dependency row shows the related task's title and status.
- [ ] Clicking remove (x) on a dependency removes it immediately.
- [ ] Completed blockers are visually distinguished (e.g., checkmark, strikethrough).
- [ ] Dependencies involving deleted tasks show "Deleted task" in grayed-out text.
- [ ] Creating a dependency that introduces a cycle shows a warning toast but still creates the dependency.

### 2.3 Blocked and Cyclic Indicators on Grid Cards

Grid cards display visual indicators for two distinct states: **blocked** and **cyclic**. These are separate, independent visual states.

**Blocked logic:**
- A task shows the "Blocked" badge if it has at least one unsatisfied **direct** blocker whose status is NOT "done" AND that blocker is NOT part of a cycle with the current task.
- Cyclic blockers are never counted toward the blocked state. A task whose only unfinished blockers are in a cycle with it is NOT considered blocked.
- If a task has a mix of cyclic and non-cyclic unfinished blockers, it IS still blocked (by the non-cyclic ones only).
- Cyclic tasks are NOT automatically considered blocked.

**Blocked visual indicator:**
- A small "Blocked" badge or lock icon appears on the grid card (e.g., bottom-right corner).
- Hovering over the badge shows a tooltip: "Blocked by: Task A, Task B" listing the unsatisfied direct non-cyclic blockers.

**Cyclic indicator:**
- A task that participates in a strongly connected component (SCC) of size > 1 or a self-loop in the dependency graph displays a separate "Cyclic" warning indicator on its grid card.
- The "Cyclic" indicator is visually distinct from the "Blocked" badge (e.g., a warning triangle or different color/label).
- A task can show both "Blocked" (by external non-cyclic tasks) AND "Cyclic" simultaneously.

**Acceptance Criteria:**
- [ ] A task with at least one unsatisfied direct non-cyclic blocker shows a "Blocked" badge on its grid card.
- [ ] A task whose only unfinished blockers are in a cycle with it does NOT show the "Blocked" badge.
- [ ] The "Blocked" badge tooltip lists the names of the unsatisfied direct non-cyclic blockers.
- [ ] When all non-cyclic blockers are completed (status = "done"), the "Blocked" badge disappears.
- [ ] Tasks with no dependencies never show the "Blocked" badge.
- [ ] A task in a strongly connected component (size > 1 or self-loop) shows a "Cyclic" warning indicator.
- [ ] The "Cyclic" indicator is visually distinct from the "Blocked" badge.
- [ ] A task can display both "Blocked" and "Cyclic" indicators simultaneously (blocked by external non-cyclic tasks while also participating in a cycle).
- [ ] When a dependency is removed that dissolves the cycle, the "Cyclic" indicator disappears from the affected tasks.

### 2.4 Hover Highlighting on Grid

When the user hovers over a task card on the grid, its **direct** (1-hop) dependency relationships are visually highlighted. No transitive highlighting is performed.

**Behavior:**
- Tasks that **directly block** the hovered task (its direct blockers, 1-hop) are highlighted with a distinct border color (e.g., red/orange).
- Tasks that **are directly blocked by** the hovered task (its direct dependents, 1-hop) are highlighted with a different border color (e.g., blue/green).
- Only direct relationships are highlighted — no transitive/indirect dependencies are shown.
- All other tasks dim slightly (reduced opacity) to create contrast.
- The hovered task itself retains its normal appearance.
- When the mouse leaves the card, all highlighting is removed and cards return to normal.

**Acceptance Criteria:**
- [ ] Hovering over a task card highlights its direct blockers (1-hop) with a distinct visual style.
- [ ] Hovering over a task card highlights its direct dependents (1-hop) with a different distinct visual style.
- [ ] Transitive/indirect dependencies are NOT highlighted (only 1-hop).
- [ ] Non-related tasks dim slightly during hover.
- [ ] Moving the mouse away from the card removes all highlighting immediately.
- [ ] Tasks with no dependencies show no highlighting effect on hover (other cards still dim).

### 2.5 Graph View

A graph view provides a visual representation of the task dependency and subtask reference network.

**Access:**
- A "Graph View" button is displayed in the grid toolbar/header area.
- Clicking it opens a full-screen overlay showing the graph.
- A "Close" button (or Escape key) returns to the grid.

**Graph content:**
- Each active task is rendered as a node showing its title and status.
- Dependency edges ("blocks") are drawn as directed arrows from the blocking task to the dependent task.
- TaskRef subtask edges are drawn as directed arrows (visually distinct from dependency edges, e.g., dashed line) from the parent task to the referenced task.
- A toggle control at the top of the graph lets the user switch between:
  - **"Dependencies only"**: shows only dependency edges.
  - **"Dependencies + Subtask refs"**: shows both dependency edges and taskref subtask edges.

**Cycle visualization:**
- Edges that are part of a detected cycle are highlighted with a distinct color (e.g., orange/red) and/or a visual indicator (e.g., dashed + colored).
- A small warning label or icon appears near cyclic edges or nodes: "Cycle detected".

**Interaction:**
- Nodes can be dragged to rearrange the layout for readability.
- Clicking a node opens the task detail view for that task (closing the graph view).
- The graph auto-layouts on open (e.g., top-to-bottom or left-to-right directed layout).

**Acceptance Criteria:**
- [ ] A "Graph View" button is visible in the grid header/toolbar.
- [ ] Clicking the button opens a full-screen overlay with the graph.
- [ ] Escape or a close button returns to the grid.
- [ ] Each active task appears as a node with title and status.
- [ ] Dependency edges are drawn as directed arrows (blocker → dependent).
- [ ] TaskRef subtask edges are drawn as visually distinct directed arrows (parent → referenced task).
- [ ] A toggle switches between "Dependencies only" and "Dependencies + Subtask refs" modes.
- [ ] Cyclic edges are visually highlighted (distinct color or style).
- [ ] Nodes can be dragged to rearrange the layout.
- [ ] Clicking a node navigates to the task detail view.
- [ ] The graph auto-layouts on open.

### 2.6 Cycle Detection and Handling

Cycles in the dependency graph are allowed but detected and handled gracefully using strongly connected component (SCC) analysis.

**Detection:**
- When a new dependency is created, the system checks whether it introduces a cycle in the dependency graph.
- Cycle detection uses **strongly connected component (SCC)** analysis: a set of tasks forms a cycle if every task in the set can reach every other task in the set via dependency edges. A self-loop (Task A blocks Task A, if somehow created) also counts.
- Only dependency edges are considered for cycle detection (not taskref subtask edges).

**Warning:**
- If a new dependency creates a cycle (introduces an SCC of size > 1), a warning toast is shown: "This creates a cycle — blocking will be disabled for these tasks."
- The dependency is still created.

**Cyclic set behavior:**
- All tasks in a detected SCC (size > 1 or self-loop) MUST:
  - Display the "Cyclic" warning indicator on their grid card (see section 2.3).
  - NOT enforce blocking against each other — cyclic blockers are ignored for blocking purposes.
  - Still be blockable by **external** non-cyclic tasks (tasks outside the SCC).
- A task that is part of a cycle and ALSO has non-cyclic unfinished blockers shows BOTH the "Cyclic" indicator and the "Blocked" badge.

**Enforce-blocking:**
- Tasks within the same SCC do NOT block each other from transitioning to "done".
- Tasks blocked by external (non-cyclic) blockers are still prevented from transitioning to "done" per section 2.1.

**Cycle resolution:**
- When the user removes a dependency that was part of a cycle, the SCC is re-evaluated. If the SCC dissolves (tasks no longer form a cycle), the "Cyclic" indicator disappears and normal blocking logic resumes for those tasks.

**Acceptance Criteria:**
- [ ] Creating a dependency that forms a cycle (SCC of size > 1) shows a warning toast.
- [ ] The dependency is created despite the cycle warning.
- [ ] All tasks in a cyclic SCC display the "Cyclic" warning indicator.
- [ ] Tasks in the same SCC do NOT enforce blocking against each other.
- [ ] Tasks in a cycle MAY still be blocked by external non-cyclic tasks.
- [ ] Tasks with both cyclic and non-cyclic blockers show both "Cyclic" and "Blocked" indicators.
- [ ] Removing a dependency that dissolves the SCC removes the "Cyclic" indicator and re-enables blocking.
- [ ] Cycle detection considers only dependency edges, not taskref subtask edges.

---

## 3. Scope and Boundaries

### In-Scope

- Dependency data model (separate from subtasks): create, read, delete dependency relationships.
- Task detail view: "Dependencies" section with "Blocked by" and "Blocks" sub-lists, add/remove UI.
- Grid card: blocked badge/icon for tasks with unsatisfied non-cyclic blockers.
- Grid hover: highlight blockers and dependents with visual distinction; dim unrelated cards.
- Graph view: full-screen overlay, task nodes, dependency edges, taskref edges, toggle between views, cycle highlighting, drag-to-rearrange, click-to-navigate.
- Cycle detection: at dependency creation time, with user warning.
- Cycle handling: enforce-blocking disabled for cyclic sets.

### Out-of-Scope

- **AI-assisted thinking partner** (separate Phase 3 roadmap item).
- **Priority & Status Management / Filtering / Sorting** (separate roadmap item).
- **Application Shell & Navigation** (separate roadmap item).
- **Local-First Storage Engine** (already implemented as part of the existing stack).
- **Subtask creation/editing** (already implemented in Feature 004).
- Editing dependencies from the graph view (read-only graph for this version; editing is done via task detail view).
- Multi-level transitive blocking (only direct blockers are considered for the blocked badge — no "A blocks B blocks C means C is indirectly blocked by A" logic).
- Automatic status changes when all blockers are satisfied (the user must manually change task status).
- Styling or theming beyond the required dependency states.
