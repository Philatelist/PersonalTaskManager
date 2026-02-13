# Functional Specification: Priority Reordering (Drag & Drop) + Deterministic Renumbering

- **Roadmap Item:** Priority & Status Management (Phase 2) — Reordering subset
- **Status:** Completed
- **Author:** AI-assisted

---

## 1. Overview and Rationale (The "Why")

The main grid displays active tasks as square cards ordered by priority rank — but the user currently has **no way to change that order**. The priority of every task is frozen at creation time. This defeats the core promise of the product: *"the user can always tell at a glance what matters most and what to work on next."*

**Problem:** Priorities change constantly. A research task that was #5 yesterday might become #1 today because of a deadline shift. Without reordering, the user must mentally track their "real" priorities separately from what the grid shows. The grid becomes misleading rather than helpful, and the user stops trusting it.

**Desired outcome:** The user can grab any task card and drag it to a new position in the grid. The moment they drop it, all priority numbers update instantly to reflect the new order. For large jumps (e.g., moving task #47 to #1), shortcuts like "Move to Top" and "Move to Bottom" are available. Keyboard users can reorder with Alt+Arrow keys. The ordering persists reliably — even after hundreds of reorderings — thanks to deterministic renumbering that keeps rank values clean and compact.

**Success looks like:**
- The user drags a card from position #5 to position #2 and immediately sees all cards renumber: the former #2 becomes #3, #3 becomes #4, #4 becomes #5, and the moved card is now #2.
- The user right-clicks a card on page 3 and selects "Move to Top." The card becomes #1 and the grid navigates to page 1 to show it.
- After hundreds of reorderings over weeks of use, the system never slows down or produces ordering glitches — renumbering keeps the underlying rank values short and deterministic.

---

## 2. Functional Requirements (The "What")

### 2.0. Global Ordering Invariant

All reordering operations — drag-and-drop, keyboard, and context menu — MUST modify the **global active-task priority order**. This is a single, linear list of all active tasks sorted by priority rank.

The grid layout (rows and columns) is purely a **visual projection** of this linear list. The number of columns, card positions within a row, and pagination boundaries MUST NOT affect reorder logic. Reordering always means changing a task's position in the underlying linear sequence.

Filters and pagination do not create independent priority scopes. A task moved from position #5 to position #2 on page 1 has been moved from the 5th to the 2nd position in the global list, regardless of how many columns the grid currently displays.

### 2.1. Drag-and-Drop Reordering

The user MUST be able to reorder task cards within the grid by dragging and dropping.

**Drag initiation:**
- Each card MUST display a **drag handle icon** (e.g., a grip/dots icon). Only dragging from this handle initiates a reorder operation.
- Clicking or dragging anywhere else on the card MUST NOT start a drag. Normal card click behavior (opening the task detail view) and checkbox behavior MUST remain unaffected.

**Drag interaction:**
- When the user begins dragging from the handle, the dragged card MUST become a **semi-transparent "ghost"** that follows the cursor.
- A **drop indicator** (e.g., a highlighted gap or insertion line between cards) MUST appear to show the user where the card will land if dropped at the current position.
- As the cursor moves over the grid, the drop indicator MUST update in real time to track the cursor position.
- The drop indicator MUST be visible between any two adjacent cards, before the first card, or after the last card on the current page.

**Drop behavior:**
- When the user drops the card, it MUST be inserted at the indicated position in the **global priority order**.
- Dropping at the first visible position on the current page inserts the task immediately after the last task on the previous page (or at position #1 if on page 1).
- Dropping at the last visible position on the current page inserts the task immediately before the next task in the global order (i.e., the first task on the next page), or at the very end if on the last page.
- All priority numbers (#1, #2, #3, ...) on all visible cards MUST update **immediately** after the drop to reflect the new ordering.
- The reorder MUST be persisted — closing and reopening the app shows the new order.

**Drag within the current page only:**
- The visual drag-and-drop interaction operates within the current page of the grid. The user CANNOT drag a card across page boundaries visually.
- However, the resulting reorder is always applied to the global active-task list. For explicit cross-page moves, see section 2.3 (Context Menu Shortcuts).

**Cancellation:**
- Pressing **Escape** during a drag MUST cancel the operation and return the card to its original position with no changes.
- Dropping the card back in its original position MUST result in no change (no unnecessary persistence writes).

**Concurrent change safety:**
- If the underlying task list changes during a drag operation — due to task deletion, status change, filter change, or pagination recalculation — the drag MUST be **safely cancelled** and no reorder persisted. The grid MUST refresh to reflect the current state.

**Acceptance Criteria:**
- [x] Each card displays a drag handle icon.
- [x] Dragging from the handle initiates a drag operation; dragging from other areas of the card does not.
- [x] During a drag, the card appears as a semi-transparent ghost following the cursor.
- [x] A drop indicator shows the insertion point as the user drags over the grid.
- [x] Dropping the card at a new position reorders it in the global priority list and persists the change.
- [x] Dropping at the last visible position on a page correctly inserts before the next task in the global order.
- [x] All visible priority numbers update immediately after the drop.
- [x] Pressing Escape during a drag cancels the operation with no side effects.
- [x] Dropping a card in its original position causes no change.
- [x] Drag-and-drop is visually limited to the current page (no cross-page dragging).
- [x] If the task list changes during a drag (deletion, status change, filter change, pagination recalculation), the drag is safely cancelled and no reorder is persisted.

### 2.2. Keyboard Reordering

The user MUST be able to reorder tasks using the keyboard as an alternative to drag-and-drop.

**Keyboard interaction:**
- The user selects/focuses a card in the grid (selection mechanism defined by grid navigation — e.g., Tab, arrow keys to focus a card).
- Pressing **Alt+Arrow Up** MUST move the focused card **one position earlier in the global sorted active-task list**. This means it swaps with the task immediately before it in priority, regardless of the visual grid layout (rows and columns are irrelevant to reorder logic).
- Pressing **Alt+Arrow Down** MUST move the focused card **one position later in the global sorted active-task list**. This means it swaps with the task immediately after it in priority.
- If the card is already at position #1 (highest priority globally), Alt+Arrow Up MUST have no effect.
- If the card is already at the last position globally, Alt+Arrow Down MUST have no effect.
- Each keyboard move MUST persist the change and update all visible priority numbers immediately, identical to a drag-and-drop reorder.

**Focus preservation:**
- After a successful keyboard reorder, focus MUST remain on the moved card in its new visual position. The user MUST be able to press Alt+Arrow Up/Down repeatedly to continue moving the same card without re-selecting it.

**Page boundary behavior:**
- Keyboard reordering operates on the global priority list. Within the current page, the card moves visually. If a keyboard move would place the card beyond the current page boundaries, the behavior is the same as within the page (the global order is updated), but the card may shift off-screen — the grid SHOULD navigate to keep the moved card visible.

**Acceptance Criteria:**
- [x] A card in the grid can be focused/selected via keyboard.
- [x] Alt+Arrow Up moves the focused card one position earlier in the global priority list.
- [x] Alt+Arrow Down moves the focused card one position later in the global priority list.
- [x] Alt+Arrow Up at global position #1 has no effect.
- [x] Alt+Arrow Down at the last global position has no effect.
- [x] Each keyboard move persists the change and updates all visible priority numbers immediately.
- [x] After a keyboard reorder, focus remains on the moved card in its new position.
- [x] The user can press Alt+Arrow Up/Down repeatedly to continue moving the same card.

### 2.3. Context Menu Shortcuts (Cross-Page Moves)

For moving tasks across page boundaries or making large priority jumps, the user MUST have access to shortcut actions via a context menu.

**Context menu trigger:**
- Right-clicking a card (or long-pressing on touch devices, if applicable) MUST open a context menu.

**Menu items:**
- **"Move to Top"**: Moves the task to priority #1 (the very first position in the global active-task list). After the move, the grid MUST navigate to page 1 so the user can see the card in its new position.
- **"Move to Bottom"**: Moves the task to the last priority position (after all other active tasks in the global list). After the move, the grid MUST navigate to the last page so the user can see the card in its new position.

**Behavior after move:**
- Priority numbers across all pages MUST update to reflect the new ordering (the user sees correct numbers on whichever page they navigate to).
- The move MUST be persisted immediately.

**Acceptance Criteria:**
- [x] Right-clicking a card opens a context menu with "Move to Top" and "Move to Bottom" options.
- [x] "Move to Top" moves the task to priority #1 in the global list and navigates the grid to page 1.
- [x] "Move to Bottom" moves the task to the last priority position in the global list and navigates the grid to the last page.
- [x] Priority numbers update correctly across all pages after a cross-page move.
- [x] Cross-page moves are persisted immediately.

### 2.4. Deterministic Renumbering

The underlying priority ranking system MUST remain reliable and performant regardless of how many reorderings the user performs over time.

**Invariant:** Priority ranking uses an internal ordering value (not visible to the user). After many insertions between adjacent positions, these internal values can grow long. When any value exceeds the threshold of 20 characters during a reorder operation, the system MUST automatically **renumber all active tasks within the same transaction as the reorder** — reassigning short, evenly-spaced ordering values while preserving the exact current order.

**Transactional guarantee:** The reorder and the renumbering (when triggered) MUST occur atomically. If the reorder triggers renumbering, both the new position and the compacted rank values MUST be committed together. There MUST be no observable state where the reorder is committed but renumbering is not, or vice versa.

**User-visible behavior:**
- Renumbering is **invisible to the user**. The user MUST NOT see any visual glitch, flicker, reflow, or change in card positions when renumbering occurs.
- Renumbering MUST NOT change the order of any tasks. It only compacts the internal values.
- After renumbering, subsequent reorderings MUST continue to work correctly.

**Acceptance Criteria:**
- [x] When a reorder operation causes any internal ranking value to exceed 20 characters, the system automatically renumbers all active tasks.
- [x] Renumbering occurs within the same transaction as the reorder operation.
- [x] Renumbering preserves the exact current task order — no task changes position.
- [x] Renumbering is invisible to the user (no visual change, no flicker).
- [x] After renumbering, drag-and-drop, keyboard, and context menu reordering continue to work correctly.

### 2.5. Visual Feedback and Priority Number Display

Priority numbers displayed on cards are derived from the task's sorted position in the global active-task list, not stored as a separate field. They MUST always reflect the true current order.

**Rules:**
- The priority number on each card is its **1-based position index** in the full sorted list of active tasks (across all pages), not just its position on the current page.
- On page 2 with 10 cards per page, the first card shows #11, the second shows #12, etc.
- After any reorder (drag-and-drop, keyboard, or context menu), all visible cards MUST update their priority numbers immediately to reflect the new global ordering.

**Acceptance Criteria:**
- [x] Priority numbers reflect the global position across all pages (e.g., page 2 starts at #11 if page 1 has 10 cards).
- [x] After any reorder operation, all visible priority numbers update immediately.
- [x] Priority numbers are always sequential with no gaps or duplicates among active tasks.

---

## 3. Scope and Boundaries

### In-Scope

- Drag-and-drop reordering of task cards within the current page via a drag handle, applied to the global priority order.
- Visual feedback during drag: ghost card and drop indicator.
- Correct drop behavior at page boundaries (inserts at the correct position in the global list).
- Safe cancellation of drag when the underlying task list changes concurrently.
- Keyboard reordering with Alt+Arrow Up/Down operating on the global priority list.
- Focus preservation on the moved card after keyboard reorder.
- Context menu with "Move to Top" and "Move to Bottom" for cross-page moves.
- Automatic page navigation after cross-page moves.
- Deterministic renumbering within the same transaction when internal ranking values exceed the threshold.
- Immediate update of all visible priority numbers after any reorder.
- Persistence of new order.
- Escape to cancel a drag.

### Out-of-Scope

The following are separate roadmap items and will be addressed in their own specifications:

- **Task detail view** UI and content (Phase 2 — Expanded Task View).
- **Task dependencies** / blocks / blocked-by relationships (Phase 2 — Task Dependencies).
- **Filtering and sorting** beyond priority order (Phase 2 — Priority & Status Management, filtering subset).
- **Graph view** of tasks.
- **AI-assisted chat** per task (Phase 3).
- **Application shell / navigation chrome** (separate spec).
- **Subtask reordering** within a task detail view (separate from grid-level priority reordering).
- **Touch/mobile drag gestures** (out-of-scope — desktop only).
- **Drag-and-drop across pages** (dragging to page edges to auto-scroll) — cross-page moves use context menu shortcuts instead.
- **"Move to Position #N"** (typing a specific number) — deferred; "Move to Top" and "Move to Bottom" cover the primary use cases.
- **Multi-select drag** (selecting and moving multiple cards at once).
- Card animations or transitions during reorder (beyond the drag ghost and drop indicator).
