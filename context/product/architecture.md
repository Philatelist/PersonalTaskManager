# System Architecture Overview: Personal Task Manager

---

## 1. Application & Technology Stack

- **Desktop Framework:** Tauri v2 — Rust-based shell providing native OS integration for macOS and Windows. Lightweight (~5MB bundle), fast startup, and built-in security model. The Rust backend handles file system access, database operations, and system-level APIs.
- **Frontend Framework:** React 18 with TypeScript — Component-based UI running inside Tauri's webview. Handles the grid layout, task cards, detail views, and all user interactions.
- **Build Tool:** Vite — Fast dev server and bundler, natively supported by Tauri. Provides hot module replacement for rapid frontend development.
- **Styling:** CSS Modules or Tailwind CSS — Scoped, maintainable styling for the component-based UI.

---

## 2. Data & Persistence

- **Primary Database:** SQLite — Embedded, single-file SQL database accessed from the Tauri Rust backend. Handles all structured data: tasks, subtasks, dependencies, priorities, statuses, and AI conversation history.
- **Schema Migrations:** Embedded Rust migrations — Versioned SQL migrations executed on app startup from the Rust backend. Ensures the database schema stays in sync with each app version.
- **Data Location:** User's local app data directory (platform-specific: `~/Library/Application Support/` on macOS, `%APPDATA%` on Windows). Managed via Tauri's path API.

---

## 3. Infrastructure & Distribution

- **Packaging:** Tauri built-in bundler — Produces `.dmg` for macOS and `.msi`/`.exe` for Windows. No additional packaging tools required.
- **Auto-Updates:** Tauri Updater plugin — Built-in update mechanism for distributing new versions to users.
- **CI/CD:** None for now — Local builds during early development. GitHub Actions to be added later when the project stabilizes.
- **Version Control:** Git with GitHub — Source code hosting and release management.

---

## 4. AI Integration (Phase 3)

- **AI Provider:** OpenAI GPT API — Powers the per-task thinking partner chat. API calls made from the Tauri Rust backend to keep the API key secure and out of the frontend.
- **Chat Storage:** SQLite — Conversation messages stored in the same local database as task data, linked by task ID. Enables easy backup and consistent data management.
- **API Key Management:** Stored securely in the OS keychain via Tauri's secure storage plugin. Never hardcoded or stored in plain text.

---

## 5. Developer Experience & Tooling

- **Package Manager:** pnpm — Fast, disk-efficient, strict dependency resolution for the frontend.
- **Testing:** Vitest + React Testing Library — Vite-native test runner for unit and component tests. Fast execution with native TypeScript support.
- **Linting & Formatting:** ESLint + Prettier — Standard TypeScript/React linting and consistent code formatting.
- **Rust Tooling:** Cargo (Rust's built-in package manager and build tool) — Manages Rust dependencies and builds the Tauri backend.
