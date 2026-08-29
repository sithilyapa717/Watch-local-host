use std::path::{Path, PathBuf};

/// Normalize a Windows path for comparison: quotes, `\\?\`, mixed slashes, trailing slash.
pub fn normalize_path_str(path: &str) -> String {
    let trimmed = path.trim().trim_matches('"');
    let without_prefix = trimmed
        .strip_prefix(r"\\?\")
        .or_else(|| trimmed.strip_prefix(r"//?/"))
        .unwrap_or(trimmed);
    without_prefix.replace('/', "\\").trim_end_matches('\\').to_string()
}

pub fn path_key(path: &str) -> String {
    normalize_path_str(path).to_lowercase()
}

/// Case-insensitive relative path from library root. Does not require canonicalize,
/// so USB drives, missing files, and `\\?\` paths still work.
pub fn library_relative(path: &Path, library_root: &str) -> Option<PathBuf> {
    relative_from_normalized(
        &normalize_path_str(&path.to_string_lossy()),
        &normalize_path_str(library_root),
    )
    .or_else(|| {
        let path_canon = path.canonicalize().ok()?;
        let root_canon = Path::new(library_root).canonicalize().ok()?;
        relative_from_normalized(
            &normalize_path_str(&path_canon.to_string_lossy()),
            &normalize_path_str(&root_canon.to_string_lossy()),
        )
    })
}

fn relative_from_normalized(path_s: &str, root_s: &str) -> Option<PathBuf> {
    if path_s.is_empty() || root_s.is_empty() {
        return None;
    }
    let path_l = path_s.to_lowercase();
    let root_l = root_s.to_lowercase();
    if path_l == root_l {
        return None;
    }
    let prefix = format!("{root_l}\\");
    if !path_l.starts_with(&prefix) {
        return None;
    }
    if path_s.len() <= root_s.len() {
        return None;
    }
    let rel = path_s[root_s.len()..].trim_start_matches('\\');
    if rel.is_empty() {
        return None;
    }
    Some(PathBuf::from(rel))
}

fn segments(rel: &str) -> Vec<String> {
    rel.replace('\\', "/")
        .split('/')
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect()
}

fn is_anime_segment(name: &str) -> bool {
    matches!(name.to_lowercase().as_str(), "anime" | "animes")
}

fn is_tv_segment(name: &str) -> bool {
    matches!(
        name.to_lowercase().as_str(),
        "tv" | "television" | "series" | "shows" | "tv shows" | "tv-shows"
    )
}

fn is_movie_segment(name: &str) -> bool {
    matches!(
        name.to_lowercase().as_str(),
        "movies" | "movie" | "films" | "film" | "cinema"
    )
}

fn contains_sxxeyy(name: &str) -> bool {
    let bytes = name.as_bytes();
    let n = bytes.len();
    let mut i = 0;
    while i + 3 < n {
        if bytes[i].eq_ignore_ascii_case(&b's') {
            let mut j = i + 1;
            let mut digits = 0;
            while j < n && bytes[j].is_ascii_digit() && digits < 2 {
                digits += 1;
                j += 1;
            }
            if digits >= 1 && j < n && bytes[j].eq_ignore_ascii_case(&b'e') {
                j += 1;
                let mut ep = 0;
                while j < n && bytes[j].is_ascii_digit() && ep < 3 {
                    ep += 1;
                    j += 1;
                }
                if ep >= 1 {
                    return true;
                }
            }
        }
        i += 1;
    }
    false
}

fn looks_like_episode(filename: &str) -> bool {
    if contains_sxxeyy(filename) {
        return true;
    }
    regex::Regex::new(r"(?i)[\s\-–—]+(\d{2,3})(?:\s|\(|\.|\[|$)")
        .ok()
        .is_some_and(|re| re.is_match(filename))
}

fn looks_like_anime(filename: &str, rel: &str) -> bool {
    let blob = format!("{rel} {filename}").to_lowercase();
    ["subsplease", "horriblesubs", "erai-raws", "erai", "nyaa", "animetosho", "anidub"]
        .iter()
        .any(|hint| blob.contains(hint))
}

pub fn infer_category_from_rel(rel: &Path) -> String {
    infer_category_from_rel_str(&rel.to_string_lossy())
}

fn infer_category_from_rel_str(rel: &str) -> String {
    let parts = segments(rel);
    if parts.is_empty() {
        return "unknown".to_string();
    }
    let filename = parts.last().cloned().unwrap_or_default();

    if parts.iter().any(|p| is_movie_segment(p)) {
        return "movie".to_string();
    }
    if parts.iter().any(|p| is_anime_segment(p)) {
        return "anime".to_string();
    }
    if let Some(i) = parts.iter().position(|p| is_tv_segment(p)) {
        let folders_after = parts.len().saturating_sub(i + 2);
        if looks_like_episode(&filename) || folders_after >= 1 {
            return "tv".to_string();
        }
        // Direct file in TV / Shows (e.g. Shows/Inception.mkv) is a movie.
        return "movie".to_string();
    }
    "unknown".to_string()
}

/// Infer movie / tv / anime from a file under a library root.
/// Handles dumps like `D:\movies\file.mkv`, `Anime\Show\ep.mkv` (not under TV),
/// and show folders without a `TV` prefix.
pub fn infer_category(path: &Path, library_root: &str) -> String {
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    let Some(rel) = library_relative(path, library_root) else {
        return "unknown".to_string();
    };
    let rel_s = rel.to_string_lossy().replace('\\', "/");
    let named = infer_category_from_rel_str(&rel_s);
    if named != "unknown" {
        return named;
    }

    let parts = segments(&rel_s);
    if looks_like_anime(&filename, &rel_s) {
        return "anime".to_string();
    }
    if parts.len() >= 2 && looks_like_episode(&filename) {
        return "tv".to_string();
    }
    if parts.len() == 1 {
        if looks_like_episode(&filename) {
            return "tv".to_string();
        }
        return "movie".to_string();
    }
    if parts.len() >= 2 {
        if looks_like_episode(&filename) {
            return "tv".to_string();
        }
        return "movie".to_string();
    }
    "unknown".to_string()
}

fn is_structure_anchor(name: &str) -> bool {
    let n = name.to_lowercase();
    matches!(
        n.as_str(),
        "movies"
            | "movie"
            | "films"
            | "film"
            | "cinema"
            | "tv"
            | "television"
            | "anime"
            | "animes"
            | "not anime"
            | "not-anime"
    )
}

fn is_transient_folder(name: &str) -> bool {
    let n = name.to_lowercase();
    if contains_sxxeyy(&n) {
        return true;
    }
    let markers = [
        "subtitle",
        "sinhala",
        "piratelk",
        "baiscopelk",
        "tamilmv",
        "sample",
    ];
    if markers.iter().any(|m| n.contains(m)) {
        return true;
    }
    matches!(n.as_str(), "subs" | "sub" | "screens" | "proof")
}

/// Folder that owns the title: child of Movies / TV / Anime / Not Anime,
/// skipping per-episode dumps like `The.Mentalist.S02E16.sinhala...`.
pub fn media_title_folder(path: &Path, library_root: &str) -> Option<PathBuf> {
    let rel = library_relative(path, library_root)?;
    let mut parts: Vec<String> = rel
        .components()
        .map(|c| c.as_os_str().to_string_lossy().to_string())
        .collect();
    if parts.is_empty() {
        return None;
    }
    parts.pop(); // filename
    while let Some(last) = parts.last() {
        if is_transient_folder(last) {
            parts.pop();
            continue;
        }
        break;
    }
    if parts.is_empty() {
        return None;
    }
    if parts.last().is_some_and(|p| is_structure_anchor(p)) {
        return None;
    }
    Some(PathBuf::from(parts.join("/")))
}

pub fn show_folder_name(path: &Path, library_root: &str) -> Option<String> {
    let folder = media_title_folder(path, library_root)?;
    folder
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
}

/// Stable key for a show's on-disk folder, e.g. `TV/Not Anime/Mentalist`
pub fn show_folder_key(path: &Path, library_root: &str) -> Option<String> {
    media_title_folder(path, library_root)
        .map(|p| p.to_string_lossy().replace('\\', "/"))
}

pub fn title_hint_names(path: &Path, library_root: &str) -> Vec<String> {
    let mut hints = Vec::new();
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        hints.push(name.to_string());
    }
    if let Some(folder) = show_folder_name(path, library_root) {
        if !hints.iter().any(|h| h.eq_ignore_ascii_case(&folder)) {
            hints.push(folder);
        }
    }
    hints
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relative_ignores_case_and_slashes() {
        let rel = library_relative(Path::new(r"D:\Movies\Top Gun.mkv"), r"d:/movies").unwrap();
        assert_eq!(rel, PathBuf::from("Top Gun.mkv"));
    }

    #[test]
    fn anime_folder_at_library_root() {
        assert_eq!(
            infer_category(
                Path::new(r"D:\media\Anime\Show\[SubsPlease] Show - 01.mkv"),
                r"D:\media"
            ),
            "anime"
        );
    }

    #[test]
    fn loose_file_in_movies_dump_is_movie() {
        assert_eq!(
            infer_category(Path::new(r"D:\movies\Top Gun.mkv"), r"D:\movies"),
            "movie"
        );
    }

    #[test]
    fn show_folder_without_tv_prefix() {
        assert_eq!(
            infer_category(
                Path::new(r"D:\movies\Some Series\S01E01.mkv"),
                r"D:\movies"
            ),
            "tv"
        );
    }

    #[test]
    fn animated_movie_is_not_anime() {
        assert_eq!(
            infer_category(
                Path::new(r"D:\media\Movies\Animation\Encanto.mkv"),
                r"D:\media"
            ),
            "movie"
        );
        assert_eq!(
            infer_category(
                Path::new(r"D:\movies\Movies\Not Anime\Zootopia 2 2025 1080p.mkv"),
                r"D:\movies"
            ),
            "movie"
        );
    }

    #[test]
    fn not_anime_tv_is_tv() {
        assert_eq!(
            infer_category(
                Path::new(r"D:\movies\TV\Not Anime\Mentalist\The.Mentalist.S02E16.sinhala.sub\The.Mentalist.S02E16.mkv"),
                r"D:\movies"
            ),
            "tv"
        );
    }

    #[test]
    fn mentalist_episode_subfolder_uses_show_folder() {
        let p = Path::new(r"D:\movies\TV\Not Anime\Mentalist\The.Mentalist.S02E16.sinhala.sub-baiscopelk.com\The.Mentalist.S02E16.mkv");
        assert_eq!(
            show_folder_name(p, r"D:\movies").as_deref(),
            Some("Mentalist")
        );
        assert_eq!(
            show_folder_key(p, r"D:\movies").as_deref(),
            Some("TV/Not Anime/Mentalist")
        );
    }

    #[test]
    fn gotham_season_pack_is_one_show() {
        let p = Path::new(r"D:\movies\TV\Not Anime\Gotham (2014) Season 1 S01 (1080p)\Gotham.S01E01.Pilot.mkv");
        assert_eq!(
            show_folder_name(p, r"D:\movies").as_deref(),
            Some("Gotham (2014) Season 1 S01 (1080p)")
        );
    }

    #[test]
    fn wednesday_nested_episode_folder_still_one_show() {
        let p = Path::new(
            r"D:\movies\TV\Not Anime\Wednesday.S02.1080p.WEBRip\Wednesday S02E05 Sinhala Subtitles\Wednesday.S02E05.Hyde.and.Woe.Seek.mkv",
        );
        assert_eq!(
            show_folder_name(p, r"D:\movies").as_deref(),
            Some("Wednesday.S02.1080p.WEBRip")
        );
        assert_eq!(
            show_folder_key(p, r"D:\movies").as_deref(),
            Some("TV/Not Anime/Wednesday.S02.1080p.WEBRip")
        );
    }

    #[test]
    fn anime_typo_folder_is_still_anime() {
        assert_eq!(
            infer_category(
                Path::new(r"D:\movies\TV\Anime\apothecary idaries\[SubsPlease] Kusuriya no Hitorigoto S1 - 12 (1080p).mkv.mp4"),
                r"D:\movies"
            ),
            "anime"
        );
    }

    #[test]
    fn mixed_shows_folder_movie_and_series() {
        assert_eq!(
            infer_category(
                Path::new(r"D:\media\Shows\Inception.mkv"),
                r"D:\media"
            ),
            "movie"
        );
        assert_eq!(
            infer_category(
                Path::new(r"D:\media\Shows\Wednesday\Wednesday.S01E01.mkv"),
                r"D:\media"
            ),
            "tv"
        );
    }

    #[test]
    fn volume_root_keeps_drive() {
        assert_eq!(volume_root(r"D:\movies\Film.mkv"), r"D:\");
    }
}

pub struct PathPresence {
    volume_ok: std::collections::HashMap<String, bool>,
}

impl PathPresence {
    pub fn new() -> Self {
        Self {
            volume_ok: std::collections::HashMap::new(),
        }
    }

    pub fn is_present(&mut self, path: &str) -> bool {
        let path = path.trim();
        if path.is_empty() {
            return false;
        }
        let volume = volume_root(path);
        let volume_ok = *self
            .volume_ok
            .entry(volume.clone())
            .or_insert_with(|| Path::new(&volume).exists());
        if !volume_ok {
            return false;
        }
        Path::new(path).is_file()
    }
}

fn volume_root(path: &str) -> String {
    let normalized = normalize_path_str(path);
    let chars: Vec<char> = normalized.chars().collect();
    if chars.len() >= 2 && chars[1] == ':' {
        return format!("{}:\\", chars[0].to_ascii_uppercase());
    }
    if normalized.starts_with("\\\\") {
        let rest = normalized.trim_start_matches('\\');
        let parts: Vec<&str> = rest.split('\\').filter(|s| !s.is_empty()).take(2).collect();
        if parts.len() == 2 {
            return format!("\\\\{}\\{}", parts[0], parts[1]);
        }
    }
    normalized
}
