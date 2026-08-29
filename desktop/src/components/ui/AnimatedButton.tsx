import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { scaleHover } from "@/lib/motion";

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
  const variants = {
    primary: "bg-accent hover:bg-accent-hover text-white",
    secondary: "bg-surface hover:bg-surface-hover border border-white/8 text-white",
    ghost: "hover:bg-white/5 text-muted hover:text-white",
    danger: "bg-red-600/80 hover:bg-red-600 text-white",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm rounded-lg",
    md: "px-4 py-2 text-sm rounded-lg",
    lg: "px-6 py-3 text-base rounded-xl",
  };

  return (
    <motion.button
      className={cn(
        "font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        variants[variant],
        sizes[size],
        className
      )}
      {...scaleHover}
      {...props}
    >
      {children}
    </motion.button>
  );
}
