import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { isSafeHttpUrl } from "@/lib/instagram-flow-model";

interface RouteParams {
  params: { id: string; index: string };
}

/**
 * Redirecionador de clique (seção 4.4 do Blueprint) — a Meta não avisa
 * clique em botão de link, só leitura. Cada botão da DM aponta pra cá (nunca
 * direto pro destino), identificado pelo índice na lista `buttonUrls`.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const index = Number(params.index);
  const log = await prisma.instagramAutomationLog.findUnique({ where: { id: params.id }, select: { buttonUrls: true, clickedAt: true, readAt: true } });
  const urls = Array.isArray(log?.buttonUrls) ? (log!.buttonUrls as string[]) : [];
  const target = urls[index];
  if (!target || !isSafeHttpUrl(target)) return new NextResponse("Not found", { status: 404 });
  if (!log!.clickedAt) {
    // Clique implica leitura — cobre quem desativou a confirmação de leitura no Instagram.
    const now = new Date();
    await prisma.instagramAutomationLog
      .update({ where: { id: params.id }, data: { clickedAt: now, clickedButtonIndex: index, ...(log!.readAt ? {} : { readAt: now }) } })
      .catch(() => {});
  }
  return NextResponse.redirect(target, { status: 302 });
}
