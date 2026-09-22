import type { VendorStatus, VendorOrderStatus } from "@zenite-mkt/db";

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  HOMOLOGADO: "Homologado",
  BLOQUEADO: "Bloqueado",
};

export const VENDOR_ORDER_STATUS_LABELS: Record<VendorOrderStatus, string> = {
  SOLICITADA: "Solicitada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export const VENDOR_ORDER_TRANSITIONS: Record<VendorOrderStatus, VendorOrderStatus[]> = {
  SOLICITADA: ["EM_ANDAMENTO", "CANCELADA"],
  EM_ANDAMENTO: ["CONCLUIDA", "CANCELADA"],
  CONCLUIDA: [],
  CANCELADA: [],
};

export function canTransitionVendorOrder(from: VendorOrderStatus, to: VendorOrderStatus): boolean {
  return VENDOR_ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}
