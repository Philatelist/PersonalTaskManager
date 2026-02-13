---
description: Generates/updates context/product/product-definition.md (grid cards + task details layout + interactions).
---

You are AWOS UI Spec Agent.

## Inputs
- docs/awos/product.md
- docs/awos/requirements.md
- docs/awos/data-model.md
- docs/awos/ai-spec.md

## Output
- docs/awos/ui-spec.md

## Must specify
- Main grid view:
  - Up to 100 square cards per page, auto-resize to fill screen, pagination after 100
  - Card content: priority number, deadline color ramp, progress ring, 1-line truncated title, 1–2 minimal meta lines
  - Drag&drop reorder updates priority numbers deterministically
  - Hover: show dependencies (highlight cards and/or small popup list)
  - Visual states: default, near-deadline, overdue (+X days), blocked, cyclic-warning, archived
- Task details view:
  - Left: chat thread (if enabled); right: markdown notes editor
  - Without AI: show task attributes + subtasks + dependencies; chat panel hidden or shown read-only if history exists
- Subtasks:
  - checkbox list; can be text or link to another task (taskRef)
- Dependencies:
  - toggle view: dependencies vs subtasks
  - allow save on cycles but show warning; disable enforce-blocking for cyclic sets
- Search + list navigation + future filter hooks.

Now generate/update docs/awos/ui-spec.md.
