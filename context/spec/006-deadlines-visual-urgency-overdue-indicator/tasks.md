# Tasks: Deadlines + Visual Urgency + Overdue Indicator

- **Feature:** 006-deadlines-visual-urgency-overdue-indicator
- **Functional Spec:** `functional-spec.md`
- **Technical Spec:** `technical-considerations.md`
- **Status:** Pending

---

## Slice 1: Urgency Utility + Unit Tests

> **Goal:** Create the shared `urgency.ts` module with `getUrgency`, `formatOverdueText`, and `URGENCY_COLORS`. Fully unit-tested. No UI changes yet.
>
> **Acceptance Criteria:** §2.1 (tier computation logic)

- [x] Create `src/features/tasks/urgency.ts` with: **[Agent: general-purpose]**
  - `UrgencyTier` type: `"comfortable" | "approaching" | "urgent" | "overdue"`
  - `UrgencyInfo` interface: `{ tier: UrgencyTier; daysRemaining: number; color: string }`
  - `URGENCY_COLORS` constant: comfortable → `#4caf50`, approaching → `#ff9800`, urgent → `#d32f2f`, overdue → `#b71c1c`
  - `getUrgency(dueDate: string | null, status: string, today?: Date): UrgencyInfo | null`
    - Returns `null` if `dueDate` is null, status is `"done"`, or date is unparseable
    - Accepts optional `today` parameter for testability (defaults to `new Date()`)
    - Parses date with `+ "T00:00:00"` pattern (project convention)
    - Computes `daysRemaining = Math.floor((dueMs - todayMs) / 86_400_000)`
    - Maps: `< 0` → overdue, `=== 0` → urgent, `<= 3` → approaching, `> 3` → comfortable
  - `formatOverdueText(daysRemaining: number): string | null`
    - Returns `null` if `daysRemaining >= 0`
    - Returns `"+1 day"` if `daysRemaining === -1`
    - Returns `"+X days"` otherwise (using `Math.abs`)
- [x] Create `src/features/tasks/urgency.test.ts` with tests: **[Agent: general-purpose]**
  - `getUrgency` tests (use fixed `today` param to avoid flaky tests):
    - Due date 10 days from now → tier `"comfortable"`, color `#4caf50`, daysRemaining `10`
    - Due date 4 days from now → tier `"comfortable"`
    - Due date 3 days from now → tier `"approaching"`, color `#ff9800`, daysRemaining `3`
    - Due date 1 day from now → tier `"approaching"`, daysRemaining `1`
    - Due date today → tier `"urgent"`, color `#d32f2f`, daysRemaining `0`
    - Due date yesterday → tier `"overdue"`, color `#b71c1c`, daysRemaining `-1`
    - Due date 5 days ago → tier `"overdue"`, daysRemaining `-5`
    - `dueDate` is `null` → returns `null`
    - Status `"done"` with a future due date → returns `null`
    - Status `"done"` with an overdue due date → returns `null`
    - Invalid date string → returns `null`
  - `formatOverdueText` tests:
    - `daysRemaining = -1` → `"+1 day"`
    - `daysRemaining = -5` → `"+5 days"`
    - `daysRemaining = -30` → `"+30 days"`
    - `daysRemaining = 0` → `null`
    - `daysRemaining = 3` → `null`
- [x] **Verify:** Run `npx vitest run src/features/tasks/urgency.test.ts` — all tests pass. **[Agent: general-purpose]**

---

## Slice 2: Grid Card — Left Border Stripe + Overdue Text

> **Goal:** Integrate urgency visuals into TaskCard: colored 4px left border stripe based on tier, and "+X days" overdue text replacing the ⚠ icon.
>
> **Acceptance Criteria:** §2.2 (left border stripe), §2.3 (overdue text indicator)

- [x] Modify `src/features/tasks/TaskCard.tsx`: **[Agent: general-purpose]**
  - Import `getUrgency`, `formatOverdueText` from `./urgency`
  - Remove the local `isOverdue()` helper function
  - Call `const urgency = getUrgency(task.dueDate, task.status)` at render time
  - On the card root `<div>`: if `urgency` is not null, set `style={{ borderLeft: \`4px solid ${urgency.color}\` }}`
  - In the due date section: remove the `⚠` overdue icon (`<span className={styles.overdueIcon}>⚠</span>`)
  - If urgency is not null and `formatOverdueText(urgency.daysRemaining)` returns a string, render: `<span className={styles.overdueText} data-testid="overdue-text">{text}</span>`
- [x] Modify `src/features/tasks/TaskCard.module.css`: **[Agent: general-purpose]**
  - Remove `.overdueIcon` class
  - Add `.overdueText` class: `color: #b71c1c; font-size: 10px; font-weight: 600;`
