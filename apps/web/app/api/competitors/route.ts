import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canSeeClient } from "@/lib/client-access";
import { cleanUsername, syncCompetitor } from "@/lib/competitors";

export const maxDuration = 60;

/** Cadastra um concorrente (ou o perfil do próprio cliente) e já busca os dados. */
export async function POST(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const igUsername = cleanUsername(typeof body?.username === "string" ? body.username : "");
  if (!/^[a-z0-9._]{1,30}$/.test(igUsername)) return NextResponse.json({ error: "Informe o @ do Instagram (ex.: @perfil)." }, { status: 400 });
  const client = await prisma.client.findFirst({ where: { id: clientId, agencyId: membership.agencyId }, select: { id: true } });
  if (!client || !(await canSeeClient(membership.agencyId, session.user.id, client.id))) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  const existing = await prisma.competitor.findUnique({ where: { clientId_igUsername: { clientId, igUsername } } });
  if (existing) return NextResponse.json({ error: "Esse perfil já está cadastrado para este cliente." }, { status: 409 });
  const role = body?.role === "OWN" || body?.role === "REFERENCE" ? body.role : "DIRECT";
  const competitor = await prisma.competitor.create({ data: { agencyId: membership.agencyId, clientId, igUsername, isOwn: role === "OWN", category: role === "REFERENCE" ? "REFERENCE" : "DIRECT", notes: typeof body?.notes === "string" ? body.notes.slice(0, 500) : null } });
  try {
    await syncCompetitor(competitor.id, true);
  } catch (error) {
    // Perfil que não pode ser lido não fica cadastrado.
    await prisma.competitor.delete({ where: { id: competitor.id } });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não consegui ler esse perfil." }, { status: 400 });
  }
  if (role === "OWN") await prisma.competitor.updateMany({ where: { clientId, id: { not: competitor.id }, isOwn: true }, data: { isOwn: false, category: "DIRECT" } });
  return NextResponse.json({ id: competitor.id }, { status: 201 });
}
