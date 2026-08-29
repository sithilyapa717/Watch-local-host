import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const THEME_IDS = ["default", "marquee", "pulse"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const THEME_META: { id: ThemeId; name: string; blurb: string }[] = [
  { id: "default", name: "Default", blurb: "Glass bars and violet glow" },
  { id: "marquee", name: "Marquee", blurb: "Cinema gold and sharp frames" },
  { id: "pulse", name: "Pulse", blurb: "Neon cyan and bold motion" },
];

const STORAGE_KEY = "watch-ui-theme";

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value === "default" || value === "marquee" || value === "pulse";
}

export function readStoredTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isThemeId(raw) ? raw : "default";
  } catch {
    return "default";
  }
}

export function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
}

const ThemeContext = createContext<{
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
}>({
  theme: "default",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const id = readStoredTheme();
    applyTheme(id);
    return id;
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((id: ThemeId) => setThemeState(id), []);
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
