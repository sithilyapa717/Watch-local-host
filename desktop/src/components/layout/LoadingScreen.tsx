import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useJobProgress } from "@/lib/jobs/jobProgress";
import { formatBytes } from "@/lib/utils";

export function LoadingScreen() {
  const job = useJobProgress();
  const filePct = job.total > 0 ? Math.min(100, Math.round((job.current / job.total) * 100)) : null;
  const bytePct =
    job.totalBytes > 0 ? Math.min(100, Math.round((job.downloadedBytes / job.totalBytes) * 100)) : null;
  const pct = filePct ?? bytePct ?? 0;
  const amount =
    job.downloadedBytes > 0
      ? formatBytes(job.downloadedBytes)
      : job.total > 0
        ? `${pct}%`
        : null;

  return (
    <AnimatePresence>
      {job.active && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <motion.div
            className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-8 text-center shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
          >
            <Loader2 className="mx-auto mb-4 animate-spin text-accent" size={36} />
            <h2 className="text-lg font-semibold">{job.title || "Working…"}</h2>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-accent transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            {amount && <p className="mt-3 text-sm font-medium tabular-nums">{amount}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
