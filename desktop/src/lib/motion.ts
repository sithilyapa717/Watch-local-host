export const duration = {
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
} as const;

export const ease = {
  out: [0.16, 1, 0.3, 1] as const,
  inOut: [0.4, 0, 0.2, 1] as const,
};

export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.03 } },
};

export const scaleHover = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: { duration: duration.fast, ease: ease.out },
};

export const cardHover = {
  whileHover: { scale: 1.04 },
  whileTap: { scale: 0.98 },
  transition: { duration: duration.fast, ease: ease.out },
};

export const pageTransition = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: { duration: duration.slow, ease: ease.out },
};

export const modalOverlay = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalContent = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 8 },
  transition: { type: "spring" as const, damping: 25, stiffness: 300 },
};

export function useReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
