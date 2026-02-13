# Technical Specification: Task Details View + Notes (Markdown)

- **Functional Specification:** `context/spec/004-task-details-view-notes-markdown/functional-spec.md`
- **Status:** Draft
- **Author(s):** AI-assisted

---

## 1. High-Level Technical Approach

The Task Details View is a full-page React component that replaces the grid when the user selects a task. It reuses all existing backend commands — no new Rust endpoints are needed except for adding a circular reference check to `create_subtask_impl`.

**Key decisions:**
- **Routing:** Conditional rendering in `App.tsx` (existing pattern), replacing `TaskDetailPlaceholder` with `TaskDetailView`.
- **Data fetching:** Existing `useTask(id)` hook fetches a single task with subtasks and tags. Initial load can reuse data already in memory from the grid.
- **Markdown rendering:** `react-markdown` with `rehype-sanitize` for safe HTML-free rendering. Editing uses a plain `<textarea>` with a toolbar that inserts Markdown syntax.
- **Autosave:** Debounced `useRef`/`setTimeout` pattern for text fields (~1s), immediate persistence for discrete actions (tags, subtasks, status, due date). Pending saves flush on unmount.
- **Subtask reordering:** Reuses `@dnd-kit` (already installed) with `verticalListSortingStrategy`.
- **Circular reference check:** Enforced in both frontend (optimistic rejection before API call) and backend (authoritative guard in `create_subtask_impl`).
- **Scroll restoration:** `App.tsx` stores `scrollY` in a `useRef` before navigating to the detail view; restores it on return.
- **Task search (for taskref):** Frontend in-memory filter over `taskList()` results — no new backend command.

**Systems affected:**
- `App.tsx` — routing, scroll restoration
- `src/features/tasks/` — new detail view components
- `src-tauri/src/commands.rs` — circular reference validation in `create_subtask_impl`
- `package.json` — new dependencies (`react-markdown`, `rehype-sanitize`)

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1. New Frontend Dependencies

| Package | Purpose | Approx Size |
|---|---|---|
| `react-markdown` | Render Markdown as React elements | ~12KB gzipped |
| `rehype-sanitize` | Sanitize rendered HTML (strip raw HTML from input) | ~5KB gzipped |

Install via: `pnpm add react-markdown rehype-sanitize`

### 2.2. Component Breakdown

All new components live in `src/features/tasks/`. Each has a corresponding `.module.css` file and `.test.tsx` file.

```
TaskDetailView.tsx              — Main container, orchestrates all sections
TaskDetailView.module.css
TaskDetailView.test.tsx

EditableTitle.tsx                — Click-to-edit heading with autosave
EditableTitle.module.css
EditableTitle.test.tsx

MarkdownEditor.tsx               — Toggle view/edit, toolbar, textarea, rendering
MarkdownEditor.module.css
MarkdownEditor.test.tsx

MarkdownToolbar.tsx              — Formatting buttons (Bold, Italic, Heading, etc.)
MarkdownToolbar.module.css
MarkdownToolbar.test.tsx

SubtaskSection.tsx               — Subtask list with CRUD and reorder
SubtaskSection.module.css
SubtaskSection.test.tsx

SubtaskItem.tsx                  — Single subtask row (checkbox, label, delete, drag handle)
SubtaskItem.module.css
SubtaskItem.test.tsx

TaskRefSearchModal.tsx           — Search/select interface for adding taskref subtasks
TaskRefSearchModal.module.css
TaskRefSearchModal.test.tsx

TagEditor.tsx                    — Chip-based tag display with add/remove
TagEditor.module.css
TagEditor.test.tsx

DueDatePicker.tsx                — Click-to-edit date with native picker and clear
DueDatePicker.module.css
DueDatePicker.test.tsx

StatusActions.tsx                — Status badge + Mark as Done / Reactivate / Delete
StatusActions.module.css
StatusActions.test.tsx
```

### 2.3. Component Responsibilities

**TaskDetailView** (main orchestrator):
- Props: `taskId: string`, `priorityIndex: number`, `onBack: () => void`
- Uses `useTask(taskId)` to fetch data and `refresh()` after mutations
- Manages autosave debounce refs for title and description
- Flushes pending saves on unmount via `useEffect` cleanup
- Handles optimistic UI: applies changes locally, calls backend, reverts on failure
- Renders loading state, "not found" redirect (calls `onBack` + shows toast), or full detail layout
- Passes individual field update handlers to child components

