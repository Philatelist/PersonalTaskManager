# /awos:implement (Hybrid / Low-Token)

## Goal

Implement the **next incomplete sub-task** from the current feature
`context/spec/<feature>/tasks.md` with **minimal tokens**. Default
behavior: **do the work directly** (no subagent). Use subagent **only
when truly necessary**.

------------------------------------------------------------------------

## Hard Rules (Token Safety)

1.  **NO Web Search**. Never run web search tools. If a version/value is
    unknown, choose a safe default or mark as TODO with a pointer.
2.  **One sub-task per run** (the first unchecked `- [ ]` line under the
    first incomplete Slice).
3.  **Minimal context loading**:
    -   Always read: `context/spec/<feature>/tasks.md`.
    -   Read specs only by section, only if needed:
        -   `functional-spec.md`: relevant subsection(s) only
        -   `technical-considerations.md` / `tech.md`: relevant
            subsection(s) only
4.  **Never paste full specs into prompts**. Summarize constraints in
    **≤ 12 bullets**.
5.  **No refactors** unless required to complete the sub-task.
6.  **Do not mark done** unless verification passes.
7.  **Git policy**:
    -   Work **ONLY** on branch `dev`
    -   **One commit per /awos:implement run** (not per sub-task)
    -   Commit + push **only after** verification succeeds and `tasks.md` is updated
    -   Never commit secrets (`.env*`, tokens, credentials)

------------------------------------------------------------------------

## When to Use a Subagent (Rare)

Use a subagent **only if** at least one is true:

-   Creating/changing **many files** across Rust + TS (wide change
    surface).
-   You tried direct implementation and are **stuck** on Rust/Tauri
    details.
-   You need **UI wiring + tests** and scope is clearly broad.

If you use a subagent:
- Pass only: sub-task text + acceptance criteria + file paths + ≤12 bullets constraints.
- Instruction: "Be concise. No long explanations. Return only changed files + verify commands."
- Cap output: **≤ 200 lines**.

Otherwise: implement directly.

------------------------------------------------------------------------

## Execution Steps

### 0) Branch Guard (Must)

-   Run: `git branch --show-current`
-   If not `dev`: **STOP** (do not implement, do not commit, do not push).
    -   Ask the user to switch to `dev`, or explicitly approve switching.

### 1) Locate Target

-   Open `context/spec/<feature>/tasks.md`.
-   Find the first Slice containing unchecked items.
-   Pick the **first** unchecked sub-task (`- [ ] ...`). That is the
    only target.

### 2) Extract Minimal Requirements

-   If needed, read only the relevant spec sections.
-   Produce a constraints list (≤12 bullets). Example:
    -   SQLite: `PRAGMA foreign_keys=ON`, WAL enabled
    -   DTO: `task_get` includes tags
    -   etc.

### 3) Implement

-   Change only what is required.
-   Prefer small, readable patches.
-   Avoid unrelated cleanup.

### 4) Verify

Run what the sub-task requires (prefer fastest):
- Rust: `cargo test` / `cargo check`
- Frontend: `pnpm test` (or `pnpm vitest`)
- Manual: `pnpm tauri dev` only when needed

If verification fails:
- Fix and re-run.
- If still stuck: stop and report "blocked" (no checkbox updates).

### 5) Update tasks.md

-   Mark **only the implemented sub-task** `[ ]` → `[x]`.
-   Do not reorder or rewrite other tasks.

### 6) Commit + Push (Single Commit per Run)

Do this **only if**:
- verification succeeded, and
- `tasks.md` was updated, and
- current branch is `dev`.

Steps:
1.  Show state:
    -   `git status`
    -   `git diff`
2.  Stage all:
    -   `git add -A`
3.  Commit (one commit for the whole run). Use a concise message:
    -   `git commit -m "<type>(<scope>): <summary>"`
    -   Examples:
        -   `feat(board): add basic dnd column drop`
        -   `test(detail): add markdown editor tests`
        -   `chore(ci): stabilize tauri build`
4.  Push:
    -   `git push`

If there are **no staged changes**, do **not** create an empty commit.

------------------------------------------------------------------------

## Output Format (Short)

-   ✔ Implemented: `<sub-task name>`
-   Files changed:
    -   path1
    -   path2
-   Verification:
    -   `<commands run>`
-   Git:
    -   branch: `dev`
    -   commit: `<hash>`
    -   push: `git push`
-   Notes (optional, ≤5 bullets)

------------------------------------------------------------------------

## Stop Conditions

Stop and report "blocked" if:
- Spec conflict
- Missing decision
- Would require major refactor beyond the slice

Do not guess. Ask for the smallest decision needed.

------------------------------------------------------------------------

END.
