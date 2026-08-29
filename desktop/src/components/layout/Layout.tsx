import { Outlet, NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Film, Tv, Sparkles, FolderOpen, Settings, Search } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const movieDetail = /^\/movies\/\d+/.test(location.pathname);

  return (
    <div className="flex flex-col h-full">
      <header className="glass-nav shrink-0 flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tight text-accent">Watch</span>
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive ? "text-white" : "text-muted hover:text-white hover:bg-white/5"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={16} />
                    {label}
                    {isActive && (
                      <motion.div
                        layoutId="nav-underline"
                        className="absolute inset-0 bg-white/8 rounded-lg -z-10"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-muted hover:text-white hover:bg-white/5 border border-white/8"
            onClick={onSearchOpen}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <Search size={14} />
            Search
            <kbd className="text-xs bg-white/10 px-1.5 py-0.5 rounded">Ctrl+K</kbd>
          </motion.button>
          <NavLink to="/settings" className="p-2 rounded-lg text-muted hover:text-white hover:bg-white/5">
            <Settings size={18} />
          </NavLink>
        </div>
      </header>
      <main className={cn("flex-1 overflow-y-auto", movieDetail ? "p-0" : "p-6")}>
        <Outlet />
      </main>
    </div>
  );
}
