import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/session";
import { prisma, type UiStyle } from "@zenite-mkt/db";

const VALID_STYLES: UiStyle[] = ["ZENITE", "MINIMALISTA"];

/** Salva o estilo visual na conta do usuário — só afeta quem escolheu, em qualquer dispositivo. */
export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const style = body?.style as UiStyle | undefined;
  if (!style || !VALID_STYLES.includes(style)) {
    return NextResponse.json({ error: "Estilo inválido." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { uiStyle: style } });

  return NextResponse.json({ ok: true });
}
