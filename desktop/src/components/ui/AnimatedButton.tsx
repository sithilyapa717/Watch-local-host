import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme/theme";
import { buttonHoverFor } from "@/lib/theme/motion";

interface AnimatedButtonProps extends HTMLMotionProps<"button"> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function AnimatedButton({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: AnimatedButtonProps) {
  const { theme } = useTheme();
  const variants = {
    primary:
      theme === "pulse"
        ? "bg-accent hover:bg-accent-hover text-background"
        : theme === "marquee"
          ? "bg-accent hover:bg-accent-hover text-background"
          : "bg-accent hover:bg-accent-hover text-white",
    secondary: "bg-surface hover:bg-surface-hover border border-white/8 text-white",
    ghost: "hover:bg-white/5 text-muted hover:text-white",
    danger: "bg-red-600/80 hover:bg-red-600 text-white",
  };
  const sizes = {
    sm:
      theme === "pulse"
        ? "px-4 py-2 text-sm rounded-full"
        : theme === "marquee"
          ? "px-4 py-2 text-xs uppercase tracking-[0.14em] rounded-lg"
          : "px-3 py-1.5 text-sm rounded-lg",
    md:
      theme === "pulse"
        ? "px-6 py-2.5 text-sm rounded-full font-semibold"
        : theme === "marquee"
          ? "px-5 py-2.5 text-xs uppercase tracking-[0.16em] rounded-lg"
          : "px-4 py-2 text-sm rounded-lg",
    lg:
      theme === "pulse"
        ? "px-8 py-3.5 text-base rounded-full font-semibold"
        : theme === "marquee"
          ? "px-8 py-3.5 text-sm uppercase tracking-[0.18em] rounded-lg"
          : "px-6 py-3 text-base rounded-xl",
  };

  return (
    <motion.button
      className={cn(
        "font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        variants[variant],
        sizes[size],
        className
      )}
      {...buttonHoverFor(theme)}
      {...props}
    >
      {children}
    </motion.button>
  );
}
