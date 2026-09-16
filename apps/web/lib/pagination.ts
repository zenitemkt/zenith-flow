export const DEFAULT_PAGE_SIZE = 30;

/** `?page=` da URL → inteiro válido ≥ 1 (qualquer entrada inválida cai em 1). */
export function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function pageCountFor(total: number, pageSize: number = DEFAULT_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
