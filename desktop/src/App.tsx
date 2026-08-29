import { useEffect, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { HomePage } from "@/pages/home/HomePage";
import { MoviesPage } from "@/pages/movies/MoviesPage";
import { MovieDetailPage } from "@/pages/movies/MovieDetailPage";
import { ShowsPage } from "@/pages/shows/ShowsPage";
import { ShowDetailPage } from "@/pages/shows/ShowDetailPage";
import { NotOrganizedPage } from "@/pages/library/NotOrganizedPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { PlayerPage } from "@/pages/player/PlayerPage";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { NewFilesDialog } from "@/components/library/NewFilesDialog";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { JobProgressProvider } from "@/lib/jobs/jobProgress";
import { api, type ScannedFile } from "@/lib/api/tauri";
import { NEW_FILES_EVENT, notifyLibraryUpdated } from "@/lib/events";
import { SetupWizard } from "@/components/setup/SetupWizard";
import { isSetupComplete } from "@/lib/setup";

function failedFiles(result: { failed: string[] }, files: ScannedFile[]) {
  if (result.failed.length === 0) return files;
  return files.filter((f) =>
    result.failed.some((err) => err.startsWith(`${f.filename}:`))
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState<boolean | null>(null);
  const [newFiles, setNewFiles] = useState<ScannedFile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [organizeResult, setOrganizeResult] = useState<{ organized: number; failed: string[] } | null>(null);
  const [organizeError, setOrganizeError] = useState<string | null>(null);

  const runStartupScan = useCallback(async () => {
    try {
      const result = await api.scanLibrary();
      if (result.new_files.length > 0) {
        setNewFiles(result.new_files);
        setDialogOpen(true);
      }
    } catch {
      // library path may not exist yet
    }
  }, []);

  useEffect(() => {
    if (isSetupComplete()) {
      setSetupOpen(false);
      void runStartupScan();
      return;
    }
    setSetupOpen(true);
  }, [runStartupScan]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshPresence = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => notifyLibraryUpdated(), 400);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshPresence();
    };
    window.addEventListener("focus", refreshPresence);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", refreshPresence);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    const onNewFiles = (e: Event) => {
      const files = (e as CustomEvent<ScannedFile[]>).detail;
      if (files.length > 0) {
        setNewFiles(files);
        setOrganizeResult(null);
        setOrganizeError(null);
        setDialogOpen(true);
      }
    };
    window.addEventListener(NEW_FILES_EVENT, onNewFiles);
    return () => window.removeEventListener(NEW_FILES_EVENT, onNewFiles);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleOrganize = async () => {
    const toOrganize = organizeResult ? failedFiles(organizeResult, newFiles) : newFiles;
    if (toOrganize.length === 0) return;

    setOrganizing(true);
    setOrganizeError(null);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    try {
      const result = await api.organizeNewFiles(toOrganize);
      setOrganizeResult(result);
      if (result.organized > 0) {
        notifyLibraryUpdated();
      }
      if (result.organized === toOrganize.length && result.failed.length === 0) {
        setTimeout(() => {
          setDialogOpen(false);
          setNewFiles([]);
          setOrganizeResult(null);
          setOrganizeError(null);
        }, 1500);
      }
    } catch (e) {
      setOrganizeError(String(e));
    } finally {
      setOrganizing(false);
    }
  };

  const handleDismiss = () => {
    setDialogOpen(false);
    setNewFiles([]);
    setOrganizeResult(null);
    setOrganizeError(null);
  };

  const handleSkip = async () => {
    if (newFiles.length > 0) {
      await api.skipNewFiles(newFiles);
    }
    setDialogOpen(false);
    setNewFiles([]);
    setOrganizeResult(null);
    setOrganizeError(null);
  };

  const handleSearchNavigate = (type: string, id: string) => {
    if (type === "movie") navigate(`/movies/${id}`);
    else if (type === "show") navigate(`/tv/${id}`);
  };

  return (
    <>
      <Routes>
        <Route element={<Layout onSearchOpen={() => setSearchOpen(true)} />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/movies" element={<MoviesPage />} />
          <Route path="/movies/:id" element={<MovieDetailPage />} />
          <Route path="/tv" element={<ShowsPage category="tv" title="TV Series" basePath="/tv" />} />
          <Route path="/tv/:id" element={<ShowDetailPage basePath="/tv" />} />
          <Route path="/tv/:id/season/:seasonNum" element={<ShowDetailPage basePath="/tv" />} />
          <Route path="/anime" element={<ShowsPage category="anime" title="Anime" basePath="/anime" />} />
          <Route path="/anime/:id" element={<ShowDetailPage basePath="/anime" />} />
          <Route path="/anime/:id/season/:seasonNum" element={<ShowDetailPage basePath="/anime" />} />
          <Route path="/not-organized" element={<NotOrganizedPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="/player" element={<PlayerPage />} />
      </Routes>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={handleSearchNavigate} />
      <NewFilesDialog
        open={dialogOpen}
        files={newFiles}
        onOrganize={handleOrganize}
        onSkip={handleSkip}
        onDismiss={handleDismiss}
        organizing={organizing}
        result={organizeResult}
        error={organizeError}
      />
      {setupOpen && (
        <SetupWizard
          onComplete={() => {
            setSetupOpen(false);
          }}
        />
      )}
      <LoadingScreen />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <JobProgressProvider>
        <AppRoutes />
      </JobProgressProvider>
    </BrowserRouter>
  );
}
