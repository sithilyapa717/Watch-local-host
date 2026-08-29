import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api/tauri";
import { LIBRARY_UPDATED } from "@/lib/events";
import type { MovieItem } from "@/lib/api/tauri";
import { MovieCard } from "@/components/cards/MovieCard";
import { FilterBar, defaultFilters, applyMovieFilters, type FilterState } from "@/components/search/FilterBar";
import { ShimmerSkeleton } from "@/components/ui/MotionCard";
import { movieTileMenu } from "@/lib/menu/tileMenus";

export function MoviesPage() {
  const navigate = useNavigate();
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [filters, setFilters] = useState<FilterState>(() => {
    const saved = localStorage.getItem("filters-movies");
    return saved ? JSON.parse(saved) : defaultFilters;
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => api.getMovies().then(setMovies).finally(() => setLoading(false));
    load();
    const handler = () => load();
    window.addEventListener(LIBRARY_UPDATED, handler);
    return () => window.removeEventListener(LIBRARY_UPDATED, handler);
  }, []);

  useEffect(() => {
    localStorage.setItem("filters-movies", JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "F") setFilterOpen((o) => !o);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filtered = applyMovieFilters(movies, filters);
  const genres = [...new Set(movies.flatMap((m) => m.genres.split(", ").filter(Boolean)))];

  if (loading) {
    return <div className="grid grid-cols-6 gap-4">{Array.from({ length: 12 }).map((_, i) => <ShimmerSkeleton key={i} className="aspect-[2/3]" />)}</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Movies</h1>
      <FilterBar
        open={filterOpen}
        onToggle={() => setFilterOpen((o) => !o)}
        filters={filters}
        onChange={setFilters}
        genres={genres}
        resultCount={`${filtered.length} of ${movies.length} movies`}
      />
      {filtered.length === 0 ? (
        <p className="text-muted text-center py-12">No movies found. Add files to your Movies folder.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {filtered.map((m, i) => (
            <MovieCard
              key={m.id}
              movie={m}
              index={i}
              onClick={() => navigate(`/movies/${m.id}`, { state: { movie: m } })}
              menuItems={movieTileMenu(m, navigate)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
