use crate::commands::progress::{emit_job, emit_job_done, root_for_path};
use crate::db::DbState;
use crate::scanner::{register_unorganized, scan_library, ScanResult, ScannedFile};
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn scan_library_cmd(app: AppHandle, state: State<'_, DbState>) -> Result<ScanResult, String> {
    let db = (*state).clone();
    tauri::async_runtime::spawn_blocking(move || {
        let settings = db.lock().map_err(|e| e.to_string())?.get_settings()?;
        emit_job(&app, "Scanning library", "Looking for video files…", 0, 0, 0, 0);
        let result = scan_library(&db, &settings.library_roots, |current, detail| {
            emit_job(&app, "Scanning library", detail, current, current.max(1), 0, 0);
        });
        if !settings.tmdb_api_key.is_empty() {
            emit_job(&app, "Refreshing artwork", "Fetching missing posters…", 0, 1, 0, 0);
            let _ = crate::tmdb::enrich_missing_artwork_public(&db, &settings.tmdb_api_key, |c, t, d, dl, tb| {
                emit_job(&app, "Refreshing artwork", d, c, t, dl, tb);
            });
        }
        emit_job_done(&app);
        result
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn skip_new_files(state: State<'_, DbState>, files: Vec<ScannedFile>) -> Result<Vec<i64>, String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    register_unorganized(&db, &files)
}

#[tauri::command]
pub async fn organize_new_files(
    app: AppHandle,
    state: State<'_, DbState>,
    files: Vec<ScannedFile>,
) -> Result<crate::tmdb::OrganizeResult, String> {
    let db = (*state).clone();
    tauri::async_runtime::spawn_blocking(move || {
        let settings = db.lock().map_err(|e| e.to_string())?.get_settings()?;
        if settings.tmdb_api_key.is_empty() {
            return Err("Add your TMDB API key in Settings first".to_string());
        }
        emit_job(&app, "Organizing library", "Downloading titles and artwork…", 0, files.len(), 0, 0);
        let result = crate::tmdb::organize_files(
            &db,
            &settings.tmdb_api_key,
            &files,
            &settings.library_roots,
            |current, total, detail, downloaded, total_bytes| {
                emit_job(
                    &app,
                    "Downloading",
                    detail,
                    current,
                    total,
                    downloaded,
                    total_bytes,
                );
            },
        );
        emit_job_done(&app);
        result
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn organize_files_by_ids(
    app: AppHandle,
    state: State<'_, DbState>,
    file_ids: Vec<i64>,
) -> Result<crate::tmdb::OrganizeResult, String> {
    let db = (*state).clone();
    tauri::async_runtime::spawn_blocking(move || {
        let settings = db.lock().map_err(|e| e.to_string())?.get_settings()?;
        if settings.tmdb_api_key.is_empty() {
            return Err("Add your TMDB API key in Settings first".to_string());
        }
        let mut files = Vec::new();
        {
            let locked = db.lock().map_err(|e| e.to_string())?;
            for id in file_ids {
                if let Some(mf) = locked.get_media_file(id)? {
                    let library_root = root_for_path(&mf.path, &settings.library_roots);
                    files.push(ScannedFile {
                        path: mf.path,
                        filename: mf.filename,
                        extension: mf.extension,
                        size_bytes: mf.size_bytes,
                        category: mf.category,
                        library_root,
                    });
                }
            }
        }
        if files.is_empty() {
            return Err("No files to organize".to_string());
        }
        emit_job(&app, "Organizing library", "Downloading titles and artwork…", 0, files.len(), 0, 0);
        let result = crate::tmdb::organize_files(
            &db,
            &settings.tmdb_api_key,
            &files,
            &settings.library_roots,
            |current, total, detail, downloaded, total_bytes| {
                emit_job(
                    &app,
                    "Downloading",
                    detail,
                    current,
                    total,
                    downloaded,
                    total_bytes,
                );
            },
        );
        emit_job_done(&app);
        result
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn repair_library_shows_cmd(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<crate::tmdb::RepairResult, String> {
    let db = (*state).clone();
    tauri::async_runtime::spawn_blocking(move || {
        let settings = db.lock().map_err(|e| e.to_string())?.get_settings()?;
        emit_job(&app, "Fixing library", "Merging duplicate shows…", 0, 1, 0, 0);
        let result = {
            let locked = db.lock().map_err(|e| e.to_string())?;
            crate::tmdb::repair_library_shows(&locked, &settings.tmdb_api_key, &settings.library_roots)
        };
        emit_job(&app, "Fixing library", "Fetching missing posters…", 1, 2, 0, 0);
        let _ = crate::tmdb::enrich_missing_artwork_public(&db, &settings.tmdb_api_key, |c, t, d, dl, tb| {
            emit_job(&app, "Fixing library", d, c, t, dl, tb);
        });
        emit_job_done(&app);
        result
    })
    .await
    .map_err(|e| e.to_string())?
}
