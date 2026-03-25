# Functional Specification: Local Persistence + Autosave + Backups + Conflicted Copy

- **Roadmap Item:** Local-First Storage Engine
- **Status:** Approved
- **Author:** AWOS

---

## 1. Overview and Rationale (The "Why")

### 1.1. Problem

The app stores all of a user's tasks, notes, subtask progress, dependency relationships, and AI chat history entirely on their local machine — no cloud backend exists. This makes reliability of local persistence critical: a partial write, an unexpected crash, or a conflicted file from a cloud sync tool (such as iCloud or Dropbox) could silently corrupt or lose data the user can never recover from elsewhere.

### 1.2. Purpose

This feature ensures that the user's data is **always safe and recoverable** by:
- **Autosaving** every change immediately so the user never needs to remember to save.
- **Atomic writes** ensuring the stored data is always in a valid, complete state — never half-written.
- **Daily rotating backups** giving the user a safety net of recent snapshots they can fall back to.
- **Corruption detection** alerting the user at startup if the data file cannot be read, and offering recovery from a backup.
- **Conflicted copy detection** notifying the user when a cloud sync tool has created a duplicate file and giving them a clear path to resolve it without technical knowledge.

### 1.3. Success Criteria

- The user never loses data due to a crash, power failure, or partial write.
- The user always has at least several days of rolling backups available.
- If data corruption is detected on startup, the user is immediately informed and can restore a backup without technical knowledge.
- If a conflicted copy is detected, the user understands what happened and can choose how to resolve it without needing to understand file system internals.
- The user never needs to manually save their work.

---

## 2. Functional Requirements (The "What")

---

### §2.1 — Autosave: Changes Save Immediately

The app MUST save every change to task data and chat history **automatically**, with no manual save action required.

- Changes save as the user makes them (e.g., editing a task title, adding a subtask, sending a chat message).
- The user MUST NOT see a "Save" button anywhere in the task or chat editing flow.
- If a save fails, the user MUST be shown a non-blocking error notification: *"Failed to save your latest change. Your previous data is intact."*
- There is no unsaved-changes warning on close; the most recent successful save represents the user's data.

**Acceptance Criteria:**
- [ ] Given the user edits a task title, when they stop typing, their changes are persisted without any manual action.
- [ ] No "Save" button exists anywhere in the task or chat editing flow.
- [ ] Given a save error occurs, a non-blocking notification is shown; the app does not crash or freeze.
- [ ] On relaunch after an ungraceful close (simulated crash), the most recently autosaved state is present.

---

### §2.2 — Atomic Writes: Data Is Never Half-Written

Every write to the data store MUST be **atomic**: the stored data is always either the previous complete state or the new complete state — never a partial or corrupted intermediate state.

- If the app crashes or the system loses power during a write, the data file MUST remain readable and valid (representing the last successful complete save).
- The user never encounters a startup error caused solely by an incomplete write from a previous session.

**Acceptance Criteria:**
- [ ] Given the app is force-quit mid-write, when it relaunches, the data file loads successfully (it reflects either the old state or the new state — never a broken hybrid).
- [ ] The app does not show a corruption error solely because it was interrupted mid-write.

---

### §2.3 — Daily Backup Rotation

The app MUST automatically create a backup of all task and chat data **once per calendar day**, triggered by the first change made after a day boundary.

- Backups are created **silently in the background** — the user is never interrupted.
- The app retains backups for the **last 30 calendar days**. Backups older than 30 days are automatically deleted.
- Backups are stored in a dedicated backup folder inside the app's local data directory.
- The user can see how many backups are available from the **Settings** screen (count and date range only — no raw file paths or technical details required).
- The app MUST NOT create more than one backup per calendar day (duplicates are skipped).

**Acceptance Criteria:**
- [ ] After the first change on a new calendar day, a backup is created in the backup folder.
- [ ] After 30 backups exist, the oldest backup is deleted when a new one is created.
- [ ] If no changes are made on a given day, no backup is created for that day.
- [ ] The Settings screen shows the number of available backups and the date range they cover (e.g., *"14 backups — Mar 1 to Mar 14"*).
- [ ] A backup older than 30 days is automatically removed.

---

### §2.4 — Corruption Detection and Recovery

When the app starts, it MUST verify that the data file is readable and valid. If the data file is corrupted or unreadable, the app MUST NOT silently proceed — it must stop and present the user with a clear recovery path.

- **If the data file is missing** (first launch or accidental deletion): The app starts fresh with an empty task list (no error shown).
- **If the data file is corrupted** (unreadable or fails integrity check):
  - The app MUST NOT start normally. Instead it MUST show a **recovery screen** with:
    - A human-readable explanation: *"Your task data couldn't be read — the file may have been corrupted."*
    - A list of available backups (date of each backup).
    - A **"Restore from Backup"** action for each listed backup.
    - A **"Start Fresh"** option that requires explicit confirmation before proceeding.
  - Restoring from a backup replaces the corrupted data file with the selected backup and opens the normal app view.
  - Starting fresh (after confirmation) clears all data and opens a blank task list.
