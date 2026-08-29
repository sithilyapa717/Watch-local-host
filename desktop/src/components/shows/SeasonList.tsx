import { motion } from "framer-motion";
import { cn, formatSeasonLabel } from "@/lib/utils";
import type { SeasonCompleteness } from "@/lib/api/tauri";
import { ChevronRight } from "lucide-react";

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
  return (
    <div className="space-y-2">
      {seasons.map((season) => (
        <motion.button
          key={season.season_number}
          className={cn(
            "w-full flex items-center justify-between p-4 rounded-xl border transition-colors text-left",
            selectedSeason === season.season_number
              ? "bg-accent/10 border-accent/30"
              : "bg-surface border-white/8 hover:bg-surface-hover"
          )}
          onClick={() => onSelect(season.season_number)}
          whileHover={{ scale: 1.01 }}
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
