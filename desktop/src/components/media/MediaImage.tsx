import type { ReactNode } from "react";
import { useResolvedImageSrc } from "@/lib/media/mediaSrc";

interface MediaImageProps {
  path?: string | null;
  alt?: string;
  className?: string;
  size?: "w342" | "w780";
  fallback?: ReactNode;
}

export function MediaImage({
  path,
  alt = "",
  className,
  size = "w342",
  fallback = null,
}: MediaImageProps) {
  const src = useResolvedImageSrc(path, size);
  if (!src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={false}
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}
