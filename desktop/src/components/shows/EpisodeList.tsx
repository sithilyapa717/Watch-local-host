import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { EpisodeRow } from "@/lib/api/tauri";
import { Check } from "lucide-react";

interface EpisodeListProps {
  episodes: EpisodeRow[];
  showTitle: string;
  filter: "all" | "owned" | "missing" | "unwatched" | "watched";
  onPlay: (ep: EpisodeRow) => void;
}

export function EpisodeList({ episodes, filter, onPlay }: EpisodeListProps) {
  const filtered = episodes.filter((ep) => {
    if (filter === "owned") return ep.status !== "missing";
    if (filter === "missing") return ep.status === "missing";
    if (filter === "watched") return ep.status === "owned_watched";
    if (filter === "unwatched") return ep.status === "owned" || ep.status === "owned_in_progress";
    return true;
  });

  return (
    <div className="space-y-2">
      {filtered.map((ep, i) => {
        const isMissing = ep.status === "missing";
        const removed = Boolean(ep.removed);
        const canPlay = !isMissing && !removed;
        return (
          <motion.div
            key={ep.episode_number}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: isMissing || removed ? 0.45 : 1, x: 0 }}
            transition={{ delay: i * 0.02 }}
            className={cn(
              "flex items-center gap-4 p-3 rounded-xl border",
              isMissing || removed
                ? "border-dashed border-white/10 bg-white/2"
                : "border-white/8 bg-surface hover:bg-surface-hover cursor-pointer",
            )}
            title={
              isMissing
                ? `No file found for S${String(ep.season_number).padStart(2, "0")}E${String(ep.episode_number).padStart(2, "0")}`
                : undefined
            }
            onClick={canPlay ? () => onPlay(ep) : undefined}
          >
            <span className="text-sm font-mono text-muted w-12">
              E{String(ep.episode_number).padStart(2, "0")}
            </span>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-sm font-medium truncate",
                  canPlay && "hover:text-accent transition-colors",
                )}
              >
                {ep.name || `Episode ${ep.episode_number}`}
              </p>
              {ep.air_date && <p className="text-xs text-muted">{ep.air_date}</p>}
            </div>
            {removed ? (
              <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/80">Removed</span>
            ) : isMissing ? (
              <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-muted">Missing</span>
            ) : ep.status === "owned_watched" ? (
              <span className="flex items-center gap-1 text-xs text-success">
                <Check size={14} /> Done
              </span>
            ) : ep.status === "owned_in_progress" ? (
              <span className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent">
                {Math.round(ep.progress_pct)}%
              </span>
            ) : null}
          </motion.div>
        );
      })}
    </div>
  );
}

export function CompletenessSummary({
  owned,
  total,
  summary,
}: {
  owned: number;
  total: number;
  summary: string;
}) {
  const pct = total > 0 ? (owned / total) * 100 : 0;

  return (
    <div className="flex items-start gap-6 p-4 rounded-xl bg-surface border border-white/8">
      <div className="relative w-16 h-16 shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="3" />
          <motion.circle
            cx="18" cy="18" r="15" fill="none" stroke="#8b5cf6" strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${pct} ${100 - pct}`}
            initial={{ strokeDasharray: "0 100" }}
            animate={{ strokeDasharray: `${pct} ${100 - pct}` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
          {Math.round(pct)}%
        </span>
      </div>
      <div>
        <p className="font-semibold text-lg">{owned} / {total} episodes downloaded</p>
        <p className="text-sm text-muted mt-1">{summary}</p>
      </div>
    </div>
  );
}
