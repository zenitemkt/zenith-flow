import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { publishDueSocialPosts } from "@/lib/social-publisher";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Rede de segurança do agendador: o sistema aberto no navegador de alguém da
 * equipe chama esta rota a cada minuto (`SocialPublishTicker`) e publica o
 * que venceu na agência da sessão. Não substitui o cron externo
 * (/api/cron/social-publish) — sem ninguém com o sistema aberto, nada roda.
 * Publicar duas vezes não acontece: o motor reivindica cada post no banco.
 */
export async function POST() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }
  const summary = await publishDueSocialPosts(45_000, new Date(), { agencyId: membership.agencyId });
  return NextResponse.json({ ok: true, ...summary });
}
