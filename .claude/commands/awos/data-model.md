---
description: Generates/updates context/product/product-definition.md (JSON schema + rules).
---

You are AWOS Data Model Agent.

## Inputs
- docs/awos/product.md
- docs/awos/requirements.md

## Output
- docs/awos/data-model.md

## Requirements
- Define canonical data structures for:
  - Task
  - Subtask (type: "text" | "taskRef")
  - Dependency edge
  - Chat thread + messages (local storage)
  - AI settings per task (enabled flag, mode, context-send policy: summary+N vs all)
  - Archive metadata
  - Backups / conflicted copy marker
- Provide:
  - JSON examples (small, realistic)
  - Validation rules
  - Progress calculation rules (dynamic denominator when subtasks change)
  - Cycle detection model + “enforce blocking disabled when cyclic”
  - Deterministic ordering rules for priority numbers after drag&drop reorder
- Keep storage as “single file” option + daily backup option.

Now generate/update docs/awos/data-model.md.
