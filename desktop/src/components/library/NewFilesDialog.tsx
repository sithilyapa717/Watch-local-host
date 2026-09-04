import { motion, AnimatePresence } from "framer-motion";
import { modalOverlay, modalContent } from "@/lib/motion";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import type { ScannedFile } from "@/lib/api/tauri";
import { FolderPlus, AlertCircle } from "lucide-react";

interface NewFilesDialogProps {
  open: boolean;
  files: ScannedFile[];
  onOrganize: () => void;
  onSkip: () => void;
  onDismiss?: () => void;
  organizing?: boolean;
  result?: { organized: number; failed: string[] } | null;
  error?: string | null;
}

function splitFailure(entry: string): { name: string; reason: string } {
  const idx = entry.indexOf(": ");
  if (idx === -1) return { name: entry, reason: "" };
  return { name: entry.slice(0, idx), reason: entry.slice(idx + 2) };
}

export function NewFilesDialog({
  open,
  files,
  onOrganize,
  onSkip,
  onDismiss,
  organizing,
  result,
  error,
}: NewFilesDialogProps) {
  const showResult = result && (result.organized > 0 || result.failed.length > 0);
  const canRetry = Boolean(error || (result && result.failed.length > 0));
  const allSucceeded = result && result.organized === files.length && result.failed.length === 0;
  const keyHint = Boolean(
    error?.toLowerCase().includes("tmdb") ||
      result?.failed.some((f) => f.toLowerCase().includes("tmdb api key") || f.toLowerCase().includes("read access token")),
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          {...modalOverlay}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            className="relative z-10 w-full max-w-md rounded-2xl bg-surface border border-white/10 p-6 shadow-2xl"
            {...modalContent}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-accent/20">
                <FolderPlus className="text-accent" size={24} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{files.length} new files found</h2>
                <p className="text-sm text-muted">Download metadata and organize?</p>
              </div>
            </div>

            {error && (
              <div className="flex gap-2 items-start p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="break-words">{error}</span>
              </div>
            )}

            {keyHint && (
              <p className="mb-4 text-xs text-amber-200/90">
                Fix this in Settings → TMDB API key. Use the <strong>API Key (v3)</strong> from{" "}
                themoviedb.org/settings/api — not the Read Access Token.
              </p>
            )}

            {showResult && (
              <div className="mb-4 text-sm space-y-2">
                {result!.organized > 0 && (
                  <p className="text-green-400">Organized {result!.organized} file(s).</p>
                )}
                {result!.failed.length > 0 && (
                  <div className="text-red-300">
                    <p>{result!.failed.length} failed:</p>
                    <ul className="max-h-36 overflow-y-auto mt-1 space-y-2 text-xs">
                      {result!.failed.slice(0, 8).map((f) => {
                        const { name, reason } = splitFailure(f);
                        return (
                          <li key={f} className="rounded-lg bg-black/20 px-2 py-1.5">
                            <p className="truncate text-muted" title={name}>
                              {name}
                            </p>
                            {reason && (
                              <p className="mt-0.5 break-words text-red-300/90" title={reason}>
                                {reason}
                              </p>
                            )}
                          </li>
                        );
                      })}
                      {result!.failed.length > 8 && (
                        <li className="text-muted">…and {result!.failed.length - 8} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!showResult && !error && (
              <ul className="max-h-40 overflow-y-auto space-y-1 mb-6 text-sm text-muted">
                {files.slice(0, 8).map((f) => (
                  <li key={f.path} className="truncate">• {f.filename}</li>
                ))}
                {files.length > 8 && <li>…and {files.length - 8} more</li>}
              </ul>
            )}

            <div className="flex gap-3 justify-end flex-wrap">
              {allSucceeded ? (
                <AnimatedButton onClick={onDismiss ?? onSkip}>Done</AnimatedButton>
              ) : canRetry ? (
                <>
                  <AnimatedButton variant="secondary" onClick={onSkip} disabled={organizing}>
                    Skip — Not Organized
                  </AnimatedButton>
                  {onDismiss && (
                    <AnimatedButton variant="secondary" onClick={onDismiss} disabled={organizing}>
                      Close
                    </AnimatedButton>
                  )}
                  <AnimatedButton onClick={onOrganize} disabled={organizing}>
                    {organizing ? "Organizing…" : "Try again"}
                  </AnimatedButton>
                </>
              ) : (
                <>
                  <AnimatedButton variant="secondary" onClick={onSkip} disabled={organizing}>
                    Skip — Not Organized
                  </AnimatedButton>
                  <AnimatedButton onClick={onOrganize} disabled={organizing}>
                    {organizing ? "Organizing…" : "Organize"}
                  </AnimatedButton>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
