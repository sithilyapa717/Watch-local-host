import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api/tauri";
import { LIBRARY_UPDATED } from "@/lib/events";
import type { ShowItem } from "@/lib/api/tauri";
import { ShowCard } from "@/components/cards/ShowCard";
import { FilterBar, defaultFilters, applyShowFilters, type FilterState } from "@/components/search/FilterBar";
import { ShimmerSkeleton } from "@/components/ui/MotionCard";
import { showTileMenu } from "@/lib/menu/tileMenus";

interface ShowsPageProps {
  category: "tv" | "anime";
  title: string;
  basePath: string;
}

export function ShowsPage({ category, title, basePath }: ShowsPageProps) {
  const navigate = useNavigate();
  const [shows, setShows] = useState<ShowItem[]>([]);
  const [filters, setFilters] = useState<FilterState>(() => {
    const saved = localStorage.getItem(`filters-${category}`);
    return saved ? JSON.parse(saved) : defaultFilters;
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => api.getShows(category).then(setShows).finally(() => setLoading(false));
    load();
    const handler = () => load();
    window.addEventListener(LIBRARY_UPDATED, handler);
    return () => window.removeEventListener(LIBRARY_UPDATED, handler);
  }, [category]);

  useEffect(() => {
    localStorage.setItem(`filters-${category}`, JSON.stringify(filters));
  }, [filters, category]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "F") setFilterOpen((o) => !o);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filtered = applyShowFilters(shows, filters);
  const genres = [...new Set(shows.flatMap((s) => s.genres.split(", ").filter(Boolean)))];

  if (loading) {
    return <div className="grid grid-cols-6 gap-4">{Array.from({ length: 12 }).map((_, i) => <ShimmerSkeleton key={i} className="aspect-[2/3]" />)}</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      <FilterBar
        open={filterOpen}
        onToggle={() => setFilterOpen((o) => !o)}
        filters={filters}
        onChange={setFilters}
        genres={genres}
        showCollectionFilter
        resultCount={`${filtered.length} of ${shows.length} shows`}
      />
      {filtered.length === 0 ? (
        <p className="text-muted text-center py-12">No shows found. Add files to your TV folder.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {filtered.map((s, i) => (
            <ShowCard
              key={s.id}
              show={s}
              index={i}
              onClick={() => navigate(`${basePath}/${s.id}`)}
              menuItems={showTileMenu(s, navigate, basePath)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