- [x] Modify `src/features/tasks/TaskCard.test.tsx` — add/update tests: **[Agent: general-purpose]**
  - Card with due date > 3 days away → has green (`#4caf50`) left border inline style
  - Card with due date 2 days away → has amber (`#ff9800`) left border
  - Card due today → has red (`#d32f2f`) left border, no overdue text
  - Card overdue by 3 days → has dark red (`#b71c1c`) left border + "+3 days" text visible
  - Card overdue by 1 day → "+1 day" text (singular)
  - Card with no due date → no inline border-left style, no overdue text
  - Done card with overdue date → no inline border-left style, no overdue text
  - Regression: overdue icon (⚠ / `data-testid="overdue-icon"`) is no longer rendered
  - Ensure existing TaskCard tests still pass (title, tags, progress, context menu, etc.)
- [ ] **Verify:** Run `npx vitest run src/features/tasks/TaskCard.test.tsx` — all tests pass. **[Agent: general-purpose]**
- [ ] **Verify:** Run `npx vitest run` — full suite passes (no regressions). **[Agent: general-purpose]**

---

## Slice 3: Detail View — Urgency Dot + Overdue Text

> **Goal:** Show an urgency color dot and "+X days" text next to the due date in the task detail view's DueDatePicker.
>
> **Acceptance Criteria:** §2.4 (task detail view urgency indicator)

- [ ] Modify `src/features/tasks/DueDatePicker.tsx`: **[Agent: general-purpose]**
  - Add optional `status?: string` prop (defaults to `"active"`)
  - Import `getUrgency`, `formatOverdueText` from `./urgency`
  - Remove the local `isOverdue()` helper function
  - Call `const urgency = getUrgency(dueDate, status ?? "active")` at render time
  - In display mode (not editing): if urgency is not null, render a dot before the date text:
    `<span className={styles.urgencyDot} style={{ backgroundColor: urgency.color }} data-testid="urgency-dot" />`
  - If overdue, append after the date text:
    `<span className={styles.overdueText} data-testid="detail-overdue-text">{formatOverdueText(urgency.daysRemaining)}</span>`
  - Keep the existing `.overdue` class on the date text for overdue color
- [ ] Modify `src/features/tasks/DueDatePicker.module.css`: **[Agent: general-purpose]**
  - Add `.urgencyDot`: `width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; vertical-align: middle;`
  - Add `.overdueText`: `color: #b71c1c; font-size: 0.75rem; font-weight: 600; margin-left: 4px;`
- [ ] Modify `src/features/tasks/TaskDetailView.tsx`: **[Agent: general-purpose]**
  - Pass `status={task.status}` prop to the `<DueDatePicker>` component
- [ ] Modify `src/features/tasks/DueDatePicker.test.tsx` — add tests: **[Agent: general-purpose]**
  - Due date 5 days away → urgency dot visible with green background
  - Due date 2 days away → urgency dot visible with amber background
  - Due date today → urgency dot visible with red background
  - Due date 3 days ago → urgency dot (dark red) + "+3 days" text visible
  - Due date 1 day ago → "+1 day" text (singular)
  - No due date → no urgency dot, no overdue text
  - Status `"done"` with overdue date → no urgency dot, no overdue text
- [ ] **Verify:** Run `npx vitest run src/features/tasks/DueDatePicker.test.tsx` — all tests pass. **[Agent: general-purpose]**
- [ ] **Verify:** Run `npx vitest run` — full suite passes (no regressions). **[Agent: general-purpose]**

---

## Slice 4: Edge Cases + Integration Verification

> **Goal:** Verify all edge cases from the spec and ensure the urgency system works end-to-end across grid and detail views.
>
> **Acceptance Criteria:** §2.5 (edge cases), §2.1 (done-task suppression)

- [ ] Add edge-case tests to `src/features/tasks/TaskCard.test.tsx`: **[Agent: general-purpose]**
  - Task due today: red border, NO "+0 days" text (§2.3 AC: "A task due today does NOT show +0 days")
  - Task status changes from active to done: urgency indicators disappear (mock status change + re-render)
  - Task with status `"deleted"` and overdue date: no urgency indicators (treated same as done)
- [ ] Add edge-case tests to `src/features/tasks/DueDatePicker.test.tsx`: **[Agent: general-purpose]**
  - Due date cleared (set to null): urgency dot disappears
  - Due date changed from overdue to future: tier updates from overdue to comfortable
  - Status changed from done to active with overdue date: urgency reappears
- [ ] **Verify:** Run `npx vitest run` — full test suite passes. **[Agent: general-purpose]**
- [ ] **Verify:** Run `/Users/alex/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml` — all Rust tests still pass (no backend changes, regression check). **[Agent: general-purpose]**

---

## Recommendations

| Task/Slice | Issue | Recommendation |
|------------|-------|----------------|
| All slices | Assigned to `general-purpose` — no React/TS specialist agent | Acceptable: the changes are straightforward React + pure TS logic. A specialist agent is not necessary. |
| Verification | No browser MCP available for visual UI testing | Tests use Vitest + React Testing Library (DOM assertions). Manual visual check recommended after Slice 2 and Slice 3 to confirm border colors render correctly in the Tauri webview. |
