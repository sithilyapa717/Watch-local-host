import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/lib/api/tauri";
import type { ShowItem, EpisodeRow, SeasonCompleteness } from "@/lib/api/tauri";
import { playAndNavigate } from "@/lib/playback/play";
import {
  formatSeasonLabel,
  sortSeasons,
  visibleSeasons,
} from "@/lib/utils";
import { useResolvedImageSrc } from "@/lib/media/mediaSrc";
import { CompletenessSummary, EpisodeList } from "@/components/shows/EpisodeList";
import { SeasonList } from "@/components/shows/SeasonList";
import { ArrowLeft } from "lucide-react";
import { LIBRARY_UPDATED } from "@/lib/events";
import { cn } from "@/lib/utils";

interface ShowDetailPageProps {
  basePath: string;
}

export function ShowDetailPage({ basePath }: ShowDetailPageProps) {
  const { id, seasonNum } = useParams();
  const navigate = useNavigate();
  const [show, setShow] = useState<ShowItem | null>(null);
  const [completeness, setCompleteness] = useState<{ completeness: import("@/lib/api/tauri").ShowCompleteness; summary: string } | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [epFilter, setEpFilter] = useState<"all" | "owned" | "missing" | "unwatched" | "watched">("all");
  const [includeSpecials, setIncludeSpecials] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const showId = Number(id);
    const load = () => api.getShowDetail(showId).then(setShow);
    load();
    window.addEventListener(LIBRARY_UPDATED, load);
    return () => window.removeEventListener(LIBRARY_UPDATED, load);
  }, [id]);

  const [detailsExpanded, setDetailsExpanded] = useState(false);

  useEffect(() => {
    setDetailsExpanded(false);
  }, [id]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (detailsExpanded) {
        setDetailsExpanded(false);
      } else {
        navigate(basePath);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [basePath, detailsExpanded, navigate]);

  useEffect(() => {
    if (!id) return;
    const showId = Number(id);
    api.getShowCompleteness(showId, includeSpecials).then((c) => {
      setCompleteness(c);
      const seasonFromRoute = seasonNum ? Number(seasonNum) : null;
      const visible = sortSeasons(
        visibleSeasons(c.completeness.seasons, includeSpecials),
      );
      const firstOwned =
        visible.find((sn) => sn.owned_count > 0)?.season_number ??
        visible[0]?.season_number ??
        null;
      const routeSeason =
        seasonFromRoute !== null && visible.some((s) => s.season_number === seasonFromRoute)
          ? seasonFromRoute
          : null;
      setSelectedSeason(routeSeason ?? firstOwned);
    });
  }, [id, seasonNum, includeSpecials]);

  useEffect(() => {
    if (!id) return;
    const reload = () => {
      api.getShowCompleteness(Number(id), includeSpecials).then(setCompleteness);
    };
    window.addEventListener(LIBRARY_UPDATED, reload);
    return () => window.removeEventListener(LIBRARY_UPDATED, reload);
  }, [id, includeSpecials]);

  useEffect(() => {
    if (!completeness) return;
    const visible = sortSeasons(
      visibleSeasons(completeness.completeness.seasons, includeSpecials),
    );
    if (selectedSeason !== null && !visible.some((s) => s.season_number === selectedSeason)) {
      const next =
        visible.find((s) => s.owned_count > 0)?.season_number ?? visible[0]?.season_number ?? null;
      setSelectedSeason(next);
      if (next !== null) {
        navigate(`${basePath}/${id}/season/${next}`, { replace: true });
      }
    }
  }, [includeSpecials, completeness, selectedSeason, basePath, id, navigate]);

  const playEpisode = async (ep: EpisodeRow) => {
    if (!ep.file_id || !ep.file_path || ep.removed) {
      setPlayError(ep.removed ? "This episode is on a disconnected drive." : "No video file found for this episode.");
      return;
    }
    const title = `${show?.title} S${String(ep.season_number).padStart(2, "0")}E${String(ep.episode_number).padStart(2, "0")}`;
    try {
      setPlayError(null);
      await playAndNavigate(navigate, ep.file_id, ep.file_path, title, title);
    } catch (e) {
      setPlayError(String(e));
    }
  };

  const seasons = completeness
    ? sortSeasons(visibleSeasons(completeness.completeness.seasons, includeSpecials))
    : [];
  const currentSeason: SeasonCompleteness | undefined = seasons.find(
    (s) => s.season_number === selectedSeason,
  );

  const backdropSrc = useResolvedImageSrc(show?.backdrop_path, "w780");

  if (!show || !completeness) return <div className="text-muted">Loading…</div>;

  return (
    <div>
      <section className="relative -mx-6 -mt-6 mb-8 min-h-[430px] overflow-hidden border-b border-white/10 md:min-h-[500px]">
        {backdropSrc && (
          <motion.img
            src={backdropSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 6 }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/15 to-transparent" />

        <button
          type="button"
          onClick={() => navigate(basePath)}
          className="absolute left-6 top-6 z-20 flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-sm text-white/80 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="relative z-10 flex min-h-[430px] items-end px-6 pb-8 pt-32 md:min-h-[500px] md:px-10 md:pb-10">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{show.title}</h1>
            {show.removed && (
              <p className="mt-3 text-sm text-white/70">Removed — reconnect the drive to play this show.</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/75">
              {show.first_air_date && <span>{show.first_air_date.slice(0, 4)}</span>}
              {show.first_air_date && show.status && <span>·</span>}
              {show.status && <span>{show.status}</span>}
              {show.genres && <span>·</span>}
              {show.genres && <span>{show.genres}</span>}
            </div>
            <p className="mt-2 text-sm text-white/85">★ {show.vote_average.toFixed(1)}</p>
            <p className={cn("mt-4 max-w-2xl text-sm leading-relaxed text-white/75", !detailsExpanded && "line-clamp-3")}>
              {show.overview || "No description available."}
            </p>
            <button
              type="button"
              onClick={() => setDetailsExpanded((expanded) => !expanded)}
              className="mt-4 text-xs font-semibold uppercase tracking-wider text-accent transition-colors hover:text-accent-hover"
            >
              {detailsExpanded ? "Hide details" : "More details"}
            </button>
            {detailsExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 border-t border-white/15 pt-4 text-sm text-white/70"
              >
                <p>
                  Status:{" "}
                  <span className="text-white">{show.status || "Unknown"}</span>
                </p>
                <p className="mt-1">
                  Collection:{" "}
                  <span className="text-white">
                    {completeness.completeness.owned_count} of {completeness.completeness.total_count} episodes downloaded
                  </span>
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      <CompletenessSummary
        owned={completeness.completeness.owned_count}
        total={completeness.completeness.total_count}
        summary={completeness.summary}
      />
      {playError && (
        <p className="text-sm text-red-300 mt-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {playError}
        </p>
      )}

      <div className="flex items-center justify-between mt-8 mb-4">
        <h2 className="text-lg font-semibold">Seasons</h2>
        <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
          <input type="checkbox" checked={includeSpecials} onChange={(e) => setIncludeSpecials(e.target.checked)} className="rounded" />
          Include specials
        </label>
      </div>

      <SeasonList
        seasons={seasons}
        selectedSeason={selectedSeason}
        onSelect={(sn) => {
          setSelectedSeason(sn);
          navigate(`${basePath}/${id}/season/${sn}`, { replace: true });
        }}
      />

      {currentSeason && (
        <motion.div
          key={currentSeason.season_number}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">
              {formatSeasonLabel(currentSeason.season_number)} · {currentSeason.owned_count} of{" "}
              {currentSeason.total_count} episodes downloaded
            </h3>
            <div className="flex gap-1">
              {(["all", "owned", "missing", "unwatched", "watched"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setEpFilter(f)}
                  className={cn("px-2 py-1 rounded-lg text-xs capitalize", epFilter === f ? "bg-accent text-white" : "text-muted hover:bg-white/5")}
                >
                  {{
                    all: "All",
                    owned: "Have",
                    missing: "Missing",
                    unwatched: "To watch",
                    watched: "Done",
                  }[f]}
                </button>
              ))}
            </div>
          </div>
          <EpisodeList
            episodes={currentSeason.episodes}
            showTitle={show.title}
            filter={epFilter}
            onPlay={playEpisode}
          />
        </motion.div>
      )}
    </div>
  );
}
