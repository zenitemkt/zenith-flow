import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { createRequestRecord } from "@/lib/requests-create";
import { prisma } from "@zenith/db";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Demanda aberta pelo próprio cliente no portal — seção 18 do manual
 * ("nova solicitação entra na triagem"). O cliente nunca escolhe qual
 * cliente/prioridade: clientId vem do workspace da sessão, prioridade só é
 * definida pelo time na triagem (mesma regra da seção 13).
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito ao portal do cliente." }, { status: 403 });
  }

  const client = await prisma.client.findUnique({ where: { workspaceId: membership.workspaceId } });
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const title = optionalString(body?.title);
  if (!title) {
    return NextResponse.json({ error: "Informe um título para a solicitação." }, { status: 400 });
  }
  const description = optionalString(body?.description);

  const created = await createRequestRecord({
    agencyId: client.agencyId,
    clientId: client.id,
    title,
    description,
    requesterName: session.user.name,
    requestedByUserId: session.user.id,
    auditActorType: "client_portal",
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
