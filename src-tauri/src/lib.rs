use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

pub mod backup;
mod commands;
mod db;
pub mod fractional_index;
mod models;

/// Wrapper around a `Mutex<Connection>` so it can be stored as Tauri managed state.
pub struct DbState(pub Mutex<Connection>);

/// Tracks daily backup state: the paths needed and the last date a backup was performed.
pub struct BackupState {
    pub db_path: PathBuf,
    pub backup_dir: PathBuf,
    pub last_backup_date: Mutex<Option<String>>,
}

impl BackupState {
    /// Call before any mutation. Runs backup at most once per calendar day.
    pub fn maybe_backup(&self) {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let mut last = self.last_backup_date.lock().unwrap();
        if last.as_deref() == Some(&today) {
            return;
        }
        let _ = backup::ensure_daily_backup(&self.db_path, &self.backup_dir);
        *last = Some(today);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Resolve the platform-specific app data directory.
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data directory");

            // Create the directory tree if it doesn't already exist.
            std::fs::create_dir_all(&app_data_dir)
                .expect("failed to create app data directory");

            // Initialise the SQLite database (creates the file + sets pragmas).
            let conn = db::initialize(&app_data_dir)
                .expect("failed to initialise database");

            let db_path = app_data_dir.join("ptm.sqlite");
            let backup_dir = app_data_dir.join("backups");

            // Store the connection in Tauri managed state so commands can access it.
            app.manage(DbState(Mutex::new(conn)));
            app.manage(BackupState {
                db_path,
                backup_dir,
                last_backup_date: Mutex::new(None),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::task_create,
            commands::task_get,
            commands::task_list,
            commands::task_update,
            commands::task_delete,
            commands::task_reorder,
            commands::subtask_create,
            commands::subtask_update,
            commands::subtask_delete,
            commands::subtask_reorder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
