use rusqlite::Connection;
use std::path::Path;

/// A named migration: a unique name and the SQL to execute.
struct Migration {
    name: &'static str,
    sql: &'static str,
}

/// All migrations, in order. New migrations should be appended to this list.
const MIGRATIONS: &[Migration] = &[
    Migration {
        name: "001_create_tasks_table",
        sql: "
            CREATE TABLE IF NOT EXISTS tasks (
                id          TEXT PRIMARY KEY NOT NULL,
                title       TEXT NOT NULL CHECK(title != ''),
                description TEXT,
                priority_rank TEXT NOT NULL,
                status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'done', 'deleted')),
                due_date    TEXT,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );
        ",
    },
    Migration {
        name: "002_create_task_tags_table",
        sql: "
            CREATE TABLE IF NOT EXISTS task_tags (
                id       TEXT PRIMARY KEY NOT NULL,
                task_id  TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                tag      TEXT NOT NULL,
                UNIQUE(task_id, tag)
            );
            CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag);
        ",
    },
    Migration {
        name: "003_create_subtasks_table",
        sql: "
            CREATE TABLE IF NOT EXISTS subtasks (
                id          TEXT PRIMARY KEY NOT NULL,
                task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                type        TEXT NOT NULL CHECK(type IN ('checklist', 'taskref')),
                label       TEXT,
                is_done     INTEGER,
                ref_task_id TEXT REFERENCES tasks(id) ON DELETE NO ACTION,
                sort_order  INTEGER NOT NULL,
                created_at  TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
        ",
    },
];

/// Runs all pending migrations against the database.
///
/// On first call this creates a `_migrations` tracking table, then iterates
/// through every entry in [`MIGRATIONS`]. Migrations that have already been
/// recorded are skipped; new ones are executed inside a transaction and
/// recorded in `_migrations`.
pub fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Ensure the migration-tracking table exists.
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            name       TEXT PRIMARY KEY NOT NULL,
            applied_at TEXT NOT NULL
        );"
    )?;

    for migration in MIGRATIONS {
        // Check whether this migration has already been applied.
        let already_applied: bool = conn.query_row(
            "SELECT COUNT(*) FROM _migrations WHERE name = ?1",
            [migration.name],
            |row| {
                let count: i64 = row.get(0)?;
                Ok(count > 0)
            },
        )?;

        if already_applied {
            continue;
        }

        // Run the migration inside a transaction.
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(migration.sql)?;
        tx.execute(
            "INSERT INTO _migrations (name, applied_at) VALUES (?1, datetime('now'))",
            [migration.name],
        )?;
        tx.commit()?;
    }

    Ok(())
}

