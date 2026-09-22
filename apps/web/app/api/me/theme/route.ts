import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/session";
import { prisma, type ThemePreference } from "@zenite-mkt/db";

const VALID_THEMES: ThemePreference[] = ["LIGHT", "DARK"];

/** Salva a preferência de tema na conta do usuário — vale em qualquer dispositivo, não só neste navegador. */
export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const theme = body?.theme as ThemePreference | undefined;
  if (!theme || !VALID_THEMES.includes(theme)) {
    return NextResponse.json({ error: "Tema inválido." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { themePreference: theme } });

  return NextResponse.json({ ok: true });
}
