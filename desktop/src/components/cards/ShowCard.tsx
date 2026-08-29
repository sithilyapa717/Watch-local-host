import { motion } from "framer-motion";
import { Tv } from "lucide-react";
import type { ShowItem } from "@/lib/api/tauri";
import { MediaImage } from "@/components/media/MediaImage";
import { TileContextMenu, type ContextMenuItem } from "@/components/menu/TileContextMenu";
import { RemovedBadge } from "@/components/media/RemovedBadge";
import { useTheme } from "@/lib/theme/theme";
import { cardEnterFor } from "@/lib/theme/motion";
import { cn } from "@/lib/utils";

interface ShowCardProps {
  show: ShowItem;
  index?: number;
  onClick: () => void;
  menuItems?: ContextMenuItem[];
}

export function ShowCard({ show, index = 0, onClick, menuItems }: ShowCardProps) {
  const { theme } = useTheme();
  const isDone = show.owned_count > 0 && show.unwatched_count === 0;
  const removed = Boolean(show.removed);

  const card = (
    <motion.div
      className={cn("group cursor-pointer", theme === "default" && "rounded-xl")}
      {...cardEnterFor(theme, index)}
      onClick={onClick}
      whileHover={
        theme === "pulse"
          ? { y: -10, rotate: -1.4, transition: { delay: 0, type: "spring", stiffness: 420, damping: 22 } }
          : theme === "marquee"
            ? { y: -2, transition: { delay: 0, duration: 0.18 } }
            : undefined
      }
    >
      <div
        className={cn(
          "relative aspect-[2/3] overflow-hidden bg-surface",
          theme === "default" &&
            "rounded-xl shadow-lg transition-shadow duration-300 group-hover:shadow-[0_12px_40px_rgb(0_0_0_/_0.45)]",
          theme === "marquee" &&
            "rounded-none border border-white/10 transition-[box-shadow,border-color] duration-300 group-hover:border-accent group-hover:shadow-[0_0_0_1px_var(--watch-accent)]",
          theme === "pulse" &&
            "rounded-2xl shadow-lg transition-shadow duration-300 group-hover:shadow-[0_16px_36px_rgb(8_47_73_/_0.55),0_0_24px_rgb(34_211_238_/_0.28)]",
        )}
      >
        <MediaImage
          path={show.poster_path}
          alt={show.title}
          className={cn(
            "h-full w-full object-cover",
            theme === "default" && "transition-transform duration-500 ease-out group-hover:scale-110",
            theme === "marquee" && "transition-[filter,object-position] duration-700 ease-out group-hover:brightness-110 group-hover:object-[center_20%]",
            theme === "pulse" && "transition-transform duration-300 ease-out group-hover:scale-125",
            removed && "grayscale",
          )}
          fallback={
            <div className="flex h-full items-center justify-center text-muted"><Tv size={32} /></div>
          }
        />
        {theme === "marquee" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <p className="theme-title text-sm leading-tight">{show.title}</p>
          </div>
        )}
        {removed && <RemovedBadge />}
        {isDone && !removed && (
          <span
            className={cn(
              "absolute top-2 right-2 bg-success/90 text-xs",
              theme === "marquee" && "px-2 py-0.5 uppercase tracking-wider",
              theme === "pulse" && "px-2.5 py-1 rounded-full font-semibold",
              theme === "default" && "px-2 py-0.5 rounded-full",
            )}
          >
            Done
          </span>
        )}
      </div>
      <div className={cn("mt-2", theme === "marquee" ? "px-0" : "px-1")}>
        <p className={cn("font-medium truncate", theme === "marquee" ? "theme-title text-[15px]" : "text-sm")}>
          {show.title}
        </p>
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
