import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";

type ImageSize = "w342" | "w780";

function isFilesystemPath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("\\\\");
}

export function tmdbUrl(path: string, size: ImageSize): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `https://image.tmdb.org/t/p/${size}${normalized}`;
}

/**
 * Resolve poster/backdrop paths for the UI.
 * TMDB relative paths always use the CDN — local asset:// URLs often fail
 * (403) on Windows release builds when AppData paths are not in scope.
 * Local cache is still used by the mobile API.
 */
export function useResolvedImageSrc(
  path?: string | null,
  size: ImageSize = "w342",
): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setSrc(null);
      return;
    }

    if (path.startsWith("http://") || path.startsWith("https://")) {
      setSrc(path);
      return;
    }

    if (isFilesystemPath(path)) {
      setSrc(convertFileSrc(path));
      return;
    }

    setSrc(tmdbUrl(path, size));
  }, [path, size]);

  return src;
}