**EditableTitle**:
- Props: `value: string`, `onSave: (newTitle: string) => Promise<void>`
- State: `isEditing`, `editValue`
- Display: `<h1>` heading, click → `<input type="text">`
- Auto-focus + select-all on enter edit mode
- Save on blur/Enter, cancel on Escape
- Rejects empty string (reverts to previous)

**MarkdownEditor**:
- Props: `value: string`, `onChange: (newValue: string) => void`
- State: `isEditing`
- Rendered view: `<ReactMarkdown>` with `rehype-sanitize` plugin
- Edit view: `<textarea>` + `<MarkdownToolbar>`
- `onChange` fires on every keystroke (parent handles debounce)
- Exit edit: click outside or Escape
- Links rendered with `target="_blank"` and `rel="noopener noreferrer"` via custom link component

**MarkdownToolbar**:
- Props: `textareaRef: RefObject<HTMLTextAreaElement>`
- Buttons: Bold, Italic, Heading, Bullet List, Numbered List, Code, Link
- Each button reads `selectionStart`/`selectionEnd` from textarea, wraps selection in syntax, updates value and restores cursor position
- Link button: if selection exists, wraps as `[selection](url)` and selects "url" for typing; if no selection, inserts `[link text](url)` and selects "link text"

**SubtaskSection**:
- Props: `subtasks: Subtask[]`, `taskId: string`, `onUpdated: () => void`
- Wraps subtask list in `DndContext` + `SortableContext` with `verticalListSortingStrategy`
- Sensors: `PointerSensor` (distance: 5), `KeyboardSensor`
- Drag handle required on each `SubtaskItem` — full-row drag is NOT enabled
- **Same-position guard:** On drag end, compare the resulting `orderedIds` array with the current order. If identical, skip the backend call entirely (no unnecessary `subtaskReorder` call).
- On drag end (position changed): optimistically reorder the local subtask array, call `subtaskReorder(taskId, orderedIds)`, then `onUpdated()` to confirm from backend. If the backend call fails, `onUpdated()` refreshes to revert.
- "Add subtask" input at bottom: Enter → `subtaskCreate(taskId, "checklist", label)` → `onUpdated()`
- "Link task" button: opens `TaskRefSearchModal`

**SubtaskItem**:
- Props: `subtask: Subtask`, `onToggle`, `onDelete`
- Uses `useSortable` for drag handle
- Checkbox: click → `subtaskUpdate(id, { isDone: !isDone })` for checklist; disabled for taskref
- Shows "Deleted task" (grayed out) if `subtask.refTaskStatus === "deleted"`
- Delete button (X icon): click → `subtaskDelete(id)` → `onUpdated()`

**TaskRefSearchModal**:
- Props: `taskId: string` (current task, to exclude), `onSelect: (refTaskId: string) => void`, `onClose: () => void`
- Fetches all active tasks via `taskList({ statusFilter: "active" })` — no new backend search command
- Filters out: current task (self-reference prevention), tasks that already reference the current task (circular prevention)
- Search input performs **case-insensitive substring** filtering in-memory on the loaded task list
- Renders dropdown/list of matching tasks
- **Empty state:** If no tasks match the search query, show a "No matching tasks" message instead of an empty list
- On select: calls `onSelect(refTaskId)` → parent calls `subtaskCreate` → `onUpdated()`

**TagEditor**:
- Props: `tags: string[]`, `onAdd: (tag: string) => void`, `onRemove: (tag: string) => void`
- Renders chips in alphabetical order, each with "x" remove button
- Text input: Enter → `onAdd(value.trim())`, clear input
- Parent handles `taskUpdate(id, { tags: [...tags, newTag] })` and `taskUpdate(id, { tags: tags.filter(t => t !== removed) })`

**DueDatePicker**:
- Props: `dueDate: string | null`, `onChange: (date: string | null) => void`
- Display: formatted date or "No due date" placeholder
- Click → reveals `<input type="date">` with current value
- Overdue detection: compare date with today, apply `.overdue` CSS class
- Clear button: calls `onChange(null)`
- On date select: calls `onChange(selectedDate)`

