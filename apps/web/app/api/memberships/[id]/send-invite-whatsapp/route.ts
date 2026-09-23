import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam, isClientRole } from "@/lib/rbac";
import { normalizeWhatsappNumber, buildWhatsappLink, buildWhatsappMessage } from "@/lib/whatsapp";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** Não envia nada pelo servidor — só valida e devolve o link wa.me pronto pro client abrir. */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }
  if (isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }
  if (!canManageTeam(membership.role)) {
    return NextResponse.json({ error: "Seu papel não tem permissão para convidar membros." }, { status: 403 });
  }

  const invite = await prisma.membership.findUnique({ where: { id: params.id } });
  if (!invite || invite.agencyId !== membership.agencyId || invite.status !== "INVITED" || !invite.inviteToken) {
    return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const phone = normalizeWhatsappNumber(typeof body?.phone === "string" ? body.phone : "");
  if (!phone) {
    return NextResponse.json({ error: "Informe um número de WhatsApp válido." }, { status: 400 });
  }

  const publicUrl = `${new URL(request.url).origin}/convite/${invite.inviteToken}`;
  const message = buildWhatsappMessage(`Oi! Você foi convidado(a) pra entrar no time de ${membership.agency.name}:`, publicUrl);

  return NextResponse.json({ ok: true, waLink: buildWhatsappLink(phone, message) });
}
