import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";
import { listGoogleBusinessLocations, withGoogleBusinessToken } from "@/lib/google-business";

/** Localizações do Google ainda sem cliente, para escolher no cadastro de redes do cliente. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || !canManageTeam(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  const client = await prisma.client.findFirst({ where: { id: params.id, agencyId: membership.agencyId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  try {
    const [all, linked] = await Promise.all([
      withGoogleBusinessToken(membership.agencyId, listGoogleBusinessLocations),
      prisma.googleBusinessLocation.findMany({ where: { agencyId: membership.agencyId }, select: { locationId: true } }),
    ]);
    const used = new Set(linked.map((l) => l.locationId));
    return NextResponse.json({ options: all.filter((o) => !used.has(o.locationId)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível listar as localizações." }, { status: 502 });
  }
}

/** Vincula (ou troca) a localização do Google deste cliente. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || !canManageTeam(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  const client = await prisma.client.findFirst({ where: { id: params.id, agencyId: membership.agencyId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  const connection = await prisma.googleBusinessConnection.findUnique({ where: { agencyId: membership.agencyId } });
  if (!connection) return NextResponse.json({ error: "Conecte o Google Meu Negócio em Integrações primeiro." }, { status: 409 });
  const body = await request.json().catch(() => null);
  const accountId = typeof body?.accountId === "string" ? body.accountId : "";
  const locationId = typeof body?.locationId === "string" ? body.locationId : "";
  const name = typeof body?.name === "string" ? body.name.slice(0, 200) : "";
  const address = typeof body?.address === "string" ? body.address.slice(0, 300) : null;
  if (!accountId || !locationId || !name) return NextResponse.json({ error: "Escolha uma localização." }, { status: 400 });
  const taken = await prisma.googleBusinessLocation.findUnique({ where: { agencyId_locationId: { agencyId: membership.agencyId, locationId } } });
  if (taken && taken.clientId !== client.id) return NextResponse.json({ error: "Esta localização já está vinculada a outro cliente." }, { status: 409 });
  const location = await prisma.googleBusinessLocation.upsert({
    where: { clientId: client.id },
    create: { agencyId: membership.agencyId, clientId: client.id, connectionId: connection.id, accountId, locationId, name, address },
    update: { connectionId: connection.id, accountId, locationId, name, address, lastError: null },
  });
  await prisma.auditLog.create({ data: { agencyId: membership.agencyId, actorUserId: session.user.id, actorType: "user", action: "google_business.location_linked", resourceType: "client", resourceId: client.id, metadata: { locationId, name } } });
  return NextResponse.json({ id: location.id, name: location.name });
}

/** Remove o vínculo (o histórico de avaliações continua guardado). */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || !canManageTeam(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  const location = await prisma.googleBusinessLocation.findFirst({ where: { clientId: params.id, agencyId: membership.agencyId } });
  if (!location) return NextResponse.json({ error: "Nenhuma localização vinculada." }, { status: 404 });
  await prisma.googleBusinessLocation.delete({ where: { id: location.id } });
  return NextResponse.json({ ok: true });
}
