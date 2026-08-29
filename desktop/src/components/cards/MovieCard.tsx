import { motion } from "framer-motion";
import type { MovieItem } from "@/lib/api/tauri";
import { MediaImage } from "@/components/media/MediaImage";
import { TileContextMenu, type ContextMenuItem } from "@/components/menu/TileContextMenu";
import { RemovedBadge } from "@/components/media/RemovedBadge";

interface MovieCardProps {
  movie: MovieItem;
  index?: number;
  onClick: () => void;
  menuItems?: ContextMenuItem[];
}

export function MovieCard({ movie, index = 0, onClick, menuItems }: MovieCardProps) {
  const isProgress = movie.watch_status === "in_progress";
  const isWatched = movie.watch_status === "watched";
  const removed = Boolean(movie.removed);

  const card = (
    <motion.div
      className="group cursor-pointer rounded-xl"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      onClick={onClick}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface shadow-lg transition-shadow duration-300 group-hover:shadow-[0_12px_40px_rgb(0_0_0_/_0.45)]">
        <MediaImage
          path={movie.poster_path}
          alt={movie.title}
          className={`h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110 ${removed ? "grayscale" : ""}`}
          fallback={
            <div className="flex h-full items-center justify-center text-muted text-sm">No poster</div>
          }
        />
        {removed && <RemovedBadge />}
        {isProgress && !removed && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full bg-accent" style={{ width: `${movie.progress_pct}%` }} />
          </div>
        )}
        {isWatched && (
          <span className="absolute top-2 right-2 bg-success/90 text-xs px-2 py-0.5 rounded-full">Done</span>
        )}
      </div>
      <div className="mt-2 px-1">
        <p className="font-medium text-sm truncate">{movie.title}</p>
        <p className="text-xs text-muted">
          {removed
            ? "Removed"
            : `${movie.versions?.length > 1 ? `${movie.versions.length} files · ` : ""}${movie.release_date?.slice(0, 4)} · ★ ${movie.vote_average.toFixed(1)}`}
        </p>
      </div>
    </motion.div>
  );

  return <TileContextMenu items={menuItems ?? []}>{card}</TileContextMenu>;
}