- **If no backups are available** and the file is corrupted: The recovery screen shows only the "Start Fresh" option with the message: *"No backups are available. You can start fresh, but your previous data cannot be recovered."*

**Acceptance Criteria:**
- [ ] Given the data file is missing on launch, the app starts normally with an empty task list and no error message.
- [ ] Given the data file is corrupted on launch, the app shows the recovery screen instead of the normal view.
- [ ] The recovery screen lists all available backups with their dates.
- [ ] Selecting "Restore from Backup" replaces the corrupted file and opens the app with that backup's data.
- [ ] Selecting "Start Fresh" requires confirmation, then clears all data and opens an empty task list.
- [ ] If no backups exist and the file is corrupted, only the "Start Fresh" option is shown with a clear message.

---

### §2.5 — Conflicted Copy Detection and Resolution

When a cloud sync tool (such as iCloud Drive, Dropbox, or OneDrive) encounters a sync conflict, it may create a "conflicted copy" file — a duplicate of the app's data file with a modified filename — in the same directory. The app MUST detect this situation and notify the user.

- On startup, the app scans its data directory for any files that appear to be conflicted copies (files with naming patterns indicating a sync conflict — e.g., filenames containing "conflicted copy", "conflict", or similar cloud-sync markers).
- If a conflicted copy is found, the app MUST show a **conflict notification banner** at the top of the main screen (non-blocking — the app still opens normally with the primary data file):
  - Message: *"A conflicted copy of your data was found. This was likely created by your cloud sync tool. Review and resolve the conflict."*
  - A **"Resolve Conflict"** button opens the conflict resolution screen.
- The **conflict resolution screen** shows:
  - The **current file** (what the app is using): last-modified date and task count.
  - The **conflicted copy**: last-modified date and task count.
  - Two options: **"Keep Current"** and **"Use Conflicted Copy"**.
  - A notice: *"The version you don't choose will be saved as a backup before it is discarded."*
- After the user resolves the conflict, the notification banner disappears and the conflict file is removed (the discarded version is saved as a dated backup so no data is permanently lost).
- If the user dismisses or ignores the banner without resolving, it reappears on the next app launch as long as the conflicted file exists.

**Acceptance Criteria:**
- [ ] Given a conflicted copy file exists in the data directory on launch, the app opens normally with the primary file AND shows the conflict notification banner.
- [ ] The conflict notification banner is visible but non-blocking — the user can use the app without resolving immediately.
- [ ] Clicking "Resolve Conflict" opens the conflict resolution screen showing both versions with last-modified date and task count.
- [ ] Choosing "Keep Current" removes the conflicted file (saving it as a backup) and dismisses the banner.
- [ ] Choosing "Use Conflicted Copy" replaces the current file with the conflicted copy (saving the current as a backup) and reloads the app with the new data.
- [ ] After resolution, the conflict notification banner no longer appears on subsequent launches.
- [ ] If the banner is dismissed without resolving, it reappears on the next launch while the conflicted file still exists.
- [ ] The discarded version is always saved as a dated backup before being removed.

---

### §2.6 — Data Storage Location Visibility

The user SHOULD be able to find their data without technical assistance.

- The app's data directory path is shown in **Settings** in a human-readable format.
- A **"Show in Finder"** (macOS) / **"Show in Explorer"** (Windows) button opens the data folder directly.
- The backup folder location is also shown in Settings.

**Acceptance Criteria:**
- [ ] The Settings screen shows the path to the data directory in a readable format.
- [ ] Clicking "Show in Finder" / "Show in Explorer" opens the correct directory.
- [ ] The backup folder path is also visible in Settings.

---

## 3. Scope and Boundaries

### In-Scope

- Autosave of all task data and AI chat threads on every change (no manual save).
- Atomic write behaviour (data always in a valid, complete state after interrupted writes).
- Daily backup rotation: one backup per calendar day; 30-day retention; automatic pruning of older backups.
- Backup count and date range display in Settings.
- Data directory and backup folder path display in Settings with "Show in Finder/Explorer".
- Corruption detection at startup with recovery screen (restore from backup or start fresh).
- Conflicted copy detection and conflict resolution screen.
- Saving the discarded version as a backup during conflict resolution.

### Out-of-Scope

- Cloud sync or multi-device data sync (explicitly not in scope for this app).
- Manual save action.
- User-initiated export or import of raw data files.
- Encryption of local data files.
- Automatic repair of corrupted files (detection and recovery only; no reconstruction).
- Undo history or version diffing beyond backup restore.
- AI response behavior, prompt logic, and modes (separate roadmap item; only chat message persistence is covered here).
