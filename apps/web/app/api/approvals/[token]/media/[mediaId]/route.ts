import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { signContentMediaRead } from "@/lib/content-media-server";

interface RouteParams {
  params: { token: string; mediaId: string };
}

/**
 * Rota pública do link de aprovação: o token só libera os arquivos da
 * própria versão em aprovação, nunca outra mídia.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const approval = await prisma.contentApproval.findUnique({
    where: { token: params.token },
    select: { contentVersionId: true },
  });
  if (!approval) return NextResponse.json({ error: "Link inválido." }, { status: 404 });

  const media = await prisma.contentVersionMedia.findFirst({
    where: { id: params.mediaId, versionId: approval.contentVersionId },
    select: { key: true },
  });
  if (!media) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });

  return NextResponse.redirect(await signContentMediaRead(media.key));
}
