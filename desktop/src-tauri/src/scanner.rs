use crate::db::AppDatabase;
use crate::paths::{infer_category, path_key};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use walkdir::WalkDir;

const VIDEO_EXTENSIONS: &[&str] = &["mp4", "mkv", "avi", "webm", "mov", "m4v", "wmv"];
const SKIP_DIRS: &[&str] = &[
    "project",
    "desktop",
    "app",
    "mobile app",
    "mobile",
    "release",
    ".cursor",
    "node_modules",
    "target",
    ".git",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannedFile {
    pub path: String,
    pub filename: String,
    pub extension: String,
    pub size_bytes: i64,
    pub category: String,
    #[serde(default)]
    pub library_root: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub new_files: Vec<ScannedFile>,
    pub total_scanned: usize,
}

pub fn scan_library(
    db: &Mutex<AppDatabase>,
    library_roots: &[String],
    mut on_progress: impl FnMut(usize, &str),
) -> Result<ScanResult, String> {
    let roots: Vec<PathBuf> = library_roots
        .iter()
        .filter(|root| !root.trim().is_empty())
        .map(PathBuf::from)
        .filter(|root| root.exists() && root.is_dir())
        .collect();
    if roots.is_empty() {
        return Err("None of the configured library folders exist".to_string());
    }

    let mut known: std::collections::HashSet<String> = {
        let db = db.lock().map_err(|e| e.to_string())?;
        db.get_known_paths()?
            .into_iter()
            .map(|p| path_key(&p))
            .collect()
    };

    let mut new_files = Vec::new();
    let mut total = 0usize;

    for root in roots {
        let root_label = root.to_string_lossy().to_string();
        on_progress(total, &format!("Scanning {root_label}"));
        for entry in WalkDir::new(&root)
            .into_iter()
            .filter_entry(|e| {
                if e.file_type().is_dir() {
                    let name = e.file_name().to_string_lossy();
                    !SKIP_DIRS.contains(&name.as_ref())
                } else {
                    true
                }
            })
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let path = entry.path();
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();

            let ext = if path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .contains(".mkv.")
            {
                "mkv".to_string()
            } else if !VIDEO_EXTENSIONS.contains(&ext.as_str()) {
                continue;
            } else {
                ext
            };

            total += 1;
            if total == 1 || total % 25 == 0 {
                on_progress(total, &format!("Found {total} videos"));
            }
            let path_str = path.to_string_lossy().to_string();
            let key = path_key(&path_str);
            if known.contains(&key) {
                continue;
            }

            let filename = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            {
                let db = db.lock().map_err(|e| e.to_string())?;
                if db.relocate_missing_file(&filename, &path_str)? {
                    known.insert(key);
                    continue;
                }
            }
            known.insert(key);

            let metadata = std::fs::metadata(path).map_err(|e| e.to_string())?;
            let category = infer_category(path, &root.to_string_lossy());

            new_files.push(ScannedFile {
                path: path_str,
                filename,
                extension: ext,
                size_bytes: metadata.len() as i64,
                category,
                library_root: root.to_string_lossy().to_string(),
            });
        }
    }

    Ok(ScanResult {
        new_files,
        total_scanned: total,
    })
}

pub fn register_unorganized(db: &AppDatabase, files: &[ScannedFile]) -> Result<Vec<i64>, String> {
    let mut ids = Vec::new();
    for f in files {
        let id = db.upsert_media_file(
            &f.path,
            &f.filename,
            &f.extension,
            f.size_bytes,
            &f.category,
            false,
        )?;
        ids.push(id);
    }
    Ok(ids)
}
