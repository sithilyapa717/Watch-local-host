import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { api, type Settings } from "@/lib/api/tauri";
import { notifyNewFiles, notifyLibraryUpdated } from "@/lib/events";
import { clearPlayerSession } from "@/lib/playback/playerSession";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { FolderPlus, Trash2, Folder } from "lucide-react";
import { THEME_META, useTheme } from "@/lib/theme/theme";
import { cn } from "@/lib/utils";
import { clearSetupComplete } from "@/lib/setup";

export function SettingsPage() {
  const navigate = useNavigate();
  const { theme: themeId, setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>({
    library_root: "",
    library_roots: [""],
    tmdb_api_key: "",
  });
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [saved, setSaved] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings);
    api.getMobileServerInfo()
      .then((info) => setPin(info.token))
      .catch(() => setPin(""));
  }, []);

  const roots = settings.library_roots.length > 0 ? settings.library_roots : [settings.library_root];

  const updateRoots = (libraryRoots: string[]) => {
    setSettings({
      ...settings,
      library_root: libraryRoots[0] ?? "",
      library_roots: libraryRoots.length ? libraryRoots : [""],
    });
  };

  const pickFolder = async (index: number) => {
    const selected = await open({ directory: true, multiple: false, title: "Choose library folder" });
    if (typeof selected !== "string" || !selected) return;
    const next = [...roots];
    next[index] = selected;
    updateRoots(next);
  };

  const save = async () => {
    const libraryRoots = roots.filter((root) => root.trim());
    await api.saveSettings({
      ...settings,
      library_root: libraryRoots[0] ?? "",
      library_roots: libraryRoots,
    });
    if (pin.length === 6 && /^\d{6}$/.test(pin)) {
      await api.setMobilePin(pin);
      setPinError("");
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const savePin = async (value: string) => {
    setPin(value);
    setPinError("");
    if (value.length === 6) {
      if (!/^\d{6}$/.test(value)) {
        setPinError("Use 6 digits");
        return;
      }
      try {
        const next = await api.setMobilePin(value);
        setPin(next);
      } catch (e) {
        setPinError(String(e));
      }
    }
  };

  const newPin = async () => {
    const next = await api.regenerateMobilePin();
    setPin(next);
    setPinError("");
  };

  const scan = async () => {
    await save();
    setScanning(true);
    setStatus("");
    try {
      const result = await api.scanLibrary();
      if (result.new_files.length > 0) {
        notifyNewFiles(result.new_files);
      } else {
        setStatus("No new files");
      }
    } catch (e) {
      setStatus(String(e));
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg pb-12">
      <h1 className="mb-8 text-2xl font-bold theme-title">Settings</h1>

      <label className="mb-2 block text-sm text-muted">Appearance</label>
      <div className="mb-8 grid grid-cols-3 gap-2">
        {THEME_META.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTheme(item.id)}
            className={cn(
              "border px-3 py-3 text-left transition-colors",
              themeId === "pulse" ? "rounded-2xl" : "rounded-xl",
              themeId === item.id
                ? "border-accent bg-accent/15"
                : "border-white/8 bg-surface hover:bg-surface-hover",
            )}
          >
            <p className="text-sm font-semibold">{item.name}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted">{item.blurb}</p>
          </button>
        ))}
      </div>

      <label className="mb-2 block text-sm text-muted">Library folders</label>
      <div className="space-y-2">
        {roots.map((root, index) => (
          <div key={index} className="flex items-center gap-2">
            <button
              type="button"
              className="min-w-0 flex-1 truncate rounded-xl border border-white/8 bg-surface px-4 py-3 text-left text-sm hover:bg-surface-hover"
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
        className="mt-2 flex items-center gap-1.5 text-sm text-muted hover:text-white"
        onClick={() => updateRoots([...roots, ""])}
      >
        <FolderPlus size={15} /> Add folder
      </button>

      <label className="mb-2 mt-8 block text-sm text-muted">TMDB API key</label>
      <input
        type="password"
        className="w-full rounded-xl border border-white/8 bg-surface px-4 py-3 text-sm"
        value={settings.tmdb_api_key}
        onChange={(e) => setSettings({ ...settings, tmdb_api_key: e.target.value })}
        autoComplete="off"
      />

      <label className="mb-2 mt-8 block text-sm text-muted">Phone PIN</label>
      <div className="flex items-center gap-2">
        <input
          inputMode="numeric"
          maxLength={6}
          className="w-40 rounded-xl border border-white/8 bg-surface px-4 py-3 text-center font-mono text-lg tracking-[0.4em]"
          value={pin}
          onChange={(e) => void savePin(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        <AnimatedButton variant="secondary" size="sm" onClick={() => void newPin()}>
          New code
        </AnimatedButton>
      </div>
      {pinError && <p className="mt-1 text-xs text-red-300">{pinError}</p>}

      <div className="mt-8 flex flex-wrap gap-2">
        <AnimatedButton onClick={() => void save()}>{saved ? "Saved" : "Save"}</AnimatedButton>
        <AnimatedButton variant="secondary" onClick={() => void scan()} disabled={scanning}>
          {scanning ? "Scanning…" : "Scan"}
        </AnimatedButton>
      </div>
      {status && <p className="mt-3 text-sm text-muted">{status}</p>}

      <div className="mt-16 border-t border-white/8 pt-6">
        {!resetOpen ? (
          <button
            type="button"
            className="text-sm text-muted hover:text-red-300"
            onClick={() => setResetOpen(true)}
          >
            Reset library data
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">Type RESET. Files on disk are not deleted.</p>
            <input
              className="w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm"
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="RESET"
              autoFocus
            />
            <div className="flex gap-2">
              <AnimatedButton
                variant="danger"
                size="sm"
                disabled={resetConfirm.trim().toUpperCase() !== "RESET" || resetting}
                onClick={async () => {
                  setResetting(true);
                  try {
                    await api.resetApp();
                    clearPlayerSession();
                    clearSetupComplete();
                    notifyLibraryUpdated();
                    setSettings(await api.getSettings());
                    setResetOpen(false);
                    setResetConfirm("");
                    navigate("/");
                  } catch (e) {
                    setStatus(String(e));
                  } finally {
                    setResetting(false);
                  }
                }}
              >
                {resetting ? "Resetting…" : "Reset"}
              </AnimatedButton>
              <AnimatedButton
                variant="ghost"
                size="sm"
                disabled={resetting}
                onClick={() => {
                  setResetOpen(false);
                  setResetConfirm("");
                }}
              >
                Cancel
              </AnimatedButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
