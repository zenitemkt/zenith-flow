import { NextResponse } from "next/server";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { parseDriveFolderId } from "@/lib/google-drive";
import { connectCreativeFolder, syncCreativeFolder } from "@/lib/ad-creatives";

export const maxDuration = 60;

/** Liga uma pasta do Google Drive (link ou ID) à biblioteca de criativos e já faz a primeira leitura. */
export async function POST(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManageIntegrations(membership.role)) return NextResponse.json({ error: "Apenas administradores podem conectar pastas." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const folderId = typeof body?.folder === "string" ? parseDriveFolderId(body.folder) : null;
  if (!folderId) return NextResponse.json({ error: "Cole o link da pasta do Google Drive." }, { status: 400 });
  try {
    const folder = await connectCreativeFolder(membership.agencyId, folderId);
    const result = await syncCreativeFolder(folder);
    return NextResponse.json({ ok: true, folderId: folder.id, ...result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não consegui conectar a pasta." }, { status: 400 });
  }
}
