/**
 * Agrupa os criativos de um conjunto em anúncios: a versão Feed e a versão Stories da mesma
 * imagem viram UM anúncio (cada uma no seu posicionamento). Reconhece pelo fim do nome
 * ("-F"/"-S", "-FD"/"-ST", "feed"/"stories") e, se o nome não disser, pela proporção
 * (vertical 9:16 = Stories). Sem dependência de servidor: usado na tela e no envio.
 */
export interface PairableCreative {
  id: string;
  name: string;
  kind: "IMAGE" | "VIDEO";
  width?: number | null;
  height?: number | null;
}

export interface AdGroup<T extends PairableCreative> {
  key: string;
  feed: T | null;
  stories: T | null;
  /** Vídeo (ou imagem sem par) entra sozinho, no lugar do feed. */
}

const SUFFIX = /[\s._-]*(feed|fd|f|stories|story|st|s)\s*$/i;

export function creativeRole(c: PairableCreative): "F" | "S" | null {
  const base = c.name.replace(/\.[a-z0-9]{2,4}$/i, "").trim();
  const m = base.match(SUFFIX);
  if (m) return /^(stories|story|st|s)$/i.test(m[1]!) ? "S" : "F";
  if (c.kind === "IMAGE" && c.width && c.height) return c.height / c.width > 1.4 ? "S" : "F";
  return null;
}

export function pairKey(c: PairableCreative): string {
  const base = c.name.replace(/\.[a-z0-9]{2,4}$/i, "").trim();
  return (base.match(SUFFIX) ? base.replace(SUFFIX, "") : base).toLowerCase();
}

/** Mantém a ordem em que os criativos foram escolhidos. */
export function groupCreativesIntoAds<T extends PairableCreative>(items: T[]): AdGroup<T>[] {
  const groups: AdGroup<T>[] = [];
  for (const c of items) {
    if (c.kind === "VIDEO") {
      groups.push({ key: c.id, feed: c, stories: null });
      continue;
    }
    const role = creativeRole(c) ?? "F";
    const k = pairKey(c);
    const open = groups.find((g) => g.feed?.kind !== "VIDEO" && (g.feed ? pairKey(g.feed) : g.stories ? pairKey(g.stories) : "") === k && (role === "F" ? !g.feed : !g.stories));
    if (open) {
      if (role === "F") open.feed = c;
      else open.stories = c;
      open.key = [open.feed?.id, open.stories?.id].filter(Boolean).join("+");
    } else {
      groups.push({ key: c.id, feed: role === "F" ? c : null, stories: role === "S" ? c : null });
    }
  }
  return groups;
}

/** "01-01-AD01-F": nº da campanha, nº do conjunto, nº do anúncio e F/S (vídeo sem letra). */
export function standardCreativeName(campaignNo: number, adSetNo: number, adNo: number, role: "F" | "S" | null): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(campaignNo)}-${p(adSetNo)}-AD${p(adNo)}${role ? `-${role}` : ""}`;
}
