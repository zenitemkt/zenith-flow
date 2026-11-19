import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { publishDueSocialPosts } from "@/lib/social-publisher";
import { checkCronWake } from "@/lib/cron-wake";

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
  // Antes até da sessão (que consulta o banco): sem post vencendo segundo o plano do
  // cron (lib/cron-wake.ts), responde "nada a fazer" e deixa o Neon dormir. A rota
  // já exige cookie de sessão no middleware; a resposta não expõe nenhum dado.
  // Só lê o plano — quem o recalcula é o cron, que cobre todas as agências.
  const wake = await checkCronWake("social");
  if (!wake.run) return NextResponse.json({ ok: true, idle: true });

  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }
  const summary = await publishDueSocialPosts(45_000, new Date(), { agencyId: membership.agencyId });
  return NextResponse.json({ ok: true, ...summary });
}
