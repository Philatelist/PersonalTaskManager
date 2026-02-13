# AWOS Topic Prompt: AI Offline / Network Failure Handling

This single file is intended to be used sequentially with AWOS standard commands:

- `/awos:spec  @awos_prompts/10-ai-offline--network-failure-handling.md`
- `/awos:tech  @awos_prompts/10-ai-offline--network-failure-handling.md`
- `/awos:tasks @awos_prompts/10-ai-offline--network-failure-handling.md`

## Topic
AI Offline / Network Failure Handling

## Scope (what this topic covers)
When offline: chat remains visible; sending disabled; clear message; retry behavior; error states; do not lose drafts; safe handling of API errors/timeouts.

## Out of scope (for this topic)
Keychain/secure storage (future), advanced observability.

## Command-specific instructions

### If you are running `/awos:spec`
Write a functional specification for **this topic only**.
- Focus on user-visible behavior and acceptance criteria.
- Avoid implementation details and library choices (those belong to tech/architecture).
- Use MUST/SHOULD/MAY where helpful.
- Include: user stories, functional requirements, edge cases, acceptance criteria (Given/When/Then when possible).

### If you are running `/awos:tech`
Write technical guidance for implementing **this topic**, consistent with the architecture:
- Desktop: Tauri + React + TypeScript.
- Local-first persistence with autosave, atomic writes, daily backups, conflicted copy.
- If graphs are involved: React Flow (or equivalent).
- If notes are involved: Markdown editor (basic formatting).
- If AI is involved: OpenAI API (model configurable; default intended gpt-5-mini).
Include: data contracts/types, module boundaries, error handling, risks & mitigations.
Do NOT output full code; use structured descriptions/pseudocode.

### If you are running `/awos:tasks`
Generate development tasks as **vertical slices** for this topic.
Rules:
- Each task delivers visible user value.
- Keep the app runnable after each slice.
- Include verification steps per task.
- Reference acceptance criteria from the spec.
Cover topic-specific edge cases explicitly.

## Global invariants
Global invariants (apply wherever relevant)
- Single user.
- Main grid shows up to 100 square cards per page, auto-resized to fill the screen; if >100 tasks, paginate pages.
- Priority is an explicit rank/order; user can drag&drop to reorder; ranks renumber deterministically.
- Subtasks are either checkbox text OR taskRef to another task.
- Progress % is calculated dynamically from completed/total subtasks; adding/removing subtasks updates progress.
- A taskRef subtask is complete when referenced task status is Done.
- Dependencies + subtasks form a graph; cycles are allowed with warnings; enforce-blocking disabled for cyclic sets.
- Archive distinguishes Completed vs Deleted.
- Local-first persistence: autosave with atomic writes; daily backups on change; conflicted copy on sync conflict.

AI invariants (only for AI-related topics)
- AI is OFF by default per task; enabled explicitly.
- Exactly one chat thread per task; persisted locally.
- Offline: chat visible; send disabled with a clear message.
- Four modes: Personal Task Advisor, AI Manager, AI Tech Specialist, AI Coach (behavioral).
- AI never modifies task data automatically; it only proposes changes for user approval.
- Per-task context policy: send all notes/history OR summary + last N.
