import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { resolveContentAutomationActor } from "@/lib/content-automation-auth";

/** O agente lê os pedidos de alteração abertos (status='open') antes de escrever de novo. */
export async function GET(request: Request) {
  const actor = await resolveContentAutomationActor(request);
  if (!actor) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const comments = await prisma.blogDraftComment.findMany({
    where: { status: "open", draft: { agencyId: actor.agencyId } },
    include: { draft: { select: { id: true, slug: true, title: true, status: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ comments });
}
