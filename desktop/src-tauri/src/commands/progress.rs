use tauri::{AppHandle, Emitter};

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct JobProgress {
    active: bool,
    title: String,
    detail: String,
    current: usize,
    total: usize,
    downloaded_bytes: u64,
    total_bytes: u64,
}

pub fn emit_job(
    app: &AppHandle,
    title: &str,
    detail: &str,
    current: usize,
    total: usize,
    downloaded_bytes: u64,
    total_bytes: u64,
) {
    let _ = app.emit(
        "job-progress",
        JobProgress {
            active: true,
            title: title.to_string(),
            detail: detail.to_string(),
            current,
            total,
            downloaded_bytes,
            total_bytes,
        },
    );
}

pub fn emit_job_done(app: &AppHandle) {
    let _ = app.emit(
        "job-progress",
        JobProgress {
            active: false,
            title: String::new(),
            detail: String::new(),
            current: 0,
            total: 0,
            downloaded_bytes: 0,
            total_bytes: 0,
        },
    );
}

pub fn root_for_path(path: &str, roots: &[String]) -> String {
    roots
        .iter()
        .find(|root| crate::paths::library_relative(std::path::Path::new(path), root).is_some())
        .cloned()
        .unwrap_or_default()
}
