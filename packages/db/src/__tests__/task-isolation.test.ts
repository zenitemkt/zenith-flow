import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("isolamento e bloqueio de tarefas", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { project: { agencyId: { in: createdAgencyIds } } } });
    await prisma.project.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgencyWithProject(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    const project = await prisma.project.create({
      data: { agencyId: agency.id, name: `Projeto da ${label}` },
    });
    createdAgencyIds.push(agency.id);
    return { agency, project };
  }

  it("nunca retorna tarefas de outra agência ao consultar por projeto/agência", async () => {
    const a = await createAgencyWithProject("alpha");
    const b = await createAgencyWithProject("beta");
    const taskA = await prisma.task.create({ data: { projectId: a.project.id, title: "Tarefa A" } });
    const taskB = await prisma.task.create({ data: { projectId: b.project.id, title: "Tarefa B" } });

    const tasksOfA = await prisma.task.findMany({ where: { project: { agencyId: a.agency.id } } });
    const tasksOfB = await prisma.task.findMany({ where: { project: { agencyId: b.agency.id } } });

    expect(tasksOfA.map((t) => t.id)).toEqual([taskA.id]);
    expect(tasksOfB.map((t) => t.id)).toEqual([taskB.id]);
  });

  it("bloqueio por dependência: tarefa bloqueadora precisa estar concluída", async () => {
    const { project } = await createAgencyWithProject("gamma");
    const blocker = await prisma.task.create({ data: { projectId: project.id, title: "Base" } });
    const dependent = await prisma.task.create({
      data: { projectId: project.id, title: "Depende da base", blockedByTaskId: blocker.id },
    });

    const loaded = await prisma.task.findUnique({
      where: { id: dependent.id },
      include: { blockedBy: true },
    });
    expect(loaded?.blockedBy?.status).toBe("BACKLOG");

    await prisma.task.update({ where: { id: blocker.id }, data: { status: "CONCLUIDA" } });
    const reloaded = await prisma.task.findUnique({
      where: { id: dependent.id },
      include: { blockedBy: true },
    });
    expect(reloaded?.blockedBy?.status).toBe("CONCLUIDA");
  });
});
