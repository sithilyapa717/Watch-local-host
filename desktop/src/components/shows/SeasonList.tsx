import { motion } from "framer-motion";
import { cn, formatSeasonLabel } from "@/lib/utils";
import type { SeasonCompleteness } from "@/lib/api/tauri";
import { ChevronRight } from "lucide-react";
import { useTheme } from "@/lib/theme/theme";

interface SeasonListProps {
  seasons: SeasonCompleteness[];
  selectedSeason: number | null;
  onSelect: (season: number) => void;
}

export function SeasonBadge({ status, owned, total }: { status: string; owned: number; total: number }) {
  const styles = {
    complete: "bg-success/20 text-success",
    partial: "bg-warning/20 text-warning",
    missing: "bg-white/10 text-muted",
  }[status] ?? "bg-white/10 text-muted";

  const label = status === "complete" ? "Complete" : status === "partial" ? `${owned}/${total}` : "Missing";

  return (
    <motion.span
      className={cn("text-xs px-2 py-0.5 rounded-full font-medium", styles)}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      {label}
    </motion.span>
  );
}

export function SeasonList({ seasons, selectedSeason, onSelect }: SeasonListProps) {
  const { theme } = useTheme();
  return (
    <div className={cn(theme === "pulse" ? "grid gap-3 sm:grid-cols-2" : "space-y-2")}>
      {seasons.map((season) => (
        <motion.button
          key={season.season_number}
          className={cn(
            "w-full flex items-center justify-between text-left",
            theme === "default" && "p-4 rounded-xl border transition-colors",
            theme === "marquee" && "border-b border-white/10 px-1 py-4",
            theme === "pulse" && "rounded-2xl border-2 p-5",
            selectedSeason === season.season_number
              ? theme === "marquee"
                ? "border-accent text-accent"
                : theme === "pulse"
                  ? "border-accent bg-accent/15"
                  : "bg-accent/10 border-accent/30"
              : theme === "marquee"
                ? "hover:text-accent"
                : theme === "pulse"
                  ? "border-white/10 bg-surface hover:border-accent/50"
                  : "bg-surface border-white/8 hover:bg-surface-hover"
          )}
          onClick={() => onSelect(season.season_number)}
          whileHover={theme === "pulse" ? { scale: 1.03 } : { scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="flex items-center gap-4">
            <span className="font-semibold">{formatSeasonLabel(season.season_number)}</span>
            <span className="text-sm text-muted">
              {season.owned_count} / {season.total_count} episodes
            </span>
            <SeasonBadge status={season.status} owned={season.owned_count} total={season.total_count} />
          </div>
          <ChevronRight size={18} className="text-muted" />
        </motion.button>
      ))}
    </div>
  );
}
