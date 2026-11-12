import { beforeEach, describe, expect, it, vi } from "vitest";

const socialPost = { updateMany: vi.fn(), findMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), count: vi.fn() };
const auditLog = { create: vi.fn() };

vi.mock("@zenite-mkt/db", () => ({ prisma: { socialPost, auditLog } }));
vi.mock("@/lib/crypto-secrets", () => ({ decryptSecret: vi.fn() }));
vi.mock("@/lib/meta-ads", () => ({ MetaApiError: class extends Error {} }));
vi.mock("@/lib/meta-social", () => ({
  RetryableSocialError: class extends Error {},
  finishInstagramContainer: vi.fn(),
  publishToFacebookPage: vi.fn(),
  publishToInstagram: vi.fn(),
}));
vi.mock("@/lib/content-media-server", () => ({ signContentMediaRead: vi.fn() }));

const { MAX_LATE_MS, MISSED_SCHEDULE_ERROR, publishDueSocialPosts } = await import("./social-publisher");

const NOW = new Date("2026-11-12T15:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  socialPost.updateMany.mockResolvedValue({ count: 1 });
  auditLog.create.mockResolvedValue({});
});

describe("agendador — ciclo de publicação", () => {
  it("post que perdeu o horário por mais de 6h vira falha com aviso, sem publicar", async () => {
    const publishAt = new Date(NOW.getTime() - MAX_LATE_MS - 60_000);
    socialPost.findMany
      .mockResolvedValueOnce([{ id: "p1", agencyId: "a1", platform: "INSTAGRAM", publishAt }]) // perdidos
      .mockResolvedValueOnce([]); // vencidos

    const summary = await publishDueSocialPosts(40_000, NOW);

    expect(socialPost.findMany.mock.calls[0]![0].where).toMatchObject({
      status: "SCHEDULED",
      attempts: 0,
      nextAttemptAt: null,
      publishAt: { lt: new Date(NOW.getTime() - MAX_LATE_MS) },
    });
    expect(socialPost.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", status: "SCHEDULED", attempts: 0 },
      data: { status: "FAILED", lastError: MISSED_SCHEDULE_ERROR },
    });
    expect(auditLog.create.mock.calls[0]![0].data).toMatchObject({ action: "social_post.missed_schedule", resourceId: "p1", agencyId: "a1" });
    expect(summary).toEqual({ published: 0, processing: 0, retried: 0, failed: 1, skipped: 0 });
    expect(socialPost.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("chamado pelo sistema aberto, só mexe na agência da sessão", async () => {
    socialPost.findMany.mockResolvedValue([]);

    await publishDueSocialPosts(40_000, NOW, { agencyId: "a1" });

    for (const call of [...socialPost.updateMany.mock.calls, ...socialPost.findMany.mock.calls]) {
      expect(call[0].where.agencyId).toBe("a1");
    }
  });

  it("chamado pelo cron, não filtra por agência", async () => {
    socialPost.findMany.mockResolvedValue([]);

    await publishDueSocialPosts(40_000, NOW);

    for (const call of socialPost.findMany.mock.calls) expect(call[0].where).not.toHaveProperty("agencyId");
  });
});
