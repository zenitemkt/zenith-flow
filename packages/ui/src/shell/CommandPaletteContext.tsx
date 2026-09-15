"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

interface CommandPaletteContextValue {
  open: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

/**
 * Permite que qualquer tela (mesmo Server Component, via um botão cliente
 * pequeno) abra o command palette global do `AppShell` sem precisar
 * levantar estado manualmente pela árvore.
 */
export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  return ctx ?? { open: () => {} };
}

export function CommandPaletteProvider({
  onOpen,
  children,
}: {
  onOpen: () => void;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ open: onOpen }), [onOpen]);
  return <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>;
}
