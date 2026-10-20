import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

/** Ramos de atuação já cadastrados na agência — alimenta a sugestão do campo "Ramo de atuação". */
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const segments = await prisma.clientSegment.findMany({
    where: { agencyId: membership.agencyId },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ segments: segments.map((s) => s.name) });
}
