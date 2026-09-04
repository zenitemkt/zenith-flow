import { prisma } from "@zenith/db";

/**
 * Criação de uma Demanda — compartilhada entre a rota interna
 * (/api/requests, qualquer membro da equipe) e o Portal do Cliente
 * (/api/portal/requests, cliente cria pra si mesmo). Mesma regra de
 * negócio nos dois casos, só muda quem está agindo e qual actorType vai
 * pro audit log.
 */
export async function createRequestRecord({
  agencyId,
  clientId,
  title,
  description,
  requesterName,
  requestedByUserId,
  auditActorType = "user",
}: {
  agencyId: string;
  clientId: string | null;
  title: string;
  description: string | null;
  requesterName: string | null;
  requestedByUserId: string;
  auditActorType?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const req = await tx.request.create({
      data: { agencyId, clientId, title, description, requesterName, requestedByUserId },
    });
    await tx.requestStatusHistory.create({
      data: { requestId: req.id, toStatus: "NOVA", actorUserId: requestedByUserId },
    });
    await tx.auditLog.create({
      data: {
        agencyId,
        actorUserId: requestedByUserId,
        actorType: auditActorType,
        action: "request.created",
        resourceType: "request",
        resourceId: req.id,
      },
    });
    return req;
  });
}
