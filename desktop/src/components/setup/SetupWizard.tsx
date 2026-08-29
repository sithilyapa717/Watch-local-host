import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, type Settings } from "@/lib/api/tauri";
import { notifyNewFiles } from "@/lib/events";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { markSetupComplete } from "@/lib/setup";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme/theme";
import { ExternalLink, Folder, FolderPlus, KeyRound, Library, Trash2 } from "lucide-react";

const TMDB_API_URL = "https://www.themoviedb.org/settings/api";

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const { theme } = useTheme();
  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState<Settings>({
    library_root: "",
    library_roots: [""],
    tmdb_api_key: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then((current) => {
      const roots =
        current.library_roots.length > 0 ? current.library_roots : [current.library_root || ""];
      setSettings({
        ...current,
        library_roots: roots.length ? roots : [""],
        library_root: roots[0] ?? "",
      });
    });
  }, []);

  const roots = settings.library_roots.length > 0 ? settings.library_roots : [settings.library_root];
  const hasKey = settings.tmdb_api_key.trim().length > 8;
  const hasFolder = roots.some((root) => root.trim());

  const updateRoots = (libraryRoots: string[]) => {
    setSettings({
      ...settings,
      library_root: libraryRoots[0] ?? "",
      library_roots: libraryRoots.length ? libraryRoots : [""],
    });
  };

  const pickFolder = async (index: number) => {
    const selected = await open({ directory: true, multiple: false, title: "Choose a library folder" });
    if (typeof selected !== "string" || !selected) return;
    const next = [...roots];
    next[index] = selected;
    updateRoots(next);
  };

  const finish = async () => {
    const libraryRoots = roots.filter((root) => root.trim());
    if (!hasKey) {
      setError("Paste your TMDB API key to continue.");
      setStep(1);
      return;
    }
    if (libraryRoots.length === 0) {
      setError("Choose at least one folder that contains your media.");
      setStep(2);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.saveSettings({
        ...settings,
        library_root: libraryRoots[0],
        library_roots: libraryRoots,
      });
      markSetupComplete();
      try {
        const result = await api.scanLibrary();
        if (result.new_files.length > 0) {
          notifyNewFiles(result.new_files);
        }
      } catch {
        // Scan can wait; settings are saved.
      }
      onComplete();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const steps = ["Welcome", "TMDB key", "Library", "Finish"];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background p-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(255_255_255/0.06),transparent_55%)]" />
      <motion.div
        className={cn(
          "relative z-10 w-full max-w-xl border bg-surface shadow-2xl",
          theme === "pulse" ? "rounded-[1.75rem]" : theme === "marquee" ? "rounded-sm" : "rounded-2xl",
          "border-white/10",
        )}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="border-b border-white/8 px-6 py-5">
          <p className="text-xs uppercase tracking-[0.2em] text-accent">Watch setup</p>
          <h1 className="theme-title mt-1 text-2xl font-bold">Get ready to watch</h1>
          <div className="mt-4 flex gap-2">
            {steps.map((label, index) => (
              <div key={label} className="flex-1">
                <div
                  className={cn(
                    "h-1 rounded-full",
                    index <= step ? "bg-accent" : "bg-white/10",
                  )}
                />
                <p className={cn("mt-1.5 text-[10px] uppercase tracking-wider", index <= step ? "text-white/80" : "text-muted")}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="min-h-[22rem] px-6 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.22 }}
            >
              {step === 0 && (
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-white/80">
                    Watch keeps your movies, series, and anime on this computer. The next few
                    screens take about a minute: a free TMDB key for posters and titles, then the
                    folders where your files live.
                  </p>
                  <p className="text-sm leading-relaxed text-muted">
                    You only do this once. Settings stay available later if anything changes.
                  </p>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-accent/15 p-2 text-accent">
                      <KeyRound size={18} />
                    </div>
                    <div>
                      <h2 className="font-semibold">The Movie Database API key</h2>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        Watch uses TMDB for artwork and metadata. Create a free account, request an
                        API key, then paste it below. The key never leaves this PC.
                      </p>
                    </div>
                  </div>
                  <ol className="list-decimal space-y-2 pl-5 text-sm text-white/80">
                    <li>Open TMDB and sign in, or register for a free account.</li>
                    <li>Go to Settings → API and request a developer key.</li>
                    <li>Copy the API Key (v3 auth) and paste it here.</li>
                  </ol>
                  <AnimatedButton
                    type="button"
                    variant="secondary"
                    onClick={() => void openUrl(TMDB_API_URL)}
                  >
                    <ExternalLink size={16} className="mr-2" />
                    Open TMDB API settings
                  </AnimatedButton>
                  <label className="block text-sm text-muted">API key</label>
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-xl border border-white/8 bg-background px-4 py-3 text-sm"
                    placeholder="Paste your TMDB v3 API key"
                    value={settings.tmdb_api_key}
                    onChange={(e) => setSettings({ ...settings, tmdb_api_key: e.target.value.trim() })}
                  />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-accent/15 p-2 text-accent">
                      <Library size={18} />
                    </div>
                    <div>
                      <h2 className="font-semibold">Library folders</h2>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        Point Watch at the folders that hold your files. A strict Movies / TV split
                        is optional. Mixed libraries are fine.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-background/60 px-4 py-3 font-mono text-xs leading-relaxed text-white/75">
                    <p className="text-[10px] uppercase tracking-wider text-muted">Example</p>
                    <p className="mt-2">Shows/</p>
                    <p className="pl-4">Inception.mkv</p>
                    <p className="pl-8 text-muted">→ Movie</p>
                    <p className="pl-4">Wednesday/</p>
                    <p className="pl-8">S01E01.mkv</p>
                    <p className="pl-8 text-muted">→ Series</p>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">
                    Movies can sit as files in a folder. Series should live in their own subfolder
                    with episode files. You can add more than one library location.
                  </p>
                  <div className="space-y-2">
                    {roots.map((root, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate rounded-xl border border-white/8 bg-background px-4 py-3 text-left text-sm hover:bg-surface-hover"
                          onClick={() => void pickFolder(index)}
                        >
                          {root.trim() || "Choose folder…"}
                        </button>
                        <button
                          type="button"
                          className="rounded-xl p-2.5 text-muted hover:bg-white/5 hover:text-white"
                          title="Browse"
                          onClick={() => void pickFolder(index)}
                        >
                          <Folder size={17} />
                        </button>
                        {roots.length > 1 && (
                          <button
                            type="button"
                            className="rounded-xl p-2.5 text-muted hover:bg-white/5 hover:text-red-300"
                            onClick={() => updateRoots(roots.filter((_, i) => i !== index))}
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-sm text-muted hover:text-white"
                    onClick={() => updateRoots([...roots, ""])}
                  >
                    <FolderPlus size={15} /> Add another folder
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="font-semibold">You are ready</h2>
                  <p className="text-sm leading-relaxed text-white/80">
                    Watch will save your key and folders, then scan for files. If new titles are
                    found, you can organize them and pull metadata from TMDB.
                  </p>
                  <ul className="space-y-2 text-sm text-muted">
                    <li>API key: {hasKey ? "Added" : "Missing"}</li>
                    <li>
                      Folders: {hasFolder ? roots.filter((r) => r.trim()).length : "None selected"}
                    </li>
                  </ul>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        </div>

        <div className="flex items-center justify-between border-t border-white/8 px-6 py-4">
          <AnimatedButton
            type="button"
            variant="ghost"
            disabled={step === 0 || saving}
            onClick={() => {
              setError(null);
              setStep((s) => Math.max(0, s - 1));
            }}
          >
            Back
          </AnimatedButton>
          {step < 3 ? (
            <AnimatedButton
              type="button"
              onClick={() => {
                if (step === 1 && !hasKey) {
                  setError("Paste your TMDB API key to continue.");
                  return;
                }
                if (step === 2 && !hasFolder) {
                  setError("Choose at least one folder that contains your media.");
                  return;
                }
                setError(null);
                setStep((s) => s + 1);
              }}
            >
              Continue
            </AnimatedButton>
          ) : (
            <AnimatedButton type="button" disabled={saving} onClick={() => void finish()}>
              {saving ? "Saving…" : "Finish setup"}
            </AnimatedButton>
          )}
        </div>
      </motion.div>
    </div>
  );
}
