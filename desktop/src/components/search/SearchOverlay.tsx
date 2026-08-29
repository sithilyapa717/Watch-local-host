import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api/tauri";
import { cn } from "@/lib/utils";

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (type: string, id: string) => void;
}

export function SearchOverlay({ open, onClose, onNavigate }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Record<string, string>[]>([]);
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState<"all" | "movie" | "show">("all");

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    const r = await api.searchLocal(q);
    setResults(r as Record<string, string>[]);
    setSelected(0);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && filtered[selected]) {
        onNavigate(filtered[selected].entity_type, filtered[selected].entity_id);
        onClose();
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, selected, onClose, onNavigate]);

  const filtered = results.filter((r) => filter === "all" || r.entity_type === filter);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative z-10 w-full max-w-xl rounded-2xl bg-surface border border-white/10 shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="flex items-center gap-3 px-4 border-b border-white/8">
              <Search size={18} className="text-muted shrink-0" />
              <input
                autoFocus
                className="flex-1 bg-transparent py-4 outline-none text-white placeholder:text-muted"
                placeholder="Search movies, shows, episodes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button onClick={onClose} className="text-muted hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex gap-2 p-2 border-b border-white/8">
              {(["all", "movie", "show"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1 rounded-lg text-xs capitalize", filter === f ? "bg-accent text-white" : "text-muted hover:bg-white/5")}>
                  {f}
                </button>
              ))}
            </div>
            <ul className="max-h-72 overflow-y-auto p-2">
              {filtered.map((r, i) => (
                <motion.li
                  key={`${r.entity_type}-${r.entity_id}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={cn("px-3 py-2 rounded-lg cursor-pointer text-sm", i === selected ? "bg-accent/20" : "hover:bg-white/5")}
                  onClick={() => { onNavigate(r.entity_type, r.entity_id); onClose(); }}
                >
                  <span className="text-xs text-muted uppercase mr-2">{r.entity_type}</span>
                  {r.title}
                </motion.li>
              ))}
              {query && filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-muted text-sm">No results</li>
              )}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
