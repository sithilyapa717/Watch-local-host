import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/lib/api/tauri";
import type { MovieItem, MovieVersion } from "@/lib/api/tauri";
import { playAndNavigate } from "@/lib/playback/play";
import { useResolvedImageSrc } from "@/lib/media/mediaSrc";
import { Play, RotateCcw, ArrowLeft, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function MovieDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromList = (location.state as { movie?: MovieItem } | null)?.movie;
  const [movie, setMovie] = useState<MovieItem | null>(fromList ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  useEffect(() => {
    if (!id) return;
    const movieId = Number(id);
    let cancelled = false;
    api
      .getMovieDetail(movieId)
      .then((detail) => {
        if (!cancelled) {
          setMovie(detail);
          setLoadError(null);
        }
      })
      .catch(async (err) => {
        try {
          const movies = await api.getMovies();
          const found = movies.find((item) => item.id === movieId);
          if (!cancelled && found) {
            setMovie(found);
            setLoadError(null);
            return;
          }
        } catch {
          // keep original error
        }
        if (!cancelled) setLoadError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    setDetailsExpanded(false);
  }, [id]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (detailsExpanded) {
        setDetailsExpanded(false);
      } else {
        navigate("/movies");
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [detailsExpanded, navigate]);

  const backdropSrc = useResolvedImageSrc(movie?.backdrop_path || movie?.poster_path, "w780");
  const fileName = movie?.file_path.split(/[/\\]/).pop() ?? "";
  const inProgress = movie?.watch_status === "in_progress";

  const playVersion = async (version: MovieVersion, startOver = false) => {
    if (!movie) return;
    if (version.removed || movie.removed) {
      setPlayError("This file is on a disconnected drive. Plug it back in to play.");
      return;
    }
    try {
      setPlayError(null);
      await playAndNavigate(navigate, version.file_id, version.file_path, movie.title, undefined, startOver);
    } catch (e) {
      setPlayError(String(e));
    }
  };

  const play = async (startOver = false) => {
    if (!movie) return;
    await playVersion({ file_id: movie.file_id, file_path: movie.file_path }, startOver);
  };

  if (!movie) {
    return (
      <div className="p-6">
        <button type="button" onClick={() => navigate("/movies")} className="flex items-center gap-2 text-muted hover:text-white mb-4 text-sm">
          <ArrowLeft size={16} /> Back
        </button>
        {loadError ? (
          <p className="text-sm text-red-300">{loadError}</p>
        ) : (
          <p className="text-muted">Loading…</p>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-3.5rem)] overflow-hidden">
      {backdropSrc && (
        <motion.img
          src={backdropSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 8, ease: "linear" }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/25" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/40" />

      <button
        type="button"
        onClick={() => navigate("/movies")}
        className="absolute left-6 top-6 z-20 flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm text-white/85 backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="relative z-10 flex h-full items-end px-8 pb-12 pt-28 md:px-12">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">{movie.title}</h1>
          {movie.removed && (
            <p className="mt-3 text-sm text-white/70">Removed — reconnect the drive to play this title.</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/80">
            {movie.release_date && <span>{movie.release_date.slice(0, 4)}</span>}
            {movie.runtime ? <span>· {movie.runtime} min</span> : null}
            {movie.genres && <span>· {movie.genres}</span>}
            <span>· ★ {movie.vote_average.toFixed(1)}</span>
          </div>
          <p className={cn("mt-5 max-w-xl text-sm leading-relaxed text-white/80 md:text-base", !detailsExpanded && "line-clamp-4")}>
            {movie.overview || "No description available."}
          </p>
          <button
            type="button"
            onClick={() => setDetailsExpanded((expanded) => !expanded)}
            className="mt-3 text-xs font-semibold uppercase tracking-wider text-accent transition-colors hover:text-accent-hover"
          >
            {detailsExpanded ? "Hide details" : "More details"}
          </button>
          {detailsExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-sm text-white/70"
            >
              {fileName && (
                <p>
                  File: <span className="text-white">{fileName}</span>
                </p>
              )}
              {inProgress && (
                <p className="mt-1">
                  Watched {Math.round(movie.progress_pct)}%
                </p>
              )}
            </motion.div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={Boolean(movie.removed)}
              onClick={() => void play(false)}
              className="inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-black/40 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {inProgress ? <RotateCcw size={18} /> : <Play size={18} fill="black" />}
              {inProgress ? "Resume" : "Play"}
              {inProgress && (
                <span className="text-xs font-medium text-black/60">{Math.round(movie.progress_pct)}%</span>
              )}
            </button>
            {inProgress && (
              <button
                type="button"
                onClick={() => void play(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/20"
              >
                <Undo2 size={16} />
                Start over
              </button>
            )}
          </div>
          {inProgress && (
            <p className="mt-3 text-xs text-white/55">Start over clears the saved position and plays from the beginning.</p>
          )}

          {movie.versions?.length > 1 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {movie.versions.map((version, index) => (
                <button
                  key={version.file_id}
                  type="button"
                  onClick={() => void playVersion(version, false)}
                  className={`rounded-full border px-3 py-1.5 text-xs backdrop-blur-md ${
                    version.removed
                      ? "border-white/10 bg-black/20 text-white/40"
                      : "border-white/20 bg-black/30 text-white/80 hover:bg-white/10"
                  }`}
                  disabled={Boolean(version.removed)}
                >
                  File {index + 1}
                </button>
              ))}
            </div>
          )}
          {playError && <p className="mt-4 text-sm text-red-300">{playError}</p>}
        </div>
      </div>
    </div>
  );
}
