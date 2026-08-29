import { motion } from "framer-motion";
import { Tv } from "lucide-react";
import type { ShowItem } from "@/lib/api/tauri";
import { MediaImage } from "@/components/media/MediaImage";
import { TileContextMenu, type ContextMenuItem } from "@/components/menu/TileContextMenu";
import { RemovedBadge } from "@/components/media/RemovedBadge";

interface ShowCardProps {
  show: ShowItem;
  index?: number;
  onClick: () => void;
  menuItems?: ContextMenuItem[];
}

export function ShowCard({ show, index = 0, onClick, menuItems }: ShowCardProps) {
  const isDone = show.owned_count > 0 && show.unwatched_count === 0;
  const removed = Boolean(show.removed);

  const card = (
    <motion.div
      className="group cursor-pointer rounded-xl"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface shadow-lg transition-shadow duration-300 group-hover:shadow-[0_12px_40px_rgb(0_0_0_/_0.45)]">
        <MediaImage
          path={show.poster_path}
          alt={show.title}
          className={`h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110 ${removed ? "grayscale" : ""}`}
          fallback={
            <div className="flex h-full items-center justify-center text-muted"><Tv size={32} /></div>
          }
        />
        {removed && <RemovedBadge />}
        {isDone && !removed && (
          <span className="absolute top-2 right-2 bg-success/90 text-xs px-2 py-0.5 rounded-full">
            Done
          </span>
        )}
      </div>
      <div className="mt-2 px-1">
        <p className="font-medium text-sm truncate">{show.title}</p>
        <p className="text-xs text-muted">
          {removed
            ? "Removed"
            : `${show.owned_count}/${show.total_count} ep${show.first_air_date ? ` · ${show.first_air_date.slice(0, 4)}` : ""}`}
        </p>
      </div>
    </motion.div>
  );

  return <TileContextMenu items={menuItems ?? []}>{card}</TileContextMenu>;
}
