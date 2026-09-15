export type ChartValueFormat = "number" | "cents";

/** Formata um valor de gráfico dentro do client component — nunca receba uma função de formatação via prop vinda de um Server Component (quebra em runtime). */
export function formatChartValue(value: number, format: ChartValueFormat): string {
  if (format === "cents") {
    return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return value.toLocaleString("pt-BR");
}
