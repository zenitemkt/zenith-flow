import { prisma, type ApprovalStatus } from "@zenite-mkt/db";

type Decision = Extract<ApprovalStatus, "APROVADO" | "AJUSTES_SOLICITADOS">;

/**
 * Aplica a decisão do cliente (aprovar ou pedir ajuste) sobre uma aprovação
 * pendente. Compartilhado entre o link público (/api/approvals/:token,
 * actorUserId null) e o Portal do Cliente autenticado
 * (/api/portal/content/:id/decide, actorUserId real) — mesma regra de
 * negócio, só muda quem está agindo.
 */
export async function applyApprovalDecision({
  approvalId,
  contentVersionId,
  decision,
  note,
  actorUserId,
}: {
  approvalId: string;
  contentVersionId: string;
  decision: Decision;
  note: string | null;
  actorUserId: string | null;
}) {
  const contentVersion = await prisma.contentVersion.findUniqueOrThrow({
    where: { id: contentVersionId },
    include: { contentItem: true },
  });
  const contentItem = contentVersion.contentItem;
  const nextStatus = decision === "APROVADO" ? "APROVADO" : "AJUSTES";

  await prisma.$transaction(async (tx) => {
    await tx.contentApproval.update({
      where: { id: approvalId },
      data: { status: decision, decisionNote: note, decidedAt: new Date() },
    });
    await tx.contentItem.update({ where: { id: contentItem.id }, data: { status: nextStatus } });
    await tx.contentStatusHistory.create({
      data: {
        contentItemId: contentItem.id,
        fromStatus: contentItem.status,
        toStatus: nextStatus,
        reason: note,
        actorUserId,
      },
    });
    await tx.auditLog.create({
      data: {
        agencyId: contentItem.agencyId,
        actorUserId,
        actorType: actorUserId ? "client_portal" : "client",
        action: decision === "APROVADO" ? "content.approved" : "content.changes_requested",
        resourceType: "content_item",
        resourceId: contentItem.id,
        metadata: { versionId: contentVersionId, note },
      },
    });
  });

  return nextStatus;
}
