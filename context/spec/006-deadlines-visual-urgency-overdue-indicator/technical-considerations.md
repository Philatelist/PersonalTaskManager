# Technical Specification: Deadlines + Visual Urgency + Overdue Indicator

- **Functional Specification:** `context/spec/006-deadlines-visual-urgency-overdue-indicator/functional-spec.md`
- **Status:** Draft
- **Author(s):** AI-assisted

---

## 1. High-Level Technical Approach

This feature is **frontend-only**. The `due_date` field already exists in the SQLite schema (`TEXT`, nullable, ISO 8601 `YYYY-MM-DD`), the Rust `TaskDto` model (`Option<String>`), and the TypeScript `Task` interface (`string | null`). No backend or database changes are needed.

The implementation adds:

1. A **shared pure utility** (`urgency.ts`) that computes the urgency tier and overdue day count from a due date string and task status.
2. **TaskCard** modifications: a 4px colored left border stripe and "+X days" overdue text replacing the existing ⚠ icon.
3. **DueDatePicker** modifications: a colored urgency dot and "+X days" text next to the due date display.

All urgency computation happens at render time using the browser's local clock (`new Date()`). No server-side date math is needed.

---

## 2. Proposed Solution & Implementation Plan

### 2.1 Urgency Utility — `src/features/tasks/urgency.ts` (NEW)

A pure, stateless module with no React dependencies. Easy to unit-test in isolation.

**Exported types and functions:**

| Export | Signature | Purpose |
|--------|-----------|---------|
| `UrgencyTier` | `"comfortable" \| "approaching" \| "urgent" \| "overdue" \| null` | Enum-like type for the 4 tiers + `null` (no urgency) |
| `UrgencyInfo` | `{ tier: UrgencyTier; daysRemaining: number; color: string }` | Full urgency result |
| `getUrgency` | `(dueDate: string \| null, status: string) => UrgencyInfo \| null` | Main computation function |
| `URGENCY_COLORS` | `Record<string, string>` | Color constants for each tier |

**Color constants:**

| Tier | Color | Hex |
|------|-------|-----|
| Comfortable | Green | `#4caf50` |
| Approaching | Amber/Orange | `#ff9800` |
| Urgent | Red | `#d32f2f` |
| Overdue | Dark Red | `#b71c1c` |

**`getUrgency` logic:**

1. If `dueDate` is `null` → return `null` (no urgency).
2. If `status` is `"done"` → return `null` (no urgency).
3. Parse `dueDate` as `new Date(dueDate + "T00:00:00")` (avoids timezone shift — existing project pattern).
4. Compute `today` as `new Date()` with hours/minutes/seconds zeroed to midnight local time.
5. `daysRemaining = Math.floor((dueMs - todayMs) / 86_400_000)`.
6. Map to tier:
   - `daysRemaining < 0` → `"overdue"`
   - `daysRemaining === 0` → `"urgent"`
   - `daysRemaining <= 3` → `"approaching"`
   - `daysRemaining > 3` → `"comfortable"`
7. Return `{ tier, daysRemaining, color: URGENCY_COLORS[tier] }`.

**Overdue text formatting** (also exported):

| Export | Signature | Purpose |
|--------|-----------|---------|
| `formatOverdueText` | `(daysRemaining: number) => string \| null` | Returns `"+X days"` / `"+1 day"` or `null` if not overdue |

- If `daysRemaining >= 0` → return `null`.
- If `daysRemaining === -1` → return `"+1 day"`.
- Otherwise → return `"+${Math.abs(daysRemaining)} days"`.

### 2.2 TaskCard Changes — `src/features/tasks/TaskCard.tsx`

**Left border stripe:**

- Call `getUrgency(task.dueDate, task.status)` at render time.
- If urgency is not `null`, apply inline style on the card root `<div>`:
  ```
  style={{ borderLeft: `4px solid ${urgency.color}` }}
  ```
- If urgency is `null`, no inline style (falls back to the existing 1px border from CSS).

**Overdue text replacing ⚠ icon:**

- Remove the existing `{isOverdue(task.dueDate) && <span className={styles.overdueIcon}>⚠</span>}` block.
- Remove the local `isOverdue()` helper (replaced by the shared utility).
- If `formatOverdueText(urgency.daysRemaining)` returns a string, render it as:
  ```
  <span className={styles.overdueText} data-testid="overdue-text">+X days</span>
  ```
- Style: dark red (`#b71c1c`), font-size 10px, font-weight 600.

**Cleanup:**

- Remove the local `isOverdue()` function from TaskCard.tsx (replaced by `getUrgency`).
- Remove the `.overdueIcon` CSS class from TaskCard.module.css.

### 2.3 TaskCard CSS Changes — `src/features/tasks/TaskCard.module.css`

| Change | Details |
|--------|---------|
| Add `.overdueText` | `color: #b71c1c; font-size: 10px; font-weight: 600;` |
| Remove `.overdueIcon` | No longer used (⚠ icon removed) |

The left border color is applied via inline style, so no new CSS classes for urgency tiers.

### 2.4 DueDatePicker Changes — `src/features/tasks/DueDatePicker.tsx`

**Urgency dot:**