**StatusActions**:
- Props: `status: TaskStatus`, `onStatusChange: (newStatus: TaskStatus) => void`, `onDelete: () => void`
- Shows status badge (Active = green, Done = gray)
- Active → "Mark as Done" button
- Done → "Reactivate" button
- "Delete" button → `window.confirm()` prompt → `onDelete()`

### 2.4. App.tsx Changes — Navigation State Preservation

```
Current:  selectedTaskId ? <TaskDetailPlaceholder> : <GridView>
Updated:  selectedTaskId ? <TaskDetailView>        : <GridView>
```

New state/refs in App.tsx:
- `scrollPositionRef = useRef(0)` — captures grid container `scrollTop` (or `window.scrollY` if window-level scroll) before navigating to the detail view
- `currentPageRef = useRef(1)` — captures the grid page index before navigating (passed from GridView via callback or lifted ref)
- `priorityIndexRef = useRef(0)` — captures the task's global priority index for display in the detail view

**On `onSelectTask(id, priorityIndex)`:**
1. Capture `scrollPositionRef.current = window.scrollY` (or grid container `scrollTop`)
2. Capture `currentPageRef.current` from GridView state
3. Capture `priorityIndexRef.current = priorityIndex`
4. Set `selectedTaskId = id`

**On `onBack()`:**
1. Clear `selectedTaskId = null`
2. Restore `currentPage` by passing `currentPageRef.current` as the initial page to GridView
3. Restore scroll position **after DOM layout is stable** using `useLayoutEffect` (preferred) or `useEffect` + `requestAnimationFrame`:
   ```
   useLayoutEffect(() => {
     if (!selectedTaskId && scrollPositionRef.current > 0) {
       window.scrollTo(0, scrollPositionRef.current);
       scrollPositionRef.current = 0;
     }
   }, [selectedTaskId]);
   ```
   `useLayoutEffect` fires synchronously after DOM mutation but before paint, preventing a visual jump. If grid content loads asynchronously (e.g., `useTasks` re-fetches), fall back to `requestAnimationFrame` inside a `useEffect` watching the `tasks` array to ensure the DOM has the correct content height before scrolling.

### 2.5. Circular TaskRef Protection (Belt + Suspenders)

Circular reference prevention is enforced at **both** layers for safety.

**Frontend (optimistic rejection in `TaskRefSearchModal`):**
- When building the candidate list for the task search dropdown:
  1. Exclude the current task itself (self-reference prevention).
  2. Exclude any task that already has a subtask of type `"taskref"` with `ref_task_id` pointing back to the current task. This requires checking the candidate's subtask list (fetched via `taskGet` or pre-loaded from `taskList` if subtasks are included).
- If a user somehow bypasses the filter, the backend rejects the request.

**Backend (authoritative guard in `create_subtask_impl`):**

**File:** `src-tauri/src/commands.rs`, in `create_subtask_impl`

**Logic:** When `subtask_type === "taskref"` and `ref_task_id` is provided:
1. Reject if `ref_task_id == task_id` (self-reference) → return `Err("A task cannot reference itself")`
2. Query: check if the target task has any subtask of type "taskref" that references back to the source task:
   ```sql
   SELECT COUNT(*) FROM subtasks
   WHERE task_id = ?1 AND type = 'taskref' AND ref_task_id = ?2
   ```
   Where `?1 = ref_task_id` (target task) and `?2 = task_id` (source task). If count > 0, return `Err("CircularTaskRefNotAllowed: the target task already references this task")`
3. If neither check fails, proceed with creation as normal.

This is a **direct** circular check (A→B, B→A), not a transitive check (A→B→C→A). Direct-only is sufficient per the spec. The error string uses a structured prefix (`CircularTaskRefNotAllowed`) so the frontend can pattern-match and display a user-friendly message.

### 2.6. Autosave Architecture

**Debounced fields (title, description):**
- `TaskDetailView` maintains `titleSaveTimerRef` and `descriptionSaveTimerRef` (both `useRef<ReturnType<typeof setTimeout> | null>`)
- On field change: clear existing timer, set new timer (~1000ms debounce)
- Timer callback: call `taskUpdate(id, { [field]: value })`, then `refresh()`
- **Flush on blur:** Both title and description flush immediately when the field loses focus (blur event). Clear the pending timer and execute the save synchronously — do not wait for the debounce.
- **Flush on unmount:** `useEffect` cleanup checks if a timer exists; if so, clears it and executes the save. This prevents data loss when the user navigates back mid-edit. The latest value is read from a ref (not stale closure state) to ensure the flush saves the most recent content.

