mod commands;
mod completeness;
mod db;
mod matcher;
mod mobile_api;
mod paths;
mod player;
mod scanner;
mod tmdb;

use commands::*;
use db::{app_data_dir, AppDatabase, DbState};
use player::{PlayerState, PlayerStateMutex};
use std::sync::{Arc, Mutex};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let data_dir = app_data_dir().expect("Failed to resolve app data dir");
    let database = AppDatabase::new(data_dir).expect("Failed to init database");
    let db_state: DbState = Arc::new(Mutex::new(database));
    let db_for_api = Arc::clone(&db_state);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(db_state)
        .manage(PlayerStateMutex::new(PlayerState::default()))
        .setup(move |_app| {
            tauri::async_runtime::spawn(async move {
                mobile_api::start(db_for_api).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            validate_tmdb_key_cmd,
            reset_app_cmd,
            scan_library_cmd,
            skip_new_files,
            organize_new_files,
            organize_files_by_ids,
            repair_library_shows_cmd,
            get_movies,
            get_shows,
            get_not_organized,
            get_show_completeness_cmd,
            get_incomplete_shows_cmd,
            search_local,
            search_tmdb_cmd,
            save_watch_progress,
            clear_watch_progress_cmd,
            mark_file_watched_cmd,
            mark_show_watched_cmd,
            reset_show_progress_cmd,
            get_watch_progress,
            get_poster_path,
            play_media,
            stop_player,
            check_mpv,
            get_next_episode_cmd,
            get_next_episode_for_file_cmd,
            get_continue_watching,
            get_movie_detail,
            get_show_detail,
            get_mobile_server_info,
            set_mobile_pin_cmd,
            regenerate_mobile_pin_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
