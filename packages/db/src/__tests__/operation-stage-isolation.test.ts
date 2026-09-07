import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("colunas customizáveis de Operação: isolamento e ordenação única", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { project: { agencyId: { in: createdAgencyIds } } } });
    await prisma.project.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.operationStage.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgencyWithStage(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    const stage = await prisma.operationStage.create({ data: { agencyId: agency.id, name: `Fazendo ${label}`, order: 0 } });
    createdAgencyIds.push(agency.id);
    return { agency, stage };
  }

  it("nunca retorna colunas de outra agência ao consultar por agencyId", async () => {
    const a = await createAgencyWithStage("alpha");
    const b = await createAgencyWithStage("beta");

    const stagesOfA = await prisma.operationStage.findMany({ where: { agencyId: a.agency.id } });
    const stagesOfB = await prisma.operationStage.findMany({ where: { agencyId: b.agency.id } });

    expect(stagesOfA.map((s) => s.id)).toEqual([a.stage.id]);
    expect(stagesOfB.map((s) => s.id)).toEqual([b.stage.id]);
  });

  it("a constraint @@unique([agencyId, order]) impede duas colunas na mesma posição", async () => {
    const { agency } = await createAgencyWithStage("gamma");

    await expect(
      prisma.operationStage.create({ data: { agencyId: agency.id, name: "Revisão", order: 0 } }),
    ).rejects.toThrow();
  });

  it("apagar uma coluna não apaga a tarefa — só desvincula (onDelete: SetNull)", async () => {
    const { agency, stage } = await createAgencyWithStage("delta");
    const project = await prisma.project.create({ data: { agencyId: agency.id, name: "Projeto delta" } });
    const task = await prisma.task.create({
      data: { projectId: project.id, title: "Tarefa em coluna", status: "EM_ANDAMENTO", stageId: stage.id },
    });

    await prisma.operationStage.delete({ where: { id: stage.id } });

    const reloaded = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(reloaded.stageId).toBeNull();
    expect(reloaded.status).toBe("EM_ANDAMENTO");
  });
});
