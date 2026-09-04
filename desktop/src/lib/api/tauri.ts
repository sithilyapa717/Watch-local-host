import { invoke } from "@tauri-apps/api/core";

export interface Settings {
  library_root: string;
  library_roots: string[];
  tmdb_api_key: string;
  last_scan_at?: string | null;
}

export interface ScannedFile {
  path: string;
  filename: string;
  extension: string;
  size_bytes: number;
  category: string;
}

export interface ScanResult {
  new_files: ScannedFile[];
  total_scanned: number;
}

export interface MovieItem {
  id: number;
  file_id: number;
  tmdb_id: number;
  title: string;
  overview: string;
  release_date?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average: number;
  runtime?: number | null;
  genres: string;
  watch_status: string;
  progress_pct: number;
  file_path: string;
  versions: MovieVersion[];
  removed?: boolean;
}

export interface MovieVersion {
  file_id: number;
  file_path: string;
  removed?: boolean;
}

export interface ShowItem {
  id: number;
  tmdb_id: number;
  title: string;
  overview: string;
  first_air_date?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average: number;
  genres: string;
  category: string;
  status: string;
  owned_count: number;
  total_count: number;
  unwatched_count: number;
  removed?: boolean;
}

export interface MediaFile {
  id: number;
  path: string;
  filename: string;
  extension: string;
  size_bytes: number;
  category: string;
  organized: boolean;
  added_at: string;
}

export type EpisodeStatus = "owned" | "owned_watched" | "owned_in_progress" | "missing";
export type SeasonStatus = "complete" | "partial" | "missing";

export interface EpisodeRow {
  season_number: number;
  episode_number: number;
  name: string;
  air_date?: string | null;
  still_path?: string | null;
  overview: string;
  file_id?: number | null;
  file_path?: string | null;
  status: EpisodeStatus;
  progress_pct: number;
  removed?: boolean;
}

export interface SeasonCompleteness {
  season_number: number;
  status: SeasonStatus;
  owned_count: number;
  total_count: number;
  episodes: EpisodeRow[];
}

export interface ShowCompleteness {
  show_id: number;
  title: string;
  owned_count: number;
  total_count: number;
  seasons: SeasonCompleteness[];
}

export interface CompletenessResponse {
  completeness: ShowCompleteness;
  summary: string;
}

export const api = {
  getSettings: () => invoke<Settings>("get_settings"),
  saveSettings: (s: Settings) => invoke<void>("save_settings", { settings: s }),
  validateTmdbKey: (apiKey: string) => invoke<void>("validate_tmdb_key_cmd", { apiKey }),
  resetApp: () => invoke<void>("reset_app_cmd"),
  scanLibrary: () => invoke<ScanResult>("scan_library_cmd"),
  skipNewFiles: (files: ScannedFile[]) => invoke<number[]>("skip_new_files", { files }),
  organizeNewFiles: (files: ScannedFile[]) =>
    invoke<{ organized: number; failed: string[] }>("organize_new_files", { files }),
  organizeFilesByIds: (fileIds: number[]) =>
    invoke<{ organized: number; failed: string[] }>("organize_files_by_ids", { fileIds }),
  repairLibraryShows: () =>
    invoke<{ folders_fixed: number; episodes_moved: number; shows_removed: number }>(
      "repair_library_shows_cmd"
    ),
  getMovies: () => invoke<MovieItem[]>("get_movies"),
  getShows: (category: string) => invoke<ShowItem[]>("get_shows", { category }),
  getNotOrganized: () => invoke<MediaFile[]>("get_not_organized"),
  getShowCompleteness: (showId: number, includeSpecials?: boolean) =>
    invoke<CompletenessResponse>("get_show_completeness_cmd", {
      showId,
      includeSpecials: includeSpecials ?? false,
    }),
  getIncompleteShows: (category: string, unwatchedOnly?: boolean) =>
    invoke<ShowItem[]>("get_incomplete_shows_cmd", { category, unwatchedOnly: unwatchedOnly ?? false }),
  searchLocal: (query: string) => invoke<Record<string, string>[]>("search_local", { query }),
  searchTmdb: (query: string, mediaType: string) =>
    invoke<{ id: number; title: string; year?: string; media_type: string }[]>(
      "search_tmdb_cmd",
      { query, mediaType }
    ),
  saveWatchProgress: (fileId: number, positionSec: number, durationSec: number) =>
    invoke<void>("save_watch_progress", { fileId, positionSec, durationSec }),
  getWatchProgress: (fileId: number) =>
    invoke<[number, number]>("get_watch_progress", { fileId }),
  getPosterPath: (remotePath: string) =>
    invoke<string | null>("get_poster_path", { remotePath }),
  playMedia: (fileId: number, path: string, title: string, subtitle?: string, startOver?: boolean) =>
    invoke<{
      playing: boolean;
      mpv_available: boolean;
      path: string;
      title: string;
      start_sec: number;
      mode: "mpv" | "embedded";
      file_id?: number | null;
      error?: string | null;
      subtitles: { label: string; path: string; format: string }[];
    }>("play_media", {
      fileId,
      path,
      title,
      subtitle,
      startOver: startOver ?? false,
    }),
  stopPlayer: () => invoke<void>("stop_player"),
  getNextEpisode: (fileId: number) =>
    invoke<{
      file_id: number;
      path: string;
      title: string;
      season: number;
      episode: number;
    } | null>("get_next_episode_for_file_cmd", { fileId }),
  checkMpv: () => invoke<boolean>("check_mpv"),
  getContinueWatching: () => invoke<Record<string, unknown>[]>("get_continue_watching"),
  getMovieDetail: (id: number) => invoke<MovieItem>("get_movie_detail", { id }),
  getShowDetail: (id: number) => invoke<ShowItem>("get_show_detail", { id }),
  clearWatchProgress: (fileId: number) => invoke<void>("clear_watch_progress_cmd", { fileId }),
  markFileWatched: (fileId: number) => invoke<void>("mark_file_watched_cmd", { fileId }),
  markShowWatched: (showId: number) => invoke<void>("mark_show_watched_cmd", { showId }),
  resetShowProgress: (showId: number) => invoke<void>("reset_show_progress_cmd", { showId }),
  getMobileServerInfo: () =>
    invoke<{ port: number; token: string; lan_url: string; usb_url: string; name: string }>(
      "get_mobile_server_info"
    ),
  setMobilePin: (pin: string) => invoke<string>("set_mobile_pin_cmd", { pin }),
  regenerateMobilePin: () => invoke<string>("regenerate_mobile_pin_cmd"),
};
