import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { isSafeHttpUrl } from "@/lib/instagram-flow-model";

const cents = (v: unknown) => {
  if (v === null || v === "" || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};

/** Configurações do Gestor de tráfego (teto, custo por lead, página, links). */
export async function PUT(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageIntegrations(membership.role)) return NextResponse.json({ error: "Apenas administradores alteram as travas do gestor." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  const privacy = typeof body.privacyPolicyUrl === "string" ? body.privacyPolicyUrl.trim() : "";
  const website = typeof body.websiteUrl === "string" ? body.websiteUrl.trim() : "";
  if ((privacy && !isSafeHttpUrl(privacy)) || (website && !isSafeHttpUrl(website))) return NextResponse.json({ error: "Os links precisam começar com https://." }, { status: 400 });
  let pageConnectionId: string | null = typeof body.pageConnectionId === "string" && body.pageConnectionId ? body.pageConnectionId : null;
  if (pageConnectionId) {
    const page = await prisma.socialConnection.findFirst({ where: { id: pageConnectionId, agencyId: membership.agencyId, platform: "FACEBOOK" }, select: { id: true } });
    if (!page) pageConnectionId = null;
  }
  const pct = Math.min(100, Math.max(5, Number(body.maxBudgetChangePct) || 20));
  const data = {
    dailyBudgetCapCents: cents(body.dailyBudgetCap),
    cplGoodCents: cents(body.cplGood),
    cplMaxCents: cents(body.cplMax),
    maxBudgetChangePct: pct,
    killSwitch: body.killSwitch === true,
    pageConnectionId,
    privacyPolicyUrl: privacy || null,
    websiteUrl: website || null,
  };
  await prisma.trafficSettings.upsert({ where: { agencyId: membership.agencyId }, create: { agencyId: membership.agencyId, ...data }, update: data });
  return NextResponse.json({ ok: true });
}
