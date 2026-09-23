import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
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

  const item = await prisma.contentItem.findUnique({ where: { id: params.id } });
  if (!item || item.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }

  const latestVersion = await prisma.contentVersion.findFirst({
    where: { contentItemId: item.id },
    orderBy: { versionNumber: "desc" },
    include: { approval: true },
  });
  if (!latestVersion?.approval) {
    return NextResponse.json({ error: "Envie para aprovação antes de mandar o link." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const phoneRaw = typeof body?.phone === "string" ? body.phone : "";
  const phone = normalizeWhatsappNumber(phoneRaw);
  if (!phone) {
    return NextResponse.json({ error: "Informe um número de WhatsApp válido." }, { status: 400 });
  }

  const publicUrl = `${new URL(request.url).origin}/aprovar/${latestVersion.approval.token}`;
  const message = buildWhatsappMessage(`Oi! Segue "${item.title}" pra você aprovar:`, publicUrl);

  return NextResponse.json({ ok: true, waLink: buildWhatsappLink(phone, message) });
}
