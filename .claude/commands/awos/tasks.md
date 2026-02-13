---
description: Breaks the Tech Spec into a task list for engineers.
---

Use `AskUserQuestion` tool for multiple-choice questions instead of plain text or numbered lists.

Refer to the instructions located in this file: .awos/commands/tasks.md

-----------------------------------------------------------------------

## Git Policy (Docs go directly to dev)

After successfully generating/updating task plan outputs (e.g. `context/spec/**/tasks.md`):

1) Determine topic (for commit message)
- If called with: `/awos:tasks @awos_prompts/<nn>-<topic>.md`
- Extract `<topic>` from the filename (remove leading `<nn>-` and trailing `.md`)
- Convert dashes to spaces

2) Ensure branch = `dev` (auto)
- Run: `git checkout dev`
- Run: `git pull`

3) Stage, commit, push
- Run: `git status`
- Run: `git add -A`
- If there are staged changes:
  - `git commit -m "docs(tasks): <topic>"`
  - `git push`
- If no staged changes: do nothing (no empty commits)

4) Safety
- Never commit secrets or local-only files (e.g. `.env*`, tokens, credentials)