**Title-specific behavior:**
- Title saves on blur or Enter (immediate, no debounce wait).
- Title also debounce-saves at ~1000ms while typing (in case the user keeps typing without blurring).
- Escape cancels the edit and reverts — no save triggered.

**Description-specific behavior:**
- Description debounce-saves at ~1000ms while typing.
- Description flushes on blur (exiting edit mode).
- Description flushes on unmount.

**Immediate fields (tags, subtasks, status, due date):**
- Each action calls the service function directly, then `refresh()`
- No debounce — these are discrete user actions, not continuous typing
- Optimistic UI: update local state first, revert on error

**Error recovery:**
- On backend failure: call `refresh()` to revert to persisted state
- Show non-blocking toast notification (simple `div` with CSS transition, auto-dismiss after 3s)
- Toast component: `src/features/tasks/Toast.tsx` — rendered via portal, positioned fixed bottom-center

### 2.7. Optimistic UI + Consistency

All mutations in the detail view follow the same pattern:
1. **Optimistic update:** Apply the change to local state immediately so the UI responds instantly.
2. **Backend call:** Persist via the appropriate service function (`taskUpdate`, `subtaskCreate`, etc.).
3. **Refresh/invalidate:** On success, call `refresh()` to re-fetch the authoritative state from the backend. This ensures derived data (e.g., `updatedAt`, `progress`, taskref statuses) is correct.
4. **Revert on failure:** If the backend call throws, `refresh()` restores the last persisted state. Display a non-blocking toast with the error.

**No-op guards (avoid unnecessary backend calls):**
- Subtask reorder: if the resulting `orderedIds` array is identical to the current order, skip the call entirely.
- Title save: if the new value equals the current persisted value, skip the `taskUpdate` call.
- Description save: if the new value equals the current persisted value, skip the `taskUpdate` call.

This is consistent with the grid's existing optimistic pattern (`arrayMove` → `taskReorder` → `refresh`).

### 2.8. Markdown Rendering Safety

**Core safety rules:**
- Use `react-markdown` with `rehype-sanitize` — Markdown is parsed to an AST and rendered as React elements. **No `dangerouslySetInnerHTML` anywhere in the rendering pipeline.**
- Raw HTML in Markdown input (e.g., `<script>`, `<iframe>`, `<div onclick="...">`) is stripped by `rehype-sanitize` before rendering.
- Links are sanitized to prevent unsafe protocols: only `http:`, `https:`, and `mailto:` are allowed. `javascript:`, `data:`, and other protocols are stripped by the sanitizer's default schema.

**ReactMarkdown setup:**
```
<ReactMarkdown
  rehypePlugins={[rehypeSanitize]}
  components={{
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    )
  }}
>
  {content}
</ReactMarkdown>
```

**Supported elements** (controlled by `rehype-sanitize` default schema):
- Headings: `h1`, `h2`, `h3`
- Inline: `strong`, `em`, `code`, `a`
- Block: `p`, `ul`, `ol`, `li`, `pre`, `code` (fenced blocks)
- All other HTML tags stripped by sanitizer

### 2.9. Data Flow for Priority Index

The detail view needs the task's global priority number (its 1-based position among all active tasks). Options:
- **Approach:** `App.tsx` passes `priorityIndex` as a prop to `TaskDetailView`. The index is computed in `GridView` when the user clicks a card: `startIndex + localIndex + 1`. GridView passes this up via a modified `onSelectTask(id, priorityIndex)` callback.
- This avoids fetching and sorting all active tasks inside the detail view just to compute a single number.

---

## 3. Impact and Risk Analysis

### System Dependencies

| Component | Depends On | Affected By This Change |
|---|---|---|
| `App.tsx` | `TaskDetailView` (new) | Modified — routing, scroll save/restore |
| `GridView.tsx` | — | Modified — `onSelectTask` signature adds `priorityIndex` |
| `TaskCard.tsx` | — | No change (already fires `onSelect`) |
| `useTask` hook | `task-service.ts` | No change (already exists) |
| `task-service.ts` | Tauri invoke | No change (all commands exist) |
| `commands.rs` | SQLite | Modified — circular ref check in `create_subtask_impl` |
| `models.rs` | — | No change |
| `db.rs` | — | No change (no schema changes) |

