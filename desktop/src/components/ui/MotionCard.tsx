import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export function MotionCard({ className, children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={cn("rounded-xl overflow-hidden bg-surface border border-white/8", className)}
      layout
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function ShimmerSkeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg bg-white/5", className)} />;
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
