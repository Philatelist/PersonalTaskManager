# Product Definition: Personal Task Manager

- **Version:** 1.0
- **Status:** Proposed

---

## 1. The Big Picture (The "Why")

### 1.1. Project Vision & Purpose

To give individuals a calm, focused space to see all their goals clearly and think deeply about how to accomplish them — without the noise of team tools, automations, or cloud dependencies.

### 1.2. Target Audience

Polymaths and generalists — people who work across many domains (technical, scientific, creative, personal) and need a single place to manage all of their goals and priorities. These are individuals who think deeply about complex problems and want a tool that supports that thinking, not one that reduces everything to a checklist.

### 1.3. User Personas

- **Persona 1: "Alex the Generalist"**
  - **Role:** A knowledge worker who juggles projects across software engineering, scientific research, personal development, and creative pursuits.
  - **Goal:** Wants a single, clear overview of everything they're working on — and a way to think through complex goals rather than just track to-dos.
  - **Frustration:** Existing task managers are either too shallow (just checklists), too bloated (built for teams with endless integrations), or too fragmented (tasks get buried in nested lists and you lose the big picture). None of them help you *think*.

### 1.4. Success Metrics

- **Clarity of priorities:** The user can always tell at a glance what matters most and what to work on next.
- **Deeper thinking:** The user makes better decisions about complex goals because the AI helps them reason through approaches and trade-offs.
- **Consistent engagement:** The user returns to the tool daily because it is fast, useful, and not a chore to use.

---

## 2. The Product Experience (The "What")

### 2.1. Core Features

- **Grid-based task overview:** All active tasks are displayed as square cards in a visual grid, giving an immediate big-picture view of everything in progress.
- **Task detail view with subtasks and dependencies:** Each task can be expanded to show its full context, broken into subtasks, and linked to other tasks it depends on or enables.
- **AI-assisted chat per task:** Each task optionally includes a conversational AI partner that helps the user reason about the task — asking clarifying questions, suggesting approaches, and exploring trade-offs. The AI never changes task data automatically.
- **Priority and status management:** Tasks can be prioritized and moved through statuses, helping the user decide what to focus on and track progress.
- **Local-first storage:** All data is stored locally on the user's machine with no cloud dependency, ensuring the app is fast, private, and reliable.

### 2.2. User Journey

The user's experience follows two complementary patterns depending on the moment:

**Review, Pick, Think, Act:** The user opens the app and scans the grid to see all active tasks at a glance. They pick a task that needs attention, open its AI chat to think through next steps or unblock a decision, and then go do the work.

**Capture, Organize, Reflect:** New ideas and tasks arrive throughout the day. The user opens the app, quickly captures them as new cards, organizes priorities across the grid, and periodically reflects on progress — sometimes using the AI to step back and evaluate the bigger picture.

---

## 3. Project Boundaries

### 3.1. What's In-Scope for this Version

- Desktop application for macOS and Windows.
- Grid view of all active tasks displayed as visual cards.
- Task creation and editing with subtasks and dependencies.
- Optional AI-assisted chat per task (thinking partner mode).
- Local data storage (no cloud backend).
- Priority and status management.

### 3.2. What's Out-of-Scope (Non-Goals)

- Collaboration or multi-user functionality.
- Cloud backend or data sync across devices.
- Automatic task execution or modification by AI.
- Workflow DSL or automation engine.
- Mobile application.
- Integrations with external tools or services.
