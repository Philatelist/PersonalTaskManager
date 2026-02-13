use std::path::Path;

/// Ensure a daily backup of the database exists.
///
/// Checks for `backup_dir/ptm-YYYY-MM-DD.sqlite`. If it doesn't exist,
/// copies the DB file there. Best-effort: on any failure, logs a warning
/// and returns `Ok(())` — never blocks the user.
pub fn ensure_daily_backup(db_path: &Path, backup_dir: &Path) -> Result<(), ()> {
    if let Err(e) = try_backup(db_path, backup_dir) {
        eprintln!("[backup] Warning: daily backup failed: {e}");
    }
    Ok(())
}

fn try_backup(db_path: &Path, backup_dir: &Path) -> Result<(), String> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let backup_filename = format!("ptm-{today}.sqlite");
    let backup_path = backup_dir.join(&backup_filename);

    if backup_path.exists() {
        return Ok(());
    }

    std::fs::create_dir_all(backup_dir).map_err(|e| format!("create backup dir: {e}"))?;
    std::fs::copy(db_path, &backup_path).map_err(|e| format!("copy db: {e}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_first_write_creates_backup() {
        let tmp = tempfile::tempdir().unwrap();
        let db_path = tmp.path().join("test.sqlite");
        fs::write(&db_path, b"test db content").unwrap();

        let backup_dir = tmp.path().join("backups");

        ensure_daily_backup(&db_path, &backup_dir).unwrap();

        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let backup_path = backup_dir.join(format!("ptm-{today}.sqlite"));
        assert!(backup_path.exists(), "backup file should be created");
        assert_eq!(
            fs::read(&backup_path).unwrap(),
            b"test db content",
            "backup content should match source"
        );
    }

    #[test]
    fn test_second_write_same_day_no_duplicate() {
        let tmp = tempfile::tempdir().unwrap();
        let db_path = tmp.path().join("test.sqlite");
        fs::write(&db_path, b"original content").unwrap();

        let backup_dir = tmp.path().join("backups");

        ensure_daily_backup(&db_path, &backup_dir).unwrap();

        // Modify the source DB after backup.
        fs::write(&db_path, b"modified content").unwrap();

        // Second call should not overwrite.
        ensure_daily_backup(&db_path, &backup_dir).unwrap();

        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let backup_path = backup_dir.join(format!("ptm-{today}.sqlite"));
        assert_eq!(
            fs::read(&backup_path).unwrap(),
            b"original content",
            "backup should not be overwritten on second call"
        );
    }

    #[test]
    fn test_failure_does_not_block() {
        let tmp = tempfile::tempdir().unwrap();
        let db_path = tmp.path().join("nonexistent.sqlite");

        // DB file doesn't exist — copy should fail, but ensure_daily_backup returns Ok.
        let backup_dir = tmp.path().join("backups");
        let result = ensure_daily_backup(&db_path, &backup_dir);
        assert!(result.is_ok(), "should return Ok even on failure");
    }
}
