use crate::commands::progress::{emit_job, emit_job_done};
use crate::db::{DbState, Settings};
use crate::player::{stop_mpv, PlayerStateMutex};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn get_settings(state: State<'_, DbState>) -> Result<Settings, String> {
    state.lock().map_err(|e| e.to_string())?.get_settings()
}

#[tauri::command]
pub fn save_settings(state: State<'_, DbState>, mut settings: Settings) -> Result<(), String> {
    settings.tmdb_api_key = settings.tmdb_api_key.trim().to_string();
    if !settings.tmdb_api_key.is_empty() {
        // Local checks only — network validation runs when organizing.
        let _ = crate::tmdb::normalize_api_key_public(&settings.tmdb_api_key)?;
    }
    state.lock().map_err(|e| e.to_string())?.save_settings(&settings)
}

#[tauri::command]
pub fn validate_tmdb_key_cmd(api_key: String) -> Result<(), String> {
    crate::tmdb::validate_tmdb_api_key(&api_key)
}

#[tauri::command]
pub async fn reset_app_cmd(
    app: AppHandle,
    state: State<'_, DbState>,
    player_state: State<'_, PlayerStateMutex>,
) -> Result<(), String> {
    {
        let mut ps = player_state.lock().map_err(|e| e.to_string())?;
        stop_mpv(&mut ps);
    }
    let db = (*state).clone();
    tauri::async_runtime::spawn_blocking(move || {
        emit_job(&app, "Resetting Watch", "Clearing library data…", 0, 0, 0, 0);
        let result = db.lock().map_err(|e| e.to_string())?.reset_app();
        emit_job_done(&app);
        result
    })
    .await
    .map_err(|e| e.to_string())?
}
