import type { ClientStatus } from "@zenith/db";

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  PROSPECT: "Prospect",
  ONBOARDING: "Onboarding",
  ATIVO: "Ativo",
  PAUSADO: "Pausado",
  EM_ENCERRAMENTO: "Em encerramento",
  ENCERRADO: "Encerrado",
  REATIVADO: "Reativado",
};

/** Seção 10 do manual: prospect -> onboarding -> ativo -> pausado -> em encerramento -> encerrado -> reativado. */
export const CLIENT_STATUS_TRANSITIONS: Record<ClientStatus, ClientStatus[]> = {
  PROSPECT: ["ONBOARDING"],
  ONBOARDING: ["ATIVO"],
  ATIVO: ["PAUSADO", "EM_ENCERRAMENTO"],
  PAUSADO: ["ATIVO", "EM_ENCERRAMENTO"],
  EM_ENCERRAMENTO: ["ENCERRADO"],
  ENCERRADO: ["REATIVADO"],
  REATIVADO: ["ATIVO"],
};

export function canTransition(from: ClientStatus, to: ClientStatus): boolean {
  return CLIENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
