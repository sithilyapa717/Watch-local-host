import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { api } from "@/lib/api/tauri";
import { clearPlayerSession, getPlayerSession, setPlayerSession, type SubtitleTrack } from "@/lib/playback/playerSession";
import { ArrowLeft, Volume2, VolumeX, Maximize, Play, Pause, Captions, SkipForward, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme/theme";
import { backMotionFor, playerEnterFor } from "@/lib/theme/motion";

function isEmbeddableSubtitle(format: string) {
  return format === "srt" || format === "vtt";
}

function srtToVtt(contents: string) {
  return `WEBVTT\n\n${contents
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .replace(/^\d+\s*$/gm, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")}`;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function PlayerPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const localSubtitlesRef = useRef<SubtitleTrack[]>([]);
  const sessionFromStore = getPlayerSession();
  const [session, setSession] = useState(sessionFromStore);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeSubIndex, setActiveSubIndex] = useState(-1);
  const [localSubtitles, setLocalSubtitles] = useState<SubtitleTrack[]>([]);
  const [ended, setEnded] = useState(false);
  const [nextEpisode, setNextEpisode] = useState<{
    file_id: number;
    path: string;
    title: string;
    season: number;
    episode: number;
  } | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsHoveredRef = useRef(false);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const cursorHidden = !controlsVisible && playing && !ended && !error;

  const embeddableSubs =
    session?.subtitles.filter((sub) => isEmbeddableSubtitle(sub.format)).concat(localSubtitles) ??
    localSubtitles;

  const scheduleHideControls = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      if (!controlsHoveredRef.current && playing && !ended) {
        setControlsVisible(false);
      }
    }, 3000);
  }, [playing, ended]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHideControls();
  }, [scheduleHideControls]);

  const exit = useCallback(() => {
    api.stopPlayer();
    clearPlayerSession();
    navigate(-1);
  }, [navigate]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await el.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    if (!session) {
      navigate("/", { replace: true });
    }
  }, [session, navigate]);

  useEffect(() => {
    return () => {
      api.stopPlayer();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!playing || ended) {
      setControlsVisible(true);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      return;
    }
    scheduleHideControls();
  }, [playing, ended, scheduleHideControls]);

  useEffect(() => {
    const previous = document.body.style.cursor;
    document.body.style.cursor = cursorHidden ? "none" : "";
    return () => {
      document.body.style.cursor = previous;
    };
  }, [cursorHidden]);

  useEffect(() => {
    if (embeddableSubs.length > 0) {
      setActiveSubIndex(0);
    } else {
      setActiveSubIndex(-1);
    }
  }, [session?.fileId, embeddableSubs.length]);

  useEffect(() => {
    if (!session) return;
    setEnded(false);
    setNextEpisode(null);
    api
      .getNextEpisode(session.fileId)
      .then(setNextEpisode)
      .catch(() => setNextEpisode(null));
  }, [session?.fileId]);

  useEffect(() => {
    localSubtitlesRef.current.forEach((subtitle) => URL.revokeObjectURL(subtitle.path));
    localSubtitlesRef.current = [];
    setLocalSubtitles([]);
  }, [session?.fileId]);

  useEffect(() => {
    return () => {
      localSubtitlesRef.current.forEach((subtitle) => URL.revokeObjectURL(subtitle.path));
    };
  }, []);

  const addSubtitle = async (file: File) => {
    const format = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!isEmbeddableSubtitle(format)) {
      setError("Please choose an SRT or VTT subtitle file for the embedded player.");
      return;
    }

    const contents = format === "srt" ? srtToVtt(await file.text()) : await file.text();
    const path = URL.createObjectURL(
      new Blob([contents], { type: "text/vtt;charset=utf-8" }),
    );
    setLocalSubtitles((current) => {
      const next = [
        ...current,
        {
          label: file.name.replace(/\.[^.]+$/, ""),
          path,
          format: "vtt",
        },
      ];
      localSubtitlesRef.current = next;
      return next;
    });
    setActiveSubIndex(embeddableSubs.length);
    setError(null);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || session?.mode !== "embedded") return;
    video.volume = volume / 100;
    video.muted = muted;
  }, [volume, muted, session?.mode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || session?.mode !== "embedded" || session.startSec <= 0) return;
    const onLoaded = () => {
      video.currentTime = session.startSec;
    };
    video.addEventListener("loadedmetadata", onLoaded);
    return () => video.removeEventListener("loadedmetadata", onLoaded);
  }, [session]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || session?.mode !== "embedded") return;
    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = i === activeSubIndex ? "showing" : "disabled";
    }
  }, [activeSubIndex, session?.mode, embeddableSubs]);

  const saveProgress = useCallback(async () => {
    if (!session || !videoRef.current) return;
    const v = videoRef.current;
    if (v.duration > 0) {
      await api.saveWatchProgress(session.fileId, v.currentTime, v.duration);
    }
  }, [session]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (session?.mode === "embedded" && playing) {
        saveProgress();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [session, playing, saveProgress]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      revealControls();
      const video = videoRef.current;
      if (e.code === "Space" && session?.mode === "embedded" && video) {
        e.preventDefault();
        if (video.ended || ended) {
          video.currentTime = 0;
          void video.play();
          setEnded(false);
          setPlaying(true);
        } else if (video.paused) {
          void video.play();
          setPlaying(true);
        } else {
          video.pause();
          setPlaying(false);
        }
      }
      if (
        (e.code === "ArrowLeft" || e.code === "ArrowRight") &&
        session?.mode === "embedded" &&
        video
      ) {
        e.preventDefault();
        const offset = e.code === "ArrowLeft" ? -5 : 5;
        const nextTime = Math.max(
          0,
          Math.min(video.duration || Number.POSITIVE_INFINITY, video.currentTime + offset),
        );
        video.currentTime = nextTime;
        setCurrentTime(nextTime);
      }
      if (e.code === "ArrowUp" || e.code === "ArrowDown") {
        e.preventDefault();
        const offset = e.code === "ArrowUp" ? 5 : -5;
        setVolume((currentVolume) => Math.max(0, Math.min(100, currentVolume + offset)));
      }
      if (e.code === "KeyM") setMuted((m) => !m);
      if (e.code === "KeyF" && session?.mode === "embedded") {
        e.preventDefault();
        void toggleFullscreen();
      }
      if (e.code === "Escape") {
        if (document.fullscreenElement) {
          e.preventDefault();
          void document.exitFullscreen();
          return;
        }
        void saveProgress();
        exit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [session, exit, saveProgress, toggleFullscreen, revealControls, ended]);

  if (!session) {
    return null;
  }

  const isEmbedded = session.mode === "embedded";
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const hasSubtitles = session.subtitles.length > 0 || localSubtitles.length > 0;

  const rewatch = async () => {
    const video = videoRef.current;
    setEnded(false);
    setCurrentTime(0);
    if (video) {
      video.currentTime = 0;
      try {
        await video.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
    if (session) {
      void api.saveWatchProgress(session.fileId, 0, duration || video?.duration || 0);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (ended || video.ended) {
      void rewatch();
      return;
    }
    if (video.paused) {
      void video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const seekToClientX = (clientX: number) => {
    const video = videoRef.current;
    const bar = seekBarRef.current;
    if (!video || !bar || !Number.isFinite(duration) || duration <= 0) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const nextTime = pct * duration;
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const onSeekPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isEmbedded || !Number.isFinite(duration) || duration <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekToClientX(e.clientX);
  };

  const onSeekPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    seekToClientX(e.clientX);
  };

  const onSeekPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    void saveProgress();
  };

  const playNext = async () => {
    if (!nextEpisode) return;
    const title = `${nextEpisode.title} S${String(nextEpisode.season).padStart(2, "0")}E${String(nextEpisode.episode).padStart(2, "0")}`;
    try {
      const status = await api.playMedia(nextEpisode.file_id, nextEpisode.path, title);
      const nextSession = {
        fileId: nextEpisode.file_id,
        path: status.path,
        title: status.title,
        startSec: 0,
        mode: status.mode as "mpv" | "embedded",
        subtitles: status.subtitles ?? [],
      };
      setPlayerSession(nextSession);
      setSession(nextSession);
      setEnded(false);
      setCurrentTime(0);
      setDuration(0);
      setPlaying(true);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <motion.div
      ref={containerRef}
      className={cn(
        "absolute inset-0 overflow-hidden bg-black",
        cursorHidden && "cursor-none [&_*]:cursor-none",
      )}
      onMouseMove={revealControls}
      {...playerEnterFor(theme)}
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        onDoubleClick={isEmbedded ? () => void toggleFullscreen() : undefined}
      >
        {isEmbedded ? (
          <video
            key={session.fileId}
            ref={videoRef}
            src={convertFileSrc(session.path)}
            className="absolute inset-0 h-full w-full object-contain bg-black"
            autoPlay
            onPlay={() => {
              setPlaying(true);
              setEnded(false);
            }}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => {
              if (draggingRef.current) return;
              const time = e.currentTarget.currentTime;
              setCurrentTime(time);
              if (ended && e.currentTarget.duration - time > 0.5) {
                setEnded(false);
              }
            }}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onEnded={() => {
              setPlaying(false);
              setEnded(true);
              void saveProgress();
            }}
            onError={() =>
              setError("Could not play this file. Try installing mpv: winget install mpv")
            }
          >
            {embeddableSubs.map((sub, index) => (
              <track
                key={sub.path}
                kind="subtitles"
                label={sub.label}
                src={convertFileSrc(sub.path)}
                srcLang={sub.label.slice(0, 2).toLowerCase()}
                default={index === 0}
              />
            ))}
          </video>
        ) : (
          <div className="text-center p-8">
            <p className="text-lg font-semibold mb-2">{session.title}</p>
            <p className="text-muted text-sm">Playing in mpv — use the mpv window for controls</p>
            {hasSubtitles && (
              <p className="text-muted text-xs mt-2">
                {session.subtitles.length} subtitle track
                {session.subtitles.length === 1 ? "" : "s"} loaded in mpv
              </p>
            )}
          </div>
        )}

        {ended && !error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70">
            <div className="text-center space-y-4 px-6">
              <p className="text-lg font-semibold">Episode finished</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <AnimatedButton variant="secondary" onClick={() => void rewatch()}>
                  <RotateCcw size={18} className="mr-2" /> Rewatch
                </AnimatedButton>
                {nextEpisode && (
                  <AnimatedButton onClick={() => void playNext()}>
                    <SkipForward size={18} className="mr-2" />
                    Next episode · S{String(nextEpisode.season).padStart(2, "0")}E
                    {String(nextEpisode.episode).padStart(2, "0")}
                  </AnimatedButton>
                )}
              </div>
              {!nextEpisode && (
                <p className="text-sm text-white/70">No next episode in the library</p>
              )}
              <div>
                <AnimatedButton variant="ghost" onClick={exit}>
                  <ArrowLeft size={16} className="mr-1" /> Back
                </AnimatedButton>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-8">
            <div className="text-center max-w-md">
              <p className="text-red-300 mb-4">{error}</p>
              <AnimatedButton onClick={exit}>Go back</AnimatedButton>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {controlsVisible && (
          <motion.button
            type="button"
            className={cn(
              "absolute z-30 flex items-center gap-2 text-sm text-white/90",
              theme === "default" &&
                "left-4 top-4 rounded-full bg-black/45 px-4 py-2 backdrop-blur-md hover:bg-black/65",
              theme === "marquee" &&
                "left-6 top-6 border border-accent/60 px-4 py-2 uppercase tracking-[0.18em] text-[11px] text-accent hover:bg-accent hover:text-background",
              theme === "pulse" &&
                "left-5 top-5 h-12 w-12 justify-center rounded-full border-2 border-accent bg-black/40 hover:bg-accent hover:text-background",
            )}
            {...backMotionFor(theme)}
            onClick={() => {
              void saveProgress();
              exit();
            }}
          >
            <ArrowLeft size={theme === "pulse" ? 20 : 16} />
            {theme !== "pulse" && "Back"}
          </motion.button>
        )}
        {controlsVisible && (
          <motion.div
            className={cn(
              "absolute inset-x-0 bottom-0 z-30",
              theme === "default" && "bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-10",
              theme === "marquee" && "border-t border-accent/30 bg-black/85 px-6 pb-5 pt-4",
              theme === "pulse" && "bg-gradient-to-t from-[#031018] via-[#031018]/90 to-transparent px-5 pb-6 pt-12",
            )}
            initial={{ opacity: 0, y: theme === "marquee" ? 24 : 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: theme === "pulse" ? 20 : 0 }}
            transition={{ duration: theme === "pulse" ? 0.28 : 0.2 }}
            onMouseEnter={() => {
              controlsHoveredRef.current = true;
            }}
            onMouseLeave={() => {
              controlsHoveredRef.current = false;
              scheduleHideControls();
            }}
          >
            <div className={cn("mb-2", theme === "marquee" ? "text-left" : "text-right")}>
              <p className={cn("truncate text-white/80", theme === "marquee" ? "theme-title text-base" : "text-sm")}>
                {session.title}
              </p>
            </div>

            {isEmbedded && (
              <>
                <input
                  ref={subtitleInputRef}
                  type="file"
                  accept=".srt,.vtt"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void addSubtitle(file);
                  }}
                />
                <div className="mb-3 flex items-center gap-3">
                  <span className="min-w-11 text-right text-xs tabular-nums text-white/75">
                    {formatTime(currentTime)}
                  </span>
                  <div
                    ref={seekBarRef}
                    className={cn(
                      "group relative flex flex-1 cursor-grab items-center active:cursor-grabbing select-none touch-none",
                      theme === "pulse" ? "h-8" : "h-5",
                    )}
                    onPointerDown={onSeekPointerDown}
                    onPointerMove={onSeekPointerMove}
                    onPointerUp={onSeekPointerUp}
                    onPointerCancel={onSeekPointerUp}
                    role="slider"
                    aria-label="Seek"
                    aria-valuemin={0}
                    aria-valuemax={Math.floor(duration) || 0}
                    aria-valuenow={Math.floor(currentTime)}
                  >
                    <div
                      className={cn(
                        "relative w-full bg-white/20",
                        theme === "default" && "h-1.5 rounded-full transition-[height] group-hover:h-2",
                        theme === "marquee" && "h-px bg-accent/30",
                        theme === "pulse" && "h-2.5 rounded-full",
                      )}
                    >
                      <div
                        className={cn("h-full bg-accent", theme === "default" && "rounded-full", theme === "pulse" && "rounded-full")}
                        style={{ width: `${progressPct}%` }}
                      />
                      <div
                        className={cn(
                          "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-md",
                          theme === "default" &&
                            "h-3.5 w-3.5 rounded-full bg-white opacity-0 group-hover:opacity-100 group-active:opacity-100",
                          theme === "marquee" && "h-4 w-2 rounded-none bg-accent",
                          theme === "pulse" && "h-6 w-6 rounded-full border-2 border-white bg-accent",
                        )}
                        style={{ left: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                  <span className="min-w-11 text-xs tabular-nums text-white/75">
                    {formatTime(duration)}
                  </span>
                </div>

                <div
                  className={cn(
                    "flex flex-wrap items-center gap-5",
                    theme === "default" && "justify-center",
                    theme !== "default" && "justify-between",
                  )}
                >
                  <div className="flex items-center gap-4">
                    <motion.button
                      whileHover={{ scale: theme === "pulse" ? 1.16 : 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={togglePlay}
                      className={cn(
                        "text-white",
                        theme === "pulse" && "rounded-full bg-accent p-3 text-background",
                        theme === "marquee" && "border border-accent/50 px-3 py-1 text-accent",
                      )}
                    >
                      {playing ? (
                        <Pause size={theme === "pulse" ? 34 : 28} />
                      ) : (
                        <Play size={theme === "pulse" ? 34 : 28} fill={theme === "pulse" ? "currentColor" : "white"} />
                      )}
                    </motion.button>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setMuted(!muted)}>
                        {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className={cn("accent-accent", theme === "pulse" ? "w-36" : "w-24")}
                      />
                    </div>
                  </div>
                  {theme === "default" && (
                    <button
                      type="button"
                      onClick={() => subtitleInputRef.current?.click()}
                      className="flex items-center gap-2 text-sm text-white/80 hover:text-white"
                      title="Choose an SRT or VTT subtitle file"
                    >
                      <Captions size={18} /> Add subtitles
                    </button>
                  )}
                  {theme === "default" && embeddableSubs.length > 0 && (
                    <select
                      value={activeSubIndex}
                      onChange={(e) => setActiveSubIndex(Number(e.target.value))}
                      className="text-sm bg-white/10 text-white rounded-lg px-2 py-1 border border-white/20"
                      aria-label="Subtitle track"
                    >
                      <option value={-1}>Subtitles off</option>
                      {embeddableSubs.map((sub, index) => (
                        <option key={sub.path} value={index}>
                          {sub.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {theme === "default" && hasSubtitles && embeddableSubs.length === 0 && (
                    <span className="text-xs text-white/60">
                      {session.subtitles.length} subtitle
                      {session.subtitles.length === 1 ? "" : "s"} (mpv only)
                    </span>
                  )}
                  {theme === "default" ? (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      type="button"
                      className="text-white/80 hover:text-white"
                      onClick={() => void toggleFullscreen()}
                    >
                      <Maximize size={20} />
                    </motion.button>
                  ) : (
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => subtitleInputRef.current?.click()}
                        className={cn(
                          "flex items-center gap-2 text-sm text-white/80 hover:text-white",
                          theme === "marquee" && "uppercase tracking-wider text-[11px]",
                        )}
                        title="Choose an SRT or VTT subtitle file"
                      >
                        <Captions size={18} /> Add subtitles
                      </button>
                      {embeddableSubs.length > 0 && (
                        <select
                          value={activeSubIndex}
                          onChange={(e) => setActiveSubIndex(Number(e.target.value))}
                          className="text-sm bg-white/10 text-white rounded-lg px-2 py-1 border border-white/20"
                          aria-label="Subtitle track"
                        >
                          <option value={-1}>Subtitles off</option>
                          {embeddableSubs.map((sub, index) => (
                            <option key={sub.path} value={index}>
                              {sub.label}
                            </option>
                          ))}
                        </select>
                      )}
                      {hasSubtitles && embeddableSubs.length === 0 && (
                        <span className="text-xs text-white/60">
                          {session.subtitles.length} subtitle
                          {session.subtitles.length === 1 ? "" : "s"} (mpv only)
                        </span>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        type="button"
                        className="text-white/80 hover:text-white"
                        onClick={() => void toggleFullscreen()}
                      >
                        <Maximize size={theme === "pulse" ? 24 : 20} />
                      </motion.button>
                    </div>
                  )}
                </div>
              </>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
