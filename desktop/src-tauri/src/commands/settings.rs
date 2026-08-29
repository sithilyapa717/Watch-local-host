use crate::commands::progress::{emit_job, emit_job_done};
use crate::db::{DbState, Settings};
use crate::player::{stop_mpv, PlayerStateMutex};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn get_settings(state: State<'_, DbState>) -> Result<Settings, String> {
    state.lock().map_err(|e| e.to_string())?.get_settings()
}

#[tauri::command]
pub fn save_settings(state: State<'_, DbState>, settings: Settings) -> Result<(), String> {
    state.lock().map_err(|e| e.to_string())?.save_settings(&settings)
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
