import type { ThemeId } from "@/lib/theme/theme";

export function pageMotionFor(theme: ThemeId) {
  if (theme === "marquee") {
    return {
      initial: { opacity: 0, y: 18 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -10 },
      transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
    };
  }
  if (theme === "pulse") {
    return {
      initial: { opacity: 0, x: 36 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -24 },
      transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const },
    };
  }
  return {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 1 },
    transition: { duration: 0 },
  };
}

export function playerEnterFor(theme: ThemeId) {
  if (theme === "marquee") {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] as const },
    };
  }
  if (theme === "pulse") {
    return {
      initial: { opacity: 0, scale: 1.08 },
      animate: { opacity: 1, scale: 1 },
      transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
    };
  }
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.2 },
  };
}

export function backMotionFor(theme: ThemeId) {
  if (theme === "marquee") {
    return {
      initial: { opacity: 0, x: -12 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -12 },
      transition: { duration: 0.35 },
    };
  }
  if (theme === "pulse") {
    return {
      initial: { opacity: 0, scale: 0.6, rotate: -20 },
      animate: { opacity: 1, scale: 1, rotate: 0 },
      exit: { opacity: 0, scale: 0.6, rotate: 12 },
      transition: { type: "spring" as const, stiffness: 420, damping: 22 },
    };
  }
  return {
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  };
}

export function searchPanelFor(theme: ThemeId) {
  if (theme === "marquee") {
    return {
      initial: { opacity: 0, y: -28, scale: 1 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, y: -16 },
      transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
    };
  }
  if (theme === "pulse") {
    return {
      initial: { opacity: 0, scale: 0.82, y: 18 },
      animate: { opacity: 1, scale: 1, y: 0 },
      exit: { opacity: 0, scale: 0.9, y: 10 },
      transition: { type: "spring" as const, stiffness: 380, damping: 22 },
    };
  }
  return {
    initial: { opacity: 0, scale: 0.96, y: -8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96 },
    transition: { type: "spring" as const, damping: 25, stiffness: 300 },
  };
}

export function cardEnterFor(theme: ThemeId, index: number) {
  const delay = Math.min(index, 8) * 0.03;
  if (theme === "marquee") {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { delay, duration: 0.45 },
    };
  }
  if (theme === "pulse") {
    return {
      initial: { opacity: 0, y: 28, scale: 0.86, rotate: -3 },
      animate: { opacity: 1, y: 0, scale: 1, rotate: 0 },
      transition: { delay, type: "spring" as const, stiffness: 320, damping: 20 },
    };
  }
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.3 },
  };
}

export function buttonHoverFor(theme: ThemeId) {
  if (theme === "marquee") {
    return {
      whileHover: { y: -1 },
      whileTap: { y: 0 },
      transition: { duration: 0.18 },
    };
  }
  if (theme === "pulse") {
    return {
      whileHover: { scale: 1.08 },
      whileTap: { scale: 0.92 },
      transition: { type: "spring" as const, stiffness: 500, damping: 18 },
    };
  }
  return {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.97 },
    transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] as const },
  };
}
