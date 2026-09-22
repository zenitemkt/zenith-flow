import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** Alterna aberta/resolvida — seção 19: "estados thread aberta/resolvida". */
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

  const thread = await prisma.commentThread.findUnique({ where: { id: params.id } });
  if (!thread || thread.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Thread não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const resolved = body?.resolved !== false;

  const updated = await prisma.commentThread.update({
    where: { id: thread.id },
    data: resolved
      ? { status: "RESOLVIDA", resolvedAt: new Date(), resolvedByUserId: session.user.id }
      : { status: "ABERTA", resolvedAt: null, resolvedByUserId: null },
  });

  return NextResponse.json({ status: updated.status });
}
