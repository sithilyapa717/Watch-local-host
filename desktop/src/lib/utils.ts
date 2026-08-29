import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function posterUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (/^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("\\\\")) return path;
  return `https://image.tmdb.org/t/p/w342${path.startsWith("/") ? path : `/${path}`}`;
}

export function backdropUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (/^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("\\\\")) return path;
  return `https://image.tmdb.org/t/p/w780${path.startsWith("/") ? path : `/${path}`}`;
}

export function formatSeasonLabel(seasonNumber: number): string {
  if (seasonNumber === 0) return "Specials";
  return `Season ${seasonNumber}`;
}

export function visibleSeasons<T extends { season_number: number }>(
  seasons: T[],
  includeSpecials: boolean,
): T[] {
  return includeSpecials ? seasons : seasons.filter((s) => s.season_number > 0);
}

export function sortSeasons<
  T extends {
    season_number: number;
    episodes?: Array<{ air_date?: string | null }>;
  },
>(seasons: T[]): T[] {
  const firstAirDate = (season: T) =>
    season.episodes
      ?.map((episode) => episode.air_date)
      .filter((date): date is string => Boolean(date))
      .sort()[0] ?? null;

  return [...seasons].sort((a, b) => {
    const dateA = firstAirDate(a);
    const dateB = firstAirDate(b);

    if (dateA && dateB && dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    return a.season_number - b.season_number;
  });
}
