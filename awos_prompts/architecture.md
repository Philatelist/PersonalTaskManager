Define a pragmatic architecture aligned with the product and roadmap (desktop-first, local-first, optional AI).

Confirmed stack (v1)
- Desktop: Tauri + React + TypeScript.
- Graph visualization: React Flow (or equivalent) for dependency/subtask graphs.
- Notes: Markdown editor (basic formatting, lists).

Core components
1) UI layer
- Grid view: 100 cards/page, responsive sizing, pagination, drag&drop reorder.
- Task detail view: attributes, subtasks, dependencies, notes; optional AI chat panel; graph panel with toggle.

2) State & domain layer
- Task domain model (Task, Subtask, DependencyEdge).
- Derived state: progress %, blocked/unblocked, overdue days, deadline urgency color.
- Deterministic priority reorder algorithm (drag&drop renumber).

3) Persistence layer (local-first)
- Data files: tasks store + per-task chat logs + attachments.
- Autosave with debounced writes + atomic write pattern (write temp, fsync, rename).
- Corruption protection: validate on load; on failure restore from latest backup.
- Backups: at most 1 per day when changes occur (rotate by date).
- Sync conflicts: detect concurrent edits (etag/hash/mtime). If conflict, create “conflicted copy” and notify.

4) AI gateway (Phase 2)
- OpenAI API client; model name configurable (default intended gpt-5-mini).
- API key in config for v1 (migrate to secure store later).
- Per-task AI config: enabled, mode, context policy (all vs summary+last N).
- Offline handling: network failures disable send; UI shows message; chat remains readable.
- Contract: AI never mutates tasks directly; only returns suggestions + optional structured proposed changes for user approval.

Graph & cycles
- Represent dependencies and subtasks as labeled edges.
- Cycle detection; allow saving cycles but show warning.
- Enforce-blocking rules disabled for tasks involved in cycles (still show informational dependency links).

Non-goals (v1)
- No server backend
- No multi-user auth
- No encryption/password vault
