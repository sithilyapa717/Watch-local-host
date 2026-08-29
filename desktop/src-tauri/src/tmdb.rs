use crate::db::AppDatabase;
use crate::matcher::{parse_anime_show_title, parse_episode, parse_movie, parse_show_title};
use crate::paths::{show_folder_key, show_folder_name, title_hint_names};
use crate::scanner::ScannedFile;
use reqwest::blocking::Client;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

const TMDB_BASE: &str = "https://api.themoviedb.org/3";
const TMDB_IMAGE: &str = "https://image.tmdb.org/t/p";

thread_local! {
    static IMAGE_BYTES: std::cell::Cell<(u64, u64)> = const { std::cell::Cell::new((0, 0)) };
}

#[derive(Debug, Deserialize)]
struct TmdbSearchResponse<T> {
    results: Vec<T>,
}

#[derive(Debug, Deserialize)]
struct TmdbMovieResult {
    id: i64,
    title: String,
    release_date: Option<String>,
    vote_average: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct TmdbTvResult {
    id: i64,
    name: String,
    first_air_date: Option<String>,
    vote_average: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct TmdbMovieDetail {
    id: i64,
    title: String,
    overview: String,
    release_date: Option<String>,
    poster_path: Option<String>,
    backdrop_path: Option<String>,
    vote_average: Option<f64>,
    runtime: Option<i64>,
    genres: Option<Vec<TmdbGenre>>,
    credits: Option<TmdbCredits>,
}

#[derive(Debug, Deserialize)]
struct TmdbTvDetail {
    id: i64,
    name: String,
    overview: String,
    first_air_date: Option<String>,
    poster_path: Option<String>,
    backdrop_path: Option<String>,
    vote_average: Option<f64>,
    status: Option<String>,
    genres: Option<Vec<TmdbGenre>>,
    seasons: Option<Vec<TmdbSeasonMeta>>,
    credits: Option<TmdbCredits>,
}

#[derive(Debug, Deserialize)]
struct TmdbGenre {
    name: String,
}

#[derive(Debug, Deserialize)]
struct TmdbSeasonMeta {
    season_number: i64,
    episode_count: i64,
}

#[derive(Debug, Deserialize)]
struct TmdbSeasonDetail {
    episodes: Vec<TmdbEpisodeMeta>,
}

#[derive(Debug, Deserialize)]
struct TmdbEpisodeMeta {
    episode_number: i64,
    name: String,
    air_date: Option<String>,
    still_path: Option<String>,
    overview: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TmdbCredits {
    cast: Option<Vec<TmdbCastMember>>,
}

#[derive(Debug, Deserialize)]
struct TmdbCastMember {
    name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TmdbSearchItem {
    pub id: i64,
    pub title: String,
    pub year: Option<String>,
    pub media_type: String,
    pub poster_path: Option<String>,
}

pub fn download_image(
    client: &Client,
    api_key: &str,
    db: &AppDatabase,
    remote_path: &str,
    size: &str,
) -> Result<(), String> {
    if remote_path.is_empty() {
        return Ok(());
    }
    let local = db.cache_dir().join(remote_path.trim_start_matches('/'));
    if local.exists() {
        return Ok(());
    }
    if let Some(parent) = local.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let url = format!("{}{}{}", TMDB_IMAGE, size, remote_path);
    let resp = client.get(&url).send().map_err(|e| e.to_string())?;
    let expected = resp.content_length().unwrap_or(0);
    let bytes = resp.bytes().map_err(|e| e.to_string())?;
    let got = bytes.len() as u64;
    add_image_bytes(got, if expected > 0 { expected } else { got });
    std::fs::write(&local, &bytes).map_err(|e| e.to_string())?;
    let _ = api_key; // key not needed for image CDN
    Ok(())
}

fn add_image_bytes(got: u64, expected: u64) {
    IMAGE_BYTES.with(|c| {
        let (downloaded, total) = c.get();
        c.set((downloaded + got, total + expected));
    });
}

fn image_bytes() -> (u64, u64) {
    IMAGE_BYTES.with(|c| c.get())
}

fn reset_image_bytes() {
    IMAGE_BYTES.with(|c| c.set((0, 0)));
}

pub fn organize_files(
    db: &Mutex<AppDatabase>,
    api_key: &str,
    files: &[ScannedFile],
    library_roots: &[String],
    mut on_progress: impl FnMut(usize, usize, &str, u64, u64),
) -> Result<OrganizeResult, String> {
    if api_key.is_empty() {
        return Err("Add your TMDB API key in Settings first".to_string());
    }
    let client = Client::new();
    let mut organized = 0usize;
    let mut failed = Vec::new();
    let mut folder_show_cache: HashMap<String, i64> = HashMap::new();
    let total = files.len();
    reset_image_bytes();

    for (index, file) in files.iter().enumerate() {
        let (downloaded, total_bytes) = image_bytes();
        on_progress(index + 1, total, &file.filename, downloaded, total_bytes);
        let result = {
            let db = db.lock().map_err(|e| e.to_string())?;
            organize_one(&client, &db, api_key, file, &mut folder_show_cache)
        };
        match result {
            Ok(()) => organized += 1,
            Err(e) => failed.push(format!("{}: {}", file.filename, e)),
        }
        let (downloaded, total_bytes) = image_bytes();
        on_progress(index + 1, total, &file.filename, downloaded, total_bytes);
    }

        let (downloaded, total_bytes) = image_bytes();
        on_progress(total, total, "Finishing…", downloaded, total_bytes);
    {
        let db = db.lock().map_err(|e| e.to_string())?;
        let _ = repair_library_shows(&db, api_key, library_roots);
        let _ = db.heal_organized_flags();
    }

    Ok(OrganizeResult { organized, failed })
}

#[derive(Debug, Serialize)]
pub struct OrganizeResult {
    pub organized: usize,
    pub failed: Vec<String>,
}

fn organize_one(
    client: &Client,
    db: &AppDatabase,
    api_key: &str,
    file: &ScannedFile,
    folder_show_cache: &mut HashMap<String, i64>,
) -> Result<(), String> {
    let file_id = db.upsert_media_file(
        &file.path,
        &file.filename,
        &file.extension,
        file.size_bytes,
        &file.category,
        false,
    )?;

    let result = match file.category.as_str() {
        "movie" => organize_movie(client, db, api_key, file_id, &file.path, &file.library_root),
        "tv" | "anime" => organize_tv(
            client,
            db,
            api_key,
            file_id,
            &file.path,
            &file.library_root,
            &file.category,
            folder_show_cache,
        ),
        _ => Err("Unknown category".to_string()),
    };

    match result {
        Ok(()) => {
            db.conn
                .execute(
                    "UPDATE media_files SET organized = 1 WHERE id = ?1",
                    params![file_id],
                )
                .map_err(|e| e.to_string())?;
            Ok(())
        }
        Err(e) => {
            db.conn
                .execute(
                    "UPDATE media_files SET organized = 0 WHERE id = ?1",
                    params![file_id],
                )
                .map_err(|e| e.to_string())?;
            Err(e)
        }
    }
}

fn tmdb_get<T: serde::de::DeserializeOwned>(client: &Client, url: &str) -> Result<T, String> {
    let resp = client.get(url).send().map_err(|e| e.to_string())?;
    let status = resp.status();
    let body = resp.text().map_err(|e| e.to_string())?;
    if !status.is_success() {
        if body.contains("Invalid API key") || body.contains("\"status_code\":7") {
            return Err("Invalid TMDB API key — check Settings".to_string());
        }
        let snippet: String = body.chars().take(200).collect();
        return Err(format!("TMDB error ({}): {}", status, snippet));
    }
    serde_json::from_str(&body).map_err(|e| format!("TMDB response parse error: {e}"))
}

fn pick_movie_result(results: &[TmdbMovieResult], year: Option<i32>) -> Option<&TmdbMovieResult> {
    if results.is_empty() {
        return None;
    }
    if let Some(year) = year {
        let year_s = year.to_string();
        if let Some(matched) = results.iter().find(|m| {
            m.release_date
                .as_deref()
                .is_some_and(|d| d.starts_with(&year_s))
        }) {
            return Some(matched);
        }
    }
    results.first()
}

fn organize_movie(
    client: &Client,
    db: &AppDatabase,
    api_key: &str,
    file_id: i64,
    path: &str,
    library_root: &str,
) -> Result<(), String> {
    let filename = Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(path);
    let mut parsed = None;
    let mut results: Vec<TmdbMovieResult> = Vec::new();
    for hint in title_hint_names(Path::new(path), library_root) {
        let candidate = parse_movie(&hint);
        if candidate.title.is_empty() {
            continue;
        }
        results.clear();
        if let Some(year) = candidate.year {
            let url = format!(
                "{}/search/movie?api_key={}&query={}&year={}",
                TMDB_BASE,
                api_key,
                urlencoding_encode(&candidate.title),
                year
            );
            if let Ok(resp) = tmdb_get::<TmdbSearchResponse<TmdbMovieResult>>(client, &url) {
                results = resp.results;
            }
        }
        if results.is_empty() {
            let url = format!(
                "{}/search/movie?api_key={}&query={}",
                TMDB_BASE,
                api_key,
                urlencoding_encode(&candidate.title)
            );
            if let Ok(resp) = tmdb_get::<TmdbSearchResponse<TmdbMovieResult>>(client, &url) {
                results = resp.results;
            }
        }
        if !results.is_empty() {
            parsed = Some(candidate);
            break;
        }
    }
    let parsed = parsed.ok_or("No TMDB match")?;

    let best = pick_movie_result(&results, parsed.year).ok_or("No TMDB match")?;
    let detail_url = format!(
        "{}/movie/{}?api_key={}&append_to_response=credits",
        TMDB_BASE, best.id, api_key
    );
    let detail: TmdbMovieDetail = tmdb_get(&client, &detail_url)?;

    if let Some(ref p) = detail.poster_path {
        download_image(client, api_key, db, p, "/w342")?;
    }
    if let Some(ref b) = detail.backdrop_path {
        download_image(client, api_key, db, b, "/w780")?;
    }

    let genres: String = detail
        .genres
        .unwrap_or_default()
        .iter()
        .map(|g| g.name.clone())
        .collect::<Vec<_>>()
        .join(", ");

    let cast_names: String = detail
        .credits
        .and_then(|c| c.cast)
        .unwrap_or_default()
        .iter()
        .take(10)
        .map(|m| m.name.clone())
        .collect::<Vec<_>>()
        .join(", ");

    db.conn
        .execute(
            "DELETE FROM tmdb_movies WHERE file_id = ?1",
            params![file_id],
        )
        .map_err(|e| e.to_string())?;

    db.conn
        .execute(
            r"INSERT INTO tmdb_movies (file_id, tmdb_id, title, overview, release_date,
               poster_path, backdrop_path, vote_average, runtime, genres, metadata_json)
               VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
            params![
                file_id,
                detail.id,
                detail.title,
                detail.overview,
                detail.release_date,
                detail.poster_path,
                detail.backdrop_path,
                detail.vote_average.unwrap_or(0.0),
                detail.runtime,
                genres,
                serde_json::json!({}).to_string()
            ],
        )
        .map_err(|e| e.to_string())?;

    let movie_row_id = db.conn.last_insert_rowid();
    db.index_search_entry(
        "movie",
        movie_row_id,
        &detail.title,
        &detail.overview,
        &cast_names,
        &genres,
        filename,
    )?;

    db.conn
        .execute(
            "UPDATE media_files SET organized = 1 WHERE id = ?1",
            params![file_id],
        )
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn organize_tv(
    client: &Client,
    db: &AppDatabase,
    api_key: &str,
    file_id: i64,
    path: &str,
    library_root: &str,
    category: &str,
    folder_show_cache: &mut HashMap<String, i64>,
) -> Result<(), String> {
    let filename = Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");
    let folder = show_folder_name(Path::new(path), library_root)
        .unwrap_or_else(|| filename.to_string());
    let mut folder_query = parse_show_title(&folder);
    if folder_query.is_empty() {
        folder_query = parse_show_title(filename);
    }
    if folder_query.is_empty() {
        return Err("Could not determine show name from folder or file".to_string());
    }
    let folder_key = show_folder_key(Path::new(path), library_root).unwrap_or_else(|| {
        format!("loose/{}", crate::paths::path_key(&folder_query))
    });
    let parsed = parse_episode(filename).unwrap_or(crate::matcher::ParsedEpisode {
        season: 1,
        episode: 1,
    });

    let show_id = if let Some(&cached) = folder_show_cache.get(&folder_key) {
        cached
    } else if let Some(existing) = db.show_id_for_folder_key(&folder_key, category) {
        folder_show_cache.insert(folder_key.clone(), existing);
        existing
    } else {
        let id = resolve_show_for_folder(
            client,
            db,
            api_key,
            &folder_key,
            &folder_query,
            filename,
            category,
        )?;
        folder_show_cache.insert(folder_key, id);
        id
    };

    db.conn
        .execute(
            "INSERT OR REPLACE INTO episodes (file_id, show_id, season_number, episode_number)
             VALUES (?1, ?2, ?3, ?4)",
            params![file_id, show_id, parsed.season, parsed.episode],
        )
        .map_err(|e| e.to_string())?;

    db.conn
        .execute(
            "UPDATE media_files SET organized = 1 WHERE id = ?1",
            params![file_id],
        )
        .map_err(|e| e.to_string())?;

    db.index_search_entry(
        "show",
        show_id,
        &folder_query,
        "",
        "",
        "",
        path,
    )?;

    Ok(())
}

fn resolve_show_for_folder(
    client: &Client,
    db: &AppDatabase,
    api_key: &str,
    folder_key: &str,
    folder_query: &str,
    filename: &str,
    category: &str,
) -> Result<i64, String> {
    resolve_show_for_folder_inner(client, db, api_key, folder_key, folder_query, filename, category, false)
}

fn resolve_show_for_folder_force(
    client: &Client,
    db: &AppDatabase,
    api_key: &str,
    folder_key: &str,
    folder_query: &str,
    category: &str,
) -> Result<i64, String> {
    resolve_show_for_folder_inner(client, db, api_key, folder_key, folder_query, "", category, true)
}

fn resolve_show_for_folder_inner(
    client: &Client,
    db: &AppDatabase,
    api_key: &str,
    folder_key: &str,
    folder_query: &str,
    filename: &str,
    category: &str,
    force: bool,
) -> Result<i64, String> {
    if !force {
        if let Some(id) = db.show_id_for_folder_key(folder_key, category) {
            return Ok(id);
        }
    }

    let show_id = match search_tv_best(client, api_key, folder_query, filename) {
        Some(best) => get_or_create_show(client, db, api_key, best.id, category)?,
        None => get_or_create_local_show(db, folder_query, category)?,
    };

    db.bind_folder_to_show(show_id, folder_key)?;
    Ok(show_id)
}

fn normalize_title(s: &str) -> String {
    s.to_lowercase()
        .replace([':', '-', '_', '.'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn significant_words(s: &str) -> Vec<String> {
    s.split_whitespace()
        .filter(|w| w.len() > 2)
        .map(|w| w.to_string())
        .collect()
}

fn local_tmdb_id(title: &str) -> i64 {
    let hash = title
        .bytes()
        .fold(0u64, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u64));
    -((hash % 900_000_000) as i64 + 1)
}

fn get_or_create_local_show(
    db: &AppDatabase,
    title: &str,
    category: &str,
) -> Result<i64, String> {
    if let Ok(id) = db.conn.query_row(
        "SELECT id FROM tmdb_tv_shows WHERE title = ?1 AND category = ?2",
        params![title, category],
        |row| row.get::<_, i64>(0),
    ) {
        return Ok(id);
    }

    let tmdb_id = local_tmdb_id(title);
    db.conn
        .execute(
            r"INSERT INTO tmdb_tv_shows (tmdb_id, title, overview, first_air_date, poster_path,
               backdrop_path, vote_average, genres, category, status, metadata_json)
               VALUES (?1,?2,'','',NULL,NULL,0,'',?3,'',?4)",
            params![
                tmdb_id,
                title,
                category,
                serde_json::json!({"local": true}).to_string()
            ],
        )
        .map_err(|e| e.to_string())?;

    Ok(db.conn.last_insert_rowid())
}

fn tv_search_queries(folder: &str, filename: &str) -> Vec<String> {
    let mut queries = Vec::new();
    let mut push = |s: String| {
        let s = s.trim().to_string();
        if s.len() >= 2 && !queries.iter().any(|q: &String| q.eq_ignore_ascii_case(&s)) {
            queries.push(s);
        }
    };

    let cleaned_folder = parse_show_title(folder);
    if let Some(t) = parse_anime_show_title(filename) {
        push(t);
    }
    push(parse_show_title(filename));
    push(cleaned_folder.clone());
    if !cleaned_folder.is_empty() && !cleaned_folder.to_lowercase().starts_with("the ") {
        push(format!("The {cleaned_folder}"));
    }
    if let Some(stripped) = cleaned_folder
        .strip_suffix(" 2")
        .or_else(|| cleaned_folder.strip_suffix(" 3"))
        .or_else(|| cleaned_folder.strip_suffix(" II"))
    {
        let stripped = stripped.trim().to_string();
        push(stripped.clone());
        if !stripped.to_lowercase().starts_with("the ") {
            push(format!("The {stripped}"));
        }
    }

    queries
}

fn score_tv_match(result_name: &str, folder: &str, filename_title: Option<&str>) -> i32 {
    let n = normalize_title(result_name);
    let f = normalize_title(folder);

    if let Some(ft) = filename_title {
        let ft = normalize_title(ft);
        if !ft.is_empty() {
            if n == ft {
                return 2000;
            }
            if n.contains(&ft) {
                return 1900;
            }
        }
    }

    if n == f {
        return 1000;
    }
    // Full folder name appears in TMDB title (e.g. longer official name)
    if n.contains(&f) {
        return 900;
    }

    let folder_words = significant_words(&f);
    if folder_words.is_empty() {
        return 0;
    }

    let matched = folder_words.iter().filter(|w| n.contains(w.as_str())).count();
    let missing = folder_words.len() - matched;

    let mut score = (matched as i32) * 180;
    // Penalize when folder has words TMDB title lacks (e.g. "Brotherhood")
    score -= (missing as i32) * 250;

    if let Some(ft) = filename_title {
        let ft = normalize_title(ft);
        if n == ft || n.contains(&ft) {
            score += 100;
        }
    }

    score.max(0)
}

fn search_tv_all(
    client: &Client,
    api_key: &str,
    query: &str,
    language: &str,
) -> Option<Vec<TmdbTvResult>> {
    if query.trim().is_empty() {
        return None;
    }
    let url = format!(
        "{}/search/tv?api_key={}&query={}&language={}&include_adult=false",
        TMDB_BASE,
        api_key,
        urlencoding_encode(query),
        language
    );
    let resp: TmdbSearchResponse<TmdbTvResult> = tmdb_get(client, &url).ok()?;
    if resp.results.is_empty() {
        None
    } else {
        Some(resp.results)
    }
}

fn search_tv_best(
    client: &Client,
    api_key: &str,
    folder: &str,
    filename: &str,
) -> Option<TmdbTvResult> {
    let filename_title = parse_anime_show_title(filename).or_else(|| {
        let t = parse_show_title(filename);
        if t.len() >= 2 {
            Some(t)
        } else {
            None
        }
    });
    let queries = tv_search_queries(folder, filename);
    let mut best: Option<(i32, TmdbTvResult)> = None;

    for query in &queries {
        for lang in ["en-US", "ja-JP"] {
            let Some(results) = search_tv_all(client, api_key, query, lang) else {
                continue;
            };
            for (idx, result) in results.into_iter().enumerate() {
                let score = score_tv_match(
                    &result.name,
                    folder,
                    filename_title.as_deref(),
                );
                let position_bonus = if idx == 0 { 250 } else { 0 };
                let vote_bonus = result.vote_average.unwrap_or(0.0) as i32;
                let total = score + position_bonus + vote_bonus;
                let replace = best
                    .as_ref()
                    .map(|(s, _)| total > *s)
                    .unwrap_or(true);
                if replace {
                    best = Some((total, result));
                }
            }
        }
    }

    // Accept TMDB's top hit when the folder query returned something (search relevance)
    if best.is_none() {
        for lang in ["en-US", "ja-JP"] {
            if let Some(mut results) = search_tv_all(client, api_key, folder, lang) {
                if let Some(first) = results.drain(..1).next() {
                    return Some(first);
                }
            }
        }
    }

    best.map(|(_, r)| r)
}

fn get_or_create_show(
    client: &Client,
    db: &AppDatabase,
    api_key: &str,
    tmdb_id: i64,
    category: &str,
) -> Result<i64, String> {
    if let Ok(id) = db.conn.query_row(
        "SELECT id FROM tmdb_tv_shows WHERE tmdb_id = ?1 AND category = ?2",
        params![tmdb_id, category],
        |row| row.get::<_, i64>(0),
    ) {
        ensure_show_episodes_cached(client, db, api_key, id, tmdb_id)?;
        return Ok(id);
    }

    let detail_url = format!(
        "{}/tv/{}?api_key={}&append_to_response=credits",
        TMDB_BASE, tmdb_id, api_key
    );
    let detail: TmdbTvDetail = tmdb_get(client, &detail_url)?;

    if let Some(ref p) = detail.poster_path {
        download_image(client, api_key, db, p, "/w342")?;
    }
    if let Some(ref b) = detail.backdrop_path {
        download_image(client, api_key, db, b, "/w780")?;
    }

    let genres: String = detail
        .genres
        .unwrap_or_default()
        .iter()
        .map(|g| g.name.clone())
        .collect::<Vec<_>>()
        .join(", ");

    db.conn
        .execute(
            r"INSERT INTO tmdb_tv_shows (tmdb_id, title, overview, first_air_date, poster_path,
               backdrop_path, vote_average, genres, category, status, metadata_json)
               VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
            params![
                tmdb_id,
                detail.name,
                detail.overview,
                detail.first_air_date,
                detail.poster_path,
                detail.backdrop_path,
                detail.vote_average.unwrap_or(0.0),
                genres,
                category,
                detail.status.unwrap_or_default(),
                serde_json::json!({}).to_string()
            ],
        )
        .map_err(|e| e.to_string())?;

    let show_id = db.conn.last_insert_rowid();

    // Cache full episode manifest
    if let Some(seasons) = detail.seasons {
        for sm in seasons {
            if sm.season_number < 0 {
                continue; // skip unsupported negative season numbers
            }
            cache_season(client, db, api_key, show_id, tmdb_id, sm.season_number)?;
        }
    }

    Ok(show_id)
}

fn ensure_show_episodes_cached(
    client: &Client,
    db: &AppDatabase,
    api_key: &str,
    show_id: i64,
    tmdb_id: i64,
) -> Result<(), String> {
    let count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM tmdb_episodes WHERE show_id = ?1",
            params![show_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if count > 0 {
        return Ok(());
    }

    let detail_url = format!("{}/tv/{}?api_key={}", TMDB_BASE, tmdb_id, api_key);
    let detail: TmdbTvDetail = tmdb_get(client, &detail_url)?;
    if let Some(seasons) = detail.seasons {
        for sm in seasons {
            if sm.season_number < 0 {
                continue;
            }
            cache_season(client, db, api_key, show_id, tmdb_id, sm.season_number)?;
        }
    }
    Ok(())
}

fn cache_season(
    client: &Client,
    db: &AppDatabase,
    api_key: &str,
    show_id: i64,
    tmdb_id: i64,
    season_number: i64,
) -> Result<(), String> {
    let url = format!(
        "{}/tv/{}/season/{}?api_key={}",
        TMDB_BASE, tmdb_id, season_number, api_key
    );
    let detail: TmdbSeasonDetail = tmdb_get(client, &url)?;

    for ep in detail.episodes {
        db.conn
            .execute(
                r"INSERT OR REPLACE INTO tmdb_episodes
                   (show_id, season_number, episode_number, name, air_date, still_path, overview)
                   VALUES (?1,?2,?3,?4,?5,?6,?7)",
                params![
                    show_id,
                    season_number,
                    ep.episode_number,
                    ep.name,
                    ep.air_date,
                    ep.still_path,
                    ep.overview.unwrap_or_default()
                ],
            )
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct RepairResult {
    pub folders_fixed: usize,
    pub episodes_moved: usize,
    pub shows_removed: usize,
}

pub fn repair_library_shows(
    db: &AppDatabase,
    api_key: &str,
    library_roots: &[String],
) -> Result<RepairResult, String> {
    if api_key.is_empty() {
        return Err("Add your TMDB API key in Settings first".to_string());
    }
    let client = Client::new();
    let files = db.list_show_folder_groups()?;
    let mut folder_map: HashMap<String, (String, String)> = HashMap::new();

    for (path, filename) in files {
        let Some(library_root) = library_roots.iter().find(|root| {
            crate::paths::library_relative(Path::new(&path), root).is_some()
        }) else {
            continue;
        };
        let key = match show_folder_key(Path::new(&path), library_root) {
            Some(k) => k,
            None => continue,
        };
        folder_map
            .entry(key)
            .or_insert_with(|| (path, filename));
    }

    let mut folders_fixed = 0usize;
    let mut episodes_moved = 0usize;

    for (folder_key, (sample_path, sample_filename)) in folder_map {
        let Some(library_root) = library_roots.iter().find(|root| {
            crate::paths::library_relative(Path::new(&sample_path), root).is_some()
        }) else {
            continue;
        };
        let folder_name = show_folder_name(Path::new(&sample_path), library_root)
            .unwrap_or_else(|| sample_filename.clone());
        let folder_query = parse_show_title(&folder_name);
        let category = crate::paths::infer_category(Path::new(&sample_path), library_root);

        let force = db.folder_has_split_shows(&folder_key);
        let needs_fix = force || db.show_id_for_folder_key(&folder_key, &category).is_none();

        if !needs_fix {
            continue;
        }

        let correct_show_id = if force {
            resolve_show_for_folder_force(
                &client,
                db,
                api_key,
                &folder_key,
                &folder_query,
                &category,
            )?
        } else {
            resolve_show_for_folder(
                &client,
                db,
                api_key,
                &folder_key,
                &folder_query,
                &sample_filename,
                &category,
            )?
        };

        let moved = db.reassign_episodes_to_show(&folder_key, correct_show_id)?;
        if moved > 0 {
            folders_fixed += 1;
            episodes_moved += moved;
        }
    }

    let shows_removed = db.delete_orphan_shows()?;

    Ok(RepairResult {
        folders_fixed,
        episodes_moved,
        shows_removed,
    })
}

pub fn search_tmdb(api_key: &str, query: &str, media_type: &str) -> Result<Vec<TmdbSearchItem>, String> {
    if api_key.is_empty() {
        return Err("TMDB API key required".to_string());
    }
    let client = Client::new();
    let endpoint = if media_type == "movie" { "search/movie" } else { "search/tv" };
    let url = format!(
        "{}/{}?api_key={}&query={}",
        TMDB_BASE,
        endpoint,
        api_key,
        urlencoding_encode(query)
    );

    if media_type == "movie" {
        let resp: TmdbSearchResponse<TmdbMovieResult> = client.get(&url).send().map_err(|e| e.to_string())?
            .json().map_err(|e| e.to_string())?;
        Ok(resp.results.into_iter().map(|m| TmdbSearchItem {
            id: m.id,
            title: m.title,
            year: m.release_date.map(|d| d.chars().take(4).collect()),
            media_type: "movie".to_string(),
            poster_path: None,
        }).collect())
    } else {
        let resp: TmdbSearchResponse<TmdbTvResult> = client.get(&url).send().map_err(|e| e.to_string())?
            .json().map_err(|e| e.to_string())?;
        Ok(resp.results.into_iter().map(|m| TmdbSearchItem {
            id: m.id,
            title: m.name,
            year: m.first_air_date.map(|d| d.chars().take(4).collect()),
            media_type: "tv".to_string(),
            poster_path: None,
        }).collect())
    }
}

fn urlencoding_encode(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            ' ' => "+".to_string(),
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            _ => format!("%{:02X}", c as u32),
        })
        .collect()
}
