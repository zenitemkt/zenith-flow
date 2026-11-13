/**
 * Nome padrão dos conjuntos da Zenite (sem dependência de servidor, usado na tela e no envio):
 * "[01] [AUTO] [FRIO] Americana | Imobiliárias"
 *  - [01]: posição do conjunto na campanha
 *  - [AUTO] Advantage+ de público ligado / [MANUAL] desligado
 *  - [FRIO] público aberto / [QUENTE] remarketing
 *  - cidade(s) e, se houver, o nicho
 */
export function adSetName(a: { advantage: boolean; temperature: "FRIO" | "QUENTE"; cities: string[]; niche: string }, index: number): string {
  const parts = [`[${String(index + 1).padStart(2, "0")}]`, a.advantage ? "[AUTO]" : "[MANUAL]", `[${a.temperature}]`, a.cities.join(" / ") || "Sem cidade"];
  return `${parts.join(" ")}${a.niche ? ` | ${a.niche}` : ""}`.slice(0, 200);
}
