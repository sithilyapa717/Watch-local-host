import type { NavigateFunction } from "react-router-dom";
import type { ContextMenuItem } from "@/components/menu/TileContextMenu";
import { notifyLibraryUpdated } from "@/lib/events";
import { playAndNavigate } from "@/lib/playback/play";
import { api, type MovieItem, type ShowItem } from "@/lib/api/tauri";

export function movieTileMenu(
  movie: MovieItem,
  navigate: NavigateFunction,
): ContextMenuItem[] {
  const removed = Boolean(movie.removed);
  return [
    {
      label: "Open details",
      onClick: () => navigate(`/movies/${movie.id}`, { state: { movie } }),
    },
    {
      label: movie.watch_status === "in_progress" ? "Resume" : "Play",
      disabled: removed,
      onClick: () => void playAndNavigate(navigate, movie.file_id, movie.file_path, movie.title),
    },
    {
      label: "Play from start",
      disabled: removed,
      onClick: () =>
        void playAndNavigate(navigate, movie.file_id, movie.file_path, movie.title, undefined, true),
    },
    {
      label: "Mark as watched",
      onClick: () =>
        void api.markFileWatched(movie.file_id).then(() => notifyLibraryUpdated()),
    },
    {
      label: "Reset timestamp",
      onClick: () =>
        void api.clearWatchProgress(movie.file_id).then(() => notifyLibraryUpdated()),
    },
  ];
}

export function showTileMenu(
  show: ShowItem,
  navigate: NavigateFunction,
  basePath: string,
): ContextMenuItem[] {
  return [
    { label: "Open", onClick: () => navigate(`${basePath}/${show.id}`) },
    {
      label: "Mark all episodes watched",
      onClick: () => void api.markShowWatched(show.id).then(() => notifyLibraryUpdated()),
    },
    {
      label: "Reset all timestamps",
      onClick: () => void api.resetShowProgress(show.id).then(() => notifyLibraryUpdated()),
    },
  ];
}

export function continueWatchingMenu(
  item: Record<string, unknown>,
  play: (fileId: number, path: string, title: string, startOver?: boolean) => void,
): ContextMenuItem[] {
  const fileId = Number(item.file_id);
  const path = String(item.path);
  const title = String(item.title);
  const removed = Boolean(item.removed);
  return [
    { label: "Resume", disabled: removed, onClick: () => play(fileId, path, title) },
    { label: "Play from start", disabled: removed, onClick: () => play(fileId, path, title, true) },
    {
      label: "Mark as watched",
      onClick: () => void api.markFileWatched(fileId).then(() => notifyLibraryUpdated()),
    },
    {
      label: "Reset timestamp",
      onClick: () => void api.clearWatchProgress(fileId).then(() => notifyLibraryUpdated()),
    },
  ];
}
