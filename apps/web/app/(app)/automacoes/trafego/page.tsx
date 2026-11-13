import { redirect } from "next/navigation";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { driveServiceAccountEmail } from "@/lib/google-drive";
import { creativeWarnings } from "@/lib/ad-creatives";
import { CreativeLibrary } from "./CreativeLibrary";

export default async function TrafficManagerPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");
  const agencyId = membership.agencyId;
  const [folders, creatives, metaConnection] = await Promise.all([
    prisma.adCreativeFolder.findMany({ where: { agencyId }, orderBy: { createdAt: "asc" } }),
    prisma.adCreative.findMany({ where: { agencyId }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.adAccountConnection.findUnique({ where: { agencyId_platform: { agencyId, platform: "META" } }, select: { externalAccountName: true, externalAccountId: true, scopes: true, status: true } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Gestor de tráfego</h1>
        <p className="text-sm text-[#667085]">
          Biblioteca de criativos dos anúncios da Meta. Os arquivos ficam no Google Drive; aqui você escreve os textos do anúncio e acompanha a situação de cada um.
        </p>
      </div>
      <CreativeLibrary
        serviceEmail={driveServiceAccountEmail()}
        folders={folders.map((f) => ({ id: f.id, name: f.name, rootFolderId: f.rootFolderId, lastSyncAt: f.lastSyncAt?.toISOString() ?? null, lastSyncError: f.lastSyncError }))}
        metaAccount={metaConnection ? { name: metaConnection.externalAccountName ?? metaConnection.externalAccountId, canWrite: metaConnection.scopes.includes("ads_management"), active: metaConnection.status === "ACTIVE" } : null}
        creatives={creatives.map((c) => ({
          id: c.id,
          driveFileId: c.driveFileId,
          name: c.name,
          fileName: c.fileName,
          kind: c.kind,
          width: c.width,
          height: c.height,
          sizeBytes: c.sizeBytes === null ? null : Number(c.sizeBytes),
          status: c.status,
          missingInDrive: c.missingInDrive,
          primaryText: c.primaryText,
          headline: c.headline,
          description: c.description,
          linkUrl: c.linkUrl,
          callToAction: c.callToAction,
          lastError: c.lastError,
          warnings: creativeWarnings(c),
        }))}
      />
    </div>
  );
}
