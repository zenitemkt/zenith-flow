import { useCallback, useEffect, useRef, useState } from "react";

const PIN_STORAGE_KEY = "zenith:sidebar:pinned";
const COLLAPSE_DELAY_MS = 200;

function readStoredPin(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PIN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return reduced;
}

export interface SidebarState {
  /** true quando a sidebar deve mostrar a largura expandida (250-280px). */
  expanded: boolean;
  /** true quando o usuário fixou o menu aberto manualmente. */
  pinned: boolean;
  /** id do grupo com submenu aberto, ou null. */
  openSubmenuId: string | null;
  togglePinned: () => void;
  toggleSubmenu: (id: string) => void;
  closeSubmenu: () => void;
  handlers: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
  };
}

export function useSidebarState(): SidebarState {
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
  const collapseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPinned(readStoredPin());
  }, []);

  const togglePinned = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(PIN_STORAGE_KEY, String(next));
      } catch {
        // armazenamento indisponível (modo privado, etc.) — preferência não persiste, sem quebrar a UI.
      }
      return next;
    });
  }, []);

  const clearCollapseTimeout = useCallback(() => {
    if (collapseTimeout.current) {
      clearTimeout(collapseTimeout.current);
      collapseTimeout.current = null;
    }
  }, []);

  const onMouseEnter = useCallback(() => {
    clearCollapseTimeout();
    setHovering(true);
  }, [clearCollapseTimeout]);

  const onMouseLeave = useCallback(() => {
    clearCollapseTimeout();
    collapseTimeout.current = setTimeout(() => {
      setHovering(false);
    }, COLLAPSE_DELAY_MS);
  }, [clearCollapseTimeout]);

  const onFocus = useCallback(() => {
    clearCollapseTimeout();
    setFocused(true);
  }, [clearCollapseTimeout]);

  const onBlur = useCallback(() => {
    setFocused(false);
  }, []);

  useEffect(() => clearCollapseTimeout, [clearCollapseTimeout]);

  const toggleSubmenu = useCallback((id: string) => {
    setOpenSubmenuId((prev) => (prev === id ? null : id));
  }, []);

  const closeSubmenu = useCallback(() => setOpenSubmenuId(null), []);

  const expanded = pinned || hovering || focused;

  return {
    expanded,
    pinned,
    openSubmenuId,
    togglePinned,
    toggleSubmenu,
    closeSubmenu,
    handlers: { onMouseEnter, onMouseLeave, onFocus, onBlur },
  };
}
