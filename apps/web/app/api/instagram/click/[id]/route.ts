import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/**
 * Redirecionador de clique (seção 4.4 do Blueprint) — a Meta não avisa
 * clique em botão de link, só leitura. O botão da DM nunca aponta direto pro
 * destino: aponta aqui, que registra o clique e só depois manda (302) pro
 * link real.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const log = await prisma.instagramAutomationLog.findUnique({ where: { id: params.id }, select: { buttonUrl: true, clickedAt: true } });
  if (!log?.buttonUrl) return new NextResponse("Not found", { status: 404 });
  if (!log.clickedAt) {
    await prisma.instagramAutomationLog.update({ where: { id: params.id }, data: { clickedAt: new Date() } }).catch(() => {});
  }
  return NextResponse.redirect(log.buttonUrl, { status: 302 });
}
