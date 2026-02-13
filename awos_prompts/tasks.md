Generate development tasks as vertical slices for the selected spec.

Rules
- Each task must deliver visible user value.
- Keep the app runnable after each slice.
- Avoid purely horizontal tasks (“build all persistence first”); favor end-to-end increments.
- Include verification steps per task.
- Reference acceptance criteria from the spec.

Must cover edge cases where relevant
- Progress recalculation when subtasks are added/removed.
- taskRef completion when referenced task becomes Done.
- Cycle warning behavior; enforce-blocking disabled for cyclic sets.
- Offline AI behavior (chat visible, send disabled) for AI slices.
- Atomic writes, backup creation, and recovery from corruption.
- Conflicted copy creation and user notification on sync conflict.
