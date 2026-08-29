import { useEffect, useRef } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Film, Tv, Sparkles, FolderOpen, Settings, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme/theme";
import { pageMotionFor } from "@/lib/theme/motion";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/movies", icon: Film, label: "Movies" },
  { to: "/tv", icon: Tv, label: "TV Series" },
  { to: "/anime", icon: Sparkles, label: "Anime" },
  { to: "/not-organized", icon: FolderOpen, label: "Not Organized" },
];

interface LayoutProps {
  onSearchOpen: () => void;
}

export function Layout({ onSearchOpen }: LayoutProps) {
  const location = useLocation();
  const { theme } = useTheme();
  const mainRef = useRef<HTMLElement>(null);
  const movieDetail = /^\/movies\/\d+/.test(location.pathname);
  const pageMotion = pageMotionFor(theme);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex flex-col h-full">
      <header
        className={cn(
          "glass-nav shrink-0 flex items-center justify-between",
          theme === "default" && "px-6 h-14",
          theme === "marquee" && "px-8 h-16",
          theme === "pulse" && "px-5 h-[4.25rem]",
        )}
      >
        <div className={cn("flex items-center", theme === "marquee" ? "gap-10" : "gap-8")}>
          <span
            className={cn(
              "tracking-tight text-accent",
              theme === "default" && "text-xl font-bold",
              theme === "marquee" && "theme-title text-2xl font-bold italic",
              theme === "pulse" && "text-2xl font-bold uppercase tracking-[0.28em]",
            )}
          >
            Watch
          </span>
          <nav className={cn("flex items-center", theme === "pulse" ? "gap-2" : "gap-1")}>
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center transition-colors",
                    theme === "default" &&
                      "gap-2 px-3 py-2 rounded-lg text-sm",
                    theme === "marquee" &&
                      "gap-1.5 px-2 py-2 text-[11px] uppercase tracking-[0.18em] font-semibold",
                    theme === "pulse" &&
                      "gap-2 px-4 py-2.5 rounded-full text-sm font-semibold",
                    theme === "default" &&
                      (isActive ? "text-white" : "text-muted hover:text-white hover:bg-white/5"),
                    theme === "marquee" &&
                      (isActive ? "text-accent" : "text-muted hover:text-white"),
                    theme === "pulse" &&
                      (isActive
                        ? "text-background bg-accent"
                        : "text-muted hover:text-white hover:bg-accent/15"),
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {theme !== "marquee" && <Icon size={theme === "pulse" ? 18 : 16} />}
                    {label}
                    {theme === "default" && isActive && (
                      <motion.div
                        layoutId="nav-underline"
                        className="absolute inset-0 bg-white/8 rounded-lg -z-10"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    {theme === "marquee" && isActive && (
                      <motion.div
                        layoutId="nav-underline"
                        className="absolute -bottom-1 left-0 right-0 h-px bg-accent"
                        transition={{ duration: 0.25 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className={cn("flex items-center", theme === "pulse" ? "gap-3" : "gap-2")}>
          <motion.button
            className={cn(
              "flex items-center gap-2 text-sm",
              theme === "default" &&
                "px-3 py-1.5 rounded-lg text-muted hover:text-white hover:bg-white/5 border border-white/8",
              theme === "marquee" &&
                "px-4 py-2 border border-accent/40 text-accent uppercase tracking-[0.16em] text-[11px] font-semibold hover:bg-accent hover:text-background",
              theme === "pulse" &&
                "px-5 py-2.5 rounded-full bg-accent text-background font-semibold shadow-[0_0_18px_rgb(34_211_238_/_0.35)]",
            )}
            onClick={onSearchOpen}
            whileHover={theme === "pulse" ? { scale: 1.06 } : { scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <Search size={theme === "pulse" ? 16 : 14} />
            Search
            {theme !== "pulse" && (
              <kbd
                className={cn(
                  "text-xs px-1.5 py-0.5",
                  theme === "default" && "bg-white/10 rounded",
                  theme === "marquee" && "border border-accent/30",
                )}
              >
                Ctrl+K
              </kbd>
            )}
          </motion.button>
          <NavLink
            to="/settings"
            className={cn(
              "text-muted hover:text-white",
              theme === "default" && "p-2 rounded-lg hover:bg-white/5",
              theme === "marquee" && "p-2 border border-transparent hover:border-accent/40",
              theme === "pulse" && "p-2.5 rounded-full hover:bg-accent/20",
            )}
          >
            <Settings size={theme === "pulse" ? 20 : 18} />
          </NavLink>
        </div>
      </header>
      <main
        ref={mainRef}
        className={cn("flex-1 overflow-y-auto", movieDetail ? "p-0" : "p-6")}
      >
        {theme === "default" ? (
          <Outlet />
        ) : (
          <motion.div
            key={location.pathname}
            inherit={false}
            className="min-h-full"
            initial={pageMotion.initial}
            animate={pageMotion.animate}
            transition={pageMotion.transition}
          >
            <Outlet />
          </motion.div>
        )}
      </main>
    </div>
  );
}