- Accept new optional props: `status?: string` (needed to suppress urgency for done tasks).
- Call `getUrgency(dueDate, status ?? "active")`.
- If urgency is not `null`, render a small colored dot (`8px × 8px` circle) to the left of the date text.
- Dot uses inline `style={{ backgroundColor: urgency.color }}` with a shared `.urgencyDot` CSS class for shape/sizing.

**Overdue text:**

- If overdue, append `formatOverdueText(...)` after the formatted date.
- Style matches the card's overdue text: dark red, small font.

**Cleanup:**

- Remove the local `isOverdue()` function (replaced by the shared utility).
- The existing `.overdue` CSS class for red text can remain — it's still useful as a fallback for the date text color when overdue.

### 2.5 DueDatePicker CSS Changes — `src/features/tasks/DueDatePicker.module.css`

| Change | Details |
|--------|---------|
| Add `.urgencyDot` | `width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; vertical-align: middle;` |
| Add `.overdueText` | `color: #b71c1c; font-size: 0.75rem; font-weight: 600; margin-left: 4px;` |

### 2.6 TaskDetailView Changes — `src/features/tasks/TaskDetailView.tsx`

- Pass the task's `status` prop to `DueDatePicker` so it can compute urgency:
  ```
  <DueDatePicker dueDate={task.dueDate} status={task.status} onChange={handleDueDateChange} />
  ```
- No other changes needed in TaskDetailView itself — the DueDatePicker handles the visual indicator.

### 2.7 File Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/features/tasks/urgency.ts` | **CREATE** | Shared urgency tier computation + color constants |
| `src/features/tasks/urgency.test.ts` | **CREATE** | Unit tests for urgency utility |
| `src/features/tasks/TaskCard.tsx` | **MODIFY** | Add left border stripe, replace ⚠ with "+X days" |
| `src/features/tasks/TaskCard.module.css` | **MODIFY** | Add `.overdueText`, remove `.overdueIcon` |
| `src/features/tasks/TaskCard.test.tsx` | **MODIFY** | Update tests for new urgency visuals |
| `src/features/tasks/DueDatePicker.tsx` | **MODIFY** | Add urgency dot + overdue text |
| `src/features/tasks/DueDatePicker.module.css` | **MODIFY** | Add `.urgencyDot`, `.overdueText` |
| `src/features/tasks/DueDatePicker.test.tsx` | **MODIFY** | Update tests for urgency indicator |
| `src/features/tasks/TaskDetailView.tsx` | **MODIFY** | Pass `status` to DueDatePicker |

---

## 3. Impact and Risk Analysis

### System Dependencies

- **No backend changes.** The `due_date` field is already fully supported end-to-end.
- **TaskCard** is rendered by `TaskGrid` → `GridView`. The left border adds 3px of visual width to each card (4px border minus the existing 1px). This is negligible and won't affect the grid layout.
- **DueDatePicker** is used in `TaskDetailView` only. Adding the `status` prop is backward-compatible (optional, defaults to `"active"`).

### Potential Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| **Timezone edge case:** A task due "today" might show as "overdue" or "comfortable" near midnight if the local clock and the stored date disagree. | Low | Both dates are normalized to midnight local time using the existing `+ "T00:00:00"` pattern. The tier boundary is at midnight. |
| **Date parsing:** Invalid `dueDate` strings could cause `NaN`. | Low | `getUrgency` should guard against `isNaN(dueMs)` and return `null` for unparseable dates. The backend validates date format on write. |
| **Performance:** `getUrgency` is called per card on every render. | Negligible | Pure arithmetic on two `Date` objects — sub-microsecond. No memoization needed for up to 100 cards per page. |
| **Stale urgency on long-running sessions:** If the app stays open past midnight, urgency tiers won't update until a re-render. | Low | Acceptable for v1. A future enhancement could add a midnight timer to force re-render. |

---

## 4. Testing Strategy

### Unit Tests — `urgency.test.ts`

Test the pure `getUrgency` and `formatOverdueText` functions with fixed "today" dates (inject via parameter or mock `Date`):

- Due date > 3 days away → tier `"comfortable"`, green color
- Due date 3 days away → tier `"approaching"`, amber color
- Due date 1 day away → tier `"approaching"`, amber color
- Due date today → tier `"urgent"`, red color
- Due date yesterday → tier `"overdue"`, dark red color, daysRemaining = -1
- Due date 5 days ago → tier `"overdue"`, daysRemaining = -5
- No due date → `null`
- Status "done" with due date → `null`
- Status "done" with overdue date → `null`
- `formatOverdueText(-1)` → `"+1 day"`
- `formatOverdueText(-5)` → `"+5 days"`
- `formatOverdueText(0)` → `null`
- `formatOverdueText(3)` → `null`

### Component Tests — TaskCard

- Card with due date > 3 days → green left border, no overdue text
- Card with due date 1-3 days → amber left border, no overdue text
- Card due today → red left border, no overdue text
- Card overdue by 3 days → dark red left border, "+3 days" text visible
- Card overdue by 1 day → "+1 day" text (singular)
- Card with no due date → no left border stripe, no overdue text
- Done card with overdue date → no left border stripe, no overdue text
- Overdue icon (⚠) no longer rendered (regression guard)

### Component Tests — DueDatePicker

- Due date with urgency → colored dot visible
- Overdue due date → "+X days" text visible
- No due date → no dot, no overdue text
- Status "done" → no urgency indicator
