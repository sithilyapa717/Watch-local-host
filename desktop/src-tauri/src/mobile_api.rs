use crate::completeness::{build_summary_text, get_incomplete_shows, get_show_completeness};
use crate::db::AppDatabase;
use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::io::SeekFrom;
use std::net::SocketAddr;
use std::path::Path as FsPath;
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;
use tower_http::cors::CorsLayer;

pub const MOBILE_API_PORT: u16 = 8742;
pub const DISCOVER_PORT: u16 = 8743;

fn pc_name() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "Watch PC".to_string())
}

fn discover_json() -> String {
    serde_json::json!({
        "ok": true,
        "app": "watch",
        "name": pc_name(),
        "port": MOBILE_API_PORT,
    })
    .to_string()
}

#[derive(Clone)]
struct ApiState {
    db: Arc<Mutex<AppDatabase>>,
    token: String,
}

#[derive(Serialize)]
pub struct MobileServerInfo {
    pub port: u16,
    pub token: String,
    pub lan_url: String,
    pub usb_url: String,
    pub name: String,
}

pub fn lan_ip() -> Option<String> {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    Some(socket.local_addr().ok()?.ip().to_string())
}

pub fn server_info(db: &AppDatabase) -> Result<MobileServerInfo, String> {
    let token = db.get_or_create_mobile_token()?;
    let ip = lan_ip().unwrap_or_else(|| "127.0.0.1".into());
    Ok(MobileServerInfo {
        port: MOBILE_API_PORT,
        token,
        lan_url: format!("http://{ip}:{MOBILE_API_PORT}"),
        usb_url: format!("http://127.0.0.1:{MOBILE_API_PORT}"),
        name: pc_name(),
    })
}

pub async fn start(db: Arc<Mutex<AppDatabase>>) {
    let token = match db.lock() {
        Ok(guard) => match guard.get_or_create_mobile_token() {
            Ok(t) => t,
            Err(e) => {
                eprintln!("[watch-mobile] token error: {e}");
                return;
            }
        },
        Err(e) => {
            eprintln!("[watch-mobile] db lock error: {e}");
            return;
        }
    };

    let state = ApiState { db, token: token.clone() };
    let protected = Router::new()
        .route("/api/home", get(home))
        .route("/api/movies", get(movies))
        .route("/api/shows", get(shows))
        .route("/api/shows/{id}", get(show_detail))
        .route("/api/shows/{id}/completeness", get(show_completeness))
        .route("/api/poster", get(poster))
        .route("/api/search", get(search))
        .route("/api/stream/{file_id}", get(stream))
        .route("/api/progress", post(progress))
        .layer(middleware::from_fn_with_state(state.clone(), require_token));

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/discover", get(discover_http))
        .merge(protected)
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], MOBILE_API_PORT));
    println!(
        "[watch-mobile] {}  http://0.0.0.0:{MOBILE_API_PORT}  PIN={token}",
        pc_name()
    );
    tauri::async_runtime::spawn(udp_discover());
    match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => {
            if let Err(e) = axum::serve(listener, app).await {
                eprintln!("[watch-mobile] server error: {e}");
            }
        }
        Err(e) => eprintln!("[watch-mobile] bind {addr} failed: {e}"),
    }
}

#[derive(Deserialize)]
struct TokenQuery {
    token: Option<String>,
}

async fn require_token(
    State(state): State<ApiState>,
    Query(q): Query<TokenQuery>,
    request: axum::extract::Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let header_ok = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.strip_prefix("Bearer ").unwrap_or(v) == state.token)
        .unwrap_or(false);
    let query_ok = q.token.as_deref() == Some(state.token.as_str());
    if header_ok || query_ok {
        Ok(next.run(request).await)
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "ok": true,
        "app": "watch",
        "name": pc_name(),
        "port": MOBILE_API_PORT,
    }))
}

async fn discover_http() -> Json<serde_json::Value> {
    Json(serde_json::from_str(&discover_json()).unwrap_or(serde_json::json!({"ok": true})))
}

async fn udp_discover() {
    let Ok(socket) = tokio::net::UdpSocket::bind(("0.0.0.0", DISCOVER_PORT)).await else {
        eprintln!("[watch-mobile] UDP discover bind failed on {DISCOVER_PORT}");
        return;
    };
    let _ = socket.set_broadcast(true);
    let mut buf = [0u8; 512];
    println!("[watch-mobile] discovery on UDP {DISCOVER_PORT}");
    loop {
        match socket.recv_from(&mut buf).await {
            Ok((n, addr)) => {
                let msg = std::str::from_utf8(&buf[..n]).unwrap_or("");
                if msg.contains("WATCH") {
                    let payload = discover_json();
                    let _ = socket.send_to(payload.as_bytes(), addr).await;
                }
            }
            Err(e) => {
                eprintln!("[watch-mobile] UDP discover error: {e}");
                tokio::time::sleep(std::time::Duration::from_millis(400)).await;
            }
        }
    }
}

#[derive(Serialize)]
struct HomePayload {
    continue_watching: Vec<serde_json::Value>,
    start_anime: Vec<crate::db::ShowItem>,
    start_tv: Vec<crate::db::ShowItem>,
    movies: Vec<crate::db::MovieItem>,
}

fn db_lock(state: &ApiState) -> Result<std::sync::MutexGuard<'_, AppDatabase>, StatusCode> {
    state.db.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn home(State(state): State<ApiState>) -> Result<Json<HomePayload>, StatusCode> {
    let db = db_lock(&state)?;
    let continue_watching = db.get_continue_watching().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let start_anime = get_incomplete_shows(&db, "anime", true).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let start_tv = get_incomplete_shows(&db, "tv", true).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let movies = db.get_movies().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(HomePayload {
        continue_watching,
        start_anime: start_anime.into_iter().take(12).collect(),
        start_tv: start_tv.into_iter().take(12).collect(),
        movies: movies.into_iter().take(12).collect(),
    }))
}

