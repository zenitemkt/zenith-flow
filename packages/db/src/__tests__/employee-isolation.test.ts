import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("RH: isolamento, desligamento e ausência", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await prisma.leaveRequestStatusHistory.deleteMany({
      where: { leaveRequest: { agencyId: { in: createdAgencyIds } } },
    });
    await prisma.leaveRequest.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.employeeStatusHistory.deleteMany({
      where: { employee: { agencyId: { in: createdAgencyIds } } },
    });
    await prisma.employee.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.membership.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgency(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    const workspace = await prisma.workspace.create({
      data: { agencyId: agency.id, name: `${label} workspace`, kind: "AGENCY" },
    });
    createdAgencyIds.push(agency.id);
    return { agency, workspace };
  }

  it("nunca retorna funcionários de outra agência ao consultar por agencyId", async () => {
    const a = await createAgency("alpha");
    const b = await createAgency("beta");

    await prisma.employee.create({ data: { agencyId: a.agency.id, name: "Pessoa A" } });
    await prisma.employee.create({ data: { agencyId: b.agency.id, name: "Pessoa B" } });

    const employeesOfA = await prisma.employee.findMany({ where: { agencyId: a.agency.id } });
    const employeesOfB = await prisma.employee.findMany({ where: { agencyId: b.agency.id } });

    expect(employeesOfA.map((e) => e.name)).toEqual(["Pessoa A"]);
    expect(employeesOfB.map((e) => e.name)).toEqual(["Pessoa B"]);
  });

  it("desligamento revoga sessões ativas mas preserva o Membership (autoria histórica)", async () => {
    const { agency, workspace } = await createAgency("gamma");
    const user = await prisma.user.create({
      data: { name: "Colaborador Gamma", email: `colab-${suffix}@example.com` },
    });
    createdUserIds.push(user.id);
    await prisma.session.create({
      data: {
        userId: user.id,
        token: `token-${suffix}`,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        email: user.email,
        agencyId: agency.id,
        workspaceId: workspace.id,
        role: "ANALYST",
        status: "ACTIVE",
      },
    });
    const employee = await prisma.employee.create({
      data: { agencyId: agency.id, userId: user.id, name: user.name, status: "ATIVO" },
    });

    // Simula o que a rota /api/employees/:id/status faz ao desligar.
    await prisma.$transaction([
      prisma.employee.update({ where: { id: employee.id }, data: { status: "DESLIGADO" } }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
      prisma.membership.updateMany({
        where: { userId: user.id, agencyId: agency.id, status: "ACTIVE" },
        data: { status: "SUSPENDED" },
      }),
    ]);

    const remainingSessions = await prisma.session.findMany({ where: { userId: user.id } });
    const reloadedMembership = await prisma.membership.findUnique({ where: { id: membership.id } });
    const reloadedUser = await prisma.user.findUnique({ where: { id: user.id } });

    expect(remainingSessions).toHaveLength(0);
    expect(reloadedMembership?.status).toBe("SUSPENDED");
    expect(reloadedMembership).not.toBeNull(); // Membership preservado, não apagado
    expect(reloadedUser).not.toBeNull(); // User preservado — autoria histórica intacta
  });

  it("uma ausência aprovada com período vigente aparece na consulta de disponibilidade", async () => {
    const { agency } = await createAgency("delta");
    const employee = await prisma.employee.create({
      data: { agencyId: agency.id, name: "Pessoa em férias" },
    });
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const tomorrow = new Date(now.getTime() + 86400000);

    await prisma.leaveRequest.create({
      data: {
        agencyId: agency.id,
        employeeId: employee.id,
        type: "FERIAS",
        startDate: yesterday,
        endDate: tomorrow,
        status: "APROVADA",
      },
    });

    const activeLeaves = await prisma.leaveRequest.findMany({
      where: {
        agencyId: agency.id,
        status: "APROVADA",
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    expect(activeLeaves).toHaveLength(1);
    expect(activeLeaves[0]!.employeeId).toBe(employee.id);
  });
});
