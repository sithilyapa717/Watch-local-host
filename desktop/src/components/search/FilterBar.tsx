import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterState {
  watchStatus: string;
  collectionStatus: string;
  sort: string;
  genres: string[];
}

interface FilterBarProps {
  open: boolean;
  onToggle: () => void;
  filters: FilterState;
  onChange: (f: FilterState) => void;
  genres: string[];
  showCollectionFilter?: boolean;
  resultCount?: string;
}

const WATCH_OPTIONS = [
  { value: "all", label: "All" },
  { value: "unwatched", label: "To watch" },
  { value: "in_progress", label: "In progress" },
  { value: "watched", label: "Done" },
];

const COLLECTION_OPTIONS = [
  { value: "all", label: "All" },
  { value: "complete", label: "Complete" },
  { value: "incomplete", label: "Incomplete" },
  { value: "has_missing", label: "Has missing" },
];

const SORT_OPTIONS = [
  { value: "title_asc", label: "A–Z" },
  { value: "title_desc", label: "Z–A" },
  { value: "rating", label: "Rating" },
  { value: "date_added", label: "Date added" },
  { value: "recently_watched", label: "Recently watched" },
];

export function FilterBar({
  open,
  onToggle,
  filters,
  onChange,
  genres,
  showCollectionFilter,
  resultCount,
}: FilterBarProps) {
  const activeCount =
    (filters.watchStatus !== "all" ? 1 : 0) +
    (showCollectionFilter && filters.collectionStatus !== "all" ? 1 : 0) +
    (filters.sort !== "title_asc" ? 1 : 0) +
    filters.genres.length;

  const clearAll = () =>
    onChange({
      watchStatus: "all",
      collectionStatus: "all",
      sort: "title_asc",
      genres: [],
    });

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              open || activeCount > 0
                ? "border-accent/40 bg-accent/15 text-white"
                : "border-white/10 bg-surface text-muted hover:text-white hover:bg-white/5",
            )}
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeCount > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4">
                {activeCount}
              </span>
            )}
          </button>
          {resultCount && <span className="text-sm text-muted">{resultCount}</span>}
        </div>
        {activeCount > 0 && (
          <button type="button" onClick={clearAll} className="text-xs text-muted hover:text-white">
            Clear all
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl border border-white/8 bg-surface/80 p-4 space-y-4">
              <ChipRow
                label="Watch"
                options={WATCH_OPTIONS}
                value={filters.watchStatus}
                onChange={(watchStatus) => onChange({ ...filters, watchStatus })}
              />
              {showCollectionFilter && (
                <ChipRow
                  label="Collection"
                  options={COLLECTION_OPTIONS}
                  value={filters.collectionStatus}
                  onChange={(collectionStatus) => onChange({ ...filters, collectionStatus })}
                />
              )}
              <ChipRow
                label="Sort"
                options={SORT_OPTIONS}
                value={filters.sort}
                onChange={(sort) => onChange({ ...filters, sort })}
              />
              {genres.length > 0 && (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wider text-muted">Genre</p>
                  <div className="flex flex-wrap gap-2">
                    {genres.map((genre) => {
                      const selected = filters.genres.includes(genre);
                      return (
                        <button
                          key={genre}
                          type="button"
                          onClick={() =>
                            onChange({
                              ...filters,
                              genres: selected
                                ? filters.genres.filter((g) => g !== genre)
                                : [...filters.genres, genre],
                            })
                          }
                          className={cn(
                            "rounded-full px-3 py-1 text-xs transition-colors",
                            selected
                              ? "bg-accent text-white"
                              : "bg-white/5 text-muted hover:bg-white/10 hover:text-white",
                          )}
                        >
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wider text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs transition-colors",
              value === option.value
                ? "bg-accent text-white"
                : "bg-white/5 text-muted hover:bg-white/10 hover:text-white",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function applyShowFilters(shows: import("@/lib/api/tauri").ShowItem[], filters: FilterState) {
  let result = [...shows];
  if (filters.watchStatus === "watched") {
    result = result.filter((s) => s.owned_count > 0 && s.unwatched_count === 0);
  }
  if (filters.watchStatus === "unwatched" || filters.watchStatus === "in_progress") {
    result = result.filter((s) => s.unwatched_count > 0);
  }
  if (filters.collectionStatus === "complete") result = result.filter((s) => s.total_count > 0 && s.owned_count >= s.total_count);
  if (filters.collectionStatus === "incomplete") result = result.filter((s) => s.total_count > 0 && s.owned_count < s.total_count);
  if (filters.collectionStatus === "has_missing") result = result.filter((s) => s.owned_count < s.total_count);
  if (filters.genres.length) result = result.filter((s) => filters.genres.some((g) => s.genres.includes(g)));
  if (filters.sort === "title_asc") result.sort((a, b) => a.title.localeCompare(b.title));
  if (filters.sort === "title_desc") result.sort((a, b) => b.title.localeCompare(a.title));
  if (filters.sort === "rating") result.sort((a, b) => b.vote_average - a.vote_average);
  return result;
}

export function applyMovieFilters(movies: import("@/lib/api/tauri").MovieItem[], filters: FilterState) {
  let result = [...movies];
  if (filters.watchStatus === "watched") result = result.filter((m) => m.watch_status === "watched");
  if (filters.watchStatus === "unwatched") result = result.filter((m) => m.watch_status === "unwatched");
  if (filters.watchStatus === "in_progress") result = result.filter((m) => m.watch_status === "in_progress");
  if (filters.genres.length) result = result.filter((m) => filters.genres.some((g) => m.genres.includes(g)));
  if (filters.sort === "title_asc") result.sort((a, b) => a.title.localeCompare(b.title));
  if (filters.sort === "title_desc") result.sort((a, b) => b.title.localeCompare(a.title));
  if (filters.sort === "rating") result.sort((a, b) => b.vote_average - a.vote_average);
  return result;
}

export const defaultFilters: FilterState = {
  watchStatus: "all",
  collectionStatus: "all",
  sort: "title_asc",
  genres: [],
};