async fn movies(State(state): State<ApiState>) -> Result<Json<Vec<crate::db::MovieItem>>, StatusCode> {
    let db = db_lock(&state)?;
    db.get_movies().map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct CategoryQuery {
    category: String,
    token: Option<String>,
}

async fn shows(
    State(state): State<ApiState>,
    Query(q): Query<CategoryQuery>,
) -> Result<Json<Vec<crate::db::ShowItem>>, StatusCode> {
    let db = db_lock(&state)?;
    db.get_shows(&q.category)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn show_detail(
    State(state): State<ApiState>,
    Path(id): Path<i64>,
) -> Result<Json<crate::db::ShowItem>, StatusCode> {
    let shows_anime = {
        let db = db_lock(&state)?;
        db.get_shows("anime")
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .into_iter()
            .chain(
                db.get_shows("tv")
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
                    .into_iter(),
            )
            .find(|s| s.id == id)
    };
    shows_anime.map(Json).ok_or(StatusCode::NOT_FOUND)
}

async fn show_completeness(
    State(state): State<ApiState>,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let db = db_lock(&state)?;
    let completeness =
        get_show_completeness(&db, id, false).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let summary = build_summary_text(&completeness);
    Ok(Json(serde_json::json!({
        "completeness": completeness,
        "summary": summary,
    })))
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct SearchQuery {
    q: String,
    token: Option<String>,
}

async fn search(
    State(state): State<ApiState>,
    Query(q): Query<SearchQuery>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let db = db_lock(&state)?;
    db.search_local(&q.q)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct PosterQuery {
    path: String,
    token: Option<String>,
}

async fn poster(
    State(state): State<ApiState>,
    Query(q): Query<PosterQuery>,
) -> Result<Response, StatusCode> {
    let local = {
        let db = db_lock(&state)?;
        db.poster_local_path(&q.path)
    };
    let Some(local) = local else {
        return Err(StatusCode::NOT_FOUND);
    };
    let bytes = tokio::fs::read(&local)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    let mime = if local.ends_with(".png") {
        "image/png"
    } else if local.ends_with(".webp") {
        "image/webp"
    } else {
        "image/jpeg"
    };
    // Poster files are immutable once cached locally, so let mobile clients
    // keep them on disk instead of refetching over the LAN on every scroll.
    Ok((
        [
            (header::CONTENT_TYPE, mime),
            (header::CACHE_CONTROL, "public, max-age=31536000, immutable"),
        ],
        bytes,
    )
        .into_response())
}

fn media_type_for(path: &str) -> &'static str {
    let ext = FsPath::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    match ext.as_str() {
        "mp4" | "m4v" => "video/mp4",
        "mkv" => "video/x-matroska",
        "webm" => "video/webm",
        "avi" => "video/x-msvideo",
        _ => "video/mp4",
    }
}

fn parse_range(range: Option<&str>, size: u64) -> (u64, u64, bool) {
    if size == 0 {
        return (0, 0, false);
    }
    let Some(r) = range.filter(|s| s.starts_with("bytes=")) else {
        return (0, size - 1, false);
    };
    let spec = r[6..].split(',').next().unwrap_or(&r[6..]);
    let Some((a, b)) = spec.split_once('-') else {
        return (0, size - 1, false);
    };
    if a.is_empty() {
        let n: u64 = b.parse().unwrap_or(0).min(size);
        return (size - n, size - 1, true);
    }
    let start: u64 = a.parse().unwrap_or(0).min(size - 1);
    let end = if b.is_empty() {
        size - 1
    } else {
        b.parse().unwrap_or(size - 1).min(size - 1)
    };
    (start, end.max(start), true)
}

async fn stream(
    State(state): State<ApiState>,
    Path(file_id): Path<i64>,
    headers: HeaderMap,
) -> Result<Response, StatusCode> {
    let path = {
        let db = db_lock(&state)?;
        db.get_media_file(file_id)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .map(|f| f.path)
    };
    let Some(path) = path else {
        return Err(StatusCode::NOT_FOUND);
    };

    let mut file = tokio::fs::File::open(&path)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    let size = file
        .metadata()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .len();
    let range_header = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let (start, end, partial) = parse_range(range_header.as_deref(), size);
    let length = end.saturating_sub(start) + 1;
    file.seek(SeekFrom::Start(start))
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let limited = file.take(length);
    let stream = ReaderStream::new(limited);
    let body = Body::from_stream(stream);
    let mime = media_type_for(&path);

    let mut builder = Response::builder()
        .status(if partial {
            StatusCode::PARTIAL_CONTENT
        } else {
            StatusCode::OK
        })
        .header(header::CONTENT_TYPE, mime)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_LENGTH, length)
        .header(header::CACHE_CONTROL, "no-cache");
    if partial {
        builder = builder.header(
            header::CONTENT_RANGE,
            format!("bytes {start}-{end}/{size}"),
        );
    }
    builder.body(body).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Deserialize)]
struct ProgressBody {
    file_id: i64,
    position_sec: f64,
    duration_sec: f64,
}

async fn progress(
    State(state): State<ApiState>,
    Json(body): Json<ProgressBody>,
) -> Result<StatusCode, StatusCode> {
    let db = db_lock(&state)?;
    db.save_watch_progress(body.file_id, body.position_sec, body.duration_sec)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}