/// Opens (or creates) the SQLite database at `{app_data_dir}/ptm.sqlite` and
/// configures the connection with the required pragmas:
///   - `foreign_keys = ON`  -- enforce FK constraints
///   - `journal_mode = WAL` -- write-ahead logging for better concurrency
///
/// After setting pragmas, runs all pending migrations.
///
/// Returns the ready-to-use `Connection` or an error.
pub fn initialize(app_data_dir: &Path) -> Result<Connection, rusqlite::Error> {
    let db_path = app_data_dir.join("ptm.sqlite");
    let conn = Connection::open(&db_path)?;

    // Enforce foreign-key constraints on every connection.
    conn.pragma_update(None, "foreign_keys", "ON")?;

    // Enable WAL mode for better concurrent read/write performance.
    conn.pragma_update(None, "journal_mode", "wal")?;

    // Run all pending database migrations.
    run_migrations(&conn)?;

    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_initialize_creates_db_and_sets_pragmas() {
        let dir = tempdir().expect("failed to create temp dir");
        let conn = initialize(dir.path()).expect("failed to initialize db");

        // Verify foreign_keys is ON
        let fk: bool = conn
            .pragma_query_value(None, "foreign_keys", |row| row.get(0))
            .expect("failed to query foreign_keys pragma");
        assert!(fk, "foreign_keys should be ON");

        // Verify journal_mode is WAL
        let journal_mode: String = conn
            .pragma_query_value(None, "journal_mode", |row| row.get(0))
            .expect("failed to query journal_mode pragma");
        assert_eq!(
            journal_mode.to_lowercase(),
            "wal",
            "journal_mode should be WAL"
        );

        // Verify the file was created
        let db_file = dir.path().join("ptm.sqlite");
        assert!(db_file.exists(), "ptm.sqlite should exist on disk");
    }

    #[test]
    fn test_tasks_table_exists_after_initialization() {
        let dir = tempdir().expect("failed to create temp dir");
        let conn = initialize(dir.path()).expect("failed to initialize db");

        // Query sqlite_master to verify the tasks table was created.
        let table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'tasks'",
                [],
                |row| {
                    let count: i64 = row.get(0)?;
                    Ok(count > 0)
                },
            )
            .expect("failed to query sqlite_master for tasks table");

        assert!(table_exists, "tasks table should exist after initialization");
    }

    #[test]
    fn test_migrations_table_tracks_applied_migration() {
        let dir = tempdir().expect("failed to create temp dir");
        let conn = initialize(dir.path()).expect("failed to initialize db");

        // Verify the _migrations table exists.
        let migrations_table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '_migrations'",
                [],
                |row| {
                    let count: i64 = row.get(0)?;
                    Ok(count > 0)
                },
            )
            .expect("failed to query sqlite_master for _migrations table");
        assert!(
            migrations_table_exists,
            "_migrations table should exist after initialization"
        );

        // Verify the 001_create_tasks_table migration was recorded.
        let migration_recorded: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM _migrations WHERE name = '001_create_tasks_table'",
                [],
                |row| {
                    let count: i64 = row.get(0)?;
                    Ok(count > 0)
                },
            )
            .expect("failed to query _migrations for 001_create_tasks_table");
        assert!(
            migration_recorded,
            "001_create_tasks_table should be recorded in _migrations"
        );
    }

    #[test]
    fn test_initialize_is_idempotent() {
        let dir = tempdir().expect("failed to create temp dir");

        // First initialization.
        let conn1 = initialize(dir.path()).expect("first initialize failed");

        // Insert a test row to verify data survives the second initialization.
        conn1
            .execute(
                "INSERT INTO tasks (id, title, priority_rank, status, created_at, updated_at)
                 VALUES ('test-uuid', 'Test Task', 'a0', 'active', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
                [],
            )
            .expect("failed to insert test row");
        drop(conn1);

        // Second initialization — must not fail and must not lose data.
        let conn2 = initialize(dir.path()).expect("second initialize failed");

        // Migration should still be recorded exactly once.
        let migration_count: i64 = conn2
            .query_row(
                "SELECT COUNT(*) FROM _migrations WHERE name = '001_create_tasks_table'",
                [],
                |row| row.get(0),
            )
            .expect("failed to count migrations");
        assert_eq!(
            migration_count, 1,
            "migration should be recorded exactly once after two initializations"
        );

        // Verify the test row still exists.
        let task_count: i64 = conn2
            .query_row("SELECT COUNT(*) FROM tasks WHERE id = 'test-uuid'", [], |row| {
                row.get(0)
            })
            .expect("failed to count tasks");
        assert_eq!(task_count, 1, "test row should survive second initialization");
    }

    #[test]
    fn test_tasks_table_columns_and_constraints() {
        let dir = tempdir().expect("failed to create temp dir");
        let conn = initialize(dir.path()).expect("failed to initialize db");

        // Verify all expected columns exist via PRAGMA table_info.
        let mut stmt = conn
            .prepare("PRAGMA table_info(tasks)")
            .expect("failed to prepare PRAGMA table_info");
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .expect("failed to query table_info")
            .filter_map(|r| r.ok())
            .collect();

        let expected_columns = [
            "id",
            "title",
            "description",
            "priority_rank",
            "status",
            "due_date",
            "created_at",
            "updated_at",
        ];
        for col in &expected_columns {
            assert!(
                columns.contains(&col.to_string()),
                "tasks table should have column '{}'",
                col
            );
        }

        // Verify default status is 'active' — insert a row omitting status.
        conn.execute(
            "INSERT INTO tasks (id, title, priority_rank, created_at, updated_at)
             VALUES ('default-status-test', 'Test', 'a0', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            [],
        )
        .expect("failed to insert row without explicit status");

        let status: String = conn
            .query_row(
                "SELECT status FROM tasks WHERE id = 'default-status-test'",
                [],
                |row| row.get(0),
            )
            .expect("failed to read default status");
        assert_eq!(status, "active", "default status should be 'active'");

        // Verify CHECK constraint on status — invalid value should fail.
        let bad_status = conn.execute(
            "INSERT INTO tasks (id, title, priority_rank, status, created_at, updated_at)
             VALUES ('bad-status', 'Test', 'a0', 'invalid', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            [],
        );
        assert!(
            bad_status.is_err(),
            "inserting an invalid status should fail"
        );

        // Verify CHECK constraint on title — empty string should fail.
        let empty_title = conn.execute(
            "INSERT INTO tasks (id, title, priority_rank, status, created_at, updated_at)
             VALUES ('empty-title', '', 'a0', 'active', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            [],
        );
        assert!(
            empty_title.is_err(),
            "inserting an empty title should fail"
        );
    }

    #[test]
    fn test_task_tags_table_exists_after_initialization() {
        let dir = tempdir().expect("failed to create temp dir");
        let conn = initialize(dir.path()).expect("failed to initialize db");

        // Query sqlite_master to verify the task_tags table was created.
        let table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'task_tags'",
                [],
                |row| {
                    let count: i64 = row.get(0)?;
                    Ok(count > 0)
                },
            )
            .expect("failed to query sqlite_master for task_tags table");

        assert!(
            table_exists,
            "task_tags table should exist after initialization"
        );

        // Also verify the index on tag was created.
        let index_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_task_tags_tag'",
                [],
                |row| {
                    let count: i64 = row.get(0)?;
                    Ok(count > 0)
                },
            )
            .expect("failed to query sqlite_master for idx_task_tags_tag index");

        assert!(
            index_exists,
            "idx_task_tags_tag index should exist after initialization"
        );
    }

    #[test]
    fn test_task_tags_unique_constraint() {
        let dir = tempdir().expect("failed to create temp dir");
        let conn = initialize(dir.path()).expect("failed to initialize db");

        // Insert a task to reference.
        conn.execute(
            "INSERT INTO tasks (id, title, priority_rank, status, created_at, updated_at)
             VALUES ('task-1', 'Test Task', 'a0', 'active', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            [],
        )
        .expect("failed to insert task");

        // Insert first tag for the task.
        conn.execute(
            "INSERT INTO task_tags (id, task_id, tag) VALUES ('tag-1', 'task-1', 'urgent')",
            [],
        )
        .expect("failed to insert first tag");

        // Insert a different tag for the same task — should succeed.
        conn.execute(
            "INSERT INTO task_tags (id, task_id, tag) VALUES ('tag-2', 'task-1', 'work')",
            [],
        )
        .expect("failed to insert second tag");

        // Insert a duplicate (same task_id + tag) — should fail due to UNIQUE constraint.
        let duplicate = conn.execute(
            "INSERT INTO task_tags (id, task_id, tag) VALUES ('tag-3', 'task-1', 'urgent')",
            [],
        );
        assert!(
            duplicate.is_err(),
            "inserting a duplicate task_id + tag pair should fail"
        );
    }

    #[test]
    fn test_task_tags_cascade_delete() {
        let dir = tempdir().expect("failed to create temp dir");
        let conn = initialize(dir.path()).expect("failed to initialize db");

        // Insert a task.
        conn.execute(
            "INSERT INTO tasks (id, title, priority_rank, status, created_at, updated_at)
             VALUES ('task-cascade', 'Cascade Test', 'a0', 'active', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            [],
        )
        .expect("failed to insert task");

        // Insert a tag for that task.
        conn.execute(
            "INSERT INTO task_tags (id, task_id, tag) VALUES ('tag-cascade', 'task-cascade', 'important')",
            [],
        )
        .expect("failed to insert tag");

        // Verify the tag exists.
        let tag_count_before: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM task_tags WHERE task_id = 'task-cascade'",
                [],
                |row| row.get(0),
            )
            .expect("failed to count tags before delete");
        assert_eq!(tag_count_before, 1, "tag should exist before task deletion");

        // Hard-delete the task.
        conn.execute("DELETE FROM tasks WHERE id = 'task-cascade'", [])
            .expect("failed to delete task");

        // Verify the tag was cascade-deleted.
        let tag_count_after: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM task_tags WHERE task_id = 'task-cascade'",
                [],
                |row| row.get(0),
            )
            .expect("failed to count tags after delete");
        assert_eq!(
            tag_count_after, 0,
            "tag should be cascade-deleted when task is deleted"
        );
    }

    #[test]
    fn test_subtasks_table_exists_after_initialization() {
        let dir = tempdir().expect("failed to create temp dir");
        let conn = initialize(dir.path()).expect("failed to initialize db");

        // Verify the subtasks table was created.
        let table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'subtasks'",
                [],
                |row| {
                    let count: i64 = row.get(0)?;
                    Ok(count > 0)
                },
            )
            .expect("failed to query sqlite_master for subtasks table");

        assert!(
            table_exists,
            "subtasks table should exist after initialization"
        );

        // Verify the index on task_id was created.
        let index_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_subtasks_task_id'",
                [],
                |row| {
                    let count: i64 = row.get(0)?;
                    Ok(count > 0)
                },
            )
            .expect("failed to query sqlite_master for idx_subtasks_task_id index");

        assert!(
            index_exists,
            "idx_subtasks_task_id index should exist after initialization"
        );
    }

    #[test]
    fn test_subtasks_type_check_constraint() {
        let dir = tempdir().expect("failed to create temp dir");
        let conn = initialize(dir.path()).expect("failed to initialize db");

        // Insert a parent task.
        conn.execute(
            "INSERT INTO tasks (id, title, priority_rank, status, created_at, updated_at)
             VALUES ('task-type-check', 'Type Check Task', 'a0', 'active', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            [],
        )
        .expect("failed to insert task");

        // Insert a subtask with valid type "checklist" — should succeed.
        conn.execute(
            "INSERT INTO subtasks (id, task_id, type, label, is_done, sort_order, created_at)
             VALUES ('sub-valid', 'task-type-check', 'checklist', 'Step 1', 0, 1, '2025-01-01T00:00:00Z')",
            [],
        )
        .expect("failed to insert subtask with valid type 'checklist'");

        // Insert a subtask with invalid type — should fail.
        let bad_type = conn.execute(
            "INSERT INTO subtasks (id, task_id, type, label, is_done, sort_order, created_at)
             VALUES ('sub-invalid', 'task-type-check', 'invalid', 'Bad', 0, 2, '2025-01-01T00:00:00Z')",
            [],
        );
        assert!(
            bad_type.is_err(),
            "inserting a subtask with an invalid type should fail"
        );
    }

    #[test]
    fn test_subtasks_cascade_on_parent_delete() {
        let dir = tempdir().expect("failed to create temp dir");
        let conn = initialize(dir.path()).expect("failed to initialize db");

        // Insert a parent task.
        conn.execute(
            "INSERT INTO tasks (id, title, priority_rank, status, created_at, updated_at)
             VALUES ('task-cascade-sub', 'Cascade Sub Task', 'a0', 'active', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            [],
        )
        .expect("failed to insert task");

        // Insert a subtask for that task.
        conn.execute(
            "INSERT INTO subtasks (id, task_id, type, label, is_done, sort_order, created_at)
             VALUES ('sub-cascade', 'task-cascade-sub', 'checklist', 'Step 1', 0, 1, '2025-01-01T00:00:00Z')",
            [],
        )
        .expect("failed to insert subtask");

        // Verify the subtask exists.
        let count_before: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM subtasks WHERE task_id = 'task-cascade-sub'",
                [],
                |row| row.get(0),
            )
            .expect("failed to count subtasks before delete");
        assert_eq!(count_before, 1, "subtask should exist before task deletion");

        // Hard-delete the parent task.
        conn.execute("DELETE FROM tasks WHERE id = 'task-cascade-sub'", [])
            .expect("failed to delete task");

        // Verify the subtask was cascade-deleted.
        let count_after: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM subtasks WHERE task_id = 'task-cascade-sub'",
                [],
                |row| row.get(0),
            )
            .expect("failed to count subtasks after delete");
        assert_eq!(
            count_after, 0,
            "subtask should be cascade-deleted when parent task is deleted"
        );
    }

    #[test]
    fn test_subtasks_ref_task_id_no_action() {
        let dir = tempdir().expect("failed to create temp dir");
        let conn = initialize(dir.path()).expect("failed to initialize db");

        // Create task A (parent of the subtask).
        conn.execute(
            "INSERT INTO tasks (id, title, priority_rank, status, created_at, updated_at)
             VALUES ('task-a', 'Task A', 'a0', 'active', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            [],
        )
        .expect("failed to insert task A");

        // Create task B (referenced task).
        conn.execute(
            "INSERT INTO tasks (id, title, priority_rank, status, created_at, updated_at)
             VALUES ('task-b', 'Task B', 'a0', 'active', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            [],
        )
        .expect("failed to insert task B");

        // Insert a subtask on A with ref_task_id = B.
        conn.execute(
            "INSERT INTO subtasks (id, task_id, type, ref_task_id, sort_order, created_at)
             VALUES ('sub-ref', 'task-a', 'taskref', 'task-b', 1, '2025-01-01T00:00:00Z')",
            [],
        )
        .expect("failed to insert subtask with ref_task_id");

        // Hard-delete task B — should fail because of ON DELETE NO ACTION FK constraint.
        let delete_b = conn.execute("DELETE FROM tasks WHERE id = 'task-b'", []);
        assert!(
            delete_b.is_err(),
            "deleting referenced task B should fail due to NO ACTION FK constraint"
        );

        // Verify the subtask still exists.
        let subtask_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM subtasks WHERE id = 'sub-ref'",
                [],
                |row| row.get(0),
            )
            .expect("failed to count subtask after attempted delete");
        assert_eq!(
            subtask_count, 1,
            "subtask should still exist after failed delete of referenced task"
        );
    }
}
