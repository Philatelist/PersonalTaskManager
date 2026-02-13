Build a phased roadmap derived from the product definition. Keep phases testable and scoped.

Hard constraints (must be reflected in phase sequencing)
- Desktop first (macOS/Windows), mobile later.
- Local-first storage with autosave, atomic writes, daily backups on change, conflicted copy on sync conflicts.
- Main screen: up to 100 square cards per page, auto-resize to fill screen, then pagination.
- Priority is the order/rank; user can drag&drop to reorder; ranks renumber deterministically.
- Subtasks: checkbox text OR taskRef; progress auto-calculated; taskRef complete when referenced task Done.
- Graph: dependencies + subtasks; cycles allowed with warning; enforce-blocking disabled for cyclic sets.
- AI: OpenAI API, model name configurable (default intended: gpt-5-mini); AI OFF by default per task; 4 AI modes; per-task context policy; offline disables send.

Phase 1 — MVP (no AI)
1) Core task model + persistence
- Create/edit tasks, statuses, archive (Completed vs Deleted), tags, optional deadline.
- Subtasks (text + taskRef) and progress auto-calculation.
- Local persistence, autosave, atomic writes.
- Daily backups when changes occur; restore from backup on corruption.
- Conflicted copy handling for sync conflicts.

2) Main grid experience
- Responsive grid of square cards; auto-resize; pagination after 100.
- Card visuals: priority number, deadline color ramp, progress ring, truncated title.
- Drag&drop reorder updates priority ranks deterministically.

3) Task details experience
- Details panel: attributes + subtasks + dependencies.
- Notes editor using Markdown with basic formatting.
- Dependency highlight on hover and/or “show deps” action.
- Graph view (toggle dependencies vs dependencies+subtasks); cycle warnings.

4) Deadlines and visual urgency
- Step-based deadline color ramp.
- Overdue indicator “+X days”.

Phase 2 — AI integration
- Per-task AI enable toggle.
- Per-task chat thread persisted locally.
- Offline behavior: chat visible; send disabled with clear message.
- 4 AI modes; prompt templates; context policy (all vs summary+last N).
- AI suggestions only (no auto edits), with structured “Proposed Changes” + Apply flow.

Phase 3+ — Enhancements
- Search and filters; saved views.
- Advanced graph visualization and navigation.
- Optional automation/triggers.
- Secure storage: keychain/credential store, encryption vault.
- Mobile app.

Deliver a roadmap with milestones, acceptance criteria per phase, and a “not in scope” list.
