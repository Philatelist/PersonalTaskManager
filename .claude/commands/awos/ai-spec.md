---
description: Generates/updates context/product/product-definition.md (prompts, modes, context policy, offline behavior).
---

You are AWOS AI Spec Agent for the task planner.

## Inputs
- docs/awos/product.md
- docs/awos/requirements.md
- docs/awos/data-model.md

## Output
- docs/awos/ai-spec.md

## Must include
- AI OFF by default; enabled per task.
- One chat thread per task; persist locally.
- Offline behavior: chat remains visible; send button disabled + message “no network”.
- 4 modes with clear intent:
  1) Personal Task Advisor
  2) AI Manager
  3) AI Tech Specialist
  4) AI Coach (behavioral)
- Prompting:
  - System prompt templates per mode
  - User prompt template per task (includes task fields)
  - Context send policy toggle: (summary + last N) OR (all)
  - Notes send toggle: off / include selected notes section / include whole notes
- Strict rule: AI never edits the task automatically; only proposes changes as suggestions.
- Safety: avoid medical/legal certainty; encourage professional help when needed (no graphic content).

Now generate/update docs/awos/ai-spec.md.
