Write a functional specification for the given topic only.

Rules
- Focus on user-visible behavior and acceptance criteria.
- Avoid implementation details and library choices (those belong in tech/architecture).
- Use MUST/SHOULD/MAY language where helpful.
- Include Given/When/Then acceptance criteria when possible.

Global invariants (apply wherever relevant)
- Single user.
- Main grid shows up to 100 square cards per page, auto-resized to fill the screen; if >100 tasks, paginate pages.
- Priority is an explicit rank/order; user can drag&drop to reorder; ranks renumber deterministically.
- Subtasks are either checkbox text OR taskRef to another task.
- Progress % is calculated dynamically from completed/total subtasks; adding/removing subtasks updates progress.
- A taskRef subtask is complete when referenced task status is Done.
- Dependencies + subtasks form a graph; cycles are allowed with warnings; enforce-blocking disabled for cyclic sets.
- Archive distinguishes Completed vs Deleted.

AI invariants (only for AI-related specs)
- AI is OFF by default per task; enabled explicitly.
- Exactly one chat thread per task; persisted locally.
- Offline: chat visible; send disabled with a clear message.
- Four modes: Personal Task Advisor, AI Manager, AI Tech Specialist, AI Coach (behavioral).
- AI never modifies task data automatically; it only proposes changes for user approval.
- Per-task context policy: send all notes/history OR summary + last N.

Deliverables
- Scope: in/out
- User stories
- Functional requirements
- Edge cases
- Acceptance criteria
