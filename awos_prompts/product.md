Project: Personal Thinking-Oriented Task Manager with Optional AI Chats

Core purpose
- A single-user task manager designed to help me think clearly about how to accomplish tasks and goals, not just to track completion.
- The core problem it solves is clarity: understanding what needs to be done, in what order, and how to approach a task thoughtfully.

Audience
- One user (me). No collaboration. Desktop-first (macOS/Windows), mobile later.

What makes it different
- The main screen is a calm, dense overview of tasks as square cards in a responsive grid.
- Up to 100 square cards are shown per page; cards automatically resize to fill the screen; when more than 100 tasks exist, the UI paginates (page 1, page 2, ...).
- Each task card is minimal but informative: priority rank number, deadline status color, a tiny progress ring, and a single truncated title line.

Task model highlights (product-level)
- Tasks have: title, description/goal, priority rank, status, progress %, optional deadline, tags.
- Tasks have subtasks with checkboxes; subtasks can be plain text OR a reference to another task (“taskRef”).
- A taskRef subtask is considered complete when the referenced task is Done.
- Tasks can depend on other tasks (dependencies). Dependencies and subtasks form a graph; cycles are allowed with warnings.

AI philosophy
- AI is OFF by default per task.
- When enabled, each task has exactly one AI chat thread.
- AI is a thinking partner, not an autonomous manager. It helps reason, plan, reflect, and suggest approaches.
- AI never modifies task data automatically; it only proposes changes that the user may apply.
- AI supports four modes:
  1) Personal Task Advisor (default)
  2) AI Manager
  3) AI Tech Specialist
  4) AI Coach (behavioral)
- Each task controls how much context is sent to AI: all notes/history OR summary + last N items/messages.

Reliability and local-first boundaries
- Local-first: tasks and chats persist locally and survive restarts.
- Autosave with corruption protection (atomic writes).
- Daily backups when changes occur.
- Sync conflicts create a conflicted copy rather than overwriting data.

Out of scope for v1
- Collaboration / multi-user
- Server backend / cloud sync service (iCloud folder sync is user-managed and may cause conflicts)
- Automation/triggers (e.g., Telegram notifications)
- Mobile app
- Encryption/passwords and secure credential storage (future)
