Create technical guidance for implementing the selected functional spec topic, consistent with the architecture.

Constraints
- Desktop: Tauri + React + TypeScript.
- Local-first persistence with autosave, atomic writes, daily backups on change, conflicted copy on sync conflict.
- Graph visualization via a client-side graph library (e.g., React Flow).
- Markdown notes editor.
- AI specs use OpenAI API (model configurable; default intended gpt-5-mini).

Include
- Data contracts (types and file formats) relevant to the spec topic.
- Clear boundaries between UI, domain, persistence, and (if relevant) AI gateway.
- Error handling and edge cases (corruption recovery, conflict handling, large chat logs).
- Token/context management for AI (summary + last N; truncation strategy).
- Security notes (API key in config for v1; migrate to secure store later).

Do NOT include full code; provide pseudocode or structured descriptions where helpful.
