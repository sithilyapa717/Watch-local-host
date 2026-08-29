import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/lib/api/tauri";
import type { MovieItem, MovieVersion } from "@/lib/api/tauri";
import { playAndNavigate } from "@/lib/playback/play";
import { useResolvedImageSrc } from "@/lib/media/mediaSrc";
import { Play, RotateCcw, ArrowLeft, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme/theme";
import { backMotionFor } from "@/lib/theme/motion";

export function MovieDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
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
  const posterSrc = useResolvedImageSrc(movie?.poster_path, "w342");
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

  const playButtons = (
    <>
      <button
        type="button"
        disabled={Boolean(movie.removed)}
        onClick={() => void play(false)}
        className={cn(
          "inline-flex items-center gap-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40",
          theme === "default" &&
            "rounded-full bg-white px-6 py-3 text-sm text-black shadow-lg shadow-black/40 transition hover:bg-white/90",
          theme === "marquee" &&
            "w-full justify-center rounded-none bg-accent px-6 py-3.5 text-xs uppercase tracking-[0.2em] text-background hover:bg-accent-hover",
          theme === "pulse" &&
            "rounded-full bg-accent px-10 py-4 text-lg text-background shadow-[0_0_28px_rgb(34_211_238_/_0.4)]",
        )}
      >
        {inProgress ? (
          <RotateCcw size={theme === "pulse" ? 22 : 18} />
        ) : (
          <Play size={theme === "pulse" ? 22 : 18} fill={theme === "default" ? "black" : "currentColor"} />
        )}
        {inProgress ? "Resume" : "Play"}
        {inProgress && theme === "default" && (
          <span className="text-xs font-medium text-black/60">{Math.round(movie.progress_pct)}%</span>
        )}
      </button>
      {inProgress && (
        <button
          type="button"
          onClick={() => void play(true)}
          className={cn(
            "inline-flex items-center gap-2 text-sm font-medium text-white",
            theme === "default" &&
              "rounded-full border border-white/25 bg-white/10 px-5 py-3 backdrop-blur-md transition hover:bg-white/20",
            theme === "marquee" &&
              "w-full justify-center border border-accent/40 px-5 py-3 uppercase tracking-[0.14em] text-xs hover:bg-accent/10",
            theme === "pulse" && "rounded-full border-2 border-accent px-6 py-3 hover:bg-accent/15",
          )}
        >
          <Undo2 size={16} />
          Start over
        </button>
      )}
    </>
  );

  const detailsBlock = (
    <>
      <button
        type="button"
        onClick={() => setDetailsExpanded((expanded) => !expanded)}
        className="mt-3 text-xs font-semibold uppercase tracking-wider text-accent transition-colors hover:text-accent-hover"
      >
        {detailsExpanded ? "Hide details" : "More details"}
      </button>
      {detailsExpanded && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-sm text-white/70">
          {fileName && (
            <p>
              File: <span className="text-white">{fileName}</span>
            </p>
          )}
          {inProgress && <p className="mt-1">Watched {Math.round(movie.progress_pct)}%</p>}
        </motion.div>
      )}
    </>
  );

  const versions = movie.versions?.length > 1 && (
    <div className={cn("flex flex-wrap gap-2", theme === "marquee" ? "mt-4 flex-col" : "mt-6")}>
      {movie.versions.map((version, index) => (
        <button
          key={version.file_id}
          type="button"
          onClick={() => void playVersion(version, false)}
          className={cn(
            "border px-3 py-1.5 text-xs backdrop-blur-md",
            theme === "marquee" ? "rounded-none w-full" : "rounded-full",
            version.removed
              ? "border-white/10 bg-black/20 text-white/40"
              : "border-white/20 bg-black/30 text-white/80 hover:bg-white/10",
          )}
          disabled={Boolean(version.removed)}
        >
          File {index + 1}
        </button>
      ))}
    </div>
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        theme === "marquee" ? "h-[calc(100vh-4rem)]" : theme === "pulse" ? "h-[calc(100vh-4.25rem)]" : "h-[calc(100vh-3.5rem)]",
      )}
    >
      {backdropSrc && (
        <motion.img
          src={backdropSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          initial={{ scale: theme === "pulse" ? 1.16 : 1.08 }}
          animate={{ scale: 1, x: theme === "marquee" ? [0, 12, 0] : 0 }}
          transition={
            theme === "marquee"
              ? { duration: 24, repeat: Infinity, ease: "linear" }
              : { duration: theme === "pulse" ? 4 : 8, ease: "linear" }
          }
        />
      )}
      <div
        className={cn(
          "absolute inset-0",
          theme === "default" && "bg-gradient-to-r from-black via-black/70 to-black/25",
          theme === "marquee" && "bg-black/75",
          theme === "pulse" && "bg-gradient-to-t from-[#031018] via-[#031018]/70 to-cyan-950/30",
        )}
      />
      {theme === "default" && <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/40" />}

      <motion.button
        type="button"
        onClick={() => navigate("/movies")}
        className={cn(
          "absolute z-20 flex items-center gap-2 text-white/85 transition-colors",
          theme === "default" &&
            "left-6 top-6 rounded-full bg-black/40 px-4 py-2 text-sm backdrop-blur-md hover:bg-black/60",
          theme === "marquee" &&
            "left-8 top-8 border border-accent/50 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-accent hover:bg-accent hover:text-background",
          theme === "pulse" &&
            "left-5 top-5 h-12 w-12 justify-center rounded-full border-2 border-accent bg-black/30 hover:bg-accent hover:text-background",
        )}
        {...backMotionFor(theme)}
      >
        <ArrowLeft size={theme === "pulse" ? 20 : 16} />
        {theme !== "pulse" && "Back"}
      </motion.button>

      {theme === "marquee" ? (
        <div className="relative z-10 flex h-full items-center gap-10 px-10 pt-16">
          {posterSrc && (
            <img src={posterSrc} alt="" className="h-[70vh] max-h-[540px] w-auto border border-accent/40 object-cover shadow-2xl" />
          )}
          <div className="max-w-xl">
            <h1 className="theme-title text-4xl font-bold md:text-6xl">{movie.title}</h1>
            {movie.removed && (
              <p className="mt-3 text-sm text-white/70">Removed — reconnect the drive to play this title.</p>
            )}
            <div className="mt-4 text-sm uppercase tracking-[0.16em] text-accent">
              {[movie.release_date?.slice(0, 4), movie.runtime ? `${movie.runtime} min` : null, `★ ${movie.vote_average.toFixed(1)}`]
                .filter(Boolean)
                .join("  ·  ")}
            </div>
            {movie.genres && <p className="mt-2 text-sm text-white/70">{movie.genres}</p>}
            <p className={cn("mt-5 text-sm leading-relaxed text-white/80", !detailsExpanded && "line-clamp-5")}>
              {movie.overview || "No description available."}
            </p>
            {detailsBlock}
            <div className="mt-8 flex max-w-xs flex-col gap-2">{playButtons}</div>
            {inProgress && (
              <p className="mt-3 text-xs text-white/55">Start over clears the saved position and plays from the beginning.</p>
            )}
            {versions}
            {playError && <p className="mt-4 text-sm text-red-300">{playError}</p>}
          </div>
        </div>
      ) : theme === "pulse" ? (
        <div className="relative z-10 flex h-full flex-col justify-between px-8 pb-10 pt-24">
          <div className="max-w-3xl">
            <h1 className="theme-title text-5xl font-bold tracking-tight md:text-7xl">{movie.title}</h1>
            {movie.removed && (
              <p className="mt-3 text-sm text-white/70">Removed — reconnect the drive to play this title.</p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {movie.release_date && (
                <span className="rounded-full bg-accent/20 px-3 py-1 text-sm text-accent">{movie.release_date.slice(0, 4)}</span>
              )}
              {movie.runtime ? (
                <span className="rounded-full bg-white/10 px-3 py-1 text-sm">{movie.runtime} min</span>
              ) : null}
              <span className="rounded-full bg-white/10 px-3 py-1 text-sm">★ {movie.vote_average.toFixed(1)}</span>
            </div>
            <p className={cn("mt-5 max-w-2xl text-base leading-relaxed text-white/80", !detailsExpanded && "line-clamp-3")}>
              {movie.overview || "No description available."}
            </p>
            {detailsBlock}
            {versions}
            {playError && <p className="mt-4 text-sm text-red-300">{playError}</p>}
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-3">{playButtons}</div>
            {inProgress && (
              <p className="text-xs text-white/55">Start over clears the saved position and plays from the beginning.</p>
            )}
          </div>
        </div>
      ) : (
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
            {detailsBlock}
            <div className="mt-8 flex flex-wrap items-center gap-3">{playButtons}</div>
            {inProgress && (
              <p className="mt-3 text-xs text-white/55">Start over clears the saved position and plays from the beginning.</p>
            )}
            {versions}
            {playError && <p className="mt-4 text-sm text-red-300">{playError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
