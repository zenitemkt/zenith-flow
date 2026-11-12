import { prisma } from "@zenite-mkt/db";
import type { FinanceViewer } from "@/lib/finance-scope";
import type { PartnerChoice } from "./PartnerSplitFields";

export interface PartnerLogin {
  userId: string;
  label: string;
}

/**
 * Sócios como os formulários enxergam: `soloHidden` marca quem tem login
 * próprio e não é o usuário atual — ele entra na divisão da Zenite, mas não
 * aparece como "Só fulano" (seria lançar na conta particular de outra pessoa).
 */
export function partnerChoices(viewer: FinanceViewer): PartnerChoice[] {
  return viewer.partners.map((p) => ({
    id: p.id,
    name: p.name,
    active: p.active,
    userId: p.userId,
    soloHidden: viewer.hiddenPartnerIds.includes(p.id),
  }));
}

/** Logins da equipe (não clientes) para ligar a um sócio — só carregado para administradores. */
export async function loadPartnerLogins(agencyId: string): Promise<PartnerLogin[]> {
  const memberships = await prisma.membership.findMany({
    where: { agencyId, status: "ACTIVE", userId: { not: null }, role: { notIn: ["CLIENT_ADMIN", "CLIENT_VIEWER"] } },
    select: { userId: true, email: true, user: { select: { name: true } } },
    orderBy: { email: "asc" },
  });
  const seen = new Set<string>();
  const out: PartnerLogin[] = [];
  for (const m of memberships) {
    if (!m.userId || seen.has(m.userId)) continue;
    seen.add(m.userId);
    out.push({ userId: m.userId, label: m.user?.name ? `${m.user.name} (${m.email})` : m.email });
  }
  return out;
}
