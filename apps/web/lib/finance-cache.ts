/**
 * Tag de cache compartilhada por toda leitura pesada que depende de
 * `FinanceEntry` (hoje: DRE). Qualquer rota que crie/altere um lançamento
 * da agência precisa chamar `revalidateTag(financeEntriesCacheTag(agencyId))`
 * depois do write — de propósito uma tag só por agência (não por mês/tipo)
 * para não arriscar esquecer um caso e servir dado desatualizado; o custo é
 * invalidar o cache inteiro da agência a cada mudança, o que é aceitável
 * dado o volume de escrita nesta tabela.
 */
export function financeEntriesCacheTag(agencyId: string): string {
  return `finance-entries:${agencyId}`;
}
