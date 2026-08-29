import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/tauri";
import type { MediaFile } from "@/lib/api/tauri";
import { playAndNavigate } from "@/lib/playback/play";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { formatBytes } from "@/lib/utils";
import { LIBRARY_UPDATED, notifyLibraryUpdated } from "@/lib/events";
import { Play, FolderSearch, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export function NotOrganizedPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [extFilter, setExtFilter] = useState("all");
  const [sort, setSort] = useState<"name" | "size" | "date">("date");
  const [organizingId, setOrganizingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api.getNotOrganized().then(setFiles), []);
  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener(LIBRARY_UPDATED, handler);
    return () => window.removeEventListener(LIBRARY_UPDATED, handler);
  }, [load]);

  let filtered = [...files];
  if (extFilter !== "all") filtered = filtered.filter((f) => f.extension === extFilter);
  if (sort === "name") filtered.sort((a, b) => a.filename.localeCompare(b.filename));
  if (sort === "size") filtered.sort((a, b) => b.size_bytes - a.size_bytes);
  if (sort === "date") filtered.sort((a, b) => b.added_at.localeCompare(a.added_at));

  const extensions = [...new Set(files.map((f) => f.extension))];

  const play = async (f: MediaFile) => {
    try {
      setError(null);
      await playAndNavigate(navigate, f.id, f.path, f.filename);
    } catch (e) {
      setError(String(e));
    }
  };

  const organize = async (f: MediaFile) => {
    setOrganizingId(f.id);
    setMessage(null);
    setError(null);
    try {
      const result = await api.organizeFilesByIds([f.id]);
      if (result.organized > 0) {
        setMessage(`Organized "${f.filename}"`);
        notifyLibraryUpdated();
        load();
      } else if (result.failed.length > 0) {
        setError(result.failed[0]);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setOrganizingId(null);
    }
  };

  const organizeAll = async () => {
    if (filtered.length === 0) return;
    setOrganizingId(-1);
    setMessage(null);
    setError(null);
    try {
      const result = await api.organizeFilesByIds(filtered.map((f) => f.id));
      if (result.organized > 0) {
        setMessage(`Organized ${result.organized} file(s)`);
        notifyLibraryUpdated();
        load();
      }
      if (result.failed.length > 0) {
        setError(`${result.failed.length} failed — ${result.failed[0]}`);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setOrganizingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Not Organized</h1>
        {filtered.length > 0 && (
          <AnimatedButton
            onClick={organizeAll}
            disabled={organizingId !== null}
          >
            {organizingId === -1 ? "Organizing…" : `Organize all (${filtered.length})`}
          </AnimatedButton>
        )}
      </div>

      {message && (
        <p className="text-sm text-green-400 mb-3">{message}</p>
      )}
      {error && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-3 mb-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">
          <div className="flex gap-2 items-start flex-1">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <AnimatedButton size="sm" onClick={organizeAll} disabled={organizingId !== null}>
            Try again
          </AnimatedButton>
        </div>
      )}

      <div className="flex gap-4 mb-4 text-sm">
        <select className="bg-surface border border-white/8 rounded-lg px-3 py-1.5" value={extFilter} onChange={(e) => setExtFilter(e.target.value)}>
          <option value="all">All extensions</option>
          {extensions.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="bg-surface border border-white/8 rounded-lg px-3 py-1.5" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="date">Date added</option>
          <option value="name">Filename</option>
          <option value="size">File size</option>
        </select>
        <span className="text-muted self-center">{filtered.length} of {files.length} files</span>
      </div>
      {filtered.length === 0 ? (
        <p className="text-muted text-center py-12">No unorganized files</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-white/8"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{f.filename}</p>
                <p className="text-xs text-muted truncate">{f.path}</p>
              </div>
              <span className="text-xs text-muted">{f.extension} · {formatBytes(f.size_bytes)}</span>
              <AnimatedButton size="sm" onClick={() => play(f)}><Play size={14} className="mr-1" /> Play</AnimatedButton>
              <AnimatedButton
                size="sm"
                variant="secondary"
                disabled={organizingId !== null}
                onClick={() => organize(f)}
              >
                <FolderSearch size={14} className="mr-1" />
                {organizingId === f.id ? "Organizing…" : "Organize"}
              </AnimatedButton>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
