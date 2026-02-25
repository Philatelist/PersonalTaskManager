use crate::models::{TaskDto, SubtaskDto, DependencyDto, DependencyEdgeDto, CreateDependencyResult, TaskListResult};
use rusqlite::Connection;

/// Core implementation of task creation, separated from the Tauri command for testability.
///
/// Creates a new task with the given title, generating a UUID, timestamps, and
/// priority_rank. The task is inserted into the database within a transaction.
/// Optionally accepts a description, tags, and due_date.
pub fn create_task_impl(
    conn: &Connection,
    title: String,
    description: Option<String>,
    tags: Option<Vec<String>>,
    due_date: Option<String>,
) -> Result<TaskDto, String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    // Query for the last (highest) priority_rank among active tasks.
    let last_rank: Option<String> = tx
        .query_row(
            "SELECT priority_rank FROM tasks WHERE status = 'active' ORDER BY priority_rank DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .ok();

    // Generate the new priority_rank.
    let priority_rank = crate::fractional_index::generate_key_between(
        last_rank.as_deref(),
        None,
    );

    // Generate UUID and timestamps.
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Insert the new task.
    tx.execute(
        "INSERT INTO tasks (id, title, description, priority_rank, status, due_date, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?6, ?7)",
        rusqlite::params![id, title, description, priority_rank, due_date, now, now],
    )
    .map_err(|e| e.to_string())?;

    // Deduplicate and insert tags if provided.
    let mut unique_tags: Vec<String> = Vec::new();
    if let Some(ref tag_list) = tags {
        let mut seen = std::collections::HashSet::new();
        for tag in tag_list {
            let trimmed = tag.clone();
            if seen.insert(trimmed.clone()) {
                unique_tags.push(trimmed);
            }
        }
        for tag in &unique_tags {
            let tag_id = uuid::Uuid::new_v4().to_string();
            tx.execute(
                "INSERT OR IGNORE INTO task_tags (id, task_id, tag) VALUES (?1, ?2, ?3)",
                rusqlite::params![tag_id, id, tag],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;

    // Sort tags alphabetically for deterministic ordering.
    unique_tags.sort();

    Ok(TaskDto {
        id,
        title,
        description,
        priority_rank,
        status: "active".to_string(),
        due_date,
        tags: unique_tags,
        subtasks: vec![],
        blockers: vec![],
        dependents: vec![],
        is_cyclic: false,
        is_blocked: false,
        unsatisfied_blocker_names: vec![],
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn task_create(
    title: String,
    description: Option<String>,
    tags: Option<Vec<String>>,
    due_date: Option<String>,
    state: tauri::State<'_, crate::DbState>,
    backup_state: tauri::State<'_, crate::BackupState>,
) -> Result<TaskDto, String> {
    backup_state.maybe_backup();
    let conn = state.0.lock().unwrap();
    create_task_impl(&conn, title, description, tags, due_date)
}

/// Helper to fetch tags for a given task, sorted alphabetically.
fn get_tags_for_task(conn: &Connection, task_id: &str) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT tag FROM task_tags WHERE task_id = ?1 ORDER BY tag")
        .map_err(|e| e.to_string())?;
    let tags = stmt
        .query_map([task_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(tags)
}

/// Helper to fetch subtasks for a given task, ordered by sort_order.
fn get_subtasks_for_task(conn: &Connection, task_id: &str) -> Result<Vec<SubtaskDto>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT s.id, s.task_id, s.type, s.label, s.is_done, s.ref_task_id,
                    s.sort_order, s.created_at,
                    rt.title AS ref_task_title, rt.status AS ref_task_status
             FROM subtasks s
             LEFT JOIN tasks rt ON s.ref_task_id = rt.id
             WHERE s.task_id = ?1
             ORDER BY s.sort_order ASC"
        )
        .map_err(|e| e.to_string())?;

    let subtasks = stmt
        .query_map([task_id], |row| {
            let subtask_type: String = row.get(2)?;
            let is_done_val: Option<i64> = row.get(4)?;
            let ref_task_title: Option<String> = row.get(8)?;
            let ref_task_status: Option<String> = row.get(9)?;
            let is_taskref = subtask_type == "taskref";

            // For taskref: compute is_done from the referenced task's status.
            // If ref task is deleted/soft-deleted or missing, treat as incomplete.
            let ref_is_broken = is_taskref
                && (ref_task_status.is_none() || ref_task_status.as_deref() == Some("deleted"));

            let is_done = if is_taskref {
                if ref_is_broken {
                    Some(false)
                } else {
                    Some(ref_task_status.as_deref() == Some("done"))
                }
            } else {
                is_done_val.map(|v| v != 0)
            };

            // For taskref with a deleted/missing/soft-deleted reference, show a placeholder.
            let display_ref_title = if is_taskref {
                if ref_is_broken {
                    Some("Referenced task deleted".to_string())
                } else {
                    Some(ref_task_title.unwrap_or_else(|| "Referenced task deleted".to_string()))
                }
            } else {
                None
            };

            let display_ref_status = if is_taskref && !ref_is_broken {
                ref_task_status
            } else {
                None
            };

            Ok(SubtaskDto {
                id: row.get(0)?,
                task_id: row.get(1)?,
                subtask_type,
                label: row.get(3)?,
                is_done,
                ref_task_id: row.get(5)?,
                ref_task_title: display_ref_title,
                ref_task_status: display_ref_status,
                sort_order: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(subtasks)
}

/// Renumber all active tasks with fresh, evenly-spaced fractional index keys.
fn renumber_active_tasks(conn: &Connection, now: &str) -> Result<(), String> {
    let mut stmt = conn
        .prepare("SELECT id FROM tasks WHERE status = 'active' ORDER BY priority_rank ASC")
        .map_err(|e| e.to_string())?;

    let task_ids: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut last_key: Option<String> = None;
    for id in &task_ids {
        let new_key = crate::fractional_index::generate_key_between(
            last_key.as_deref(),
            None,
        );
        conn.execute(
            "UPDATE tasks SET priority_rank = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![new_key, now, id],
        )
        .map_err(|e| e.to_string())?;
        last_key = Some(new_key);
    }

    Ok(())
}

/// Core implementation of task update, separated from the Tauri command for testability.
///
/// Updates an existing task with the provided fields. Only fields that are `Some` are
/// updated. Always updates `updated_at` to the current timestamp. If tags are provided,
/// they fully replace existing tags for the task.
pub fn update_task_impl(
    conn: &Connection,
    id: String,
    title: Option<String>,
    description: Option<String>,
    status: Option<String>,
    due_date: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<TaskDto, String> {
    // Validate status if provided.
    if let Some(ref s) = status {
        if !["active", "done", "deleted"].contains(&s.as_str()) {
            return Err(format!("Invalid status: '{}'. Must be one of: active, done, deleted", s));
        }
    }

    // Validate title if provided.
    if let Some(ref t) = title {
        if t.is_empty() {
            return Err("Title must not be empty".to_string());
        }
    }

    // Blocking enforcement: reject "done" if unsatisfied non-cyclic blockers exist.
    if status.as_deref() == Some("done") {
        let blockers = get_blockers_for_task(conn, &id)?;
        if !blockers.is_empty() {
            let sccs = compute_sccs(conn)?;
            let unsatisfied: Vec<String> = blockers
                .iter()
                .filter(|b| b.task_status != "done")
                .filter(|b| !is_in_same_scc(&sccs, &id, &b.task_id))
                .map(|b| b.task_title.clone())
                .collect();
            if !unsatisfied.is_empty() {
                return Err(format!(
                    "BlockedByUnsatisfiedDependencies: {}",
                    unsatisfied.join(", ")
                ));
            }
        }
    }

    let now = chrono::Utc::now().to_rfc3339();

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    // Build a dynamic UPDATE query based on which fields are provided.
    let mut set_clauses = vec!["updated_at = ?"];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now.clone())];

    if let Some(ref t) = title {
        set_clauses.push("title = ?");
        params.push(Box::new(t.clone()));
    }
    if let Some(ref d) = description {
        set_clauses.push("description = ?");
        params.push(Box::new(d.clone()));
    }
    if let Some(ref s) = status {
        set_clauses.push("status = ?");
        params.push(Box::new(s.clone()));
    }
    if let Some(ref dd) = due_date {
        set_clauses.push("due_date = ?");
        if dd.is_empty() {
            params.push(Box::new(None::<String>));
        } else {
            params.push(Box::new(dd.clone()));
        }
    }

    let sql = format!("UPDATE tasks SET {} WHERE id = ?", set_clauses.join(", "));
    params.push(Box::new(id.clone()));

    let rows_updated = tx
        .execute(
            &sql,
            rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
        )
        .map_err(|e| e.to_string())?;

    if rows_updated == 0 {
        return Err("Task not found".to_string());
    }

    // If tags are provided, replace all existing tags.
    if let Some(ref tag_list) = tags {
        tx.execute("DELETE FROM task_tags WHERE task_id = ?1", rusqlite::params![id])
            .map_err(|e| e.to_string())?;

        // Deduplicate tags.
        let mut seen = std::collections::HashSet::new();
        for tag in tag_list {
            if seen.insert(tag.clone()) {
                let tag_id = uuid::Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT OR IGNORE INTO task_tags (id, task_id, tag) VALUES (?1, ?2, ?3)",
                    rusqlite::params![tag_id, id, tag],
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }

    tx.commit().map_err(|e| e.to_string())?;

    // Fetch the full updated task.
    let task = conn
        .query_row(
            "SELECT id, title, description, priority_rank, status, due_date, created_at, updated_at
             FROM tasks WHERE id = ?1",
            [&id],
            |row| {
                Ok(TaskDto {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    priority_rank: row.get(3)?,
                    status: row.get(4)?,
                    due_date: row.get(5)?,
                    tags: vec![],
                    subtasks: vec![],
                    blockers: vec![],
                    dependents: vec![],
                    is_cyclic: false,
                    is_blocked: false,
                    unsatisfied_blocker_names: vec![],
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    // Fetch tags for the task.
    let task_tags = get_tags_for_task(conn, &id)?;

    Ok(TaskDto {
        tags: task_tags,
        ..task
    })
}

#[tauri::command]
pub fn task_update(
    id: String,
    title: Option<String>,
    description: Option<String>,
    status: Option<String>,
    due_date: Option<String>,
    tags: Option<Vec<String>>,
    state: tauri::State<'_, crate::DbState>,
    backup_state: tauri::State<'_, crate::BackupState>,
) -> Result<TaskDto, String> {
    backup_state.maybe_backup();
    let conn = state.0.lock().unwrap();
    update_task_impl(&conn, id, title, description, status, due_date, tags)
}

/// Core implementation of task soft-delete, separated from the Tauri command for testability.
///
/// Sets the task's status to "deleted" and updates `updated_at`.
pub fn delete_task_impl(conn: &Connection, id: String) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    let rows_updated = conn
        .execute(
            "UPDATE tasks SET status = 'deleted', updated_at = ?1 WHERE id = ?2",
            rusqlite::params![now, id],
        )
        .map_err(|e| e.to_string())?;

    if rows_updated == 0 {
        return Err("Task not found".to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn task_delete(id: String, state: tauri::State<'_, crate::DbState>, backup_state: tauri::State<'_, crate::BackupState>) -> Result<(), String> {
    backup_state.maybe_backup();
    let conn = state.0.lock().unwrap();
    delete_task_impl(&conn, id)
}

/// Core implementation of task reordering.
///
/// Moves a task to a new position by computing a new `priority_rank` via
/// fractional indexing. If `after_id` is `None`, the task moves to the top.
/// Otherwise, it moves immediately after the task with the given `after_id`.
pub fn reorder_task_impl(
    conn: &Connection,
    task_id: String,
    after_id: Option<String>,
) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    // Verify the task exists.
    let _: String = tx
        .query_row(
            "SELECT id FROM tasks WHERE id = ?1",
            [&task_id],
            |row| row.get(0),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => "Task not found".to_string(),
            other => other.to_string(),
        })?;

    let new_rank = match after_id {
        None => {
            // Move to top: find the lowest priority_rank among active tasks
            // (excluding the task being moved).
            let lowest: Option<String> = tx
                .query_row(
                    "SELECT priority_rank FROM tasks WHERE status = 'active' AND id != ?1 ORDER BY priority_rank ASC LIMIT 1",
                    [&task_id],
                    |row| row.get(0),
                )
                .ok();

            match lowest {
                Some(low) => crate::fractional_index::generate_key_between(None, Some(&low)),
                None => crate::fractional_index::generate_key_between(None, None),
            }
        }
        Some(ref aid) => {
            // Find after_id's priority_rank.
            let after_rank: String = tx
                .query_row(
                    "SELECT priority_rank FROM tasks WHERE id = ?1",
                    [aid],
                    |row| row.get(0),
                )
                .map_err(|e| match e {
                    rusqlite::Error::QueryReturnedNoRows => format!("After task '{}' not found", aid),
                    other => other.to_string(),
                })?;

            // Find the next task after after_id (excluding the task being moved).
            let next_rank: Option<String> = tx
                .query_row(
                    "SELECT priority_rank FROM tasks WHERE status = 'active' AND id != ?1 AND priority_rank > ?2 ORDER BY priority_rank ASC LIMIT 1",
                    rusqlite::params![task_id, after_rank],
                    |row| row.get(0),
                )
                .ok();

            match next_rank {
                Some(nr) => crate::fractional_index::generate_key_between(Some(&after_rank), Some(&nr)),
                None => crate::fractional_index::generate_key_between(Some(&after_rank), None),
            }
        }
    };

    // Update the task's priority_rank.
    let now = chrono::Utc::now().to_rfc3339();
    tx.execute(
        "UPDATE tasks SET priority_rank = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![new_rank, now, task_id],
    )
    .map_err(|e| e.to_string())?;

    // Check if any active task has a priority_rank exceeding 20 characters.
    let max_len: i64 = tx
        .query_row(
            "SELECT COALESCE(MAX(LENGTH(priority_rank)), 0) FROM tasks WHERE status = 'active'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if max_len > 20 {
        renumber_active_tasks(&tx, &now)?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn task_reorder(
    task_id: String,
    after_id: Option<String>,
    state: tauri::State<'_, crate::DbState>,
    backup_state: tauri::State<'_, crate::BackupState>,
) -> Result<(), String> {
    backup_state.maybe_backup();
    let conn = state.0.lock().unwrap();
    reorder_task_impl(&conn, task_id, after_id)
}

/// Core implementation of subtask creation for checklist and taskref types.
pub fn create_subtask_impl(
    conn: &Connection,
    task_id: String,
    subtask_type: String,
    label: Option<String>,
    ref_task_id: Option<String>,
) -> Result<SubtaskDto, String> {
    // Validate type.
    if subtask_type != "checklist" && subtask_type != "taskref" {
        return Err(format!(
            "Invalid subtask type: '{}'. Must be 'checklist' or 'taskref'",
            subtask_type
        ));
    }

    if subtask_type == "checklist" {
        // Checklist requires a non-empty label.
        match &label {
            None => return Err("Checklist subtask requires a label".to_string()),
            Some(l) if l.is_empty() => {
                return Err("Checklist subtask label must not be empty".to_string())
            }
            _ => {}
        }
    } else {
        // taskref: ref_task_id is required and must reference an existing task.
        let rtid = ref_task_id
            .as_ref()
            .ok_or_else(|| "TaskRef subtask requires ref_task_id".to_string())?;

        // Self-reference check.
        if rtid == &task_id {
            return Err("A task cannot reference itself".to_string());
        }

        conn.query_row(
            "SELECT id FROM tasks WHERE id = ?1",
            [rtid],
            |row| row.get::<_, String>(0),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                format!("Referenced task '{}' not found", rtid)
            }
            other => other.to_string(),
        })?;

        // Circular reference check: does the target task already have a taskref back to us?
        let circular_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM subtasks WHERE task_id = ?1 AND type = 'taskref' AND ref_task_id = ?2",
                rusqlite::params![rtid, &task_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if circular_count > 0 {
            return Err("CircularTaskRefNotAllowed: the target task already references this task".to_string());
        }
    }

    // Verify the parent task exists.
    let _: String = conn
        .query_row(
            "SELECT id FROM tasks WHERE id = ?1",
            [&task_id],
            |row| row.get(0),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => "Parent task not found".to_string(),
            other => other.to_string(),
        })?;

    // Determine sort_order: max existing sort_order + 1, or 0 if none.
    let max_sort: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM subtasks WHERE task_id = ?1",
            [&task_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);
    let sort_order = max_sort + 1;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    if subtask_type == "checklist" {
        conn.execute(
            "INSERT INTO subtasks (id, task_id, type, label, is_done, ref_task_id, sort_order, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7)",
            rusqlite::params![id, task_id, subtask_type, label, 0i64, sort_order, now],
        )
        .map_err(|e| e.to_string())?;

        Ok(SubtaskDto {
            id,
            task_id,
            subtask_type,
            label,
            is_done: Some(false),
            ref_task_id: None,
            ref_task_title: None,
            ref_task_status: None,
            sort_order,
            created_at: now,
        })
    } else {
        conn.execute(
            "INSERT INTO subtasks (id, task_id, type, label, is_done, ref_task_id, sort_order, created_at)
             VALUES (?1, ?2, ?3, NULL, NULL, ?4, ?5, ?6)",
            rusqlite::params![id, task_id, subtask_type, ref_task_id, sort_order, now],
        )
        .map_err(|e| e.to_string())?;

        Ok(SubtaskDto {
            id,
            task_id,
            subtask_type,
            label: None,
            is_done: None,
            ref_task_id,
            ref_task_title: None,
            ref_task_status: None,
            sort_order,
            created_at: now,
        })
    }
}

#[tauri::command]
pub fn subtask_create(
    task_id: String,
    subtask_type: String,
    label: Option<String>,
    ref_task_id: Option<String>,
    state: tauri::State<'_, crate::DbState>,
    backup_state: tauri::State<'_, crate::BackupState>,
) -> Result<SubtaskDto, String> {
    backup_state.maybe_backup();
    let conn = state.0.lock().unwrap();
    create_subtask_impl(&conn, task_id, subtask_type, label, ref_task_id)
}

/// Core implementation of subtask update.
///
/// For checklist subtasks, allows updating `label` and `is_done`.
/// For taskref subtasks, rejects `is_done` updates (will be enforced in Slice 5).
pub fn update_subtask_impl(
    conn: &Connection,
    id: String,
    label: Option<String>,
    is_done: Option<bool>,
) -> Result<SubtaskDto, String> {
    // Fetch the existing subtask to check its type.
    let (subtask_type, _task_id): (String, String) = conn
        .query_row(
            "SELECT type, task_id FROM subtasks WHERE id = ?1",
            [&id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => "Subtask not found".to_string(),
            other => other.to_string(),
        })?;

    // Reject is_done updates for taskref subtasks — completion is derived from the referenced task.
    if subtask_type == "taskref" && is_done.is_some() {
        return Err("Cannot update is_done for taskref subtasks".to_string());
    }

    // Validate label if provided: must not be empty.
    if let Some(ref l) = label {
        if l.is_empty() {
            return Err("Label must not be empty".to_string());
        }
    }

    // Build dynamic UPDATE.
    let mut set_clauses: Vec<&str> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref l) = label {
        set_clauses.push("label = ?");
        params.push(Box::new(l.clone()));
    }
    if let Some(done) = is_done {
        set_clauses.push("is_done = ?");
        params.push(Box::new(if done { 1i64 } else { 0i64 }));
    }

    if set_clauses.is_empty() {
        return Err("No fields to update".to_string());
    }

    let sql = format!("UPDATE subtasks SET {} WHERE id = ?", set_clauses.join(", "));
    params.push(Box::new(id.clone()));

    conn.execute(
        &sql,
        rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
    )
    .map_err(|e| e.to_string())?;

    // Fetch and return the updated subtask.
    conn.query_row(
        "SELECT id, task_id, type, label, is_done, ref_task_id, sort_order, created_at
         FROM subtasks WHERE id = ?1",
        [&id],
        |row| {
            let is_done_val: Option<i64> = row.get(4)?;
            Ok(SubtaskDto {
                id: row.get(0)?,
                task_id: row.get(1)?,
                subtask_type: row.get(2)?,
                label: row.get(3)?,
                is_done: is_done_val.map(|v| v != 0),
                ref_task_id: row.get(5)?,
                ref_task_title: None,
                ref_task_status: None,
                sort_order: row.get(6)?,
                created_at: row.get(7)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn subtask_update(
    id: String,
    label: Option<String>,
    is_done: Option<bool>,
    state: tauri::State<'_, crate::DbState>,
    backup_state: tauri::State<'_, crate::BackupState>,
) -> Result<SubtaskDto, String> {
    backup_state.maybe_backup();
    let conn = state.0.lock().unwrap();
    update_subtask_impl(&conn, id, label, is_done)
}

/// Core implementation of subtask deletion (hard delete).
pub fn delete_subtask_impl(conn: &Connection, id: String) -> Result<(), String> {
    let rows_deleted = conn
        .execute("DELETE FROM subtasks WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    if rows_deleted == 0 {
        return Err("Subtask not found".to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn subtask_delete(id: String, state: tauri::State<'_, crate::DbState>, backup_state: tauri::State<'_, crate::BackupState>) -> Result<(), String> {
    backup_state.maybe_backup();
    let conn = state.0.lock().unwrap();
    delete_subtask_impl(&conn, id)
}

/// Core implementation of subtask reordering.
///
/// Accepts a task_id and the full ordered list of subtask IDs.
/// Updates sort_order for each subtask based on its position in the list.
pub fn reorder_subtasks_impl(
    conn: &Connection,
    task_id: String,
    ordered_ids: Vec<String>,
) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    // Verify the parent task exists.
    let _: String = tx
        .query_row("SELECT id FROM tasks WHERE id = ?1", [&task_id], |row| row.get(0))
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => "Parent task not found".to_string(),
            other => other.to_string(),
        })?;

    // Verify all provided IDs belong to this task.
    for (i, subtask_id) in ordered_ids.iter().enumerate() {
        let owner_task_id: String = tx
            .query_row(
                "SELECT task_id FROM subtasks WHERE id = ?1",
                [subtask_id],
                |row| row.get(0),
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    format!("Subtask '{}' not found", subtask_id)
                }
                other => other.to_string(),
            })?;

        if owner_task_id != task_id {
            return Err(format!(
                "Subtask '{}' does not belong to task '{}'",
                subtask_id, task_id
            ));
        }

        tx.execute(
            "UPDATE subtasks SET sort_order = ?1 WHERE id = ?2",
            rusqlite::params![i as i64, subtask_id],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn subtask_reorder(
    task_id: String,
    ordered_ids: Vec<String>,
    state: tauri::State<'_, crate::DbState>,
    backup_state: tauri::State<'_, crate::BackupState>,
) -> Result<(), String> {
    backup_state.maybe_backup();
    let conn = state.0.lock().unwrap();
    reorder_subtasks_impl(&conn, task_id, ordered_ids)
}

/// Core implementation of task retrieval, separated from the Tauri command for testability.
///
/// Queries the `tasks` table for a single row matching the given `id`.
/// Returns the full `TaskDto` or an error if the task is not found.
pub fn get_task_impl(conn: &Connection, id: String) -> Result<TaskDto, String> {
    let mut task = conn.query_row(
        "SELECT id, title, description, priority_rank, status, due_date, created_at, updated_at
         FROM tasks WHERE id = ?1",
        [&id],
        |row| {
            Ok(TaskDto {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                priority_rank: row.get(3)?,
                status: row.get(4)?,
                due_date: row.get(5)?,
                tags: vec![],
                subtasks: vec![],
                blockers: vec![],
                dependents: vec![],
                is_cyclic: false,
                is_blocked: false,
                unsatisfied_blocker_names: vec![],
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => "Task not found".to_string(),
        other => other.to_string(),
    })?;

    task.tags = get_tags_for_task(conn, &task.id)?;
    task.subtasks = get_subtasks_for_task(conn, &task.id)?;

    // Populate blockers (tasks that block this task).
    task.blockers = get_blockers_for_task(conn, &task.id)?;

    // Populate dependents (tasks that this task blocks).
    task.dependents = get_dependents_for_task(conn, &task.id)?;

    // Compute SCC-based flags.
    let sccs = compute_sccs(conn)?;
    task.is_cyclic = task_is_cyclic(&sccs, &task.id);

    // Compute blocking: unsatisfied non-cyclic blockers.
    let mut unsatisfied_names: Vec<String> = Vec::new();
    for blocker in &task.blockers {
        if is_in_same_scc(&sccs, &task.id, &blocker.task_id) {
            continue; // cyclic blocker — doesn't count
        }
        if blocker.task_status != "done" {
            unsatisfied_names.push(blocker.task_title.clone());
        }
    }
    if !unsatisfied_names.is_empty() {
        task.is_blocked = true;
        task.unsatisfied_blocker_names = unsatisfied_names;
    }

    Ok(task)
}

/// Fetches blockers for a task (tasks that block it) as rich DependencyDto.
fn get_blockers_for_task(conn: &Connection, task_id: &str) -> Result<Vec<DependencyDto>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT td.id, t.id, t.title, t.status
             FROM task_dependencies td
             JOIN tasks t ON t.id = td.blocker_task_id
             WHERE td.dependent_task_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let deps = stmt
        .query_map([task_id], |row| {
            Ok(DependencyDto {
                id: row.get(0)?,
                task_id: row.get(1)?,
                task_title: row.get(2)?,
                task_status: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(deps)
}

/// Fetches dependents for a task (tasks that it blocks) as rich DependencyDto.
fn get_dependents_for_task(conn: &Connection, task_id: &str) -> Result<Vec<DependencyDto>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT td.id, t.id, t.title, t.status
             FROM task_dependencies td
             JOIN tasks t ON t.id = td.dependent_task_id
             WHERE td.blocker_task_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let deps = stmt
        .query_map([task_id], |row| {
            Ok(DependencyDto {
                id: row.get(0)?,
                task_id: row.get(1)?,
                task_title: row.get(2)?,
                task_status: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(deps)
}

#[tauri::command]
pub fn task_get(id: String, state: tauri::State<'_, crate::DbState>) -> Result<TaskDto, String> {
    let conn = state.0.lock().unwrap();
    get_task_impl(&conn, id)
}

/// Core implementation of task listing, separated from the Tauri command for testability.
///
/// Queries the `tasks` table ordered by `priority_rank` ascending.
/// Optionally filters by status (defaults to "active") and/or tag.
/// Returns a `TaskListResult` with tasks (including computed dependency flags)
/// and a flat list of all dependency edges.
pub fn list_tasks_impl(
    conn: &Connection,
    status_filter: Option<String>,
    tag_filter: Option<String>,
) -> Result<TaskListResult, String> {
    let status = status_filter.unwrap_or_else(|| "active".to_string());

    let (sql, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = if let Some(ref tag) = tag_filter {
        (
            "SELECT DISTINCT t.id, t.title, t.description, t.priority_rank, t.status, t.due_date, t.created_at, t.updated_at
             FROM tasks t
             INNER JOIN task_tags tt ON t.id = tt.task_id
             WHERE t.status = ? AND tt.tag = ?
             ORDER BY t.priority_rank ASC".to_string(),
            vec![Box::new(status) as Box<dyn rusqlite::types::ToSql>, Box::new(tag.clone())],
        )
    } else {
        (
            "SELECT id, title, description, priority_rank, status, due_date, created_at, updated_at
             FROM tasks WHERE status = ?
             ORDER BY priority_rank ASC".to_string(),
            vec![Box::new(status) as Box<dyn rusqlite::types::ToSql>],
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let mut tasks = stmt
        .query_map(rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())), |row| {
            Ok(TaskDto {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                priority_rank: row.get(3)?,
                status: row.get(4)?,
                due_date: row.get(5)?,
                tags: vec![],
                subtasks: vec![],
                blockers: vec![],
                dependents: vec![],
                is_cyclic: false,
                is_blocked: false,
                unsatisfied_blocker_names: vec![],
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for task in &mut tasks {
        task.tags = get_tags_for_task(conn, &task.id)?;
    }

    // Bulk-fetch all dependency edges.
    let edges = fetch_all_dependency_edges(conn)?;

    // Compute SCCs once.
    let sccs = compute_sccs(conn)?;

    // Compute dependency flags for each task.
    compute_dependency_flags(&mut tasks, &edges, &sccs, conn)?;

    Ok(TaskListResult {
        tasks,
        dependencies: edges,
    })
}

/// Fetches all dependency edges from the database in a single query.
fn fetch_all_dependency_edges(conn: &Connection) -> Result<Vec<DependencyEdgeDto>, String> {
    let mut stmt = conn
        .prepare("SELECT id, blocker_task_id, dependent_task_id FROM task_dependencies")
        .map_err(|e| e.to_string())?;

    let edges = stmt
        .query_map([], |row| {
            Ok(DependencyEdgeDto {
                id: row.get(0)?,
                blocker_task_id: row.get(1)?,
                dependent_task_id: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(edges)
}

/// Computes `is_cyclic`, `is_blocked`, and `unsatisfied_blocker_names` for each task
/// based on the edge list and SCC results.
///
/// A task is `is_blocked` if it has at least one direct blocker that is:
///   - not in the same SCC as the task (i.e., not a purely cyclic blocker), AND
///   - not satisfied (blocker status != "done").
///
/// `unsatisfied_blocker_names` lists the titles of those blockers.
fn compute_dependency_flags(
    tasks: &mut [TaskDto],
    edges: &[DependencyEdgeDto],
    sccs: &[Vec<String>],
    conn: &Connection,
) -> Result<(), String> {
    // Build a map: dependent_task_id → list of blocker_task_ids
    let mut blockers_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    for edge in edges {
        blockers_map
            .entry(edge.dependent_task_id.clone())
            .or_default()
            .push(edge.blocker_task_id.clone());
    }

    for task in tasks.iter_mut() {
        // is_cyclic: task is in any SCC
        task.is_cyclic = task_is_cyclic(sccs, &task.id);

        // Compute blocking from direct blockers
        if let Some(blocker_ids) = blockers_map.get(&task.id) {
            let mut unsatisfied_names: Vec<String> = Vec::new();

            for blocker_id in blocker_ids {
                // Skip cyclic blockers (same SCC as the dependent)
                if is_in_same_scc(sccs, &task.id, blocker_id) {
                    continue;
                }

                // Look up blocker status and title
                let blocker_info: Result<(String, String), _> = conn.query_row(
                    "SELECT status, title FROM tasks WHERE id = ?1",
                    [blocker_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                );

                if let Ok((blocker_status, blocker_title)) = blocker_info {
                    if blocker_status != "done" {
                        unsatisfied_names.push(blocker_title);
                    }
                }
            }

            if !unsatisfied_names.is_empty() {
                task.is_blocked = true;
                task.unsatisfied_blocker_names = unsatisfied_names;
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn task_list(
    status_filter: Option<String>,
    tag_filter: Option<String>,
    state: tauri::State<'_, crate::DbState>,
) -> Result<TaskListResult, String> {
    let conn = state.0.lock().unwrap();
    list_tasks_impl(&conn, status_filter, tag_filter)
}

// ===========================================================================
// Dependencies
// ===========================================================================

pub fn create_dependency_impl(
    conn: &Connection,
    blocker_task_id: String,
    dependent_task_id: String,
) -> Result<CreateDependencyResult, String> {
    // Reject self-dependency.
    if blocker_task_id == dependent_task_id {
        return Err("SelfDependencyNotAllowed".to_string());
    }

    // Validate both tasks exist and are not deleted.
    let blocker_status: String = conn
        .query_row(
            "SELECT status FROM tasks WHERE id = ?1",
            [&blocker_task_id],
            |row| row.get(0),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                format!("Blocker task not found: {}", blocker_task_id)
            }
            other => other.to_string(),
        })?;

    if blocker_status == "deleted" {
        return Err(format!("Blocker task is deleted: {}", blocker_task_id));
    }

    let dependent_status: String = conn
        .query_row(
            "SELECT status FROM tasks WHERE id = ?1",
            [&dependent_task_id],
            |row| row.get(0),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                format!("Dependent task not found: {}", dependent_task_id)
            }
            other => other.to_string(),
        })?;

    if dependent_status == "deleted" {
        return Err(format!("Dependent task is deleted: {}", dependent_task_id));
    }

    // Insert the dependency row.
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO task_dependencies (id, blocker_task_id, dependent_task_id, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, blocker_task_id, dependent_task_id, now],
    )
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("UNIQUE constraint failed") {
            "DuplicateDependency".to_string()
        } else {
            msg
        }
    })?;

    // Check if this edge created a cycle.
    let sccs = compute_sccs(conn)?;
    let is_cyclic = is_in_same_scc(&sccs, &blocker_task_id, &dependent_task_id);

    Ok(CreateDependencyResult {
        edge: DependencyEdgeDto {
            id,
            blocker_task_id,
            dependent_task_id,
        },
        is_cyclic,
    })
}

pub fn delete_dependency_impl(
    conn: &Connection,
    dependency_id: String,
) -> Result<(), String> {
    let rows = conn
        .execute(
            "DELETE FROM task_dependencies WHERE id = ?1",
            [&dependency_id],
        )
        .map_err(|e| e.to_string())?;

    if rows == 0 {
        return Err("Dependency not found".to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn dependency_create(
    blocker_task_id: String,
    dependent_task_id: String,
    state: tauri::State<'_, crate::DbState>,
    backup_state: tauri::State<'_, crate::BackupState>,
) -> Result<CreateDependencyResult, String> {
    backup_state.maybe_backup();
    let conn = state.0.lock().unwrap();
    create_dependency_impl(&conn, blocker_task_id, dependent_task_id)
}

#[tauri::command]
pub fn dependency_delete(
    dependency_id: String,
    state: tauri::State<'_, crate::DbState>,
    backup_state: tauri::State<'_, crate::BackupState>,
) -> Result<(), String> {
    backup_state.maybe_backup();
    let conn = state.0.lock().unwrap();
    delete_dependency_impl(&conn, dependency_id)
}

// ===========================================================================
// SCC (Tarjan's Algorithm)
// ===========================================================================

/// Compute all strongly connected components of size > 1 from the
/// dependency graph (task_dependencies table only — not subtask refs).
pub fn compute_sccs(conn: &Connection) -> Result<Vec<Vec<String>>, String> {
    // Load all edges.
    let mut stmt = conn
        .prepare("SELECT blocker_task_id, dependent_task_id FROM task_dependencies")
        .map_err(|e| e.to_string())?;

    let edges: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    if edges.is_empty() {
        return Ok(vec![]);
    }

    // Build adjacency list and collect all node ids.
    let mut adj: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    let mut nodes: std::collections::HashSet<String> = std::collections::HashSet::new();

    for (from, to) in &edges {
        adj.entry(from.clone()).or_default().push(to.clone());
        nodes.insert(from.clone());
        nodes.insert(to.clone());
    }

    // Tarjan's algorithm state.
    let mut index_counter: usize = 0;
    let mut stack: Vec<String> = Vec::new();
    let mut on_stack: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut indices: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut lowlinks: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut result: Vec<Vec<String>> = Vec::new();

    fn strongconnect(
        v: &str,
        adj: &std::collections::HashMap<String, Vec<String>>,
        index_counter: &mut usize,
        stack: &mut Vec<String>,
        on_stack: &mut std::collections::HashSet<String>,
        indices: &mut std::collections::HashMap<String, usize>,
        lowlinks: &mut std::collections::HashMap<String, usize>,
        result: &mut Vec<Vec<String>>,
    ) {
        indices.insert(v.to_string(), *index_counter);
        lowlinks.insert(v.to_string(), *index_counter);
        *index_counter += 1;
        stack.push(v.to_string());
        on_stack.insert(v.to_string());

        if let Some(neighbors) = adj.get(v) {
            for w in neighbors {
                if !indices.contains_key(w.as_str()) {
                    strongconnect(w, adj, index_counter, stack, on_stack, indices, lowlinks, result);
                    let low_w = lowlinks[w.as_str()];
                    let low_v = lowlinks[v];
                    if low_w < low_v {
                        lowlinks.insert(v.to_string(), low_w);
                    }
                } else if on_stack.contains(w.as_str()) {
                    let idx_w = indices[w.as_str()];
                    let low_v = lowlinks[v];
                    if idx_w < low_v {
                        lowlinks.insert(v.to_string(), idx_w);
                    }
                }
            }
        }

        // If v is a root node, pop the stack to get the SCC.
        if lowlinks[v] == indices[v] {
            let mut scc = Vec::new();
            loop {
                let w = stack.pop().unwrap();
                on_stack.remove(&w);
                scc.push(w.clone());
                if w == v {
                    break;
                }
            }
            // Only keep SCCs of size > 1 (actual cycles).
            if scc.len() > 1 {
                result.push(scc);
            }
        }
    }

    // Sort nodes for deterministic traversal order.
    let mut sorted_nodes: Vec<String> = nodes.into_iter().collect();
    sorted_nodes.sort();

    for node in &sorted_nodes {
        if !indices.contains_key(node.as_str()) {
            strongconnect(
                node,
                &adj,
                &mut index_counter,
                &mut stack,
                &mut on_stack,
                &mut indices,
                &mut lowlinks,
                &mut result,
            );
        }
    }

    Ok(result)
}

/// Returns true if the given task_id appears in any SCC (i.e., is part of a cycle).
pub fn task_is_cyclic(sccs: &[Vec<String>], task_id: &str) -> bool {
    sccs.iter().any(|scc| scc.iter().any(|id| id == task_id))
}

/// Returns true if both task_a and task_b are in the same SCC.
pub fn is_in_same_scc(sccs: &[Vec<String>], task_a: &str, task_b: &str) -> bool {
    sccs.iter().any(|scc| {
        scc.iter().any(|id| id == task_a) && scc.iter().any(|id| id == task_b)
    })
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Creates an in-memory SQLite database with migrations applied, suitable for testing.
    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        crate::db::run_migrations(&conn).unwrap();
        conn
    }

    #[test]
    fn test_create_task_returns_correct_defaults() {
        let conn = test_db();
        let task = create_task_impl(&conn, "My first task".to_string(), None, None, None)
            .expect("create_task_impl should succeed");

        assert_eq!(task.title, "My first task");
        assert_eq!(task.status, "active");
        assert!(task.description.is_none());
        assert!(task.due_date.is_none());
        assert!(!task.id.is_empty(), "id should be a non-empty UUID string");
        assert!(!task.priority_rank.is_empty(), "priority_rank should be set");
        assert!(!task.created_at.is_empty(), "created_at should be set");
        assert!(!task.updated_at.is_empty(), "updated_at should be set");

        // Verify UUID format (basic check: 36 chars with hyphens).
        assert_eq!(task.id.len(), 36, "UUID should be 36 characters");
        assert_eq!(
            task.id.chars().filter(|c| *c == '-').count(),
            4,
            "UUID should contain 4 hyphens"
        );
    }

    #[test]
    fn test_second_task_has_higher_priority_rank() {
        let conn = test_db();

        let task1 = create_task_impl(&conn, "First task".to_string(), None, None, None)
            .expect("first create should succeed");
        let task2 = create_task_impl(&conn, "Second task".to_string(), None, None, None)
            .expect("second create should succeed");

        assert!(
            task2.priority_rank > task1.priority_rank,
            "second task priority_rank '{}' should be > first task priority_rank '{}'",
            task2.priority_rank,
            task1.priority_rank
        );
    }

    #[test]
    fn test_empty_title_returns_error() {
        let conn = test_db();

        let result = create_task_impl(&conn, "".to_string(), None, None, None);
        assert!(
            result.is_err(),
            "creating a task with an empty title should return an error"
        );
    }

    #[test]
    fn test_get_task_returns_created_task() {
        let conn = test_db();

        let created = create_task_impl(&conn, "Fetch me".to_string(), None, None, None)
            .expect("create_task_impl should succeed");

        let fetched = get_task_impl(&conn, created.id.clone())
            .expect("get_task_impl should succeed");

        assert_eq!(fetched.id, created.id);
        assert_eq!(fetched.title, created.title);
        assert_eq!(fetched.description, created.description);
        assert_eq!(fetched.priority_rank, created.priority_rank);
        assert_eq!(fetched.status, created.status);
        assert_eq!(fetched.due_date, created.due_date);
        assert_eq!(fetched.created_at, created.created_at);
        assert_eq!(fetched.updated_at, created.updated_at);
    }

    #[test]
    fn test_get_task_not_found() {
        let conn = test_db();

        let result = get_task_impl(&conn, "non-existent-id".to_string());
        assert!(result.is_err(), "should return an error for non-existent ID");
        assert_eq!(
            result.unwrap_err(),
            "Task not found",
            "error message should be 'Task not found'"
        );
    }

    #[test]
    fn test_get_task_returns_all_fields() {
        let conn = test_db();

        let created = create_task_impl(&conn, "Full field check".to_string(), None, None, None)
            .expect("create_task_impl should succeed");

        let fetched = get_task_impl(&conn, created.id.clone())
            .expect("get_task_impl should succeed");

        // Verify UUID format (36 chars with 4 hyphens).
        assert_eq!(fetched.id.len(), 36, "UUID should be 36 characters");
        assert_eq!(
            fetched.id.chars().filter(|c| *c == '-').count(),
            4,
            "UUID should contain 4 hyphens"
        );

        // Verify expected field values.
        assert_eq!(fetched.title, "Full field check");
        assert_eq!(fetched.status, "active");
        assert!(fetched.description.is_none(), "description should be None for a new task");
        assert!(fetched.due_date.is_none(), "due_date should be None for a new task");
        assert!(!fetched.priority_rank.is_empty(), "priority_rank should be set");
        assert!(!fetched.created_at.is_empty(), "created_at should be set");
        assert!(!fetched.updated_at.is_empty(), "updated_at should be set");
    }

    #[test]
    fn test_list_tasks_empty() {
        let conn = test_db();

        let tasks = list_tasks_impl(&conn, None, None).expect("list_tasks_impl should succeed on empty db").tasks;
        assert!(tasks.is_empty(), "should return an empty vec on an empty database");
    }

    #[test]
    fn test_list_tasks_returns_active_only() {
        let conn = test_db();

        let task1 = create_task_impl(&conn, "Active task".to_string(), None, None, None)
            .expect("create task1 should succeed");
        let task2 = create_task_impl(&conn, "Done task".to_string(), None, None, None)
            .expect("create task2 should succeed");
        let task3 = create_task_impl(&conn, "Deleted task".to_string(), None, None, None)
            .expect("create task3 should succeed");

        // Manually update statuses via raw SQL since task_update doesn't exist yet.
        conn.execute(
            "UPDATE tasks SET status = 'done' WHERE id = ?1",
            [&task2.id],
        )
        .unwrap();
        conn.execute(
            "UPDATE tasks SET status = 'deleted' WHERE id = ?1",
            [&task3.id],
        )
        .unwrap();

        let tasks = list_tasks_impl(&conn, None, None).expect("list_tasks_impl should succeed").tasks;
        assert_eq!(tasks.len(), 1, "only active tasks should be returned");
        assert_eq!(tasks[0].id, task1.id, "the returned task should be the active one");
    }

    #[test]
    fn test_list_tasks_ordered_by_priority_rank() {
        let conn = test_db();

        let task1 = create_task_impl(&conn, "First".to_string(), None, None, None)
            .expect("create task1 should succeed");
        let task2 = create_task_impl(&conn, "Second".to_string(), None, None, None)
            .expect("create task2 should succeed");
        let task3 = create_task_impl(&conn, "Third".to_string(), None, None, None)
            .expect("create task3 should succeed");

        let tasks = list_tasks_impl(&conn, None, None).expect("list_tasks_impl should succeed").tasks;
        assert_eq!(tasks.len(), 3);
        assert_eq!(tasks[0].id, task1.id, "first created task should be first (lowest priority_rank)");
        assert_eq!(tasks[1].id, task2.id, "second created task should be second");
        assert_eq!(tasks[2].id, task3.id, "third created task should be third (highest priority_rank)");

        // Also verify priority_rank ordering directly.
        assert!(
            tasks[0].priority_rank <= tasks[1].priority_rank,
            "priority_rank should be in ascending order"
        );
        assert!(
            tasks[1].priority_rank <= tasks[2].priority_rank,
            "priority_rank should be in ascending order"
        );
    }

    #[test]
    fn test_list_tasks_returns_correct_count() {
        let conn = test_db();

        for i in 1..=5 {
            create_task_impl(&conn, format!("Task {}", i), None, None, None)
                .expect("create_task_impl should succeed");
        }

        let tasks = list_tasks_impl(&conn, None, None).expect("list_tasks_impl should succeed").tasks;
        assert_eq!(tasks.len(), 5, "should return exactly 5 tasks");
    }

    #[test]
    fn test_create_task_with_description() {
        let conn = test_db();
        let task = create_task_impl(
            &conn,
            "Task with desc".to_string(),
            Some("A detailed description".to_string()),
            None,
            None,
        )
        .expect("create_task_impl should succeed");

        assert_eq!(task.title, "Task with desc");
        assert_eq!(
            task.description,
            Some("A detailed description".to_string())
        );
        assert!(task.due_date.is_none());
        assert!(task.tags.is_empty());

        // Verify description persisted in database.
        let fetched = get_task_impl(&conn, task.id.clone())
            .expect("get_task_impl should succeed");
        assert_eq!(
            fetched.description,
            Some("A detailed description".to_string())
        );
    }

    #[test]
    fn test_create_task_with_due_date() {
        let conn = test_db();
        let task = create_task_impl(
            &conn,
            "Task with due date".to_string(),
            None,
            None,
            Some("2026-03-15".to_string()),
        )
        .expect("create_task_impl should succeed");

        assert_eq!(task.title, "Task with due date");
        assert_eq!(task.due_date, Some("2026-03-15".to_string()));
        assert!(task.description.is_none());
        assert!(task.tags.is_empty());

        // Verify due_date persisted in database.
        let fetched = get_task_impl(&conn, task.id.clone())
            .expect("get_task_impl should succeed");
        assert_eq!(fetched.due_date, Some("2026-03-15".to_string()));
    }

    #[test]
    fn test_create_task_with_tags() {
        let conn = test_db();
        let task = create_task_impl(
            &conn,
            "Task with tags".to_string(),
            None,
            Some(vec!["work".to_string(), "urgent".to_string()]),
            None,
        )
        .expect("create_task_impl should succeed");

        assert_eq!(task.title, "Task with tags");
        // Tags should be sorted alphabetically.
        assert_eq!(task.tags, vec!["urgent".to_string(), "work".to_string()]);

        // Verify tags exist in task_tags table via raw SQL.
        let mut stmt = conn
            .prepare("SELECT tag FROM task_tags WHERE task_id = ?1 ORDER BY tag ASC")
            .expect("failed to prepare query");
        let db_tags: Vec<String> = stmt
            .query_map([&task.id], |row| row.get(0))
            .expect("failed to query task_tags")
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(db_tags, vec!["urgent".to_string(), "work".to_string()]);
    }

    #[test]
    fn test_create_task_with_all_optional_fields() {
        let conn = test_db();
        let task = create_task_impl(
            &conn,
            "Full task".to_string(),
            Some("Full description".to_string()),
            Some(vec!["personal".to_string(), "health".to_string()]),
            Some("2026-12-31".to_string()),
        )
        .expect("create_task_impl should succeed");

        assert_eq!(task.title, "Full task");
        assert_eq!(task.description, Some("Full description".to_string()));
        assert_eq!(task.due_date, Some("2026-12-31".to_string()));
        assert_eq!(task.tags, vec!["health".to_string(), "personal".to_string()]);
        assert_eq!(task.status, "active");

        // Verify all fields persisted in database.
        let fetched = get_task_impl(&conn, task.id.clone())
            .expect("get_task_impl should succeed");
        assert_eq!(fetched.description, Some("Full description".to_string()));
        assert_eq!(fetched.due_date, Some("2026-12-31".to_string()));

        // Verify tags in database.
        let tag_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM task_tags WHERE task_id = ?1",
                [&task.id],
                |row| row.get(0),
            )
            .expect("failed to count tags");
        assert_eq!(tag_count, 2, "should have 2 tags in task_tags table");
    }

    #[test]
    fn test_create_task_duplicate_tags_deduplicated() {
        let conn = test_db();
        let task = create_task_impl(
            &conn,
            "Dedup tags task".to_string(),
            None,
            Some(vec![
                "work".to_string(),
                "work".to_string(),
                "urgent".to_string(),
            ]),
            None,
        )
        .expect("create_task_impl should succeed");

        // Tags should be deduplicated and sorted alphabetically.
        assert_eq!(task.tags, vec!["urgent".to_string(), "work".to_string()]);

        // Verify only unique tags exist in task_tags table.
        let tag_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM task_tags WHERE task_id = ?1",
                [&task.id],
                |row| row.get(0),
            )
            .expect("failed to count tags");
        assert_eq!(
            tag_count, 2,
            "should have only 2 unique tags in task_tags table"
        );

        // Verify the actual tags stored.
        let mut stmt = conn
            .prepare("SELECT tag FROM task_tags WHERE task_id = ?1 ORDER BY tag ASC")
            .expect("failed to prepare query");
        let db_tags: Vec<String> = stmt
            .query_map([&task.id], |row| row.get(0))
            .expect("failed to query task_tags")
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(db_tags, vec!["urgent".to_string(), "work".to_string()]);
    }

    // ===================================================================
    // update_task_impl tests
    // ===================================================================

    #[test]
    fn test_update_task_title() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Original title".to_string(), None, None, None)
            .expect("create should succeed");

        let updated = update_task_impl(
            &conn,
            task.id.clone(),
            Some("New title".to_string()),
            None,
            None,
            None,
            None,
        )
        .expect("update should succeed");

        assert_eq!(updated.title, "New title");
        assert_eq!(updated.id, task.id);
        assert!(!updated.updated_at.is_empty(), "updated_at should be set");
    }

    #[test]
    fn test_update_task_status_to_done() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Task to complete".to_string(), None, None, None)
            .expect("create should succeed");

        let updated = update_task_impl(
            &conn,
            task.id.clone(),
            None,
            None,
            Some("done".to_string()),
            None,
            None,
        )
        .expect("update should succeed");

        assert_eq!(updated.status, "done");
    }

    #[test]
    fn test_update_task_status_invalid() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Task with bad status".to_string(), None, None, None)
            .expect("create should succeed");

        let result = update_task_impl(
            &conn,
            task.id.clone(),
            None,
            None,
            Some("invalid_status".to_string()),
            None,
            None,
        );

        assert!(result.is_err(), "updating with invalid status should fail");
        assert!(
            result.unwrap_err().contains("Invalid status"),
            "error should mention invalid status"
        );
    }

    #[test]
    fn test_update_task_description() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Desc task".to_string(), None, None, None)
            .expect("create should succeed");

        let updated = update_task_impl(
            &conn,
            task.id.clone(),
            None,
            Some("New description".to_string()),
            None,
            None,
            None,
        )
        .expect("update should succeed");

        assert_eq!(updated.description, Some("New description".to_string()));
    }

    #[test]
    fn test_update_task_due_date() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Due date task".to_string(), None, None, None)
            .expect("create should succeed");

        let updated = update_task_impl(
            &conn,
            task.id.clone(),
            None,
            None,
            None,
            Some("2026-06-15".to_string()),
            None,
        )
        .expect("update should succeed");

        assert_eq!(updated.due_date, Some("2026-06-15".to_string()));
    }

    #[test]
    fn test_update_task_tags_replace() {
        let conn = test_db();
        let task = create_task_impl(
            &conn,
            "Tags task".to_string(),
            None,
            Some(vec!["a".to_string(), "b".to_string()]),
            None,
        )
        .expect("create should succeed");

        assert_eq!(task.tags, vec!["a".to_string(), "b".to_string()]);

        let updated = update_task_impl(
            &conn,
            task.id.clone(),
            None,
            None,
            None,
            None,
            Some(vec!["c".to_string(), "d".to_string()]),
        )
        .expect("update should succeed");

        assert_eq!(updated.tags, vec!["c".to_string(), "d".to_string()]);

        // Verify old tags are gone from the database.
        let tag_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM task_tags WHERE task_id = ?1",
                [&task.id],
                |row| row.get(0),
            )
            .expect("failed to count tags");
        assert_eq!(tag_count, 2, "should have exactly 2 new tags");
    }

    #[test]
    fn test_update_task_not_found() {
        let conn = test_db();

        let result = update_task_impl(
            &conn,
            "non-existent-id".to_string(),
            Some("New title".to_string()),
            None,
            None,
            None,
            None,
        );

        assert!(result.is_err(), "updating non-existent task should fail");
        assert_eq!(
            result.unwrap_err(),
            "Task not found",
            "error message should be 'Task not found'"
        );
    }

    #[test]
    fn test_update_task_empty_title_rejected() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Valid title".to_string(), None, None, None)
            .expect("create should succeed");

        let result = update_task_impl(
            &conn,
            task.id.clone(),
            Some("".to_string()),
            None,
            None,
            None,
            None,
        );

        assert!(result.is_err(), "updating with empty title should fail");
        assert!(
            result.unwrap_err().contains("Title must not be empty"),
            "error should mention empty title"
        );
    }

    #[test]
    fn test_update_task_partial() {
        let conn = test_db();
        let task = create_task_impl(
            &conn,
            "Original title".to_string(),
            Some("Original description".to_string()),
            None,
            Some("2026-03-15".to_string()),
        )
        .expect("create should succeed");

        // Update only the title.
        let updated = update_task_impl(
            &conn,
            task.id.clone(),
            Some("Updated title".to_string()),
            None,
            None,
            None,
            None,
        )
        .expect("update should succeed");

        assert_eq!(updated.title, "Updated title");
        assert_eq!(
            updated.description,
            Some("Original description".to_string()),
            "description should be unchanged"
        );
        assert_eq!(
            updated.due_date,
            Some("2026-03-15".to_string()),
            "due_date should be unchanged"
        );
        assert_eq!(updated.status, "active", "status should be unchanged");
    }

    // ===================================================================
    // delete_task_impl tests
    // ===================================================================

    #[test]
    fn test_delete_task_soft() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Task to delete".to_string(), None, None, None)
            .expect("create should succeed");

        delete_task_impl(&conn, task.id.clone()).expect("delete should succeed");

        // Verify status is "deleted".
        let fetched = get_task_impl(&conn, task.id.clone())
            .expect("get should succeed even for deleted task");
        assert_eq!(fetched.status, "deleted", "status should be 'deleted'");

        // Verify deleted task is excluded from list (which filters to active only).
        let tasks = list_tasks_impl(&conn, None, None).expect("list should succeed").tasks;
        assert!(
            tasks.iter().all(|t| t.id != task.id),
            "deleted task should not appear in active task list"
        );
    }

    #[test]
    fn test_delete_task_not_found() {
        let conn = test_db();

        let result = delete_task_impl(&conn, "non-existent-id".to_string());
        assert!(result.is_err(), "deleting non-existent task should fail");
        assert_eq!(
            result.unwrap_err(),
            "Task not found",
            "error message should be 'Task not found'"
        );
    }

    #[test]
    fn test_delete_task_updates_timestamp() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Timestamp task".to_string(), None, None, None)
            .expect("create should succeed");

        let original_updated_at = task.updated_at.clone();

        // Small delay to ensure timestamp differs.
        std::thread::sleep(std::time::Duration::from_millis(10));

        delete_task_impl(&conn, task.id.clone()).expect("delete should succeed");

        let fetched = get_task_impl(&conn, task.id.clone())
            .expect("get should succeed after delete");
        assert_ne!(
            fetched.updated_at, original_updated_at,
            "updated_at should change after soft delete"
        );
    }

    // ===================================================================
    // get_task / list_tasks tag & filter tests
    // ===================================================================

    #[test]
    fn test_get_task_returns_tags() {
        let conn = test_db();
        let task = create_task_impl(
            &conn,
            "Tagged task".to_string(),
            None,
            Some(vec!["work".to_string(), "urgent".to_string()]),
            None,
        )
        .expect("create should succeed");

        let fetched = get_task_impl(&conn, task.id.clone())
            .expect("get_task_impl should succeed");

        // Tags should be sorted alphabetically.
        assert_eq!(fetched.tags, vec!["urgent".to_string(), "work".to_string()]);
    }

    #[test]
    fn test_list_tasks_returns_tags() {
        let conn = test_db();
        let task1 = create_task_impl(
            &conn,
            "Task A".to_string(),
            None,
            Some(vec!["a".to_string()]),
            None,
        )
        .expect("create task1 should succeed");

        let task2 = create_task_impl(
            &conn,
            "Task B".to_string(),
            None,
            Some(vec!["b".to_string()]),
            None,
        )
        .expect("create task2 should succeed");

        let tasks = list_tasks_impl(&conn, None, None)
            .expect("list_tasks_impl should succeed").tasks;

        assert_eq!(tasks.len(), 2);

        let t1 = tasks.iter().find(|t| t.id == task1.id).expect("task1 should be in list");
        let t2 = tasks.iter().find(|t| t.id == task2.id).expect("task2 should be in list");

        assert_eq!(t1.tags, vec!["a".to_string()]);
        assert_eq!(t2.tags, vec!["b".to_string()]);
    }

    #[test]
    fn test_list_tasks_filter_by_status() {
        let conn = test_db();
        let _task1 = create_task_impl(&conn, "Active task".to_string(), None, None, None)
            .expect("create task1 should succeed");
        let task2 = create_task_impl(&conn, "Done task".to_string(), None, None, None)
            .expect("create task2 should succeed");

        // Set task2 to "done" via raw SQL.
        conn.execute(
            "UPDATE tasks SET status = 'done' WHERE id = ?1",
            [&task2.id],
        )
        .unwrap();

        let tasks = list_tasks_impl(&conn, Some("done".to_string()), None)
            .expect("list_tasks_impl should succeed").tasks;

        assert_eq!(tasks.len(), 1, "only done tasks should be returned");
        assert_eq!(tasks[0].id, task2.id);
    }

    #[test]
    fn test_list_tasks_filter_by_tag() {
        let conn = test_db();
        let task1 = create_task_impl(
            &conn,
            "Work task 1".to_string(),
            None,
            Some(vec!["work".to_string()]),
            None,
        )
        .expect("create task1 should succeed");

        let _task2 = create_task_impl(
            &conn,
            "Personal task".to_string(),
            None,
            Some(vec!["personal".to_string()]),
            None,
        )
        .expect("create task2 should succeed");

        let task3 = create_task_impl(
            &conn,
            "Work task 2".to_string(),
            None,
            Some(vec!["work".to_string()]),
            None,
        )
        .expect("create task3 should succeed");

        let tasks = list_tasks_impl(&conn, None, Some("work".to_string()))
            .expect("list_tasks_impl should succeed").tasks;

        assert_eq!(tasks.len(), 2, "only tasks with tag 'work' should be returned");

        let ids: Vec<&str> = tasks.iter().map(|t| t.id.as_str()).collect();
        assert!(ids.contains(&task1.id.as_str()), "task1 should be in results");
        assert!(ids.contains(&task3.id.as_str()), "task3 should be in results");
    }

    #[test]
    fn test_list_tasks_filter_by_status_and_tag() {
        let conn = test_db();
        let task1 = create_task_impl(
            &conn,
            "Active work task".to_string(),
            None,
            Some(vec!["work".to_string()]),
            None,
        )
        .expect("create task1 should succeed");

        let task2 = create_task_impl(
            &conn,
            "Done work task".to_string(),
            None,
            Some(vec!["work".to_string()]),
            None,
        )
        .expect("create task2 should succeed");

        // Set task2 to "done".
        conn.execute(
            "UPDATE tasks SET status = 'done' WHERE id = ?1",
            [&task2.id],
        )
        .unwrap();

        let tasks = list_tasks_impl(&conn, Some("done".to_string()), Some("work".to_string()))
            .expect("list_tasks_impl should succeed").tasks;

        assert_eq!(tasks.len(), 1, "only done tasks with tag 'work' should be returned");
        assert_eq!(tasks[0].id, task2.id);
        assert_ne!(tasks[0].id, task1.id, "active task should not be in results");
    }

    // ===================================================================
    // reorder_task_impl tests
    // ===================================================================

    #[test]
    fn test_reorder_task_to_top() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None)
            .expect("create A should succeed");
        let b = create_task_impl(&conn, "B".to_string(), None, None, None)
            .expect("create B should succeed");
        let c = create_task_impl(&conn, "C".to_string(), None, None, None)
            .expect("create C should succeed");

        // Reorder C to top (after_id = None).
        reorder_task_impl(&conn, c.id.clone(), None).expect("reorder should succeed");

        let tasks = list_tasks_impl(&conn, None, None).expect("list should succeed").tasks;
        assert_eq!(tasks.len(), 3);
        assert_eq!(tasks[0].id, c.id, "C should be first");
        assert_eq!(tasks[1].id, a.id, "A should be second");
        assert_eq!(tasks[2].id, b.id, "B should be third");
    }

    #[test]
    fn test_reorder_task_to_middle() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None)
            .expect("create A should succeed");
        let b = create_task_impl(&conn, "B".to_string(), None, None, None)
            .expect("create B should succeed");
        let c = create_task_impl(&conn, "C".to_string(), None, None, None)
            .expect("create C should succeed");

        // Reorder C after A.
        reorder_task_impl(&conn, c.id.clone(), Some(a.id.clone()))
            .expect("reorder should succeed");

        let tasks = list_tasks_impl(&conn, None, None).expect("list should succeed").tasks;
        assert_eq!(tasks.len(), 3);
        assert_eq!(tasks[0].id, a.id, "A should be first");
        assert_eq!(tasks[1].id, c.id, "C should be second");
        assert_eq!(tasks[2].id, b.id, "B should be third");
    }

    #[test]
    fn test_reorder_task_to_end() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None)
            .expect("create A should succeed");
        let b = create_task_impl(&conn, "B".to_string(), None, None, None)
            .expect("create B should succeed");
        let c = create_task_impl(&conn, "C".to_string(), None, None, None)
            .expect("create C should succeed");

        // Reorder A after C.
        reorder_task_impl(&conn, a.id.clone(), Some(c.id.clone()))
            .expect("reorder should succeed");

        let tasks = list_tasks_impl(&conn, None, None).expect("list should succeed").tasks;
        assert_eq!(tasks.len(), 3);
        assert_eq!(tasks[0].id, b.id, "B should be first");
        assert_eq!(tasks[1].id, c.id, "C should be second");
        assert_eq!(tasks[2].id, a.id, "A should be third");
    }

    #[test]
    fn test_reorder_task_not_found() {
        let conn = test_db();

        let result = reorder_task_impl(&conn, "non-existent-id".to_string(), None);
        assert!(result.is_err(), "reordering non-existent task should fail");
        assert_eq!(
            result.unwrap_err(),
            "Task not found",
            "error message should be 'Task not found'"
        );
    }

    #[test]
    fn test_reorder_after_id_not_found() {
        let conn = test_db();
        let task = create_task_impl(&conn, "A".to_string(), None, None, None)
            .expect("create should succeed");

        let result = reorder_task_impl(
            &conn,
            task.id.clone(),
            Some("non-existent-id".to_string()),
        );
        assert!(result.is_err(), "reordering after non-existent task should fail");
        assert!(
            result.unwrap_err().contains("not found"),
            "error should mention not found"
        );
    }

    #[test]
    fn test_reorder_single_task() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Only task".to_string(), None, None, None)
            .expect("create should succeed");

        // Reorder the single task to top. Should succeed without error.
        reorder_task_impl(&conn, task.id.clone(), None)
            .expect("reorder single task to top should succeed");

        let tasks = list_tasks_impl(&conn, None, None).expect("list should succeed").tasks;
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].id, task.id);
    }

    // ===================================================================
    // renumber_active_tasks tests
    // ===================================================================

    #[test]
    fn test_renumber_triggered_by_long_keys() {
        let conn = test_db();

        // Create 3 tasks.
        let a = create_task_impl(&conn, "A".to_string(), None, None, None)
            .expect("create A should succeed");
        let b = create_task_impl(&conn, "B".to_string(), None, None, None)
            .expect("create B should succeed");
        let c = create_task_impl(&conn, "C".to_string(), None, None, None)
            .expect("create C should succeed");

        // Manually set their priority_rank to long strings (>20 chars) via raw SQL.
        conn.execute(
            "UPDATE tasks SET priority_rank = ?1 WHERE id = ?2",
            rusqlite::params!["aaaaaaaaaaaaaaaaaaaaan", a.id],
        )
        .unwrap();
        conn.execute(
            "UPDATE tasks SET priority_rank = ?1 WHERE id = ?2",
            rusqlite::params!["bbbbbbbbbbbbbbbbbbbbbn", b.id],
        )
        .unwrap();
        conn.execute(
            "UPDATE tasks SET priority_rank = ?1 WHERE id = ?2",
            rusqlite::params!["cccccccccccccccccccccn", c.id],
        )
        .unwrap();

        // Verify keys are long.
        let tasks_before = list_tasks_impl(&conn, None, None).expect("list should succeed").tasks;
        assert!(
            tasks_before.iter().any(|t| t.priority_rank.len() > 20),
            "at least one key should exceed 20 chars before reorder"
        );

        // Reorder B to top, which should trigger renumbering.
        reorder_task_impl(&conn, b.id.clone(), None).expect("reorder should succeed");

        // After the reorder, verify all tasks have short priority_rank values.
        let tasks_after = list_tasks_impl(&conn, None, None).expect("list should succeed").tasks;
        assert_eq!(tasks_after.len(), 3);
        for task in &tasks_after {
            assert!(
                task.priority_rank.len() <= 20,
                "priority_rank '{}' for task '{}' should be <= 20 chars after renumber",
                task.priority_rank,
                task.title,
            );
        }

        // Verify the order is correct: B (moved to top), A, C.
        assert_eq!(tasks_after[0].id, b.id, "B should be first (moved to top)");
        assert_eq!(tasks_after[1].id, a.id, "A should be second");
        assert_eq!(tasks_after[2].id, c.id, "C should be third");
    }

    #[test]
    fn test_no_renumber_when_keys_short() {
        let conn = test_db();

        // Create 3 tasks normally (keys will be short).
        let a = create_task_impl(&conn, "A".to_string(), None, None, None)
            .expect("create A should succeed");
        let _b = create_task_impl(&conn, "B".to_string(), None, None, None)
            .expect("create B should succeed");
        let c = create_task_impl(&conn, "C".to_string(), None, None, None)
            .expect("create C should succeed");

        // Record priority_ranks for A (which won't be moved).
        let a_rank_before = get_task_impl(&conn, a.id.clone())
            .expect("get A should succeed")
            .priority_rank;

        // Reorder C after A (move C to middle).
        reorder_task_impl(&conn, c.id.clone(), Some(a.id.clone()))
            .expect("reorder should succeed");

        // Verify the non-moved tasks still have reasonable-length keys.
        let tasks = list_tasks_impl(&conn, None, None).expect("list should succeed").tasks;
        for task in &tasks {
            assert!(
                task.priority_rank.len() <= 20,
                "priority_rank '{}' should be <= 20 chars",
                task.priority_rank,
            );
        }

        // A's rank should be unchanged since no renumbering was triggered.
        let a_rank_after = get_task_impl(&conn, a.id.clone())
            .expect("get A should succeed")
            .priority_rank;
        assert_eq!(
            a_rank_before, a_rank_after,
            "A's priority_rank should be unchanged when no renumbering occurs"
        );
    }

    #[test]
    fn test_renumber_preserves_order() {
        let conn = test_db();

        // Create 5 tasks.
        let t1 = create_task_impl(&conn, "T1".to_string(), None, None, None)
            .expect("create T1 should succeed");
        let t2 = create_task_impl(&conn, "T2".to_string(), None, None, None)
            .expect("create T2 should succeed");
        let t3 = create_task_impl(&conn, "T3".to_string(), None, None, None)
            .expect("create T3 should succeed");
        let t4 = create_task_impl(&conn, "T4".to_string(), None, None, None)
            .expect("create T4 should succeed");
        let t5 = create_task_impl(&conn, "T5".to_string(), None, None, None)
            .expect("create T5 should succeed");

        // Set long keys via raw SQL in a known order.
        conn.execute(
            "UPDATE tasks SET priority_rank = ?1 WHERE id = ?2",
            rusqlite::params!["bbbbbbbbbbbbbbbbbbbbbm", t1.id],
        )
        .unwrap();
        conn.execute(
            "UPDATE tasks SET priority_rank = ?1 WHERE id = ?2",
            rusqlite::params!["ddddddddddddddddddddn", t2.id],
        )
        .unwrap();
        conn.execute(
            "UPDATE tasks SET priority_rank = ?1 WHERE id = ?2",
            rusqlite::params!["ffffffffffffffffffffn", t3.id],
        )
        .unwrap();
        conn.execute(
            "UPDATE tasks SET priority_rank = ?1 WHERE id = ?2",
            rusqlite::params!["hhhhhhhhhhhhhhhhhhhhhhn", t4.id],
        )
        .unwrap();
        conn.execute(
            "UPDATE tasks SET priority_rank = ?1 WHERE id = ?2",
            rusqlite::params!["jjjjjjjjjjjjjjjjjjjjjn", t5.id],
        )
        .unwrap();

        // Reorder T5 after T2 (move T5 to position 3).
        reorder_task_impl(&conn, t5.id.clone(), Some(t2.id.clone()))
            .expect("reorder should succeed");

        // After renumbering, verify all 5 tasks have short keys.
        let tasks = list_tasks_impl(&conn, None, None).expect("list should succeed").tasks;
        assert_eq!(tasks.len(), 5);
        for task in &tasks {
            assert!(
                task.priority_rank.len() <= 20,
                "priority_rank '{}' for task '{}' should be <= 20 chars after renumber",
                task.priority_rank,
                task.title,
            );
        }

        // Verify the expected order is preserved: T1, T2, T5, T3, T4.
        assert_eq!(tasks[0].id, t1.id, "T1 should be first");
        assert_eq!(tasks[1].id, t2.id, "T2 should be second");
        assert_eq!(tasks[2].id, t5.id, "T5 should be third (moved after T2)");
        assert_eq!(tasks[3].id, t3.id, "T3 should be fourth");
        assert_eq!(tasks[4].id, t4.id, "T4 should be fifth");

        // Verify priority_ranks are strictly ascending.
        for i in 1..tasks.len() {
            assert!(
                tasks[i].priority_rank > tasks[i - 1].priority_rank,
                "priority_rank ordering violated: '{}' should be > '{}'",
                tasks[i].priority_rank,
                tasks[i - 1].priority_rank,
            );
        }
    }

    // ===================================================================
    // create_subtask_impl tests
    // ===================================================================

    #[test]
    fn test_create_checklist_subtask() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent task".to_string(), None, None, None)
            .expect("create task should succeed");

        let subtask = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("Step 1".to_string()),
            None,
        )
        .expect("create subtask should succeed");

        assert_eq!(subtask.subtask_type, "checklist");
        assert_eq!(subtask.label, Some("Step 1".to_string()));
        assert_eq!(subtask.is_done, Some(false));
        assert_eq!(subtask.ref_task_id, None);
        assert_eq!(subtask.sort_order, 0);
        assert_eq!(subtask.task_id, task.id);
        assert!(!subtask.id.is_empty(), "subtask id should be non-empty");
        assert!(!subtask.created_at.is_empty(), "created_at should be set");
    }

    #[test]
    fn test_create_checklist_subtask_no_label_error() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent task".to_string(), None, None, None)
            .expect("create task should succeed");

        let result = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            None,
            None,
        );

        assert!(result.is_err(), "creating checklist subtask without label should fail");
        assert_eq!(
            result.unwrap_err(),
            "Checklist subtask requires a label",
        );
    }

    #[test]
    fn test_create_checklist_subtask_empty_label_error() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent task".to_string(), None, None, None)
            .expect("create task should succeed");

        let result = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("".to_string()),
            None,
        );

        assert!(result.is_err(), "creating checklist subtask with empty label should fail");
        assert_eq!(
            result.unwrap_err(),
            "Checklist subtask label must not be empty",
        );
    }

    #[test]
    fn test_create_subtask_parent_not_found() {
        let conn = test_db();

        let result = create_subtask_impl(
            &conn,
            "non-existent-task-id".to_string(),
            "checklist".to_string(),
            Some("Step 1".to_string()),
            None,
        );

        assert!(result.is_err(), "creating subtask for non-existent task should fail");
        assert_eq!(
            result.unwrap_err(),
            "Parent task not found",
        );
    }

    #[test]
    fn test_create_subtask_sort_order_increments() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent task".to_string(), None, None, None)
            .expect("create task should succeed");

        let sub1 = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("Step 1".to_string()),
            None,
        )
        .expect("create subtask 1 should succeed");

        let sub2 = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("Step 2".to_string()),
            None,
        )
        .expect("create subtask 2 should succeed");

        let sub3 = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("Step 3".to_string()),
            None,
        )
        .expect("create subtask 3 should succeed");

        assert_eq!(sub1.sort_order, 0, "first subtask sort_order should be 0");
        assert_eq!(sub2.sort_order, 1, "second subtask sort_order should be 1");
        assert_eq!(sub3.sort_order, 2, "third subtask sort_order should be 2");
    }

    #[test]
    fn test_create_subtask_persisted() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent task".to_string(), None, None, None)
            .expect("create task should succeed");

        let subtask = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("Persisted step".to_string()),
            None,
        )
        .expect("create subtask should succeed");

        // Verify the subtask exists in the database via raw SQL query.
        let (db_id, db_task_id, db_type, db_label, db_is_done, db_sort_order): (
            String,
            String,
            String,
            Option<String>,
            i64,
            i64,
        ) = conn
            .query_row(
                "SELECT id, task_id, type, label, is_done, sort_order FROM subtasks WHERE id = ?1",
                [&subtask.id],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                    ))
                },
            )
            .expect("subtask should exist in the database");

        assert_eq!(db_id, subtask.id);
        assert_eq!(db_task_id, task.id);
        assert_eq!(db_type, "checklist");
        assert_eq!(db_label, Some("Persisted step".to_string()));
        assert_eq!(db_is_done, 0, "is_done should be 0 (false) in the database");
        assert_eq!(db_sort_order, 0);
    }

    // ===================================================================
    // update_subtask_impl tests
    // ===================================================================

    #[test]
    fn test_update_subtask_toggle_done() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent task".to_string(), None, None, None)
            .expect("create task should succeed");

        let subtask = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("Step 1".to_string()),
            None,
        )
        .expect("create subtask should succeed");

        assert_eq!(subtask.is_done, Some(false), "initial is_done should be false");

        let updated = update_subtask_impl(&conn, subtask.id.clone(), None, Some(true))
            .expect("update subtask should succeed");

        assert_eq!(updated.is_done, Some(true), "is_done should be toggled to true");
        assert_eq!(updated.id, subtask.id);
        assert_eq!(updated.label, Some("Step 1".to_string()), "label should be unchanged");
    }

    #[test]
    fn test_update_subtask_label() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent task".to_string(), None, None, None)
            .expect("create task should succeed");

        let subtask = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("Old".to_string()),
            None,
        )
        .expect("create subtask should succeed");

        let updated = update_subtask_impl(
            &conn,
            subtask.id.clone(),
            Some("New".to_string()),
            None,
        )
        .expect("update subtask should succeed");

        assert_eq!(updated.label, Some("New".to_string()), "label should be updated to 'New'");
        assert_eq!(updated.is_done, Some(false), "is_done should be unchanged");
    }

    #[test]
    fn test_update_subtask_both_fields() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent task".to_string(), None, None, None)
            .expect("create task should succeed");

        let subtask = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("Original".to_string()),
            None,
        )
        .expect("create subtask should succeed");

        let updated = update_subtask_impl(
            &conn,
            subtask.id.clone(),
            Some("Updated".to_string()),
            Some(true),
        )
        .expect("update subtask should succeed");

        assert_eq!(updated.label, Some("Updated".to_string()), "label should be updated");
        assert_eq!(updated.is_done, Some(true), "is_done should be updated to true");
    }

    #[test]
    fn test_update_subtask_not_found() {
        let conn = test_db();

        let result = update_subtask_impl(
            &conn,
            "non-existent-subtask-id".to_string(),
            Some("New label".to_string()),
            None,
        );

        assert!(result.is_err(), "updating non-existent subtask should fail");
        assert_eq!(
            result.unwrap_err(),
            "Subtask not found",
            "error message should be 'Subtask not found'"
        );
    }

    #[test]
    fn test_update_subtask_empty_label_error() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent task".to_string(), None, None, None)
            .expect("create task should succeed");

        let subtask = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("Valid label".to_string()),
            None,
        )
        .expect("create subtask should succeed");

        let result = update_subtask_impl(
            &conn,
            subtask.id.clone(),
            Some("".to_string()),
            None,
        );

        assert!(result.is_err(), "updating with empty label should fail");
        assert_eq!(
            result.unwrap_err(),
            "Label must not be empty",
            "error message should be 'Label must not be empty'"
        );
    }

    #[test]
    fn test_update_subtask_no_fields_error() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent task".to_string(), None, None, None)
            .expect("create task should succeed");

        let subtask = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("Some label".to_string()),
            None,
        )
        .expect("create subtask should succeed");

        let result = update_subtask_impl(&conn, subtask.id.clone(), None, None);

        assert!(result.is_err(), "updating with no fields should fail");
        assert_eq!(
            result.unwrap_err(),
            "No fields to update",
            "error message should be 'No fields to update'"
        );
    }

    #[test]
    fn test_update_subtask_taskref_is_done_rejected() {
        let conn = test_db();
        let parent = create_task_impl(&conn, "Parent".to_string(), None, None, None)
            .expect("create parent");
        let ref_task = create_task_impl(&conn, "Referenced".to_string(), None, None, None)
            .expect("create ref task");

        let subtask = create_subtask_impl(
            &conn,
            parent.id.clone(),
            "taskref".to_string(),
            None,
            Some(ref_task.id.clone()),
        )
        .expect("create taskref subtask");

        let result = update_subtask_impl(&conn, subtask.id.clone(), None, Some(true));

        assert!(result.is_err(), "is_done update on taskref should fail");
        assert_eq!(
            result.unwrap_err(),
            "Cannot update is_done for taskref subtasks"
        );
    }

    #[test]
    fn test_update_subtask_taskref_label_allowed() {
        let conn = test_db();
        let parent = create_task_impl(&conn, "Parent".to_string(), None, None, None)
            .expect("create parent");
        let ref_task = create_task_impl(&conn, "Referenced".to_string(), None, None, None)
            .expect("create ref task");

        let subtask = create_subtask_impl(
            &conn,
            parent.id.clone(),
            "taskref".to_string(),
            None,
            Some(ref_task.id.clone()),
        )
        .expect("create taskref subtask");

        // Label updates should still be accepted for taskref (even though label is typically NULL).
        let updated = update_subtask_impl(
            &conn,
            subtask.id.clone(),
            Some("Custom label".to_string()),
            None,
        )
        .expect("label update on taskref should succeed");

        assert_eq!(updated.label, Some("Custom label".to_string()));
    }

    // ===================================================================
    // delete_subtask_impl tests
    // ===================================================================

    #[test]
    fn test_delete_subtask() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent task".to_string(), None, None, None)
            .expect("create task should succeed");

        let subtask = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("To be deleted".to_string()),
            None,
        )
        .expect("create subtask should succeed");

        delete_subtask_impl(&conn, subtask.id.clone()).expect("delete subtask should succeed");

        // Verify the subtask is gone via raw SQL query.
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM subtasks WHERE id = ?1",
                [&subtask.id],
                |row| row.get(0),
            )
            .expect("count query should succeed");
        assert_eq!(count, 0, "subtask should no longer exist in the database");
    }

    #[test]
    fn test_delete_subtask_not_found() {
        let conn = test_db();

        let result = delete_subtask_impl(&conn, "non-existent-subtask-id".to_string());
        assert!(result.is_err(), "deleting non-existent subtask should fail");
        assert_eq!(
            result.unwrap_err(),
            "Subtask not found",
            "error message should be 'Subtask not found'"
        );
    }

    #[test]
    fn test_delete_subtask_does_not_affect_parent() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent task".to_string(), None, None, None)
            .expect("create task should succeed");

        let subtask = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("Child subtask".to_string()),
            None,
        )
        .expect("create subtask should succeed");

        delete_subtask_impl(&conn, subtask.id.clone()).expect("delete subtask should succeed");

        // Verify the parent task still exists.
        let parent = get_task_impl(&conn, task.id.clone())
            .expect("get_task_impl should succeed — parent task should still exist");
        assert_eq!(parent.id, task.id, "parent task id should match");
        assert_eq!(parent.title, "Parent task", "parent task title should be unchanged");
    }

    // ===================================================================
    // reorder_subtasks_impl tests
    // ===================================================================

    #[test]
    fn test_reorder_subtasks() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent task".to_string(), None, None, None)
            .expect("create task should succeed");

        let sub_a = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("A".to_string()),
            None,
        )
        .expect("create subtask A should succeed");

        let sub_b = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("B".to_string()),
            None,
        )
        .expect("create subtask B should succeed");

        let sub_c = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("C".to_string()),
            None,
        )
        .expect("create subtask C should succeed");

        // Initial order: A=0, B=1, C=2. Reorder to [C, A, B].
        reorder_subtasks_impl(
            &conn,
            task.id.clone(),
            vec![sub_c.id.clone(), sub_a.id.clone(), sub_b.id.clone()],
        )
        .expect("reorder subtasks should succeed");

        // Verify sort_order via raw SQL.
        let sort_c: i64 = conn
            .query_row(
                "SELECT sort_order FROM subtasks WHERE id = ?1",
                [&sub_c.id],
                |row| row.get(0),
            )
            .expect("query C sort_order should succeed");
        let sort_a: i64 = conn
            .query_row(
                "SELECT sort_order FROM subtasks WHERE id = ?1",
                [&sub_a.id],
                |row| row.get(0),
            )
            .expect("query A sort_order should succeed");
        let sort_b: i64 = conn
            .query_row(
                "SELECT sort_order FROM subtasks WHERE id = ?1",
                [&sub_b.id],
                |row| row.get(0),
            )
            .expect("query B sort_order should succeed");

        assert_eq!(sort_c, 0, "C should have sort_order 0");
        assert_eq!(sort_a, 1, "A should have sort_order 1");
        assert_eq!(sort_b, 2, "B should have sort_order 2");
    }

    #[test]
    fn test_reorder_subtasks_parent_not_found() {
        let conn = test_db();

        let result = reorder_subtasks_impl(
            &conn,
            "non-existent-task-id".to_string(),
            vec!["some-subtask-id".to_string()],
        );

        assert!(result.is_err(), "reordering subtasks for non-existent task should fail");
        assert_eq!(
            result.unwrap_err(),
            "Parent task not found",
            "error message should be 'Parent task not found'"
        );
    }

    #[test]
    fn test_reorder_subtasks_subtask_not_found() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent task".to_string(), None, None, None)
            .expect("create task should succeed");

        let _sub = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("Real subtask".to_string()),
            None,
        )
        .expect("create subtask should succeed");

        let result = reorder_subtasks_impl(
            &conn,
            task.id.clone(),
            vec!["non-existent-subtask-id".to_string()],
        );

        assert!(result.is_err(), "reordering with non-existent subtask ID should fail");
        assert!(
            result.unwrap_err().contains("not found"),
            "error should mention not found"
        );
    }

    #[test]
    fn test_reorder_subtasks_wrong_parent() {
        let conn = test_db();
        let task1 = create_task_impl(&conn, "Task 1".to_string(), None, None, None)
            .expect("create task1 should succeed");
        let task2 = create_task_impl(&conn, "Task 2".to_string(), None, None, None)
            .expect("create task2 should succeed");

        let sub = create_subtask_impl(
            &conn,
            task1.id.clone(),
            "checklist".to_string(),
            Some("Belongs to task1".to_string()),
            None,
        )
        .expect("create subtask should succeed");

        // Try to reorder a subtask of task1 under task2.
        let result = reorder_subtasks_impl(
            &conn,
            task2.id.clone(),
            vec![sub.id.clone()],
        );

        assert!(result.is_err(), "reordering subtask under wrong parent should fail");
        assert!(
            result.unwrap_err().contains("does not belong to task"),
            "error should mention wrong parent"
        );
    }

    // ===================================================================
    // get_task_impl subtask inclusion tests
    // ===================================================================

    #[test]
    fn test_get_task_returns_subtasks() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent with subtasks".to_string(), None, None, None)
            .expect("create task should succeed");

        let sub1 = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("Step 1".to_string()),
            None,
        )
        .expect("create subtask 1 should succeed");

        let sub2 = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("Step 2".to_string()),
            None,
        )
        .expect("create subtask 2 should succeed");

        let fetched = get_task_impl(&conn, task.id.clone())
            .expect("get_task_impl should succeed");

        assert_eq!(fetched.subtasks.len(), 2, "should have 2 subtasks");
        assert_eq!(fetched.subtasks[0].id, sub1.id, "first subtask should be sub1");
        assert_eq!(fetched.subtasks[1].id, sub2.id, "second subtask should be sub2");
        assert_eq!(fetched.subtasks[0].label, Some("Step 1".to_string()));
        assert_eq!(fetched.subtasks[1].label, Some("Step 2".to_string()));
        assert_eq!(fetched.subtasks[0].sort_order, 0);
        assert_eq!(fetched.subtasks[1].sort_order, 1);
    }

    #[test]
    fn test_get_task_subtasks_ordered() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Reorder parent".to_string(), None, None, None)
            .expect("create task should succeed");

        let sub_a = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("A".to_string()),
            None,
        )
        .expect("create subtask A should succeed");

        let sub_b = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("B".to_string()),
            None,
        )
        .expect("create subtask B should succeed");

        let sub_c = create_subtask_impl(
            &conn,
            task.id.clone(),
            "checklist".to_string(),
            Some("C".to_string()),
            None,
        )
        .expect("create subtask C should succeed");

        // Reorder to [C, A, B].
        reorder_subtasks_impl(
            &conn,
            task.id.clone(),
            vec![sub_c.id.clone(), sub_a.id.clone(), sub_b.id.clone()],
        )
        .expect("reorder subtasks should succeed");

        let fetched = get_task_impl(&conn, task.id.clone())
            .expect("get_task_impl should succeed");

        assert_eq!(fetched.subtasks.len(), 3, "should have 3 subtasks");
        assert_eq!(fetched.subtasks[0].id, sub_c.id, "first should be C after reorder");
        assert_eq!(fetched.subtasks[1].id, sub_a.id, "second should be A after reorder");
        assert_eq!(fetched.subtasks[2].id, sub_b.id, "third should be B after reorder");
        assert_eq!(fetched.subtasks[0].sort_order, 0);
        assert_eq!(fetched.subtasks[1].sort_order, 1);
        assert_eq!(fetched.subtasks[2].sort_order, 2);
    }

    #[test]
    fn test_get_task_no_subtasks() {
        let conn = test_db();
        let task = create_task_impl(&conn, "No subtasks task".to_string(), None, None, None)
            .expect("create task should succeed");

        let fetched = get_task_impl(&conn, task.id.clone())
            .expect("get_task_impl should succeed");

        assert!(fetched.subtasks.is_empty(), "subtasks should be an empty vec for a task with no subtasks");
    }

    #[test]
    fn test_get_task_taskref_computes_is_done_from_ref_status() {
        let conn = test_db();
        let parent = create_task_impl(&conn, "Parent".to_string(), None, None, None)
            .expect("create parent");
        let ref_task = create_task_impl(&conn, "Referenced".to_string(), None, None, None)
            .expect("create ref task");

        create_subtask_impl(
            &conn,
            parent.id.clone(),
            "taskref".to_string(),
            None,
            Some(ref_task.id.clone()),
        )
        .expect("create taskref subtask");

        // Ref task is active → taskref is_done = false.
        let fetched = get_task_impl(&conn, parent.id.clone()).expect("get parent");
        assert_eq!(fetched.subtasks.len(), 1);
        assert_eq!(fetched.subtasks[0].is_done, Some(false));
        assert_eq!(fetched.subtasks[0].ref_task_title, Some("Referenced".to_string()));
        assert_eq!(fetched.subtasks[0].ref_task_status, Some("active".to_string()));

        // Set ref task to "done" → taskref is_done = true.
        update_task_impl(&conn, ref_task.id.clone(), None, None, Some("done".to_string()), None, None)
            .expect("update ref to done");
        let fetched2 = get_task_impl(&conn, parent.id.clone()).expect("get parent again");
        assert_eq!(fetched2.subtasks[0].is_done, Some(true));
        assert_eq!(fetched2.subtasks[0].ref_task_status, Some("done".to_string()));
    }

    #[test]
    fn test_get_task_taskref_deleted_ref_shows_placeholder() {
        let conn = test_db();
        let parent = create_task_impl(&conn, "Parent".to_string(), None, None, None)
            .expect("create parent");
        let ref_task = create_task_impl(&conn, "Will be deleted".to_string(), None, None, None)
            .expect("create ref task");

        create_subtask_impl(
            &conn,
            parent.id.clone(),
            "taskref".to_string(),
            None,
            Some(ref_task.id.clone()),
        )
        .expect("create taskref subtask");

        // Soft-delete the referenced task.
        delete_task_impl(&conn, ref_task.id.clone()).expect("soft delete ref task");

        let fetched = get_task_impl(&conn, parent.id.clone()).expect("get parent");
        assert_eq!(fetched.subtasks.len(), 1);
        assert_eq!(fetched.subtasks[0].ref_task_title, Some("Referenced task deleted".to_string()));
        assert_eq!(fetched.subtasks[0].ref_task_status, None);
        assert_eq!(fetched.subtasks[0].is_done, Some(false), "deleted ref should be incomplete");
    }

    #[test]
    fn test_get_task_mixed_checklist_and_taskref() {
        let conn = test_db();
        let parent = create_task_impl(&conn, "Parent".to_string(), None, None, None)
            .expect("create parent");
        let ref_task = create_task_impl(&conn, "Ref".to_string(), None, None, None)
            .expect("create ref task");

        create_subtask_impl(
            &conn,
            parent.id.clone(),
            "checklist".to_string(),
            Some("Step 1".to_string()),
            None,
        )
        .expect("create checklist subtask");

        create_subtask_impl(
            &conn,
            parent.id.clone(),
            "taskref".to_string(),
            None,
            Some(ref_task.id.clone()),
        )
        .expect("create taskref subtask");

        let fetched = get_task_impl(&conn, parent.id.clone()).expect("get parent");
        assert_eq!(fetched.subtasks.len(), 2);

        // Checklist subtask: no ref fields.
        assert_eq!(fetched.subtasks[0].subtask_type, "checklist");
        assert_eq!(fetched.subtasks[0].is_done, Some(false));
        assert!(fetched.subtasks[0].ref_task_title.is_none());
        assert!(fetched.subtasks[0].ref_task_status.is_none());

        // Taskref subtask: ref fields populated.
        assert_eq!(fetched.subtasks[1].subtask_type, "taskref");
        assert_eq!(fetched.subtasks[1].ref_task_title, Some("Ref".to_string()));
        assert_eq!(fetched.subtasks[1].ref_task_status, Some("active".to_string()));
        assert_eq!(fetched.subtasks[1].is_done, Some(false));
    }

    // ===================================================================
    // taskref subtask tests
    // ===================================================================

    #[test]
    fn test_create_taskref_subtask() {
        let conn = test_db();
        let task_a = create_task_impl(&conn, "Parent".to_string(), None, None, None)
            .expect("create task A");
        let task_b = create_task_impl(&conn, "Referenced".to_string(), None, None, None)
            .expect("create task B");

        let subtask = create_subtask_impl(
            &conn, task_a.id.clone(), "taskref".to_string(), None, Some(task_b.id.clone()),
        ).expect("create taskref subtask");

        assert_eq!(subtask.subtask_type, "taskref");
        assert_eq!(subtask.label, None);
        assert_eq!(subtask.is_done, None);
        assert_eq!(subtask.ref_task_id, Some(task_b.id));
        assert_eq!(subtask.sort_order, 0);
    }

    #[test]
    fn test_create_taskref_subtask_no_ref_task_id_error() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent".to_string(), None, None, None).expect("create task");
        let result = create_subtask_impl(&conn, task.id.clone(), "taskref".to_string(), None, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("requires ref_task_id"));
    }

    #[test]
    fn test_create_taskref_subtask_ref_not_found() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent".to_string(), None, None, None).expect("create task");
        let result = create_subtask_impl(
            &conn, task.id.clone(), "taskref".to_string(), None, Some("nonexistent".to_string()),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[test]
    fn test_create_subtask_invalid_type() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Parent".to_string(), None, None, None).expect("create task");
        let result = create_subtask_impl(&conn, task.id.clone(), "invalid".to_string(), None, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid subtask type"));
    }

    #[test]
    fn test_create_mixed_subtasks_sort_order() {
        let conn = test_db();
        let task_a = create_task_impl(&conn, "Parent".to_string(), None, None, None).expect("create A");
        let task_b = create_task_impl(&conn, "Ref target".to_string(), None, None, None).expect("create B");

        let checklist = create_subtask_impl(
            &conn, task_a.id.clone(), "checklist".to_string(), Some("Step 1".to_string()), None,
        ).expect("create checklist");
        let taskref = create_subtask_impl(
            &conn, task_a.id.clone(), "taskref".to_string(), None, Some(task_b.id.clone()),
        ).expect("create taskref");

        assert_eq!(checklist.sort_order, 0);
        assert_eq!(taskref.sort_order, 1);
    }

    #[test]
    fn test_create_subtask_self_reference_rejected() {
        let conn = test_db();
        let task = create_task_impl(&conn, "Self".to_string(), None, None, None).expect("create");
        let result = create_subtask_impl(
            &conn, task.id.clone(), "taskref".to_string(), None, Some(task.id.clone()),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("cannot reference itself"));
    }

    #[test]
    fn test_create_subtask_circular_reference_rejected() {
        let conn = test_db();
        let task_a = create_task_impl(&conn, "A".to_string(), None, None, None).expect("create A");
        let task_b = create_task_impl(&conn, "B".to_string(), None, None, None).expect("create B");

        // A refs B (allowed)
        create_subtask_impl(
            &conn, task_a.id.clone(), "taskref".to_string(), None, Some(task_b.id.clone()),
        ).expect("A refs B");

        // B refs A (circular — should fail)
        let result = create_subtask_impl(
            &conn, task_b.id.clone(), "taskref".to_string(), None, Some(task_a.id.clone()),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("CircularTaskRefNotAllowed"));
    }

    #[test]
    fn test_create_subtask_non_circular_reference_allowed() {
        let conn = test_db();
        let task_a = create_task_impl(&conn, "A".to_string(), None, None, None).expect("create A");
        let task_b = create_task_impl(&conn, "B".to_string(), None, None, None).expect("create B");
        let task_c = create_task_impl(&conn, "C".to_string(), None, None, None).expect("create C");

        // A refs B
        create_subtask_impl(
            &conn, task_a.id.clone(), "taskref".to_string(), None, Some(task_b.id.clone()),
        ).expect("A refs B");

        // C refs A (not circular — C doesn't appear in A's subtasks)
        let result = create_subtask_impl(
            &conn, task_c.id.clone(), "taskref".to_string(), None, Some(task_a.id.clone()),
        );
        assert!(result.is_ok());
    }

    // ========= Dependency CRUD tests =========

    #[test]
    fn test_create_dependency_happy_path() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "B".to_string(), None, None, None).unwrap();

        let result = create_dependency_impl(&conn, a.id.clone(), b.id.clone())
            .expect("should create dependency");

        assert_eq!(result.edge.blocker_task_id, a.id);
        assert_eq!(result.edge.dependent_task_id, b.id);
        assert!(!result.edge.id.is_empty());
        assert!(!result.is_cyclic); // SCC not yet — always false
    }

    #[test]
    fn test_create_dependency_self_dep_rejected() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();

        let result = create_dependency_impl(&conn, a.id.clone(), a.id.clone());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("SelfDependencyNotAllowed"));
    }

    #[test]
    fn test_create_dependency_duplicate_rejected() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "B".to_string(), None, None, None).unwrap();

        create_dependency_impl(&conn, a.id.clone(), b.id.clone()).expect("first should succeed");
        let dup = create_dependency_impl(&conn, a.id.clone(), b.id.clone());
        assert!(dup.is_err());
        assert!(dup.unwrap_err().contains("DuplicateDependency"));
    }

    #[test]
    fn test_create_dependency_blocker_not_found() {
        let conn = test_db();
        let b = create_task_impl(&conn, "B".to_string(), None, None, None).unwrap();

        let result = create_dependency_impl(&conn, "nonexistent".to_string(), b.id.clone());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Blocker task not found"));
    }

    #[test]
    fn test_create_dependency_dependent_not_found() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();

        let result = create_dependency_impl(&conn, a.id.clone(), "nonexistent".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Dependent task not found"));
    }

    #[test]
    fn test_create_dependency_deleted_blocker_rejected() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "B".to_string(), None, None, None).unwrap();

        // Soft-delete task A.
        update_task_impl(&conn, a.id.clone(), None, None, Some("deleted".to_string()), None, None)
            .expect("delete A");

        let result = create_dependency_impl(&conn, a.id.clone(), b.id.clone());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Blocker task is deleted"));
    }

    #[test]
    fn test_create_dependency_deleted_dependent_rejected() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "B".to_string(), None, None, None).unwrap();

        // Soft-delete task B.
        update_task_impl(&conn, b.id.clone(), None, None, Some("deleted".to_string()), None, None)
            .expect("delete B");

        let result = create_dependency_impl(&conn, a.id.clone(), b.id.clone());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Dependent task is deleted"));
    }

    #[test]
    fn test_delete_dependency_happy_path() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "B".to_string(), None, None, None).unwrap();

        let dep = create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();
        let result = delete_dependency_impl(&conn, dep.edge.id.clone());
        assert!(result.is_ok());

        // Verify it's actually gone.
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM task_dependencies WHERE id = ?1",
                [&dep.edge.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_delete_dependency_not_found() {
        let conn = test_db();
        let result = delete_dependency_impl(&conn, "nonexistent".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Dependency not found"));
    }

    // ========= create_dependency_impl + SCC integration tests =========

    #[test]
    fn test_create_dependency_non_cyclic_returns_false() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "B".to_string(), None, None, None).unwrap();

        let result = create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();
        assert!(!result.is_cyclic, "A→B without back-edge should not be cyclic");
    }

    #[test]
    fn test_create_dependency_cyclic_returns_true() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "B".to_string(), None, None, None).unwrap();

        // A→B: not cyclic
        let r1 = create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();
        assert!(!r1.is_cyclic);

        // B→A: creates cycle
        let r2 = create_dependency_impl(&conn, b.id.clone(), a.id.clone()).unwrap();
        assert!(r2.is_cyclic, "B→A after A→B should form a cycle");
    }

    // ========= SCC (Tarjan) tests =========

    #[test]
    fn test_scc_no_edges() {
        let conn = test_db();
        // Create tasks but no dependencies.
        create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();
        let sccs = compute_sccs(&conn).unwrap();
        assert!(sccs.is_empty());
    }

    #[test]
    fn test_scc_single_edge_no_cycle() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "B".to_string(), None, None, None).unwrap();
        create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();

        let sccs = compute_sccs(&conn).unwrap();
        assert!(sccs.is_empty(), "A→B with no back-edge should not form an SCC");
        assert!(!task_is_cyclic(&sccs, &a.id));
        assert!(!task_is_cyclic(&sccs, &b.id));
    }

    #[test]
    fn test_scc_two_node_cycle() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "B".to_string(), None, None, None).unwrap();
        create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();
        create_dependency_impl(&conn, b.id.clone(), a.id.clone()).unwrap();

        let sccs = compute_sccs(&conn).unwrap();
        assert_eq!(sccs.len(), 1);
        assert!(task_is_cyclic(&sccs, &a.id));
        assert!(task_is_cyclic(&sccs, &b.id));
        assert!(is_in_same_scc(&sccs, &a.id, &b.id));
    }

    #[test]
    fn test_scc_three_node_cycle() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "B".to_string(), None, None, None).unwrap();
        let c = create_task_impl(&conn, "C".to_string(), None, None, None).unwrap();
        // A→B→C→A
        create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();
        create_dependency_impl(&conn, b.id.clone(), c.id.clone()).unwrap();
        create_dependency_impl(&conn, c.id.clone(), a.id.clone()).unwrap();

        let sccs = compute_sccs(&conn).unwrap();
        assert_eq!(sccs.len(), 1);
        assert_eq!(sccs[0].len(), 3);
        assert!(task_is_cyclic(&sccs, &a.id));
        assert!(task_is_cyclic(&sccs, &b.id));
        assert!(task_is_cyclic(&sccs, &c.id));
    }

    #[test]
    fn test_scc_two_separate_cycles() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "B".to_string(), None, None, None).unwrap();
        let c = create_task_impl(&conn, "C".to_string(), None, None, None).unwrap();
        let d = create_task_impl(&conn, "D".to_string(), None, None, None).unwrap();
        // Cycle 1: A↔B
        create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();
        create_dependency_impl(&conn, b.id.clone(), a.id.clone()).unwrap();
        // Cycle 2: C↔D
        create_dependency_impl(&conn, c.id.clone(), d.id.clone()).unwrap();
        create_dependency_impl(&conn, d.id.clone(), c.id.clone()).unwrap();

        let sccs = compute_sccs(&conn).unwrap();
        assert_eq!(sccs.len(), 2);
        assert!(is_in_same_scc(&sccs, &a.id, &b.id));
        assert!(is_in_same_scc(&sccs, &c.id, &d.id));
        assert!(!is_in_same_scc(&sccs, &a.id, &c.id));
    }

    #[test]
    fn test_scc_mixed_cyclic_and_non_cyclic() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "B".to_string(), None, None, None).unwrap();
        let c = create_task_impl(&conn, "C".to_string(), None, None, None).unwrap();
        // A↔B cycle, C→A (C is not in a cycle)
        create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();
        create_dependency_impl(&conn, b.id.clone(), a.id.clone()).unwrap();
        create_dependency_impl(&conn, c.id.clone(), a.id.clone()).unwrap();

        let sccs = compute_sccs(&conn).unwrap();
        assert_eq!(sccs.len(), 1); // Only the A↔B cycle
        assert!(task_is_cyclic(&sccs, &a.id));
        assert!(task_is_cyclic(&sccs, &b.id));
        assert!(!task_is_cyclic(&sccs, &c.id));
    }

    // ========= TaskListResult / dependency flags tests =========

    #[test]
    fn test_list_tasks_no_deps_flags_default() {
        let conn = test_db();
        create_task_impl(&conn, "Solo".to_string(), None, None, None).unwrap();

        let result = list_tasks_impl(&conn, None, None).unwrap();
        assert_eq!(result.tasks.len(), 1);
        assert!(!result.tasks[0].is_cyclic);
        assert!(!result.tasks[0].is_blocked);
        assert!(result.tasks[0].unsatisfied_blocker_names.is_empty());
        assert!(result.dependencies.is_empty());
    }

    #[test]
    fn test_list_tasks_unsatisfied_non_cyclic_blocker() {
        let conn = test_db();
        let a = create_task_impl(&conn, "Blocker A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "Dependent B".to_string(), None, None, None).unwrap();
        // A blocks B (A is active → unsatisfied)
        create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();

        let result = list_tasks_impl(&conn, None, None).unwrap();
        let task_b = result.tasks.iter().find(|t| t.id == b.id).unwrap();
        assert!(task_b.is_blocked);
        assert!(!task_b.is_cyclic);
        assert_eq!(task_b.unsatisfied_blocker_names, vec!["Blocker A"]);
    }

    #[test]
    fn test_list_tasks_only_cyclic_blockers_not_blocked() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "B".to_string(), None, None, None).unwrap();
        // A↔B cycle
        create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();
        create_dependency_impl(&conn, b.id.clone(), a.id.clone()).unwrap();

        let result = list_tasks_impl(&conn, None, None).unwrap();
        let task_a = result.tasks.iter().find(|t| t.id == a.id).unwrap();
        let task_b = result.tasks.iter().find(|t| t.id == b.id).unwrap();
        // Both are cyclic but NOT blocked (cyclic blockers don't count as blocking)
        assert!(task_a.is_cyclic);
        assert!(!task_a.is_blocked);
        assert!(task_b.is_cyclic);
        assert!(!task_b.is_blocked);
    }

    #[test]
    fn test_list_tasks_mixed_cyclic_and_non_cyclic_blockers() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "B".to_string(), None, None, None).unwrap();
        let c = create_task_impl(&conn, "External C".to_string(), None, None, None).unwrap();
        // A↔B cycle + C blocks B (non-cyclic)
        create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();
        create_dependency_impl(&conn, b.id.clone(), a.id.clone()).unwrap();
        create_dependency_impl(&conn, c.id.clone(), b.id.clone()).unwrap();

        let result = list_tasks_impl(&conn, None, None).unwrap();
        let task_b = result.tasks.iter().find(|t| t.id == b.id).unwrap();
        assert!(task_b.is_cyclic);
        assert!(task_b.is_blocked);
        assert_eq!(task_b.unsatisfied_blocker_names, vec!["External C"]);
    }

    #[test]
    fn test_list_tasks_satisfied_blocker_not_blocked() {
        let conn = test_db();
        let a = create_task_impl(&conn, "Done Blocker".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "Dependent".to_string(), None, None, None).unwrap();
        // A blocks B, then mark A as done
        create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();
        update_task_impl(&conn, a.id.clone(), None, None, Some("done".to_string()), None, None)
            .unwrap();

        // list only active tasks — A is done so it won't be in the list, but B should be
        let result = list_tasks_impl(&conn, None, None).unwrap();
        let task_b = result.tasks.iter().find(|t| t.id == b.id).unwrap();
        assert!(!task_b.is_blocked, "satisfied blocker should not block");
        assert!(task_b.unsatisfied_blocker_names.is_empty());
    }

    // ========= get_task_impl dependency enrichment tests =========

    #[test]
    fn test_get_task_returns_blockers() {
        let conn = test_db();
        let a = create_task_impl(&conn, "Blocker A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "Dependent B".to_string(), None, None, None).unwrap();
        create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();

        let task_b = get_task_impl(&conn, b.id.clone()).unwrap();
        assert_eq!(task_b.blockers.len(), 1);
        assert_eq!(task_b.blockers[0].task_id, a.id);
        assert_eq!(task_b.blockers[0].task_title, "Blocker A");
        assert_eq!(task_b.blockers[0].task_status, "active");
        assert!(task_b.dependents.is_empty());
    }

    #[test]
    fn test_get_task_returns_dependents() {
        let conn = test_db();
        let a = create_task_impl(&conn, "Blocker A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "Dependent B".to_string(), None, None, None).unwrap();
        create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();

        let task_a = get_task_impl(&conn, a.id.clone()).unwrap();
        assert_eq!(task_a.dependents.len(), 1);
        assert_eq!(task_a.dependents[0].task_id, b.id);
        assert_eq!(task_a.dependents[0].task_title, "Dependent B");
        assert!(task_a.blockers.is_empty());
    }

    #[test]
    fn test_get_task_computed_flags() {
        let conn = test_db();
        let a = create_task_impl(&conn, "A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "B".to_string(), None, None, None).unwrap();
        let c = create_task_impl(&conn, "External C".to_string(), None, None, None).unwrap();
        // A↔B cycle + C blocks B
        create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();
        create_dependency_impl(&conn, b.id.clone(), a.id.clone()).unwrap();
        create_dependency_impl(&conn, c.id.clone(), b.id.clone()).unwrap();

        let task_b = get_task_impl(&conn, b.id.clone()).unwrap();
        assert!(task_b.is_cyclic, "B should be cyclic (A↔B)");
        assert!(task_b.is_blocked, "B should be blocked by C");
        assert_eq!(task_b.unsatisfied_blocker_names, vec!["External C"]);

        // A is cyclic but not blocked (only cyclic blocker B)
        let task_a = get_task_impl(&conn, a.id.clone()).unwrap();
        assert!(task_a.is_cyclic);
        assert!(!task_a.is_blocked);

        // C has no blockers and is not cyclic
        let task_c = get_task_impl(&conn, c.id.clone()).unwrap();
        assert!(!task_c.is_cyclic);
        assert!(!task_c.is_blocked);
    }

    // ===== Blocking enforcement tests =====

    #[test]
    fn test_blocking_enforcement_rejects_done_with_unsatisfied_blocker() {
        let conn = test_db();
        let blocker = create_task_impl(&conn, "Blocker".to_string(), None, None, None).unwrap();
        let dependent = create_task_impl(&conn, "Dependent".to_string(), None, None, None).unwrap();
        create_dependency_impl(&conn, blocker.id.clone(), dependent.id.clone()).unwrap();

        let result = update_task_impl(
            &conn, dependent.id.clone(), None, None,
            Some("done".to_string()), None, None,
        );
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("BlockedByUnsatisfiedDependencies"));
        assert!(err.contains("Blocker"));
    }

    #[test]
    fn test_blocking_enforcement_allows_done_with_only_cyclic_blockers() {
        let conn = test_db();
        let a = create_task_impl(&conn, "Task A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "Task B".to_string(), None, None, None).unwrap();
        // Create cycle: A→B and B→A
        create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();
        create_dependency_impl(&conn, b.id.clone(), a.id.clone()).unwrap();

        // Both should be allowed to mark as done (only cyclic blockers)
        let result = update_task_impl(
            &conn, a.id.clone(), None, None,
            Some("done".to_string()), None, None,
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_blocking_enforcement_allows_done_with_satisfied_blockers() {
        let conn = test_db();
        let blocker = create_task_impl(&conn, "Blocker".to_string(), None, None, None).unwrap();
        let dependent = create_task_impl(&conn, "Dependent".to_string(), None, None, None).unwrap();
        create_dependency_impl(&conn, blocker.id.clone(), dependent.id.clone()).unwrap();

        // Mark blocker as done first
        update_task_impl(
            &conn, blocker.id.clone(), None, None,
            Some("done".to_string()), None, None,
        ).unwrap();

        // Now dependent should be allowed to mark as done
        let result = update_task_impl(
            &conn, dependent.id.clone(), None, None,
            Some("done".to_string()), None, None,
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_blocking_enforcement_mixed_cyclic_and_non_cyclic_rejects() {
        let conn = test_db();
        let a = create_task_impl(&conn, "Task A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "Task B".to_string(), None, None, None).unwrap();
        let c = create_task_impl(&conn, "Non-cyclic Blocker".to_string(), None, None, None).unwrap();

        // A→B and B→A (cycle)
        create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();
        create_dependency_impl(&conn, b.id.clone(), a.id.clone()).unwrap();
        // C→A (non-cyclic blocker)
        create_dependency_impl(&conn, c.id.clone(), a.id.clone()).unwrap();

        let result = update_task_impl(
            &conn, a.id.clone(), None, None,
            Some("done".to_string()), None, None,
        );
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("BlockedByUnsatisfiedDependencies"));
        assert!(err.contains("Non-cyclic Blocker"));
        // Should NOT list Task B (cyclic blocker)
        assert!(!err.contains("Task B"));
    }

    #[test]
    fn test_blocking_enforcement_delete_always_allowed() {
        let conn = test_db();
        let blocker = create_task_impl(&conn, "Blocker".to_string(), None, None, None).unwrap();
        let dependent = create_task_impl(&conn, "Dependent".to_string(), None, None, None).unwrap();
        create_dependency_impl(&conn, blocker.id.clone(), dependent.id.clone()).unwrap();

        // Delete should work even with unsatisfied blockers
        let result = update_task_impl(
            &conn, dependent.id.clone(), None, None,
            Some("deleted".to_string()), None, None,
        );
        assert!(result.is_ok());
        assert_eq!(result.unwrap().status, "deleted");
    }

    #[test]
    fn test_cascade_deleting_task_removes_dependency_rows() {
        let conn = test_db();
        let a = create_task_impl(&conn, "Task A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "Task B".to_string(), None, None, None).unwrap();
        let c = create_task_impl(&conn, "Task C".to_string(), None, None, None).unwrap();

        // A blocks B, C blocks A
        let dep1 = create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();
        let dep2 = create_dependency_impl(&conn, c.id.clone(), a.id.clone()).unwrap();

        // Count deps before
        let count_before: i64 = conn.query_row(
            "SELECT COUNT(*) FROM task_dependencies", [], |r| r.get(0),
        ).unwrap();
        assert_eq!(count_before, 2);

        // Hard-delete task A via SQL (CASCADE should remove both deps)
        conn.execute("DELETE FROM tasks WHERE id = ?1", [&a.id]).unwrap();

        let count_after: i64 = conn.query_row(
            "SELECT COUNT(*) FROM task_dependencies", [], |r| r.get(0),
        ).unwrap();
        assert_eq!(count_after, 0);
    }

    #[test]
    fn test_cycle_resolution_removing_dep_restores_blocking() {
        let conn = test_db();
        let a = create_task_impl(&conn, "Task A".to_string(), None, None, None).unwrap();
        let b = create_task_impl(&conn, "Task B".to_string(), None, None, None).unwrap();

        // Create cycle: A→B and B→A
        let dep1 = create_dependency_impl(&conn, a.id.clone(), b.id.clone()).unwrap();
        let dep2 = create_dependency_impl(&conn, b.id.clone(), a.id.clone()).unwrap();

        // Both are cyclic → marking A as done should be allowed
        let result_a = list_tasks_impl(&conn, Some("active".to_string()), None).unwrap();
        let task_a = result_a.tasks.iter().find(|t| t.id == a.id).unwrap();
        assert!(task_a.is_cyclic);

        // Remove the B→A edge, dissolving the cycle
        delete_dependency_impl(&conn, dep2.edge.id.clone()).unwrap();

        // Now A→B still exists: B is blocked by A (non-cyclic), A is not cyclic
        let result_b = list_tasks_impl(&conn, Some("active".to_string()), None).unwrap();
        let task_a2 = result_b.tasks.iter().find(|t| t.id == a.id).unwrap();
        let task_b2 = result_b.tasks.iter().find(|t| t.id == b.id).unwrap();
        assert!(!task_a2.is_cyclic);
        assert!(!task_b2.is_cyclic);
        assert!(task_b2.is_blocked);

        // B should NOT be allowed to mark as done (blocked by A)
        let result = update_task_impl(
            &conn, b.id.clone(), None, None,
            Some("done".to_string()), None, None,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("BlockedByUnsatisfiedDependencies"));
    }

    #[test]
    fn test_completed_blocker_satisfies_dependency() {
        let conn = test_db();
        let blocker = create_task_impl(&conn, "Blocker".to_string(), None, None, None).unwrap();
        let dependent = create_task_impl(&conn, "Dependent".to_string(), None, None, None).unwrap();
        create_dependency_impl(&conn, blocker.id.clone(), dependent.id.clone()).unwrap();

        // Initially dependent is blocked
        let result1 = list_tasks_impl(&conn, Some("active".to_string()), None).unwrap();
        let dep_task = result1.tasks.iter().find(|t| t.id == dependent.id).unwrap();
        assert!(dep_task.is_blocked);

        // Mark blocker as done
        update_task_impl(
            &conn, blocker.id.clone(), None, None,
            Some("done".to_string()), None, None,
        ).unwrap();

        // Dependent should no longer be blocked
        let result2 = list_tasks_impl(&conn, Some("active".to_string()), None).unwrap();
        let dep_task2 = result2.tasks.iter().find(|t| t.id == dependent.id).unwrap();
        assert!(!dep_task2.is_blocked);
    }
}
