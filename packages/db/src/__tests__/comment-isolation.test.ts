import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client";

describe("comentários: isolamento, edição com histórico e tombstone", () => {
  const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAgencyIds: string[] = [];

  afterAll(async () => {
    await prisma.commentMention.deleteMany({
      where: { comment: { thread: { agencyId: { in: createdAgencyIds } } } },
    });
    await prisma.commentEdit.deleteMany({
      where: { comment: { thread: { agencyId: { in: createdAgencyIds } } } },
    });
    await prisma.comment.deleteMany({ where: { thread: { agencyId: { in: createdAgencyIds } } } });
    await prisma.commentThread.deleteMany({ where: { agencyId: { in: createdAgencyIds } } });
    await prisma.agency.deleteMany({ where: { id: { in: createdAgencyIds } } });
  });

  async function createAgency(label: string) {
    const agency = await prisma.agency.create({
      data: { name: `Agência ${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    createdAgencyIds.push(agency.id);
    return agency;
  }

  it("nunca retorna threads de outra agência ao consultar por agencyId", async () => {
    const a = await createAgency("alpha");
    const b = await createAgency("beta");

    await prisma.commentThread.create({
      data: { agencyId: a.id, entityType: "request", entityId: `req-a-${suffix}` },
    });
    await prisma.commentThread.create({
      data: { agencyId: b.id, entityType: "request", entityId: `req-b-${suffix}` },
    });

    const threadsOfA = await prisma.commentThread.findMany({ where: { agencyId: a.id } });
    const threadsOfB = await prisma.commentThread.findMany({ where: { agencyId: b.id } });

    expect(threadsOfA).toHaveLength(1);
    expect(threadsOfB).toHaveLength(1);
    expect(threadsOfA[0]!.entityId).toBe(`req-a-${suffix}`);
  });

  it("uma entidade só tem uma thread (@@unique entityType+entityId)", async () => {
    const agency = await createAgency("gamma");
    const entityId = `content-${suffix}`;

    await prisma.commentThread.create({
      data: { agencyId: agency.id, entityType: "content_item", entityId },
    });

    await expect(
      prisma.commentThread.create({
        data: { agencyId: agency.id, entityType: "content_item", entityId },
      }),
    ).rejects.toThrow();
  });

  it("editar preserva o texto anterior em CommentEdit; remover vira tombstone", async () => {
    const agency = await createAgency("delta");
    const thread = await prisma.commentThread.create({
      data: { agencyId: agency.id, entityType: "request", entityId: `req-delta-${suffix}` },
    });
    const comment = await prisma.comment.create({
      data: { threadId: thread.id, authorUserId: "user-1", body: "Texto original" },
    });

    await prisma.$transaction([
      prisma.commentEdit.create({
        data: { commentId: comment.id, previousBody: comment.body, editedByUserId: "user-1" },
      }),
      prisma.comment.update({
        where: { id: comment.id },
        data: { body: "Texto editado", status: "EDITADO", editedAt: new Date() },
      }),
    ]);

    const edited = await prisma.comment.findUnique({ where: { id: comment.id }, include: { edits: true } });
    expect(edited?.body).toBe("Texto editado");
    expect(edited?.status).toBe("EDITADO");
    expect(edited?.edits).toHaveLength(1);
    expect(edited?.edits[0]!.previousBody).toBe("Texto original");

    await prisma.$transaction([
      prisma.commentEdit.create({
        data: { commentId: comment.id, previousBody: edited!.body, editedByUserId: "user-1" },
      }),
      prisma.comment.update({
        where: { id: comment.id },
        data: { body: "", status: "REMOVIDO", editedAt: new Date() },
      }),
    ]);

    const removed = await prisma.comment.findUnique({ where: { id: comment.id }, include: { edits: true } });
    expect(removed?.status).toBe("REMOVIDO");
    expect(removed?.body).toBe("");
    expect(removed?.edits).toHaveLength(2);
    expect(removed?.edits[1]!.previousBody).toBe("Texto editado");
  });

  it("resolver a thread grava quem resolveu e quando", async () => {
    const agency = await createAgency("epsilon");
    const thread = await prisma.commentThread.create({
      data: { agencyId: agency.id, entityType: "content_item", entityId: `content-eps-${suffix}` },
    });

    const resolved = await prisma.commentThread.update({
      where: { id: thread.id },
      data: { status: "RESOLVIDA", resolvedAt: new Date(), resolvedByUserId: "user-2" },
    });

    expect(resolved.status).toBe("RESOLVIDA");
    expect(resolved.resolvedByUserId).toBe("user-2");
    expect(resolved.resolvedAt).not.toBeNull();
  });
});
