import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { splitEmailList } from "@/lib/proposals";
import { sendContentApprovalEmail, EmailNotConfiguredError } from "@/lib/email";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

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
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  if (!to || !to.includes("@")) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  const cc = splitEmailList(body?.cc);
  const bcc = splitEmailList(body?.bcc);

  const publicUrl = `${new URL(request.url).origin}/aprovar/${latestVersion.approval.token}`;

  try {
    await sendContentApprovalEmail({ to, cc, bcc, contentTitle: item.title, publicUrl, agencyName: membership.agency.name });
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível enviar o e-mail." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
