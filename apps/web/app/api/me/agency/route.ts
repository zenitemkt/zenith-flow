import { NextResponse } from "next/server";
import { getServerSession, getActiveMemberships, CURRENT_AGENCY_COOKIE } from "@/lib/session";

/** Troca a agência ativa da sessão (seletor no menu) — grava em cookie, nunca no banco. */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const agencyId = typeof body?.agencyId === "string" ? body.agencyId : "";
  if (!agencyId) {
    return NextResponse.json({ error: "Informe a agência." }, { status: 400 });
  }

  const memberships = await getActiveMemberships(session.user.id);
  const membership = memberships.find((m) => m.agencyId === agencyId);
  if (!membership) {
    return NextResponse.json({ error: "Você não tem acesso a essa agência." }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(CURRENT_AGENCY_COOKIE, agencyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
