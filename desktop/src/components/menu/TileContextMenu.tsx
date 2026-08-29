import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface TileContextMenuProps {
  children: ReactNode;
  items: ContextMenuItem[];
  className?: string;
}

export function TileContextMenu({ children, items, className }: TileContextMenuProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!pos || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const x = Math.min(pos.x, window.innerWidth - rect.width - 8);
    const y = Math.min(pos.y, window.innerHeight - rect.height - 8);
    if (x !== pos.x || y !== pos.y) setPos({ x: Math.max(8, x), y: Math.max(8, y) });
  }, [pos]);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [pos]);

  return (
    <div
      className={className}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!items.length) return;
        setPos({ x: event.clientX, y: event.clientY });
      }}
    >
      {children}
      {pos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[90] min-w-48 overflow-hidden rounded-xl border border-white/10 bg-surface py-1 shadow-2xl"
            style={{ left: pos.x, top: pos.y }}
            onClick={(event) => event.stopPropagation()}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                className={`block w-full px-3 py-2 text-left text-sm disabled:opacity-40 ${
                  item.danger ? "text-red-300 hover:bg-red-500/10" : "text-white/90 hover:bg-white/8"
                }`}
                onClick={() => {
                  setPos(null);
                  item.onClick();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
