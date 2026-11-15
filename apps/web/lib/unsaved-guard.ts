"use client";

import { unsavedChangesDialog } from "@/lib/dialogs";

/**
 * Alterações não salvas dentro de uma janela (ex.: edição de publicação agendada).
 * Quem edita registra `dirty` e `save`; quem fecha a janela chama `confirmLeave()`.
 */
interface Guard {
  dirty: () => boolean;
  save: () => Promise<boolean>;
}

const guards = new Map<string, Guard>();

export function registerUnsavedGuard(id: string, guard: Guard) {
  guards.set(id, guard);
  return () => {
    guards.delete(id);
  };
}

/** true = pode fechar (salvou, descartou ou não havia nada pendente). */
export async function confirmLeave(): Promise<boolean> {
  const pending = Array.from(guards.values()).filter((g) => g.dirty());
  if (!pending.length) return true;
  const choice = await unsavedChangesDialog();
  if (choice === "cancel") return false;
  if (choice === "discard") return true;
  for (const g of pending) if (!(await g.save())) return false;
  return true;
}
