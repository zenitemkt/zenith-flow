import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("RH — vagas e candidatos: isolamento, funil por vaga e contratação única", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.candidateStatusHistory.deleteMany({ where: { candidate: { agencyId: { in: createdAgencyIds } } } });
    await prisma.candidate.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.jobStage.deleteMany({ where: { job: { agencyId: { in: createdAgencyIds } } } });
    await prisma.job.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.employeeStatusHistory.deleteMany({ where: { employee: { agencyId: { in: createdAgencyIds } } } });
    await prisma.employee.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.position.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgency(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    createdAgencyIds.push(agency.id);
    return agency;
  }

  it("nunca retorna vagas de outra agência ao consultar por agencyId", async () => {
    const a = await createAgency("alpha");
    const b = await createAgency("beta");

    await prisma.job.create({ data: { agencyId: a.id, title: "Designer" } });
    await prisma.job.create({ data: { agencyId: b.id, title: "Gestor de tráfego" } });

    const jobsOfA = await prisma.job.findMany({ where: { agencyId: a.id } });
    const jobsOfB = await prisma.job.findMany({ where: { agencyId: b.id } });

    expect(jobsOfA).toHaveLength(1);
    expect(jobsOfB).toHaveLength(1);
    expect(jobsOfA[0]!.title).toBe("Designer");
  });

  it("estágio é único por posição dentro da vaga (@@unique jobId+order) — mesma ordem em vagas diferentes não conflita", async () => {
    const agency = await createAgency("gamma");
    const jobA = await prisma.job.create({ data: { agencyId: agency.id, title: "Vaga A" } });
    const jobB = await prisma.job.create({ data: { agencyId: agency.id, title: "Vaga B" } });

    await prisma.jobStage.create({ data: { jobId: jobA.id, name: "Triagem", order: 0 } });
    await prisma.jobStage.create({ data: { jobId: jobB.id, name: "Triagem", order: 0 } });

    await expect(
      prisma.jobStage.create({ data: { jobId: jobA.id, name: "Duplicada", order: 0 } }),
    ).rejects.toThrow();
  });

  it("contratar um candidato vincula o Employee de forma única (@@unique convertedEmployeeId)", async () => {
    const agency = await createAgency("delta");
    const job = await prisma.job.create({ data: { agencyId: agency.id, title: "Editor de vídeo" } });
    const stage = await prisma.jobStage.create({ data: { jobId: job.id, name: "Triagem", order: 0 } });
    const [candidateA, candidateB] = await Promise.all([
      prisma.candidate.create({ data: { agencyId: agency.id, jobId: job.id, stageId: stage.id, name: "Candidato A" } }),
      prisma.candidate.create({ data: { agencyId: agency.id, jobId: job.id, stageId: stage.id, name: "Candidato B" } }),
    ]);
    const employee = await prisma.employee.create({ data: { agencyId: agency.id, name: "Candidato A" } });

    const hired = await prisma.candidate.update({
      where: { id: candidateA.id },
      data: { status: "CONTRATADO", convertedEmployeeId: employee.id },
    });
    expect(hired.convertedEmployeeId).toBe(employee.id);

    await expect(
      prisma.candidate.update({ where: { id: candidateB.id }, data: { convertedEmployeeId: employee.id } }),
    ).rejects.toThrow();
  });

  it("anonimizar limpa dados pessoais mas preserva a linha e o histórico de estágio", async () => {
    const agency = await createAgency("epsilon");
    const job = await prisma.job.create({ data: { agencyId: agency.id, title: "Social media" } });
    const stage = await prisma.jobStage.create({ data: { jobId: job.id, name: "Triagem", order: 0 } });
    const candidate = await prisma.candidate.create({
      data: {
        agencyId: agency.id,
        jobId: job.id,
        stageId: stage.id,
        name: "Fulano Real",
        email: "fulano@example.com",
        status: "REJEITADO",
        rejectedReason: "Perfil não bateu com a vaga",
      },
    });
    await prisma.candidateStatusHistory.create({
      data: { candidateId: candidate.id, toStageId: stage.id, toStatus: "EM_ANDAMENTO" },
    });

    const anonymized = await prisma.candidate.update({
      where: { id: candidate.id },
      data: { name: "Candidato anonimizado", email: null, phone: null, notes: null, anonymizedAt: new Date() },
    });

    expect(anonymized.name).toBe("Candidato anonimizado");
    expect(anonymized.email).toBeNull();
    expect(anonymized.anonymizedAt).not.toBeNull();
    expect(anonymized.rejectedReason).toBe("Perfil não bateu com a vaga");

    const history = await prisma.candidateStatusHistory.findMany({ where: { candidateId: candidate.id } });
    expect(history).toHaveLength(1);
  });
});
