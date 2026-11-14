import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isSafeHttpUrl } from "@/lib/instagram-flow-model";

const CTAS = ["SEE_DETAILS", "LEARN_MORE", "SEND_MESSAGE", "WHATSAPP_MESSAGE", "SIGN_UP", "CONTACT_US", "GET_QUOTE", "BOOK_NOW", "SHOP_NOW"];
const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) || null : undefined);

/** Edita os textos do anúncio de um criativo (nome, texto principal, título, descrição, link, botão). */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const creative = await prisma.adCreative.findFirst({ where: { id: params.id, agencyId: membership.agencyId } });
  if (!creative) return NextResponse.json({ error: "Criativo não encontrado." }, { status: 404 });
  const body = await request.json().catch(() => null);
  const linkUrl = clean(body?.linkUrl, 500);
  if (linkUrl && !isSafeHttpUrl(linkUrl)) return NextResponse.json({ error: "O link precisa começar com https://." }, { status: 400 });
  const callToAction = clean(body?.callToAction, 40);
  if (callToAction && !CTAS.includes(callToAction)) return NextResponse.json({ error: "Botão inválido." }, { status: 400 });
  const name = clean(body?.name, 120);
  const updated = await prisma.adCreative.update({
    where: { id: creative.id },
    data: {
      ...(name ? { name } : {}),
      ...(body && "primaryText" in body ? { primaryText: clean(body.primaryText, 2000) ?? null } : {}),
      ...(body && "headline" in body ? { headline: clean(body.headline, 255) ?? null } : {}),
      ...(body && "description" in body ? { description: clean(body.description, 255) ?? null } : {}),
      ...(body && "linkUrl" in body ? { linkUrl: linkUrl ?? null } : {}),
      ...(body && "callToAction" in body ? { callToAction: callToAction ?? null } : {}),
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: updated.id });
}
