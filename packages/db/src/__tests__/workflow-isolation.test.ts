import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("automações: isolamento e versionamento imutável", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.workflowStepRun.deleteMany({ where: { workflowRun: { workflowVersion: { workflow: { agencyId: { in: createdAgencyIds } } } } } });
    await prisma.workflowRun.deleteMany({ where: { workflowVersion: { workflow: { agencyId: { in: createdAgencyIds } } } } });
    await prisma.workflowVersion.deleteMany({ where: { workflow: { agencyId: { in: createdAgencyIds } } } });
    await prisma.workflow.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgencyWithWorkflow(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    const workflow = await prisma.workflow.create({
      data: { agencyId: agency.id, name: `Automação ${label}`, triggerEvent: "lead.created" },
    });
    createdAgencyIds.push(agency.id);
    return { agency, workflow };
  }

  it("nunca retorna automações de outra agência ao consultar por agencyId", async () => {
    const a = await createAgencyWithWorkflow("alpha");
    const b = await createAgencyWithWorkflow("beta");

    const workflowsOfA = await prisma.workflow.findMany({ where: { agencyId: a.agency.id } });
    const workflowsOfB = await prisma.workflow.findMany({ where: { agencyId: b.agency.id } });

    expect(workflowsOfA.map((w) => w.id)).toEqual([a.workflow.id]);
    expect(workflowsOfB.map((w) => w.id)).toEqual([b.workflow.id]);
  });

  it("a constraint @@unique([workflowId, version]) impede duas versões com o mesmo número", async () => {
    const { workflow } = await createAgencyWithWorkflow("gamma");

    await prisma.workflowVersion.create({
      data: { workflowId: workflow.id, version: 1, steps: [{ type: "ACAO", action: "webhook", url: "https://example.com" }] },
    });

    await expect(
      prisma.workflowVersion.create({
        data: { workflowId: workflow.id, version: 1, steps: [] },
      }),
    ).rejects.toThrow();
  });

  it("publicar não apaga o rascunho; execuções registram o passo em que pararam", async () => {
    const { workflow } = await createAgencyWithWorkflow("delta");
    const steps = [{ type: "ESPERA", minutes: 60 }];
    await prisma.workflow.update({ where: { id: workflow.id }, data: { draftSteps: steps, status: "ATIVO" } });
    const version = await prisma.workflowVersion.create({ data: { workflowId: workflow.id, version: 1, steps } });

    const run = await prisma.workflowRun.create({
      data: { workflowVersionId: version.id, subjectType: "lead", subjectId: "lead-1", payload: { leadId: "lead-1" } },
    });
    await prisma.workflowStepRun.create({
      data: { workflowRunId: run.id, stepIndex: 0, stepType: "ESPERA", output: { resumeAt: new Date().toISOString() } },
    });
    await prisma.workflowRun.update({ where: { id: run.id }, data: { status: "AGUARDANDO", currentStepIndex: 0, resumeAt: new Date() } });

    const reloadedWorkflow = await prisma.workflow.findUniqueOrThrow({ where: { id: workflow.id } });
    expect(reloadedWorkflow.draftSteps).toEqual(steps);

    const stepRuns = await prisma.workflowStepRun.findMany({ where: { workflowRunId: run.id } });
    expect(stepRuns).toHaveLength(1);
    expect(stepRuns[0]?.stepType).toBe("ESPERA");
  });
});
