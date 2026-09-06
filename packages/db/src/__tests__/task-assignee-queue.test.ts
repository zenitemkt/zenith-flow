import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("fila sequencial de responsáveis (TaskAssignee)", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { project: { agencyId: { in: createdAgencyIds } } } });
    await prisma.project.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgencyWithProject(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    const project = await prisma.project.create({ data: { agencyId: agency.id, name: `Projeto da ${label}` } });
    createdAgencyIds.push(agency.id);
    return { agency, project };
  }

  it("não permite duas posições iguais na fila da mesma tarefa (@@unique taskId+order)", async () => {
    const { project } = await createAgencyWithProject("alpha");
    const task = await prisma.task.create({ data: { projectId: project.id, title: "Tarefa com fila" } });
    const userA = await prisma.user.create({ data: { name: "Pessoa A", email: `a-${suffix}@example.com` } });
    const userB = await prisma.user.create({ data: { name: "Pessoa B", email: `b-${suffix}@example.com` } });

    await prisma.taskAssignee.create({ data: { taskId: task.id, userId: userA.id, order: 0 } });

    await expect(
      prisma.taskAssignee.create({ data: { taskId: task.id, userId: userB.id, order: 0 } }),
    ).rejects.toThrow();
  });

  it("concluir a parte de quem está na vez promove o próximo `order` sem apagar o histórico", async () => {
    const { project } = await createAgencyWithProject("beta");
    const userA = await prisma.user.create({ data: { name: "Pessoa C", email: `c-${suffix}@example.com` } });
    const userB = await prisma.user.create({ data: { name: "Pessoa D", email: `d-${suffix}@example.com` } });
    const task = await prisma.task.create({
      data: { projectId: project.id, title: "Tarefa em fila", status: "EM_ANDAMENTO", assigneeUserId: userA.id },
    });
    await prisma.taskAssignee.createMany({
      data: [
        { taskId: task.id, userId: userA.id, order: 0 },
        { taskId: task.id, userId: userB.id, order: 1 },
      ],
    });

    const first = await prisma.taskAssignee.findFirstOrThrow({ where: { taskId: task.id, order: 0 } });
    await prisma.taskAssignee.update({ where: { id: first.id }, data: { completedAt: new Date() } });
    const next = await prisma.taskAssignee.findFirst({
      where: { taskId: task.id, order: { gt: first.order }, completedAt: null },
      orderBy: { order: "asc" },
    });
    expect(next?.userId).toBe(userB.id);

    const queue = await prisma.taskAssignee.findMany({ where: { taskId: task.id }, orderBy: { order: "asc" } });
    expect(queue).toHaveLength(2);
    expect(queue[0]?.completedAt).not.toBeNull();
    expect(queue[1]?.completedAt).toBeNull();
  });
});
