# Product Roadmap: Personal Task Manager

_This roadmap outlines our strategic direction based on user needs and product goals. It focuses on the "what" and "why," not the technical "how."_

---

### Phase 1

_The highest priority features that form the core foundation of the product._

- [ ] **Local Data & App Shell**
  - [ ] **Local-First Storage Engine:** Implement a reliable, local data persistence layer so all task data is stored on the user's machine with no cloud dependency — ensuring speed, privacy, and reliability.
  - [ ] **Application Shell & Navigation:** Deliver the core desktop application window for macOS and Windows with basic navigation and layout structure.

- [ ] **Task Management Core**
  - [ ] **Task Creation & Editing:** Allow the user to create, edit, and delete tasks with a title, description, priority level, and status.
  - [x] **Grid-Based Task Overview:** Display all active tasks as square visual cards arranged in a grid layout, giving the user an immediate big-picture view of everything in progress.

---

### Phase 2

_Once the foundational features are complete, we will add structure, relationships, and richer task management._

- [ ] **Task Detail View**
  - [ ] **Expanded Task View:** Provide a detailed view for a single task showing its full context, description, and metadata — accessible by selecting a card from the grid.
  - [ ] **Subtasks:** Enable the user to break a task into smaller steps within the detail view, supporting structured planning for complex goals.

- [ ] **Task Relationships & Organization**
  - [ ] **Task Dependencies:** Allow the user to link tasks to each other with "blocks" and "blocked-by" relationships, making it clear which tasks must be completed first.
  - [ ] **Priority & Status Management:** Add filtering, sorting, and visual indicators on the grid so the user can quickly identify what matters most and track progress across all tasks.

---

### Phase 3

_Features that bring AI-assisted thinking into the product, completing the core vision._

- [ ] **AI-Assisted Thinking Partner**
  - [ ] **AI Chat Per Task:** Add an optional conversational AI assistant scoped to each individual task's context, accessible from the task detail view.
  - [ ] **Thinking Partner Mode:** The AI helps the user reason about the task — asking clarifying questions, suggesting approaches, and exploring trade-offs. The AI never changes task data automatically.
  - [ ] **Conversation History:** Persist AI chat history locally alongside task data so the user can revisit previous reasoning and decisions.
