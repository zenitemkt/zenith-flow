import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canSeeClient } from "@/lib/client-access";
import { analyzeTopPostsWithAI, syncCompetitor } from "@/lib/competitors";
import { syncCompetitorWebsite } from "@/lib/competitor-pagespeed";

export const maxDuration = 60;

async function load(id: string) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return { error: NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 }) };
  const competitor = await prisma.competitor.findFirst({ where: { id, agencyId: membership.agencyId } });
  if (!competitor || !(await canSeeClient(membership.agencyId, session.user.id, competitor.clientId))) return { error: NextResponse.json({ error: "Concorrente não encontrado." }, { status: 404 }) };
  return { competitor };
}

/** Atualizar agora (`sync`) ou analisar os melhores posts com IA (`analyze`). */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await load(params.id);
  if ("error" in ctx) return ctx.error;
  const body = await request.json().catch(() => null);
  try {
    if (body?.action === "analyze") {
      const days = [30, 90, 180, 365].includes(Number(body?.days)) ? Number(body.days) : 90;
      return NextResponse.json({ ok: true, report: await analyzeTopPostsWithAI(ctx.competitor.id, days) });
    }
    if (body?.action === "website") return NextResponse.json({ ok: true, ...(await syncCompetitorWebsite(ctx.competitor.id)) });
    return NextResponse.json({ ok: true, ...(await syncCompetitor(ctx.competitor.id, body?.deep === true)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha." }, { status: 502 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const ctx = await load(params.id);
  if ("error" in ctx) return ctx.error;
  await prisma.competitor.delete({ where: { id: ctx.competitor.id } });
  return NextResponse.json({ ok: true });
}
