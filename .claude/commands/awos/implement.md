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

7.  **Git policy (feature branch → dev)**:
    - Code changes must go to a feature branch derived from the prompt name:
      `feature/<slug>`
    - The feature branch MUST be created from `dev`
    - Commit + push only after verification succeeds AND `tasks.md` is updated
    - Then merge feature → dev and push dev
    - Do NOT delete the feature branch
    - Never commit secrets (`.env*`, tokens, credentials)

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

### 0) Compute topic + feature branch (Must)

- If implement was initiated for a topic prompt like:
  `/awos:spec|tech|tasks @awos_prompts/<nn>-<topic>.md`
  derive:
  - topic = `<topic>` with dashes → spaces
  - slug = first 3 words joined by `-`
  - feature branch = `feature/<slug>`
  - Example: `01-core-task-model-subtasks-progress.md` → `feature/core-task-model`

### 1) Ensure feature branch is created from dev (Must)

Run:
- `git checkout dev`
- `git pull`
- `git checkout feature/<slug>` OR (if missing) `git checkout -b feature/<slug>`

From this point, all changes are on the feature branch.

### 2) Locate Target

-   Open `context/spec/<feature>/tasks.md`.
-   Find the first Slice containing unchecked items.
-   Pick the **first** unchecked sub-task (`- [ ] ...`). That is the
    only target.

### 3) Extract Minimal Requirements

-   If needed, read only the relevant spec sections.
-   Produce a constraints list (≤12 bullets).

### 4) Implement

-   Change only what is required.
-   Prefer small, readable patches.
-   Avoid unrelated cleanup.

### 5) Verify

Run what the sub-task requires (prefer fastest):
- Rust: `cargo test` / `cargo check`
- Frontend: `pnpm test` (or `pnpm vitest`)
- Manual: `pnpm tauri dev` only when needed

If verification fails:
- Fix and re-run.
- If still stuck: stop and report "blocked" (no checkbox updates, no commit/push).

### 6) Update tasks.md

-   Mark **only the implemented sub-task** `[ ]` → `[x]`.
-   Do not reorder or rewrite other tasks.

### 7) Commit + Push on feature branch (Single Commit per Run)

Do this **only if**:
- verification succeeded, and
- `tasks.md` was updated, and
- current branch is `feature/<slug>`.

Steps:
1.  Show state:
    -   `git status`
    -   `git diff`
2.  Stage all:
    -   `git add -A`
3.  Commit (one commit for the whole run). Use a concise message:
    -   `git commit -m "<type>(<scope>): <summary>"`
    -   Examples:
        -   `feat(board): add basic dnd reorder`
        -   `test(detail): cover markdown editor`
        -   `fix(store): persist selection reliably`
4.  Push feature branch:
    -   First push: `git push -u origin feature/<slug>`
    -   Next pushes: `git push`

If there are **no staged changes**, do **not** create an empty commit.

### 8) Merge feature → dev and push dev (Must, after successful feature push)

Run:
- `git checkout dev`
- `git pull`
- `git merge --no-ff feature/<slug>`
- `git push`

Do NOT delete the feature branch (keep it on remote).

------------------------------------------------------------------------

## Output Format (Short)

-   ✔ Implemented: `<sub-task name>`
-   Topic: `<topic>`
-   Branches:
    - feature: `feature/<slug>`
    - merged into: `dev`
-   Files changed:
    -   path1
    -   path2
-   Verification:
    -   `<commands run>`
-   Git:
    - feature commit: `<hash>`
    - dev merge commit (if any): `<hash>`
    - pushes: feature + dev
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
