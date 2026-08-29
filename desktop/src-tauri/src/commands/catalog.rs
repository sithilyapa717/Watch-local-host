use crate::completeness::{
    build_summary_text, get_incomplete_shows, get_show_completeness, ShowCompleteness,
};
use crate::db::{DbState, MediaFile, MovieItem, ShowItem};
use tauri::State;

#[derive(serde::Serialize)]
pub struct CompletenessResponse {
    completeness: ShowCompleteness,
    summary: String,
}

#[tauri::command]
pub fn get_movies(state: State<'_, DbState>) -> Result<Vec<MovieItem>, String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    let _ = db.heal_organized_flags();
    db.get_movies()
}

#[tauri::command]
pub fn get_shows(state: State<'_, DbState>, category: String) -> Result<Vec<ShowItem>, String> {
    state.lock().map_err(|e| e.to_string())?.get_shows(&category)
}

#[tauri::command]
pub fn get_not_organized(state: State<'_, DbState>) -> Result<Vec<MediaFile>, String> {
    state.lock().map_err(|e| e.to_string())?.get_not_organized()
}

#[tauri::command]
pub fn get_show_completeness_cmd(
    state: State<'_, DbState>,
    show_id: i64,
    include_specials: Option<bool>,
) -> Result<CompletenessResponse, String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    let completeness = get_show_completeness(&db, show_id, include_specials.unwrap_or(false))?;
    let summary = build_summary_text(&completeness);
    Ok(CompletenessResponse {
        completeness,
        summary,
    })
}

#[tauri::command]
pub fn get_incomplete_shows_cmd(
    state: State<'_, DbState>,
    category: String,
    unwatched_only: Option<bool>,
) -> Result<Vec<ShowItem>, String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    get_incomplete_shows(&db, &category, unwatched_only.unwrap_or(false))
}

#[tauri::command]
pub fn search_local(state: State<'_, DbState>, query: String) -> Result<Vec<serde_json::Value>, String> {
    state.lock().map_err(|e| e.to_string())?.search_local(&query)
}

#[tauri::command]
pub fn search_tmdb_cmd(
    state: State<'_, DbState>,
    query: String,
    media_type: String,
) -> Result<Vec<crate::tmdb::TmdbSearchItem>, String> {
    let api_key = state.lock().map_err(|e| e.to_string())?.get_settings()?.tmdb_api_key;
    crate::tmdb::search_tmdb(&api_key, &query, &media_type)
}

#[tauri::command]
pub fn get_continue_watching(state: State<'_, DbState>) -> Result<Vec<serde_json::Value>, String> {
    state.lock().map_err(|e| e.to_string())?.get_continue_watching()
}

#[tauri::command]
pub fn get_poster_path(state: State<'_, DbState>, remote_path: String) -> Result<Option<String>, String> {
    let db = state.lock().map_err(|e| e.to_string())?;
    Ok(db.poster_local_path(&remote_path))
}

#[tauri::command]
pub fn get_movie_detail(state: State<'_, DbState>, id: i64) -> Result<MovieItem, String> {
    state.lock().map_err(|e| e.to_string())?.get_movie_detail(id)
}

#[tauri::command]
pub fn get_show_detail(state: State<'_, DbState>, id: i64) -> Result<ShowItem, String> {
    use rusqlite::params;
    let db = state.lock().map_err(|e| e.to_string())?;
    let item = db.conn.query_row(
        r"SELECT s.id, s.tmdb_id, s.title, s.overview, s.first_air_date,
                 s.poster_path, s.backdrop_path, s.vote_average, s.genres,
                 s.category, s.status,
                 (SELECT COUNT(*) FROM episodes e WHERE e.show_id = s.id),
                 (SELECT COUNT(*) FROM tmdb_episodes te WHERE te.show_id = s.id),
                 (SELECT COUNT(*) FROM episodes e
                  LEFT JOIN watch_progress wp ON wp.file_id = e.file_id
                  LEFT JOIN watch_history wh
                    ON wh.media_key = ('episode:' || CAST(s.tmdb_id AS TEXT) || ':' ||
                                       CAST(e.season_number AS TEXT) || ':' ||
                                       CAST(e.episode_number AS TEXT))
                  WHERE e.show_id = s.id
                    AND (COALESCE(wp.duration_sec, wh.duration_sec, 0) <= 0
                         OR COALESCE(wp.position_sec, wh.position_sec, 0) /
                            COALESCE(wp.duration_sec, wh.duration_sec, 1) < 0.9))
          FROM tmdb_tv_shows s WHERE s.id = ?1",
        params![id],
        |row| {
            Ok(ShowItem {
                id: row.get(0)?,
                tmdb_id: row.get(1)?,
                title: row.get(2)?,
                overview: row.get(3)?,
                first_air_date: row.get(4)?,
                poster_path: row.get(5)?,
                backdrop_path: row.get(6)?,
                vote_average: row.get(7)?,
                genres: row.get(8)?,
                category: row.get(9)?,
                status: row.get(10)?,
                owned_count: row.get(11)?,
                total_count: row.get(12)?,
                unwatched_count: row.get(13)?,
                removed: false,
            })
        },
    ).map_err(|e| e.to_string())?;
    let mut shows = vec![item];
    db.apply_show_presence(&mut shows)?;
    Ok(shows.into_iter().next().unwrap())
}
