use crate::db::{watch_status, AppDatabase};
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SeasonStatus {
    Complete,
    Partial,
    Missing,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EpisodeStatus {
    Owned,
    OwnedWatched,
    OwnedInProgress,
    Missing,
}

pub fn get_show_completeness(
    db: &AppDatabase,
    show_id: i64,
    include_specials: bool,
) -> Result<ShowCompleteness, String> {
    let (title,): (String,) = db
        .conn
        .query_row(
            "SELECT title FROM tmdb_tv_shows WHERE id = ?1",
            params![show_id],
            |row| Ok((row.get(0)?,)),
        )
        .map_err(|e| e.to_string())?;

    let mut season_stmt = db
        .conn
        .prepare(
            "SELECT DISTINCT season_number FROM tmdb_episodes WHERE show_id = ?1 ORDER BY season_number",
        )
        .map_err(|e| e.to_string())?;

    let seasons_nums: Vec<i64> = season_stmt
        .query_map(params![show_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut owned_season_stmt = db
        .conn
        .prepare(
            "SELECT DISTINCT season_number FROM episodes WHERE show_id = ?1 ORDER BY season_number",
        )
        .map_err(|e| e.to_string())?;
    let owned_season_nums: Vec<i64> = owned_season_stmt
        .query_map(params![show_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut all_season_nums: Vec<i64> = seasons_nums;
    for sn in owned_season_nums {
        if !all_season_nums.contains(&sn) {
            all_season_nums.push(sn);
        }
    }
    all_season_nums.sort_unstable();
    all_season_nums.dedup();

    let mut seasons = Vec::new();
    let mut total_owned = 0u32;
    let mut total_expected = 0u32;

    for sn in all_season_nums {
        if sn == 0 && !include_specials {
            continue;
        }
        let season = build_season(db, show_id, sn as u32)?;
        total_owned += season.owned_count;
        total_expected += season.total_count;
        seasons.push(season);
    }

    let mut presence = crate::paths::PathPresence::new();
    for season in &mut seasons {
        for episode in &mut season.episodes {
            episode.removed = episode
                .file_path
                .as_deref()
                .is_some_and(|path| !presence.is_present(path));
        }
    }

    Ok(ShowCompleteness {
        show_id,
        title,
        owned_count: total_owned,
        total_count: total_expected,
        seasons,
    })
}

fn build_season(db: &AppDatabase, show_id: i64, season_number: u32) -> Result<SeasonCompleteness, String> {
    let mut ep_stmt = db
        .conn
        .prepare(
            r"SELECT te.episode_number, te.name, te.air_date, te.still_path, te.overview,
                     e.file_id, mf.path,
                     COALESCE(wp.position_sec, wh.position_sec, 0),
                     COALESCE(wp.duration_sec, wh.duration_sec, 0)
              FROM tmdb_episodes te
              LEFT JOIN episodes e ON e.show_id = te.show_id
                  AND e.season_number = te.season_number
                  AND e.episode_number = te.episode_number
              LEFT JOIN media_files mf ON mf.id = e.file_id
              LEFT JOIN watch_progress wp ON wp.file_id = e.file_id
              LEFT JOIN watch_history wh
                ON wh.media_key = ('episode:' ||
                                   CAST((SELECT tmdb_id FROM tmdb_tv_shows WHERE id = te.show_id) AS TEXT) || ':' ||
                                   CAST(te.season_number AS TEXT) || ':' ||
                                   CAST(te.episode_number AS TEXT))
              WHERE te.show_id = ?1 AND te.season_number = ?2
              ORDER BY te.episode_number",
        )
        .map_err(|e| e.to_string())?;

    let rows = ep_stmt
        .query_map(params![show_id, season_number], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<i64>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, f64>(7)?,
                row.get::<_, f64>(8)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut episodes = Vec::new();
    let mut owned_count = 0u32;

    for row in rows {
        let (
            ep_num,
            name,
            air_date,
            still_path,
            overview,
            file_id,
            file_path,
            pos,
            dur,
        ) = row.map_err(|e| e.to_string())?;

        let (status, progress_pct) = if let Some(fid) = file_id {
            owned_count += 1;
            let (ws, pct) = watch_status(pos, dur);
            let ep_status = match ws.as_str() {
                "watched" => EpisodeStatus::OwnedWatched,
                "in_progress" => EpisodeStatus::OwnedInProgress,
                _ => EpisodeStatus::Owned,
            };
            (ep_status, pct)
        } else {
            (EpisodeStatus::Missing, 0.0)
        };

        episodes.push(EpisodeRow {
            season_number,
            episode_number: ep_num as u32,
            name,
            air_date,
            still_path,
            overview,
            file_id,
            file_path,
            status,
            progress_pct,
            removed: false,
        });
    }

    let mut extra_stmt = db
        .conn
        .prepare(
            r"SELECT e.episode_number, e.file_id, mf.path,
                     COALESCE(wp.position_sec, wh.position_sec, 0),
                     COALESCE(wp.duration_sec, wh.duration_sec, 0)
              FROM episodes e
              JOIN media_files mf ON mf.id = e.file_id
              LEFT JOIN watch_progress wp ON wp.file_id = e.file_id
              LEFT JOIN tmdb_tv_shows s ON s.id = e.show_id
              LEFT JOIN watch_history wh
                ON wh.media_key = ('episode:' || CAST(s.tmdb_id AS TEXT) || ':' ||
                                   CAST(e.season_number AS TEXT) || ':' ||
                                   CAST(e.episode_number AS TEXT))
              WHERE e.show_id = ?1 AND e.season_number = ?2
                AND NOT EXISTS (
                  SELECT 1 FROM tmdb_episodes te
                  WHERE te.show_id = e.show_id
                    AND te.season_number = e.season_number
                    AND te.episode_number = e.episode_number
                )
              ORDER BY e.episode_number",
        )
        .map_err(|e| e.to_string())?;

    let extra_rows = extra_stmt
        .query_map(params![show_id, season_number], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, f64>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    for row in extra_rows {
        let (ep_num, file_id, file_path, pos, dur) = row.map_err(|e| e.to_string())?;
        owned_count += 1;
        let (ws, pct) = watch_status(pos, dur);
        let status = match ws.as_str() {
            "watched" => EpisodeStatus::OwnedWatched,
            "in_progress" => EpisodeStatus::OwnedInProgress,
            _ => EpisodeStatus::Owned,
        };
        episodes.push(EpisodeRow {
            season_number,
            episode_number: ep_num as u32,
            name: format!("Episode {}", ep_num),
            air_date: None,
            still_path: None,
            overview: String::new(),
            file_id: Some(file_id),
            file_path: Some(file_path),
            status,
            progress_pct: pct,
            removed: false,
        });
    }

    episodes.sort_by_key(|e| e.episode_number);

    let total_count = episodes.len() as u32;
    let status = if total_count == 0 {
        SeasonStatus::Missing
    } else if owned_count == 0 {
        SeasonStatus::Missing
    } else if owned_count == total_count {
        SeasonStatus::Complete
    } else {
        SeasonStatus::Partial
    };

    Ok(SeasonCompleteness {
        season_number,
        status,
        owned_count,
        total_count,
        episodes,
    })
}

pub fn get_incomplete_shows(
    db: &AppDatabase,
    category: &str,
    unwatched_only: bool,
) -> Result<Vec<crate::db::ShowItem>, String> {
    let shows = db.get_shows(category)?;
    Ok(shows
        .into_iter()
        .filter(|s| {
            if unwatched_only {
                // "Have to Watch" is based on actual watch progress, not
                // whether the entire TMDB episode list has been downloaded.
                s.unwatched_count > 0
            } else {
                (s.total_count > 0 && s.owned_count < s.total_count)
                    || (s.total_count == 0 && s.owned_count > 0)
            }
        })
        .collect())
}

fn season_label(season_number: u32) -> String {
    if season_number == 0 {
        "Specials".to_string()
    } else {
        format!("S{}", season_number)
    }
}

pub fn build_summary_text(completeness: &ShowCompleteness) -> String {
    let mut have = Vec::new();
    let mut missing_seasons = Vec::new();
    let mut missing_parts = Vec::new();

    for s in &completeness.seasons {
        match s.status {
            SeasonStatus::Complete => have.push(format!("{} (complete)", season_label(s.season_number))),
            SeasonStatus::Partial => {
                have.push(format!(
                    "{} ({}/{})",
                    season_label(s.season_number),
                    s.owned_count,
                    s.total_count
                ));
                let missing_eps: Vec<String> = s
                    .episodes
                    .iter()
                    .filter(|e| e.status == EpisodeStatus::Missing)
                    .map(|e| format!("E{:02}", e.episode_number))
                    .collect();
                if !missing_eps.is_empty() {
                    missing_parts.push(format!(
                        "{} {}",
                        season_label(s.season_number),
                        missing_eps.join(", ")
                    ));
                }
            }
            SeasonStatus::Missing => missing_seasons.push(season_label(s.season_number)),
        }
    }

    let mut parts = Vec::new();
    if !have.is_empty() {
        parts.push(format!("You have: {}", have.join(", ")));
    }
    let mut miss = missing_seasons;
    miss.extend(missing_parts);
    if !miss.is_empty() {
        parts.push(format!("Missing: {}", miss.join(", ")));
    }
    parts.join(" · ")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpisodeRow {
    pub season_number: u32,
    pub episode_number: u32,
    pub name: String,
    pub air_date: Option<String>,
    pub still_path: Option<String>,
    pub overview: String,
    pub file_id: Option<i64>,
    pub file_path: Option<String>,
    pub status: EpisodeStatus,
    pub progress_pct: f64,
    #[serde(default)]
    pub removed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeasonCompleteness {
    pub season_number: u32,
    pub status: SeasonStatus,
    pub owned_count: u32,
    pub total_count: u32,
    pub episodes: Vec<EpisodeRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShowCompleteness {
    pub show_id: i64,
    pub title: String,
    pub owned_count: u32,
    pub total_count: u32,
    pub seasons: Vec<SeasonCompleteness>,
}
