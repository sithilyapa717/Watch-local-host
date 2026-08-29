use crate::db::DbState;
use crate::player::{
    find_mpv, find_subtitles_for_video, get_next_episode, get_next_episode_for_file, launch_mpv,
    resolve_video_path, stop_mpv, NextEpisodeInfo, PlayRequest, PlayerStateMutex, PlayerStatus,
};
use tauri::State;

#[tauri::command]
pub fn save_watch_progress(
    state: State<'_, DbState>,
    file_id: i64,
    position_sec: f64,
    duration_sec: f64,
) -> Result<(), String> {
    state
        .lock()
        .map_err(|e| e.to_string())?
        .save_watch_progress(file_id, position_sec, duration_sec)
}

#[tauri::command]
pub fn clear_watch_progress_cmd(state: State<'_, DbState>, file_id: i64) -> Result<(), String> {
    state.lock().map_err(|e| e.to_string())?.clear_watch_progress(file_id)
}

#[tauri::command]
pub fn mark_file_watched_cmd(state: State<'_, DbState>, file_id: i64) -> Result<(), String> {
    state.lock().map_err(|e| e.to_string())?.mark_file_watched(file_id)
}

#[tauri::command]
pub fn mark_show_watched_cmd(state: State<'_, DbState>, show_id: i64) -> Result<(), String> {
    state.lock().map_err(|e| e.to_string())?.mark_show_watched(show_id)
}

#[tauri::command]
pub fn reset_show_progress_cmd(state: State<'_, DbState>, show_id: i64) -> Result<(), String> {
    state.lock().map_err(|e| e.to_string())?.reset_show_progress(show_id)
}

#[tauri::command]
pub fn get_watch_progress(state: State<'_, DbState>, file_id: i64) -> Result<(f64, f64), String> {
    state.lock().map_err(|e| e.to_string())?.get_watch_progress(file_id)
}

#[tauri::command]
pub fn play_media(
    player_state: State<'_, PlayerStateMutex>,
    db_state: State<'_, DbState>,
    file_id: i64,
    path: String,
    title: String,
    subtitle: Option<String>,
    start_over: Option<bool>,
) -> Result<PlayerStatus, String> {
    let start_over = start_over.unwrap_or(false);
    let (start_sec, resolved_path) = {
        let db = db_state.lock().map_err(|e| e.to_string())?;
        let stored_path = if path.trim().is_empty() {
            db.get_media_file(file_id)?
                .map(|f| f.path)
                .ok_or_else(|| format!("No file found for id {}", file_id))?
        } else {
            path
        };
        let resolved_path = resolve_video_path(&stored_path).ok_or_else(|| {
            format!("Video file not found: {}", stored_path)
        })?;
        if resolved_path != stored_path {
            let _ = db.update_media_file_path(file_id, &resolved_path);
        }
        if start_over {
            db.clear_watch_progress(file_id)?;
            (0.0, resolved_path)
        } else {
            let (start_sec, _) = db.get_watch_progress(file_id)?;
            (start_sec, resolved_path)
        }
    };

    let subtitles = find_subtitles_for_video(&resolved_path);
    let subtitle_paths: Vec<String> = subtitles.iter().map(|s| s.path.clone()).collect();

    let mut ps = player_state.lock().map_err(|e| e.to_string())?;
    launch_mpv(
        &mut ps,
        &PlayRequest {
            file_id,
            path: resolved_path,
            title,
            subtitle,
            start_sec,
            subtitle_paths,
        },
    )
}

#[tauri::command]
pub fn stop_player(player_state: State<'_, PlayerStateMutex>) -> Result<(), String> {
    let mut ps = player_state.lock().map_err(|e| e.to_string())?;
    stop_mpv(&mut ps);
    Ok(())
}

#[tauri::command]
pub fn check_mpv() -> bool {
    find_mpv().is_some()
}

#[tauri::command]
pub fn get_next_episode_cmd(
    state: State<'_, DbState>,
    show_id: i64,
    season: u32,
    episode: u32,
) -> Result<Option<NextEpisodeInfo>, String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    get_next_episode(&db, show_id, season, episode)
}

#[tauri::command]
pub fn get_next_episode_for_file_cmd(
    state: State<'_, DbState>,
    file_id: i64,
) -> Result<Option<NextEpisodeInfo>, String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    get_next_episode_for_file(&db, file_id)
}