### Potential Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Markdown XSS** | Raw HTML in user-authored Markdown could execute scripts | `rehype-sanitize` strips all raw HTML by default; links forced to `noopener noreferrer` |
| **Typing lag in large notes** | Notes >10K chars could cause slow re-renders | Debounce autosave at 1s; textarea is uncontrolled during edit (no React re-render on keystroke); Markdown rendering only on exit edit |
| **Data loss on unmount** | User navigates back mid-edit, unsaved changes lost | Flush pending debounced saves in `useEffect` cleanup; verify with test |
| **Stale data after subtask mutation** | Adding/deleting subtask doesn't refresh progress | Every mutation calls `refresh()` which re-fetches full task from backend |
| **Circular ref not caught** | User creates A→B→A reference | Backend validation (SQL query) as authoritative guard + frontend pre-check |
| **Optimistic revert flicker** | Backend failure causes visible UI snap-back | Short debounce, refresh restores clean state; toast explains the error |
| **Subtask list performance** | 100+ subtasks with drag handles could be slow | `@dnd-kit` uses CSS transforms (no layout thrashing); `useSortable` per item is lightweight; test with 100 items |

---

## 4. Testing Strategy

### Frontend Tests (Vitest + React Testing Library)

**Per-component test files** following existing patterns:

| Component | Key Test Cases |
|---|---|
| `TaskDetailView.test.tsx` | Renders all sections; loading state; "not found" redirects with toast; back button fires `onBack`; autosave flushes on unmount; autosave flushes on blur; optimistic revert on error; no-op guard skips save when value unchanged |
| `EditableTitle.test.tsx` | Click enters edit mode; auto-focus + select-all; Enter saves; Escape cancels; empty string rejected; blur saves |
| `MarkdownEditor.test.tsx` | Renders Markdown; placeholder shown when empty; click enters edit mode; Escape exits edit; `onChange` fires on keystroke; HTML sanitized; links have correct attributes |
| `MarkdownToolbar.test.tsx` | Each button inserts correct syntax; works with selection; works without selection; cursor position restored |
| `SubtaskSection.test.tsx` | Renders subtask list; add input creates checklist subtask; toggle calls `subtaskUpdate`; delete calls `subtaskDelete`; reorder calls `subtaskReorder`; same-position drop skips backend call; taskref checkbox disabled |
| `SubtaskItem.test.tsx` | Checkbox toggles for checklist; checkbox disabled for taskref; deleted ref shows "Deleted task"; drag handle rendered; delete button works |
| `TaskRefSearchModal.test.tsx` | Filters tasks by title (case-insensitive); excludes self; excludes circular refs; selecting fires `onSelect`; empty state when no matches; Escape closes |
| `TagEditor.test.tsx` | Renders chips; add tag on Enter; duplicates ignored; remove tag on X click; alphabetical order |
| `DueDatePicker.test.tsx` | Shows formatted date; shows placeholder; click opens picker; overdue highlighted; clear button works |
| `StatusActions.test.tsx` | Active shows "Mark as Done"; Done shows "Reactivate"; Delete shows confirmation; status badge correct |

**Mocking pattern** (consistent with existing tests):
```
vi.mock("./task-service", () => ({
  taskGet: vi.fn(),
  taskUpdate: vi.fn(),
  subtaskCreate: vi.fn(),
  ...
}));
```

### Backend Tests (Rust `cargo test`)

**New tests in `commands.rs`:**

| Test | Assertion |
|---|---|
| `test_create_subtask_self_reference_rejected` | `create_subtask_impl` with `ref_task_id === task_id` returns error |
| `test_create_subtask_circular_reference_rejected` | Task A refs Task B, then Task B trying to ref Task A returns error |
| `test_create_subtask_non_circular_reference_allowed` | Task A refs Task B, Task C refs Task A — allowed (not circular with B) |

### Test Approach

- **Unit tests:** Every component tested in isolation with mocked service layer
- **Integration flow:** `TaskDetailView.test.tsx` tests full data flow: load → edit → save → refresh cycle
- **No E2E tests** in this spec (manual verification via `pnpm tauri dev`)
- **Total estimated new tests:** ~60-70 frontend tests, ~3 backend tests
