import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api/tauri";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme/theme";
import { searchPanelFor } from "@/lib/theme/motion";

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (type: string, id: string) => void;
}

export function SearchOverlay({ open, onClose, onNavigate }: SearchOverlayProps) {
  const { theme } = useTheme();
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
        <motion.div
          className={cn(
            "fixed inset-0 z-50 flex p-4",
            theme === "marquee" ? "items-start justify-center pt-10" : "items-start justify-center pt-[15vh]",
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className={cn(
              "absolute inset-0",
              theme === "marquee" ? "bg-black/80" : "bg-black/60 backdrop-blur-sm",
              theme === "pulse" && "bg-cyan-950/50 backdrop-blur-md",
            )}
            onClick={onClose}
          />
          <motion.div
            className={cn(
              "relative z-10 w-full overflow-hidden border shadow-2xl",
              theme === "default" && "max-w-xl rounded-2xl bg-surface border-white/10",
              theme === "marquee" && "max-w-2xl rounded-none bg-[#16110c] border-accent/50",
              theme === "pulse" && "max-w-lg rounded-[2rem] bg-surface border-accent/40 shadow-[0_0_40px_rgb(34_211_238_/_0.2)]",
            )}
            {...searchPanelFor(theme)}
          >
            <div className={cn("flex items-center gap-3 border-b border-white/8", theme === "pulse" ? "px-5" : "px-4")}>
              <Search size={18} className={cn("shrink-0", theme === "pulse" ? "text-accent" : "text-muted")} />
              <input
                autoFocus
                className={cn(
                  "flex-1 bg-transparent outline-none text-white placeholder:text-muted",
                  theme === "marquee" ? "py-5 theme-title text-lg" : "py-4",
                )}
                placeholder="Search movies, shows, episodes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button onClick={onClose} className="text-muted hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex gap-2 p-2 border-b border-white/8">
              {(["all", "movie", "show"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1 text-xs capitalize",
                    theme === "pulse" && "rounded-full px-4 py-1.5",
                    theme === "default" && "rounded-lg",
                    filter === f
                      ? theme === "pulse"
                        ? "bg-accent text-background"
                        : "bg-accent text-white"
                      : "text-muted hover:bg-white/5",
                  )}
                >
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
                  className={cn(
                    "px-3 py-2 cursor-pointer text-sm",
                    theme === "pulse" ? "rounded-2xl" : "rounded-lg",
                    i === selected ? "bg-accent/20" : "hover:bg-white/5",
                  )}
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
