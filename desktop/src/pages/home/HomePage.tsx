import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/lib/api/tauri";
import type { MovieItem, ShowItem } from "@/lib/api/tauri";
import { playAndNavigate } from "@/lib/playback/play";
import { MovieCard } from "@/components/cards/MovieCard";
import { ShowCard } from "@/components/cards/ShowCard";
import { ShimmerSkeleton } from "@/components/ui/MotionCard";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { LIBRARY_UPDATED } from "@/lib/events";
import { MediaImage } from "@/components/media/MediaImage";
import { TileContextMenu } from "@/components/menu/TileContextMenu";
import { continueWatchingMenu, movieTileMenu, showTileMenu } from "@/lib/menu/tileMenus";
import { RemovedBadge } from "@/components/media/RemovedBadge";
import { RotateCcw } from "lucide-react";

export function HomePage() {
  const navigate = useNavigate();
  const [continueItems, setContinueItems] = useState<Record<string, unknown>[]>([]);
  const [incompleteAnime, setIncompleteAnime] = useState<ShowItem[]>([]);
  const [incompleteTv, setIncompleteTv] = useState<ShowItem[]>([]);
  const [recentMovies, setRecentMovies] = useState<MovieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playError, setPlayError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cw, anime, tv, movies] = await Promise.all([
      api.getContinueWatching(),
      api.getIncompleteShows("anime", true),
      api.getIncompleteShows("tv", true),
      api.getMovies(),
    ]);
    const hideRemoved = localStorage.getItem("watch-hide-removed") === "1";
    setContinueItems(hideRemoved ? cw.filter((item) => !item.removed) : cw);
    setIncompleteAnime((hideRemoved ? anime.filter((show) => !show.removed) : anime).slice(0, 12));
    setIncompleteTv((hideRemoved ? tv.filter((show) => !show.removed) : tv).slice(0, 12));
    setRecentMovies((hideRemoved ? movies.filter((movie) => !movie.removed) : movies).slice(0, 12));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
    const handler = () => load();
    window.addEventListener(LIBRARY_UPDATED, handler);
    return () => window.removeEventListener(LIBRARY_UPDATED, handler);
  }, [load]);

  const play = async (fileId: number, path: string, title: string, startOver = false) => {
    try {
      setPlayError(null);
      await playAndNavigate(navigate, fileId, path, title, undefined, startOver);
    } catch (e) {
      setPlayError(String(e));
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerSkeleton key={i} className="aspect-[2/3]" />
        ))}
      </div>
    );
  }

  const hasContent =
    continueItems.length > 0 ||
    incompleteAnime.length > 0 ||
    incompleteTv.length > 0 ||
    recentMovies.length > 0;

  return (
    <div className="space-y-10">
      {playError && (
        <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {playError}
        </p>
      )}
      {continueItems.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 theme-title">Continue Watching</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {continueItems.map((item) => {
              const pct =
                Number(item.duration_sec) > 0
                  ? (Number(item.position_sec) / Number(item.duration_sec)) * 100
                  : 0;
              const removed = Boolean(item.removed);
              return (
                <TileContextMenu
                  key={String(item.file_id)}
                  items={continueWatchingMenu(item, play)}
                >
                <motion.div
                  className="group shrink-0 w-48 cursor-pointer"
                  onClick={() => {
                    if (removed) {
                      setPlayError("This title is on a disconnected drive.");
                      return;
                    }
                    play(Number(item.file_id), String(item.path), String(item.title));
                  }}
                >
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-surface">
                    <MediaImage
                      path={item.poster_path ? String(item.poster_path) : null}
                      className={`w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110 ${removed ? "grayscale" : ""}`}
                    />
                    {removed && <RemovedBadge />}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <RotateCcw size={24} />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <p className="text-sm mt-2 truncate">{String(item.title)}</p>
                </motion.div>
                </TileContextMenu>
              );
            })}
          </div>
        </section>
      )}

      {incompleteAnime.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold theme-title">Have to Watch · Anime</h2>
              <p className="text-sm text-muted">Episodes you haven&apos;t finished watching</p>
            </div>
            <AnimatedButton variant="ghost" size="sm" onClick={() => navigate("/anime")}>
              View all
            </AnimatedButton>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {incompleteAnime.map((show, i) => (
              <ShowCard
                key={show.id}
                show={show}
                index={i}
                onClick={() => navigate(`/anime/${show.id}`)}
                menuItems={showTileMenu(show, navigate, "/anime")}
              />
            ))}
          </div>
        </section>
      )}

      {incompleteTv.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold theme-title">Have to Watch · Series</h2>
              <p className="text-sm text-muted">Episodes you haven&apos;t finished watching</p>
            </div>
            <AnimatedButton variant="ghost" size="sm" onClick={() => navigate("/tv")}>
              View all
            </AnimatedButton>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {incompleteTv.map((show, i) => (
              <ShowCard
                key={show.id}
                show={show}
                index={i}
                onClick={() => navigate(`/tv/${show.id}`)}
                menuItems={showTileMenu(show, navigate, "/tv")}
              />
            ))}
          </div>
        </section>
      )}

      {recentMovies.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold theme-title">Movies</h2>
            <AnimatedButton variant="ghost" size="sm" onClick={() => navigate("/movies")}>
              View all
            </AnimatedButton>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {recentMovies.map((m, i) => (
              <MovieCard
                key={m.id}
                movie={m}
                index={i}
                onClick={() => navigate(`/movies/${m.id}`, { state: { movie: m } })}
                menuItems={movieTileMenu(m, navigate)}
              />
            ))}
          </div>
        </section>
      )}

      {!hasContent && (
        <div className="text-center py-20 text-muted">
          <p className="text-lg">Your library is empty</p>
          <p className="text-sm mt-2">Add media to your Watch folder and scan from Settings</p>
          <AnimatedButton className="mt-4" onClick={() => navigate("/settings")}>
            Open Settings
          </AnimatedButton>
        </div>
      )}
    </div>
  );
}
