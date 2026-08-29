export function RemovedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`absolute left-2 top-2 rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm ${className}`}
    >
      Removed
    </span>
  );
}
