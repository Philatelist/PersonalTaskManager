# Functional Specification: Deadlines + Visual Urgency + Overdue Indicator

- **Roadmap Item:** Deadline field; step-based color ramp as deadline approaches; overdue indicator "+X days"; behavior for tasks without deadlines.
- **Status:** Draft
- **Author:** AI-assisted

---

## 1. Overview and Rationale (The "Why")

### Problem

The user manages many tasks across different domains and timeframes. While due dates already exist in the system, there is no visual signal on the grid cards or detail view to indicate how urgent a task is becoming. The user must mentally calculate "how many days until this is due?" for each task. Overdue tasks show only a generic warning icon (⚠) with no indication of *how* overdue they are — a task 1 day late looks the same as one 30 days late.

### Solution

Add a **3-tier color ramp** that automatically colors the left border of grid cards based on proximity to the deadline. Replace the current overdue warning icon with a concrete **"+X days"** text indicator. Apply the same urgency signals in the task detail view near the due date. Tasks without deadlines or completed tasks are unaffected.

### Success Criteria

- The user can see at a glance which tasks are approaching their deadline without reading any dates.
- Overdue tasks clearly communicate *how late* they are.
- The visual system is calm — tasks without deadlines or completed tasks show no urgency signals.

---

## 2. Functional Requirements (The "What")

### 2.1 Urgency Tiers

The system uses **3 urgency tiers** based on the number of calendar days remaining until the due date. "Days remaining" is calculated as the due date minus today's date (both at midnight local time).

| Tier | Condition | Color | Label |
|------|-----------|-------|-------|
| **Comfortable** | > 3 days remaining | Green (`#4caf50`) | — |
| **Approaching** | 1–3 days remaining | Amber/Orange (`#ff9800`) | — |
| **Urgent** | Due today (0 days remaining) | Red (`#d32f2f`) | — |
| **Overdue** | Past due (negative days) | Dark Red (`#b71c1c`) | "+X days" |

- Tasks with **no due date** have no urgency tier and no color indicator.
- Tasks with status **"done"** have no urgency tier and no color indicator, regardless of their due date.

**Acceptance Criteria:**
- [ ] A task with a due date more than 3 days away shows the "Comfortable" (green) indicator.
- [ ] A task with a due date 1–3 days away shows the "Approaching" (amber) indicator.
- [ ] A task due today shows the "Urgent" (red) indicator.
- [ ] A task past its due date shows the "Overdue" (dark red) indicator.
- [ ] A task with no due date shows no urgency indicator.
- [ ] A task with status "done" shows no urgency indicator regardless of due date.

### 2.2 Grid Card — Left Border Stripe

Each grid card with a due date displays a **colored left border stripe** (4px wide) reflecting the current urgency tier. This border is always visible at a glance without reading text.

- The stripe color corresponds to the urgency tier from §2.1.
- Tasks without a due date have no left border stripe (or a neutral/transparent border matching the default card style).
- Done tasks have no left border stripe.

**Acceptance Criteria:**
- [ ] Grid cards with a due date show a colored left border stripe matching the urgency tier.
- [ ] The stripe color updates dynamically as the due date approaches (e.g., green → amber when 3 days remain).
- [ ] Grid cards without a due date show no colored left border stripe.
- [ ] Done tasks show no colored left border stripe.

### 2.3 Grid Card — Overdue Text Indicator

The existing overdue warning icon (⚠) on grid cards is **replaced** with a text indicator showing how many days overdue the task is.

- Format: **"+X days"** where X is the number of calendar days past the due date.
- "+1 days" should display as **"+1 day"** (singular).
- The text is styled in the overdue color (dark red) and appears next to or below the formatted due date.
- Tasks that are not overdue continue showing just the formatted date (e.g., "Jan 15") with no additional indicator.

**Acceptance Criteria:**
- [ ] An overdue task shows "+X days" (or "+1 day") instead of the ⚠ icon.
- [ ] The "+X days" text is colored dark red.
- [ ] A task due today does NOT show "+0 days" — it shows the date only (urgency is communicated via the border stripe).
- [ ] A task not yet due shows no overdue indicator.
- [ ] The day count is correct: a task due yesterday shows "+1 day", due 5 days ago shows "+5 days".

### 2.4 Task Detail View — Urgency Indicator

The task detail view shows an urgency indicator near the due date picker, consistent with the grid card's urgency tier.

- A colored dot or small badge appears next to the due date display text, matching the urgency tier color.
- For overdue tasks, the "+X days" text appears alongside the due date.
- Tasks without a due date or with status "done" show no urgency indicator.

**Acceptance Criteria:**
- [ ] The task detail view shows an urgency color indicator near the due date when a due date is set.
- [ ] The urgency color matches the grid card's tier for the same task.
- [ ] Overdue tasks show "+X days" text in the detail view.
- [ ] Tasks without a due date show no urgency indicator in the detail view.
- [ ] Done tasks show no urgency indicator in the detail view.

### 2.5 Edge Cases

- **Due date set to today:** Tier is "Urgent" (red border, no "+X days" text).
- **Due date changed:** The urgency tier updates immediately when the user changes the due date in the detail view and returns to the grid.
- **Due date cleared:** The urgency indicator disappears immediately.
- **Task marked done while overdue:** The urgency indicator and border stripe disappear.
- **Task reactivated after being done:** If the due date is past, the overdue indicator reappears.

**Acceptance Criteria:**
- [ ] Changing a due date in the detail view updates the grid card's urgency indicator on return.
- [ ] Clearing a due date removes the urgency indicator.
- [ ] Marking an overdue task as done removes the urgency indicator.
- [ ] Reactivating a task with a past due date restores the overdue indicator.

---

## 3. Scope and Boundaries

### In-Scope

- 3-tier urgency color ramp based on days until due date.
- Left border stripe on grid cards colored by urgency tier.
- "+X days" overdue text replacing the ⚠ icon on grid cards.
- Urgency indicator in the task detail view near the due date.
- No urgency signals for tasks without due dates or completed tasks.

### Out-of-Scope

- Notifications, reminders, or alerts (no push notifications, no desktop alerts, no triggers).
- Calendar integration or calendar view.
- Sorting or filtering tasks by due date or urgency (separate roadmap item: Priority & Status Management).
- AI-Assisted Thinking Partner (separate Phase 3 roadmap item).
- Application Shell & Navigation (separate roadmap item).
- Configurable urgency thresholds (fixed at 0/1/3 days for v1).
