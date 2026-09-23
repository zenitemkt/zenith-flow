import { prisma, type Prisma } from "@zenite-mkt/db";

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Criação de um Employee — compartilhada entre o cadastro manual
 * (/api/employees) e a conversão de candidato contratado
 * (/api/candidates/:id/convert). Mesma regra de negócio nos dois casos: cria
 * o registro já ATIVO e grava o primeiro EmployeeStatusHistory. Aceita um
 * client opcional para participar da transação do chamador (a conversão de
 * candidato precisa que a criação do Employee e a atualização do Candidate
 * sejam atômicas — nunca um Employee órfão se o resto falhar).
 */
export async function createEmployeeRecord(
  {
    agencyId,
    userId,
    name,
    email,
    phone,
    role,
    positionId,
    actorUserId,
  }: {
    agencyId: string;
    userId: string | null;
    name: string;
    email: string | null;
    phone?: string | null;
    role: string | null;
    positionId: string | null;
    actorUserId: string;
  },
  client: Client = prisma,
) {
  const employee = await client.employee.create({
    data: { agencyId, userId, name, email, phone: phone ?? null, role, positionId, hiredAt: new Date() },
  });
  await client.employeeStatusHistory.create({
    data: { employeeId: employee.id, toStatus: "ATIVO", actorUserId },
  });
  await client.auditLog.create({
    data: {
      agencyId,
      actorUserId,
      actorType: "user",
      action: "employee.created",
      resourceType: "employee",
      resourceId: employee.id,
    },
  });
  return employee;
}
