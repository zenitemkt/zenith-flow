import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";

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
  const log = await prisma.instagramAutomationLog.findUnique({ where: { id: params.id }, select: { buttonUrls: true, clickedAt: true } });
  const urls = Array.isArray(log?.buttonUrls) ? (log!.buttonUrls as string[]) : [];
  const target = urls[index];
  if (!target) return new NextResponse("Not found", { status: 404 });
  if (!log!.clickedAt) {
    await prisma.instagramAutomationLog.update({ where: { id: params.id }, data: { clickedAt: new Date(), clickedButtonIndex: index } }).catch(() => {});
  }
  return NextResponse.redirect(target, { status: 302 });
}
