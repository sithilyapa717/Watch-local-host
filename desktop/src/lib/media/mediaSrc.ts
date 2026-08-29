import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { api } from "@/lib/api/tauri";

type ImageSize = "w342" | "w780";

function isFilesystemPath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("\\\\");
}

function tmdbUrl(path: string, size: ImageSize): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `https://image.tmdb.org/t/p/${size}${normalized}`;
}

export function useResolvedImageSrc(
  path?: string | null,
  size: ImageSize = "w342",
): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
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

      try {
        const local = await api.getPosterPath(path);
        if (cancelled) return;
        if (local) {
          setSrc(convertFileSrc(local));
          return;
        }
      } catch {
        // Fall through to the TMDB URL.
      }

      if (!cancelled) setSrc(tmdbUrl(path, size));
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [path, size]);

  return src;
}
