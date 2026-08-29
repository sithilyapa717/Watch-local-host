use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub library_root: String,
    pub library_roots: Vec<String>,
    pub tmdb_api_key: String,
    pub last_scan_at: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            library_root: r"c:\sithil\Watch".to_string(),
            library_roots: vec![r"c:\sithil\Watch".to_string()],
            tmdb_api_key: String::new(),
            last_scan_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaFile {
    pub id: i64,
    pub path: String,
    pub filename: String,
    pub extension: String,
    pub size_bytes: i64,
    pub category: String,
    pub organized: bool,
    pub added_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MovieVersion {
    pub file_id: i64,
    pub file_path: String,
    #[serde(default)]
    pub removed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MovieItem {
    pub id: i64,
    pub file_id: i64,
    pub tmdb_id: i64,
    pub title: String,
    pub overview: String,
    pub release_date: Option<String>,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub vote_average: f64,
    pub runtime: Option<i64>,
    pub genres: String,
    pub watch_status: String,
    pub progress_pct: f64,
    pub file_path: String,
    pub versions: Vec<MovieVersion>,
    #[serde(default)]
    pub removed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShowItem {
    pub id: i64,
    pub tmdb_id: i64,
    pub title: String,
    pub overview: String,
    pub first_air_date: Option<String>,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub vote_average: f64,
    pub genres: String,
    pub category: String,
    pub status: String,
    pub owned_count: i64,
    pub total_count: i64,
    pub unwatched_count: i64,
    #[serde(default)]
    pub removed: bool,
}

pub struct AppDatabase {
    pub conn: Connection,
    pub data_dir: PathBuf,
}

impl AppDatabase {
    pub fn new(data_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(data_dir.join("cache/tmdb")).map_err(|e| e.to_string())?;
        let db_path = data_dir.join("watch.db");
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        let db = Self { conn, data_dir };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<(), String> {
        self.conn
            .execute_batch(
                r"
                CREATE TABLE IF NOT EXISTS library_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS media_files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    path TEXT UNIQUE NOT NULL,
                    filename TEXT NOT NULL,
                    extension TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    category TEXT NOT NULL DEFAULT 'unknown',
                    organized INTEGER NOT NULL DEFAULT 0,
                    added_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS tmdb_movies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_id INTEGER UNIQUE NOT NULL,
                    tmdb_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    overview TEXT NOT NULL DEFAULT '',
                    release_date TEXT,
                    poster_path TEXT,
                    backdrop_path TEXT,
                    vote_average REAL NOT NULL DEFAULT 0,
                    runtime INTEGER,
                    genres TEXT NOT NULL DEFAULT '',
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    FOREIGN KEY (file_id) REFERENCES media_files(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS tmdb_tv_shows (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tmdb_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    overview TEXT NOT NULL DEFAULT '',
                    first_air_date TEXT,
                    poster_path TEXT,
                    backdrop_path TEXT,
                    vote_average REAL NOT NULL DEFAULT 0,
                    genres TEXT NOT NULL DEFAULT '',
                    category TEXT NOT NULL DEFAULT 'tv',
                    status TEXT NOT NULL DEFAULT '',
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    UNIQUE(tmdb_id, category)
                );

                CREATE TABLE IF NOT EXISTS tmdb_episodes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    show_id INTEGER NOT NULL,
                    season_number INTEGER NOT NULL,
                    episode_number INTEGER NOT NULL,
                    name TEXT NOT NULL DEFAULT '',
                    air_date TEXT,
                    still_path TEXT,
                    overview TEXT NOT NULL DEFAULT '',
                    UNIQUE(show_id, season_number, episode_number),
                    FOREIGN KEY (show_id) REFERENCES tmdb_tv_shows(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS episodes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_id INTEGER UNIQUE NOT NULL,
                    show_id INTEGER NOT NULL,
                    season_number INTEGER NOT NULL,
                    episode_number INTEGER NOT NULL,
                    UNIQUE(show_id, season_number, episode_number),
                    FOREIGN KEY (file_id) REFERENCES media_files(id) ON DELETE CASCADE,
                    FOREIGN KEY (show_id) REFERENCES tmdb_tv_shows(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS watch_progress (
                    file_id INTEGER PRIMARY KEY,
                    position_sec REAL NOT NULL DEFAULT 0,
                    duration_sec REAL NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (file_id) REFERENCES media_files(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS watch_history (
                    media_key TEXT PRIMARY KEY,
                    position_sec REAL NOT NULL DEFAULT 0,
                    duration_sec REAL NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL
                );

                CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
                    entity_type,
                    entity_id,
                    title,
                    overview,
                    cast_names,
                    genres,
                    filename,
                    tokenize='porter unicode61'
                );
                ",
            )
            .map_err(|e| e.to_string())?;
        self.migrate_schema()?;
        Ok(())
    }

    fn migrate_schema(&self) -> Result<(), String> {
        let _ = self.conn.execute(
            "ALTER TABLE tmdb_tv_shows ADD COLUMN folder_key TEXT",
            [],
        );
        let _ = self.conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_tv_folder_key ON tmdb_tv_shows(folder_key, category) WHERE folder_key IS NOT NULL",
            [],
        );
        self.conn
            .execute(
                r"INSERT OR IGNORE INTO watch_history
                   (media_key, position_sec, duration_sec, updated_at)
                   SELECT 'movie:' || CAST(m.tmdb_id AS TEXT),
                          wp.position_sec, wp.duration_sec, wp.updated_at
                   FROM watch_progress wp
                   JOIN tmdb_movies m ON m.file_id = wp.file_id
                   UNION ALL
                   SELECT 'episode:' || CAST(s.tmdb_id AS TEXT) || ':' ||
                          CAST(e.season_number AS TEXT) || ':' ||
                          CAST(e.episode_number AS TEXT),
                          wp.position_sec, wp.duration_sec, wp.updated_at
                   FROM watch_progress wp
                   JOIN episodes e ON e.file_id = wp.file_id
                   JOIN tmdb_tv_shows s ON s.id = e.show_id",
                [],
            )
            .map_err(|e| e.to_string())?;
        let duplicate_episode_ids = {
            let mut stmt = self
                .conn
                .prepare(
                    r"SELECT e.id, e.show_id, e.season_number, e.episode_number
                      FROM episodes e
                      LEFT JOIN watch_progress wp ON wp.file_id = e.file_id
                      ORDER BY e.show_id, e.season_number, e.episode_number,
                               CASE
                                 WHEN wp.duration_sec > 0
                                      AND wp.position_sec / wp.duration_sec >= 0.9 THEN 0
                                 WHEN wp.position_sec > 0 THEN 1
                                 ELSE 2
                               END,
                               COALESCE(wp.position_sec, 0) /
                                 COALESCE(NULLIF(wp.duration_sec, 0), 1) DESC,
                               e.id",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, i64>(3)?,
                    ))
                })
                .map_err(|e| e.to_string())?;
            let mut seen = HashSet::new();
            let mut duplicates = Vec::new();
            for row in rows {
                let (id, show_id, season_number, episode_number) =
                    row.map_err(|e| e.to_string())?;
                if !seen.insert((show_id, season_number, episode_number)) {
                    duplicates.push(id);
                }
            }
            duplicates
        };
        for id in duplicate_episode_ids {
            self.conn
                .execute("DELETE FROM episodes WHERE id = ?1", params![id])
                .map_err(|e| e.to_string())?;
        }
        self.conn
            .execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_episodes_show_season_episode
                 ON episodes(show_id, season_number, episode_number)",
                [],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_settings(&self) -> Result<Settings, String> {
        let mut settings = Settings::default();
        let mut has_library_roots = false;
        let mut stmt = self
            .conn
            .prepare("SELECT key, value FROM library_settings")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (k, v) = row.map_err(|e| e.to_string())?;
            match k.as_str() {
                "library_root" => settings.library_root = v,
                "library_roots" => {
                    if let Ok(roots) = serde_json::from_str::<Vec<String>>(&v) {
                        settings.library_roots = roots;
                        has_library_roots = true;
                    }
                }
                "tmdb_api_key" => settings.tmdb_api_key = v,
                "last_scan_at" => settings.last_scan_at = Some(v),
                _ => {}
            }
        }
        if !has_library_roots {
            settings.library_roots = vec![settings.library_root.clone()];
        }
        if let Some(first_root) = settings.library_roots.first() {
            settings.library_root = first_root.clone();
        }
        Ok(settings)
    }

    pub fn save_settings(&self, settings: &Settings) -> Result<(), String> {
        let roots = if settings.library_roots.is_empty() {
            vec![settings.library_root.clone()]
        } else {
            settings.library_roots.clone()
        };
        self.conn
            .execute(
                "INSERT OR REPLACE INTO library_settings (key, value) VALUES ('library_root', ?1)",
                params![roots.first().cloned().unwrap_or_default()],
            )
            .map_err(|e| e.to_string())?;
        self.conn
            .execute(
                "INSERT OR REPLACE INTO library_settings (key, value) VALUES ('library_roots', ?1)",
                params![serde_json::to_string(&roots).map_err(|e| e.to_string())?],
            )
            .map_err(|e| e.to_string())?;
        self.conn
            .execute(
                "INSERT OR REPLACE INTO library_settings (key, value) VALUES ('tmdb_api_key', ?1)",
                params![settings.tmdb_api_key],
            )
            .map_err(|e| e.to_string())?;
        if let Some(ref ts) = settings.last_scan_at {
            self.conn
                .execute(
                    "INSERT OR REPLACE INTO library_settings (key, value) VALUES ('last_scan_at', ?1)",
                    params![ts],
                )
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn reset_app(&self) -> Result<(), String> {
        let settings = self.get_settings()?;
        let mobile_token: Option<String> = self
            .conn
            .query_row(
                "SELECT value FROM library_settings WHERE key = 'mobile_token'",
                [],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;

        self.conn
            .execute_batch(
                r"
                PRAGMA foreign_keys = OFF;
                DELETE FROM watch_progress;
                DELETE FROM watch_history;
                DELETE FROM episodes;
                DELETE FROM tmdb_episodes;
                DELETE FROM tmdb_movies;
                DELETE FROM tmdb_tv_shows;
                DELETE FROM media_files;
                DELETE FROM library_settings;
                DELETE FROM search_fts;
                PRAGMA foreign_keys = ON;
                ",
            )
            .map_err(|e| e.to_string())?;

        let _ = self.conn.execute("DELETE FROM sqlite_sequence", []);

        let mut restored = settings;
        restored.last_scan_at = None;
        self.save_settings(&restored)?;
        if let Some(token) = mobile_token {
            self.conn
                .execute(
                    "INSERT OR REPLACE INTO library_settings (key, value) VALUES ('mobile_token', ?1)",
                    params![token],
                )
                .map_err(|e| e.to_string())?;
        }

        let cache = self.cache_dir();
        if cache.exists() {
            std::fs::remove_dir_all(&cache).map_err(|e| e.to_string())?;
        }
        std::fs::create_dir_all(self.cache_dir()).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn cache_dir(&self) -> PathBuf {
        self.data_dir.join("cache/tmdb")
    }

    pub fn poster_local_path(&self, remote: &str) -> Option<String> {
        if remote.is_empty() {
            return None;
        }
        let local = self.cache_dir().join(remote.trim_start_matches('/'));
        if local.exists() {
            Some(local.to_string_lossy().to_string())
        } else {
            None
        }
    }

    pub fn upsert_media_file(
        &self,
        path: &str,
        filename: &str,
        extension: &str,
        size_bytes: i64,
        category: &str,
        organized: bool,
    ) -> Result<i64, String> {
        let added_at = chrono::Utc::now().to_rfc3339();
        self.conn
            .execute(
                "INSERT INTO media_files (path, filename, extension, size_bytes, category, organized, added_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(path) DO UPDATE SET
                   filename=excluded.filename,
                   size_bytes=excluded.size_bytes,
                   category=excluded.category,
                   organized=MAX(media_files.organized, excluded.organized)",
                params![
                    path,
                    filename,
                    extension,
                    size_bytes,
                    category,
                    if organized { 1 } else { 0 },
                    added_at
                ],
            )
            .map_err(|e| e.to_string())?;
        self.get_file_id_by_path(path)?
            .ok_or_else(|| format!("Failed to resolve file id for {}", path))
    }

    pub fn update_media_file_path(&self, file_id: i64, new_path: &str) -> Result<(), String> {
        let filename = Path::new(new_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(new_path);
        self.conn
            .execute(
                "UPDATE media_files SET path = ?1, filename = ?2 WHERE id = ?3",
                params![new_path, filename, file_id],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn relocate_missing_file(&self, filename: &str, new_path: &str) -> Result<bool, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, path FROM media_files WHERE filename = ?1")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![filename], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (id, old_path) = row.map_err(|e| e.to_string())?;
            if old_path == new_path {
                return Ok(true);
            }
            if !Path::new(&old_path).is_file() {
                self.update_media_file_path(id, new_path)?;
                return Ok(true);
            }
        }
        Ok(false)
    }

    pub fn get_file_id_by_path(&self, path: &str) -> Result<Option<i64>, String> {
        self.conn
            .query_row(
                "SELECT id FROM media_files WHERE path = ?1",
                params![path],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())
    }

    pub fn mark_unorganized(&self, file_ids: &[i64]) -> Result<(), String> {
        for id in file_ids {
            self.conn
                .execute(
                    "UPDATE media_files SET organized = 0 WHERE id = ?1",
                    params![id],
                )
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn get_known_paths(&self) -> Result<Vec<String>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT path FROM media_files")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn heal_organized_flags(&self) -> Result<(), String> {
        self.conn
            .execute(
                r"UPDATE media_files SET organized = 1
                  WHERE organized = 0
                    AND (
                      id IN (SELECT file_id FROM tmdb_movies)
                      OR id IN (SELECT file_id FROM episodes WHERE file_id IS NOT NULL)
                    )",
                [],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_not_organized(&self) -> Result<Vec<MediaFile>, String> {
        self.heal_organized_flags()?;
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, path, filename, extension, size_bytes, category, organized, added_at
                 FROM media_files WHERE organized = 0 ORDER BY added_at DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(MediaFile {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    filename: row.get(2)?,
                    extension: row.get(3)?,
                    size_bytes: row.get(4)?,
                    category: row.get(5)?,
                    organized: row.get::<_, i64>(6)? != 0,
                    added_at: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn show_id_for_folder_key(&self, folder_key: &str, category: &str) -> Option<i64> {
        self.conn
            .query_row(
                "SELECT id FROM tmdb_tv_shows WHERE folder_key = ?1 AND category = ?2",
                params![folder_key, category],
                |row| row.get(0),
            )
            .ok()
    }

    pub fn bind_folder_to_show(&self, show_id: i64, folder_key: &str) -> Result<(), String> {
        self.conn
            .execute(
                "UPDATE tmdb_tv_shows SET folder_key = NULL WHERE folder_key = ?1 AND id != ?2",
                params![folder_key, show_id],
            )
            .map_err(|e| e.to_string())?;
        self.conn
            .execute(
                "UPDATE tmdb_tv_shows SET folder_key = ?1 WHERE id = ?2",
                params![folder_key, show_id],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn folder_has_split_shows(&self, folder_key: &str) -> bool {
        let pattern_bs = format!("%{}%", folder_key.replace('/', "\\"));
        let pattern_fs = format!("%{}%", folder_key);
        let count: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(DISTINCT e.show_id) FROM episodes e
                 JOIN media_files mf ON mf.id = e.file_id
                 WHERE mf.path LIKE ?1 OR mf.path LIKE ?2",
                params![pattern_bs, pattern_fs],
                |row| row.get(0),
            )
            .unwrap_or(0);
        count > 1
    }

    pub fn predominant_show_for_folder(&self, folder_key: &str) -> Option<i64> {
        let pattern_bs = format!("%{}%", folder_key.replace('/', "\\"));
        let pattern_fs = format!("%{}%", folder_key);
        self.conn
            .query_row(
                "SELECT e.show_id FROM episodes e
                 JOIN media_files mf ON mf.id = e.file_id
                 WHERE mf.path LIKE ?1 OR mf.path LIKE ?2
                 GROUP BY e.show_id
                 ORDER BY COUNT(*) DESC
                 LIMIT 1",
                params![pattern_bs, pattern_fs],
                |row| row.get(0),
            )
            .ok()
    }

    pub fn list_show_folder_groups(&self) -> Result<Vec<(String, String)>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT mf.path, mf.filename FROM media_files mf
                 JOIN episodes e ON e.file_id = mf.id
                 WHERE mf.category IN ('tv', 'anime')",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?;
        Ok(rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?)
    }

    pub fn reassign_episodes_to_show(&self, folder_key: &str, show_id: i64) -> Result<usize, String> {
        let pattern_bs = format!("%{}%", folder_key.replace('/', "\\"));
        let pattern_fs = format!("%{}%", folder_key);
        let updated = self
            .conn
            .execute(
                "UPDATE episodes SET show_id = ?1
                 WHERE file_id IN (
                   SELECT mf.id FROM media_files mf
                   WHERE mf.path LIKE ?2 OR mf.path LIKE ?3
                 )",
                params![show_id, pattern_bs, pattern_fs],
            )
            .map_err(|e| e.to_string())?;
        Ok(updated)
    }

    pub fn delete_orphan_shows(&self) -> Result<usize, String> {
        self.conn
            .execute(
                "DELETE FROM tmdb_tv_shows
                 WHERE id NOT IN (SELECT DISTINCT show_id FROM episodes)",
                [],
            )
            .map_err(|e| e.to_string())
    }

    pub fn get_media_file(&self, id: i64) -> Result<Option<MediaFile>, String> {
        self.conn
            .query_row(
                "SELECT id, path, filename, extension, size_bytes, category, organized, added_at
                 FROM media_files WHERE id = ?1",
                params![id],
                |row| {
                    Ok(MediaFile {
                        id: row.get(0)?,
                        path: row.get(1)?,
                        filename: row.get(2)?,
                        extension: row.get(3)?,
                        size_bytes: row.get(4)?,
                        category: row.get(5)?,
                        organized: row.get::<_, i64>(6)? != 0,
                        added_at: row.get(7)?,
                    })
                },
            )
            .optional()
            .map_err(|e| e.to_string())
    }

    pub fn get_movies(&self) -> Result<Vec<MovieItem>, String> {
        let mut stmt = self
            .conn
            .prepare(
                r"SELECT m.id, m.file_id, m.tmdb_id, m.title, m.overview, m.release_date,
                         m.poster_path, m.backdrop_path, m.vote_average, m.runtime, m.genres,
                         COALESCE(wp.position_sec, wh.position_sec, 0),
                         COALESCE(wp.duration_sec, wh.duration_sec, 0), mf.path
                  FROM tmdb_movies m
                  JOIN media_files mf ON mf.id = m.file_id
                  LEFT JOIN watch_progress wp ON wp.file_id = m.file_id
                  LEFT JOIN watch_history wh ON wh.media_key = ('movie:' || CAST(m.tmdb_id AS TEXT))
                  ORDER BY m.title",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                let pos: f64 = row.get(11)?;
                let dur: f64 = row.get(12)?;
                let (status, pct) = watch_status(pos, dur);
                let file_id: i64 = row.get(1)?;
                let file_path: String = row.get(13)?;
                Ok((
                    MovieItem {
                        id: row.get(0)?,
                        file_id,
                        tmdb_id: row.get(2)?,
                        title: row.get(3)?,
                        overview: row.get(4)?,
                        release_date: row.get(5)?,
                        poster_path: row.get(6)?,
                        backdrop_path: row.get(7)?,
                        vote_average: row.get(8)?,
                        runtime: row.get(9)?,
                        genres: row.get(10)?,
                        watch_status: status,
                        progress_pct: pct,
                        file_path: file_path.clone(),
                        versions: vec![MovieVersion {
                            file_id,
                            file_path: file_path.clone(),
                            removed: false,
                        }],
                        removed: false,
                    },
                    MovieVersion {
                        file_id,
                        file_path: file_path.clone(),
                        removed: false,
                    },
                ))
            })
            .map_err(|e| e.to_string())?;
        let mut grouped: Vec<MovieItem> = Vec::new();
        let mut indexes: HashMap<i64, usize> = HashMap::new();
        for row in rows {
            let (movie, version) = row.map_err(|e| e.to_string())?;
            if let Some(index) = indexes.get(&movie.tmdb_id) {
                let grouped_movie = &mut grouped[*index];
                if movie.watch_status == "watched"
                    || (movie.watch_status == "in_progress"
                        && grouped_movie.watch_status == "unwatched")
                {
                    grouped_movie.watch_status = movie.watch_status;
                    grouped_movie.progress_pct = movie.progress_pct;
                } else if movie.progress_pct > grouped_movie.progress_pct {
                    grouped_movie.progress_pct = movie.progress_pct;
                }
                grouped_movie.versions.push(version);
            } else {
                indexes.insert(movie.tmdb_id, grouped.len());
                grouped.push(movie);
            }
        }
        self.apply_movie_presence(&mut grouped);
        Ok(grouped)
    }

    pub fn apply_movie_presence(&self, movies: &mut [MovieItem]) {
        let mut presence = crate::paths::PathPresence::new();
        for movie in movies {
            for version in &mut movie.versions {
                version.removed = !presence.is_present(&version.file_path);
            }
            movie.removed = !movie.versions.is_empty() && movie.versions.iter().all(|v| v.removed);
        }
    }

    pub fn apply_show_presence(&self, shows: &mut [ShowItem]) -> Result<(), String> {
        let mut paths_by_show: HashMap<i64, Vec<String>> = HashMap::new();
        {
            let mut stmt = self
                .conn
                .prepare("SELECT e.show_id, mf.path FROM episodes e JOIN media_files mf ON mf.id = e.file_id")
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)))
                .map_err(|e| e.to_string())?;
            for row in rows {
                let (show_id, path) = row.map_err(|e| e.to_string())?;
                paths_by_show.entry(show_id).or_default().push(path);
            }
        }
        let mut presence = crate::paths::PathPresence::new();
        for show in shows {
            let paths = paths_by_show.get(&show.id).cloned().unwrap_or_default();
            show.removed = !paths.is_empty() && paths.iter().all(|path| !presence.is_present(path));
        }
        Ok(())
    }

    pub fn get_movie_detail(&self, id: i64) -> Result<MovieItem, String> {
        let movies = self.get_movies()?;
        movies
            .into_iter()
            .find(|movie| {
                movie.id == id || movie.versions.iter().any(|version| version.file_id == id)
            })
            .ok_or_else(|| "Movie not found".to_string())
    }

    pub fn get_shows(&self, category: &str) -> Result<Vec<ShowItem>, String> {
        let mut stmt = self
            .conn
            .prepare(
                r"SELECT s.id, s.tmdb_id, s.title, s.overview, s.first_air_date,
                         s.poster_path, s.backdrop_path, s.vote_average, s.genres,
                         s.category, s.status,
                         (SELECT COUNT(*) FROM episodes e WHERE e.show_id = s.id) as owned,
                         (SELECT COUNT(*) FROM tmdb_episodes te WHERE te.show_id = s.id) as total,
                         (SELECT COUNT(*) FROM episodes e
                          LEFT JOIN watch_progress wp ON wp.file_id = e.file_id
                          LEFT JOIN watch_history wh
                            ON wh.media_key = ('episode:' || CAST(s.tmdb_id AS TEXT) || ':' ||
                                               CAST(e.season_number AS TEXT) || ':' ||
                                               CAST(e.episode_number AS TEXT))
                          WHERE e.show_id = s.id
                            AND (COALESCE(wp.duration_sec, wh.duration_sec, 0) <= 0
                                 OR COALESCE(wp.position_sec, wh.position_sec, 0) /
                                    COALESCE(wp.duration_sec, wh.duration_sec, 1) < 0.9)) as unwatched
                  FROM tmdb_tv_shows s
                  WHERE s.category = ?1
                  ORDER BY s.title",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![category], |row| {
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
            })
            .map_err(|e| e.to_string())?;
        let mut shows = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
        self.apply_show_presence(&mut shows)?;
        Ok(shows)
    }

    pub fn save_watch_progress(
        &self,
        file_id: i64,
        position_sec: f64,
        duration_sec: f64,
    ) -> Result<(), String> {
        let (position_sec, duration_sec) = clamp_finished(position_sec, duration_sec);
        let updated_at = chrono::Utc::now().to_rfc3339();
        self.conn
            .execute(
                "INSERT OR REPLACE INTO watch_progress (file_id, position_sec, duration_sec, updated_at)
                 VALUES (?1, ?2, ?3, ?4)",
                params![file_id, position_sec, duration_sec, updated_at],
            )
            .map_err(|e| e.to_string())?;
        if let Some(media_key) = self.history_key_for_file(file_id)? {
            self.conn
                .execute(
                    "INSERT OR REPLACE INTO watch_history
                     (media_key, position_sec, duration_sec, updated_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![media_key, position_sec, duration_sec, updated_at],
                )
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn clear_watch_progress(&self, file_id: i64) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM watch_progress WHERE file_id = ?1", params![file_id])
            .map_err(|e| e.to_string())?;
        if let Some(media_key) = self.history_key_for_file(file_id)? {
            self.conn
                .execute("DELETE FROM watch_history WHERE media_key = ?1", params![media_key])
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn mark_file_watched(&self, file_id: i64) -> Result<(), String> {
        let (_, duration) = self.get_watch_progress(file_id)?;
        let duration = if duration > 1.0 { duration } else { 100.0 };
        self.save_watch_progress(file_id, duration, duration)
    }

    pub fn show_file_ids(&self, show_id: i64) -> Result<Vec<i64>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT file_id FROM episodes WHERE show_id = ?1")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![show_id], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn mark_show_watched(&self, show_id: i64) -> Result<(), String> {
        for file_id in self.show_file_ids(show_id)? {
            self.mark_file_watched(file_id)?;
        }
        Ok(())
    }

    pub fn reset_show_progress(&self, show_id: i64) -> Result<(), String> {
        for file_id in self.show_file_ids(show_id)? {
            self.clear_watch_progress(file_id)?;
        }
        Ok(())
    }

    pub fn get_watch_progress(&self, file_id: i64) -> Result<(f64, f64), String> {
        let direct = self
            .conn
            .query_row(
                "SELECT position_sec, duration_sec FROM watch_progress WHERE file_id = ?1",
                params![file_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        if let Some(progress) = direct {
            return Ok(progress);
        }

        let Some(media_key) = self.history_key_for_file(file_id)? else {
            return Ok((0.0, 0.0));
        };
        self.conn
            .query_row(
                "SELECT position_sec, duration_sec FROM watch_history WHERE media_key = ?1",
                params![media_key],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(|e| e.to_string())
            .map(|o| o.unwrap_or((0.0, 0.0)))
    }

    fn history_key_for_file(&self, file_id: i64) -> Result<Option<String>, String> {
        self.conn
            .query_row(
                r"SELECT 'movie:' || CAST(tmdb_id AS TEXT)
                  FROM tmdb_movies
                  WHERE file_id = ?1
                  UNION ALL
                  SELECT 'episode:' || CAST(s.tmdb_id AS TEXT) || ':' ||
                         CAST(e.season_number AS TEXT) || ':' ||
                         CAST(e.episode_number AS TEXT)
                  FROM episodes e
                  JOIN tmdb_tv_shows s ON s.id = e.show_id
                  WHERE e.file_id = ?1
                  LIMIT 1",
                params![file_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())
    }

    pub fn index_search_entry(
        &self,
        entity_type: &str,
        entity_id: i64,
        title: &str,
        overview: &str,
        cast_names: &str,
        genres: &str,
        filename: &str,
    ) -> Result<(), String> {
        self.conn
            .execute(
                "DELETE FROM search_fts WHERE entity_type = ?1 AND entity_id = ?2",
                params![entity_type, entity_id.to_string()],
            )
            .map_err(|e| e.to_string())?;
        self.conn
            .execute(
                "INSERT INTO search_fts (entity_type, entity_id, title, overview, cast_names, genres, filename)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    entity_type,
                    entity_id.to_string(),
                    title,
                    overview,
                    cast_names,
                    genres,
                    filename
                ],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn search_local(&self, query: &str) -> Result<Vec<serde_json::Value>, String> {
        if query.trim().is_empty() {
            return Ok(vec![]);
        }
        let pattern = format!("{}*", query.replace('"', ""));
        let mut stmt = self
            .conn
            .prepare(
                "SELECT entity_type, entity_id, title, overview, filename
                 FROM search_fts WHERE search_fts MATCH ?1 LIMIT 50",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![pattern], |row| {
                Ok(serde_json::json!({
                    "entity_type": row.get::<_, String>(0)?,
                    "entity_id": row.get::<_, String>(1)?,
                    "title": row.get::<_, String>(2)?,
                    "overview": row.get::<_, String>(3)?,
                    "filename": row.get::<_, String>(4)?,
                }))
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn get_or_create_mobile_token(&self) -> Result<String, String> {
        let existing: Option<String> = self
            .conn
            .query_row(
                "SELECT value FROM library_settings WHERE key = 'mobile_token'",
                [],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        if let Some(token) = existing {
            if token.len() == 6 && token.chars().all(|c| c.is_ascii_digit()) {
                return Ok(token);
            }
        }
        self.regenerate_mobile_token()
    }

    pub fn set_mobile_token(&self, pin: &str) -> Result<String, String> {
        let pin = pin.trim();
        if pin.len() != 6 || !pin.chars().all(|c| c.is_ascii_digit()) {
            return Err("PIN must be 6 digits".to_string());
        }
        self.conn
            .execute(
                "INSERT OR REPLACE INTO library_settings (key, value) VALUES ('mobile_token', ?1)",
                params![pin],
            )
            .map_err(|e| e.to_string())?;
        Ok(pin.to_string())
    }

    pub fn regenerate_mobile_token(&self) -> Result<String, String> {
        let pin = format!("{:06}", (uuid::Uuid::new_v4().as_u128() % 1_000_000) as u32);
        self.set_mobile_token(&pin)
    }

    pub fn get_continue_watching(&self) -> Result<Vec<serde_json::Value>, String> {
        let mut presence = crate::paths::PathPresence::new();
        let mut movies = Vec::new();
        {
            let mut stmt = self
                .conn
                .prepare(
                    r"SELECT m.id, m.title, m.poster_path, mf.id as file_id, mf.path,
                             COALESCE(wp.position_sec, wh.position_sec, 0),
                             COALESCE(wp.duration_sec, wh.duration_sec, 0),
                             COALESCE(wp.updated_at, wh.updated_at, '')
                      FROM tmdb_movies m
                      JOIN media_files mf ON mf.id = m.file_id
                      LEFT JOIN watch_progress wp ON wp.file_id = mf.id
                      LEFT JOIN watch_history wh ON wh.media_key = ('movie:' || CAST(m.tmdb_id AS TEXT))
                      WHERE COALESCE(wp.duration_sec, wh.duration_sec, 0) > 0",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, f64>(5)?,
                        row.get::<_, f64>(6)?,
                        row.get::<_, String>(7)?,
                    ))
                })
                .map_err(|e| e.to_string())?;
            for row in rows {
                let (id, title, poster, file_id, path, pos, dur, updated) =
                    row.map_err(|e| e.to_string())?;
                if is_finished(pos, dur) {
                    continue;
                }
                movies.push(serde_json::json!({
                    "type": "movie",
                    "id": id,
                    "title": title,
                    "poster_path": poster,
                    "file_id": file_id,
                    "path": path,
                    "position_sec": pos,
                    "duration_sec": dur,
                    "season": null,
                    "episode": null,
                    "resume_count": 1,
                    "updated_at": updated,
                    "removed": !presence.is_present(&path),
                }));
            }
        }

        struct EpRow {
            show_id: i64,
            title: String,
            poster: Option<String>,
            file_id: i64,
            path: String,
            pos: f64,
            dur: f64,
            season: i64,
            episode: i64,
            updated: String,
        }
        let mut episodes = Vec::new();
        {
            let mut stmt = self
                .conn
                .prepare(
                    r"SELECT s.id, s.title, s.poster_path, mf.id, mf.path,
                             COALESCE(wp.position_sec, wh.position_sec, 0),
                             COALESCE(wp.duration_sec, wh.duration_sec, 0),
                             e.season_number, e.episode_number,
                             COALESCE(wp.updated_at, wh.updated_at, '')
                      FROM episodes e
                      JOIN tmdb_tv_shows s ON s.id = e.show_id
                      JOIN media_files mf ON mf.id = e.file_id
                      LEFT JOIN watch_progress wp ON wp.file_id = mf.id
                      LEFT JOIN watch_history wh
                        ON wh.media_key = ('episode:' || CAST(s.tmdb_id AS TEXT) || ':' ||
                                           CAST(e.season_number AS TEXT) || ':' ||
                                           CAST(e.episode_number AS TEXT))
                      WHERE COALESCE(wp.duration_sec, wh.duration_sec, 0) > 0
                      ORDER BY COALESCE(wp.updated_at, wh.updated_at, '') DESC",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |row| {
                    Ok(EpRow {
                        show_id: row.get(0)?,
                        title: row.get(1)?,
                        poster: row.get(2)?,
                        file_id: row.get(3)?,
                        path: row.get(4)?,
                        pos: row.get(5)?,
                        dur: row.get(6)?,
                        season: row.get(7)?,
                        episode: row.get(8)?,
                        updated: row.get(9)?,
                    })
                })
                .map_err(|e| e.to_string())?;
            for row in rows {
                let ep = row.map_err(|e| e.to_string())?;
                if !is_finished(ep.pos, ep.dur) {
                    episodes.push(ep);
                }
            }
        }

        let mut grouped: Vec<(EpRow, i64)> = Vec::new();
        let mut index_by_show = std::collections::HashMap::<i64, usize>::new();
        for ep in episodes {
            if let Some(&idx) = index_by_show.get(&ep.show_id) {
                grouped[idx].1 += 1;
            } else {
                index_by_show.insert(ep.show_id, grouped.len());
                grouped.push((ep, 1));
            }
        }

        let mut items = movies;
        for (ep, count) in grouped {
            items.push(serde_json::json!({
                "type": "episode",
                "id": ep.show_id,
                "title": ep.title,
                "poster_path": ep.poster,
                "file_id": ep.file_id,
                "path": ep.path,
                "position_sec": ep.pos,
                "duration_sec": ep.dur,
                "season": ep.season,
                "episode": ep.episode,
                "resume_count": count,
                "updated_at": ep.updated,
                "removed": !presence.is_present(&ep.path),
            }));
        }
        items.sort_by(|a, b| {
            let au = a.get("updated_at").and_then(|v| v.as_str()).unwrap_or("");
            let bu = b.get("updated_at").and_then(|v| v.as_str()).unwrap_or("");
            bu.cmp(au)
        });
        items.truncate(20);
        Ok(items)
    }
}

pub fn watch_status(position: f64, duration: f64) -> (String, f64) {
    if duration <= 0.0 {
        return ("unwatched".to_string(), 0.0);
    }
    let (position, duration) = clamp_finished(position, duration);
    let pct = (position / duration) * 100.0;
    if is_finished(position, duration) {
        ("watched".to_string(), 100.0)
    } else if pct > 0.0 {
        ("in_progress".to_string(), pct)
    } else {
        ("unwatched".to_string(), pct)
    }
}

/// Treat the last 12% or last 3.5 minutes (whichever is shorter) as credits.
pub fn is_finished(position: f64, duration: f64) -> bool {
    if duration <= 0.0 {
        return false;
    }
    let credit_window = (duration * 0.12).min(210.0);
    position >= (duration - credit_window).max(0.0)
}

pub fn clamp_finished(position: f64, duration: f64) -> (f64, f64) {
    if is_finished(position, duration) {
        (duration, duration)
    } else {
        (position.max(0.0), duration)
    }
}

pub type DbState = std::sync::Arc<Mutex<AppDatabase>>;

pub fn app_data_dir() -> Result<PathBuf, String> {
    dirs::data_dir()
        .map(|d| d.join("WatchApp"))
        .ok_or_else(|| "Could not resolve app data directory".to_string())
}

pub fn infer_category(path: &Path, library_root: &str) -> String {
    crate::paths::infer_category(path, library_root)
}
