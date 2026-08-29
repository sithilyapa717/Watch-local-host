use serde::{Deserialize, Serialize};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

pub struct PlayerState {
    pub mpv_process: Option<Child>,
    pub current_file_id: Option<i64>,
    pub ipc_path: Option<String>,
}

impl Default for PlayerState {
    fn default() -> Self {
        Self {
            mpv_process: None,
            current_file_id: None,
            ipc_path: None,
        }
    }
}

pub type PlayerStateMutex = Mutex<PlayerState>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubtitleTrack {
    pub label: String,
    pub path: String,
    pub format: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlayRequest {
    pub file_id: i64,
    pub path: String,
    pub title: String,
    pub subtitle: Option<String>,
    pub start_sec: f64,
    pub subtitle_paths: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlayerStatus {
    pub playing: bool,
    pub file_id: Option<i64>,
    pub title: String,
    pub path: String,
    pub start_sec: f64,
    pub mode: String,
    pub mpv_available: bool,
    pub error: Option<String>,
    pub subtitles: Vec<SubtitleTrack>,
}

const SUBTITLE_EXTENSIONS: &[&str] = &["srt", "vtt", "ass", "ssa"];

pub fn video_file_stem(path: &std::path::Path) -> String {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    let lower = name.to_lowercase();
    let without_mp4 = if lower.ends_with(".mkv.mp4") {
        name.strip_suffix(".mp4")
            .or_else(|| name.strip_suffix(".MP4"))
            .unwrap_or(&name)
            .to_string()
    } else {
        name
    };
    std::path::Path::new(&without_mp4)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(&without_mp4)
        .to_string()
}

fn alternate_video_names(file_name: &str) -> Vec<String> {
    let mut names = vec![file_name.to_string()];
    let lower = file_name.to_lowercase();
    if lower.ends_with(".mkv.mp4") {
        names.push(file_name[..file_name.len() - 4].to_string());
    } else if lower.ends_with(".mkv") {
        names.push(format!("{file_name}.mp4"));
    } else if lower.ends_with(".mp4") {
        let without_mp4 = &file_name[..file_name.len() - 4];
        names.push(format!("{without_mp4}.mkv"));
        if !without_mp4.to_lowercase().ends_with(".mkv") {
            names.push(format!("{without_mp4}.mkv"));
        }
    }
    names
}

/// Find a video even if the folder was renamed or the double extension changed.
pub fn resolve_video_path(stored: &str) -> Option<String> {
    let path = std::path::PathBuf::from(stored);
    if path.is_file() {
        return Some(path.to_string_lossy().to_string());
    }

    let file_name = path.file_name()?.to_string_lossy().to_string();
    let names = alternate_video_names(&file_name);

    if let Some(parent) = path.parent() {
        if parent.is_dir() {
            for name in &names {
                let candidate = parent.join(name);
                if candidate.is_file() {
                    return Some(candidate.to_string_lossy().to_string());
                }
            }
        }

        let mut ancestor = parent.to_path_buf();
        while !ancestor.is_dir() {
            if !ancestor.pop() {
                break;
            }
        }
        if ancestor.is_dir() {
            for entry in walkdir::WalkDir::new(&ancestor)
                .max_depth(5)
                .into_iter()
                .flatten()
            {
                if !entry.file_type().is_file() {
                    continue;
                }
                let name = entry.file_name().to_string_lossy();
                if names.iter().any(|n| n.eq_ignore_ascii_case(&name)) {
                    return Some(entry.path().to_string_lossy().to_string());
                }
            }
        }
    }

    None
}

fn subtitle_label(file_stem: &str, video_stem: &str) -> String {
    let file_lower = file_stem.to_lowercase();
    let video_lower = video_stem.to_lowercase();
    let remainder = if file_lower.starts_with(&video_lower) {
        file_stem[video_lower.len()..]
            .trim_start_matches(['.', '_', ' ', '-'])
    } else {
        file_stem
    };
    if remainder.is_empty() {
        return "Subtitles".to_string();
    }
    match remainder.to_lowercase().as_str() {
        "en" | "eng" | "english" => "English".to_string(),
        "ja" | "jpn" | "jp" | "japanese" => "Japanese".to_string(),
        "es" | "spa" | "spanish" => "Spanish".to_string(),
        _ => remainder.replace(['_', '.'], " ").trim().to_string(),
    }
}

pub fn find_subtitles_for_video(video_path: &str) -> Vec<SubtitleTrack> {
    let path = std::path::Path::new(video_path);
    let Some(parent) = path.parent() else {
        return Vec::new();
    };
    let video_stem = video_file_stem(path);
    let video_stem_lower = video_stem.to_lowercase();
    let mut tracks = Vec::new();

    let Ok(entries) = std::fs::read_dir(parent) else {
        return tracks;
    };

    for entry in entries.flatten() {
        let sub_path = entry.path();
        if !sub_path.is_file() {
            continue;
        }
        let ext = sub_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !SUBTITLE_EXTENSIONS.contains(&ext.as_str()) {
            continue;
        }
        let file_name = sub_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        let file_lower = file_name.to_lowercase();
        let matches = file_lower == video_stem_lower
            || file_lower.starts_with(&format!("{}.", video_stem_lower))
            || file_lower.starts_with(&format!("{} ", video_stem_lower))
            || file_lower.starts_with(&video_stem_lower);
        if !matches {
            continue;
        }
        tracks.push(SubtitleTrack {
            label: subtitle_label(&file_name, &video_stem),
            path: sub_path.to_string_lossy().to_string(),
            format: ext,
        });
    }

    tracks.sort_by(|a, b| a.label.cmp(&b.label));
    tracks.dedup_by(|a, b| a.path == b.path);
    tracks
}

fn player_status(
    req: &PlayRequest,
    mode: &str,
    mpv_available: bool,
    subtitles: Vec<SubtitleTrack>,
) -> PlayerStatus {
    PlayerStatus {
        playing: true,
        file_id: Some(req.file_id),
        title: req.title.clone(),
        path: req.path.clone(),
        start_sec: req.start_sec,
        mode: mode.to_string(),
        mpv_available,
        error: None,
        subtitles,
    }
}

pub fn find_mpv() -> Option<String> {
    let candidates = ["mpv", "mpv.exe"];
    for c in candidates {
        if Command::new(c).arg("--version").output().is_ok() {
            return Some(c.to_string());
        }
    }
    // Common Windows install paths
    let paths = [
        r"C:\Program Files\mpv\mpv.exe",
        r"C:\Program Files (x86)\mpv\mpv.exe",
    ];
    for p in paths {
        if std::path::Path::new(p).exists() {
            return Some(p.to_string());
        }
    }
    None
}

pub fn launch_mpv(
    state: &mut PlayerState,
    req: &PlayRequest,
) -> Result<PlayerStatus, String> {
    if !std::path::Path::new(&req.path).exists() {
        return Err(format!("Video file not found: {}", req.path));
    }

    let subtitles: Vec<SubtitleTrack> = find_subtitles_for_video(&req.path);
    let subtitle_paths: Vec<String> = subtitles.iter().map(|s| s.path.clone()).collect();

    if let Some(mpv) = find_mpv() {
        // Stop existing
        if let Some(mut child) = state.mpv_process.take() {
            let _ = child.kill();
        }

        let ipc_path = std::env::temp_dir()
            .join(format!("watch-mpv-{}", uuid::Uuid::new_v4()))
            .to_string_lossy()
            .to_string();

        let mut cmd = Command::new(&mpv);
        cmd.arg(&req.path)
            .arg(format!("--start={}", req.start_sec))
            .arg(format!("--input-ipc-server={}", ipc_path))
            .arg("--force-window=yes")
            .arg("--keep-open=yes")
            .arg(format!("--title={}", req.title))
            .stdout(Stdio::null())
            .stderr(Stdio::null());

        cmd.arg("--sub-auto=fuzzy");
        for sub_path in &subtitle_paths {
            cmd.arg(format!("--sub-file={}", sub_path));
        }

        if let Some(ref sub) = req.subtitle {
            cmd.arg(format!("--osd-msg1={}", sub));
        }

        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to launch mpv: {}", e))?;

        state.mpv_process = Some(child);
        state.current_file_id = Some(req.file_id);
        state.ipc_path = Some(ipc_path);

        return Ok(player_status(req, "mpv", true, subtitles));
    }

    Ok(player_status(req, "embedded", false, subtitles))
}

pub fn stop_mpv(state: &mut PlayerState) {
    if let Some(mut child) = state.mpv_process.take() {
        let _ = child.kill();
    }
    state.current_file_id = None;
    state.ipc_path = None;
}

pub fn send_mpv_command(state: &PlayerState, command: &str) -> Result<(), String> {
    let ipc = state
        .ipc_path
        .as_ref()
        .ok_or("No active mpv session")?;

    // Windows named pipe / socket - mpv on Windows uses pipe
    use std::io::Write;
    use std::net::TcpStream;

    // mpv IPC on Windows can be a pipe; try connecting via \\.\pipe\ path
    // For simplicity, use subprocess echo via mpv's --input-ipc-server on TCP if configured
    // Fallback: use taskkill or ignore for v1
    let _ = (ipc, command);

    // Try TCP localhost fallback - mpv uses unix socket on linux, pipe on windows
    // For Windows pipe, we'd need winapi - skip advanced IPC, mpv window has native controls
    if let Ok(mut stream) = TcpStream::connect("127.0.0.1:0") {
        let payload = format!(r#"{{"command":["{}",]}}"#, command);
        let _ = stream.write_all(payload.as_bytes());
    }

    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NextEpisodeInfo {
    pub file_id: i64,
    pub path: String,
    pub title: String,
    pub season: u32,
    pub episode: u32,
}

pub fn get_next_episode(
    db: &crate::db::AppDatabase,
    show_id: i64,
    current_season: u32,
    current_episode: u32,
) -> Result<Option<NextEpisodeInfo>, String> {
    use rusqlite::params;
    let row = db.conn.query_row(
        r"SELECT e.file_id, mf.path, ts.title, e.season_number, e.episode_number
           FROM episodes e
           JOIN media_files mf ON mf.id = e.file_id
           JOIN tmdb_tv_shows ts ON ts.id = e.show_id
           WHERE e.show_id = ?1
             AND (e.season_number > ?2 OR (e.season_number = ?2 AND e.episode_number > ?3))
           ORDER BY e.season_number, e.episode_number
           LIMIT 1",
        params![show_id, current_season, current_episode],
        |row| {
            Ok(NextEpisodeInfo {
                file_id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                season: row.get::<_, i64>(3)? as u32,
                episode: row.get::<_, i64>(4)? as u32,
            })
        },
    );

    match row {
        Ok(info) => Ok(Some(info)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn get_next_episode_for_file(
    db: &crate::db::AppDatabase,
    file_id: i64,
) -> Result<Option<NextEpisodeInfo>, String> {
    use rusqlite::params;
    let current = db.conn.query_row(
        "SELECT show_id, season_number, episode_number FROM episodes WHERE file_id = ?1",
        params![file_id],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)? as u32,
                row.get::<_, i64>(2)? as u32,
            ))
        },
    );
    match current {
        Ok((show_id, season, episode)) => {
            let next = get_next_episode(db, show_id, season, episode)?;
            Ok(next.map(|mut info| {
                if let Some(resolved) = resolve_video_path(&info.path) {
                    info.path = resolved;
                }
                info
            }))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}
