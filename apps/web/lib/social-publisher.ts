import { prisma, type SocialPost } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";
import { MetaApiError } from "@/lib/meta-ads";
import {
  RetryableSocialError,
  finishInstagramContainer,
  publishToFacebookPage,
  publishToInstagram,
  type PublishResult,
} from "@/lib/meta-social";
import { signContentMediaRead } from "@/lib/content-media-server";

/**
 * Motor do agendador de redes (2026-10-20). Roda pelo cron externo
 * (/api/cron/social-publish, a cada minuto) e pelo "Publicar agora".
 *
 * Garantias:
 * - nunca publica duas vezes: cada post é "reivindicado" com um UPDATE
 *   condicionado ao status (SCHEDULED/PROCESSING → PUBLISHING); só quem
 *   conseguiu a troca publica;
 * - falha temporária volta para a fila com espera crescente; depois de
 *   MAX_ATTEMPTS vira FAILED com o erro em português, para reenviar à mão;
 * - vídeo do Instagram que não terminou de processar fica PROCESSING com o
 *   container salvo, e o próximo ciclo só confere e publica.
 */
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MIN = [5, 15];
const PROCESSING_RECHECK_MS = 60_000;
/** PUBLISHING parado além disso = função caiu no meio; marca falha (pode ter publicado — conferir na rede). */
const STALE_PUBLISHING_MS = 15 * 60_000;
/** Tempo que a Meta tem para baixar a mídia do R2. */
const MEDIA_URL_TTL_SECONDS = 2 * 60 * 60;

export interface PublishRunSummary {
  published: number;
  processing: number;
  retried: number;
  failed: number;
  skipped: number;
}

async function claim(postId: string): Promise<boolean> {
  const result = await prisma.socialPost.updateMany({
    where: { id: postId, status: { in: ["SCHEDULED", "PROCESSING"] } },
    data: { status: "PUBLISHING", attempts: { increment: 1 } },
  });
  return result.count === 1;
}

/** Peça publicada em todas as redes agendadas → Concluído (Publicado). */
async function markContentPublishedIfDone(contentItemId: string | null) {
  if (!contentItemId) return;
  const pending = await prisma.socialPost.count({
    where: { contentItemId, status: { in: ["SCHEDULED", "PUBLISHING", "PROCESSING", "FAILED"] } },
  });
  if (pending > 0) return;
  const item = await prisma.contentItem.findUnique({ where: { id: contentItemId }, select: { status: true } });
  if (!item || item.status === "PUBLICADO" || item.status === "ARQUIVADO") return;
  await prisma.$transaction([
    prisma.contentItem.update({ where: { id: contentItemId }, data: { status: "PUBLICADO" } }),
    prisma.contentStatusHistory.create({
      data: { contentItemId, fromStatus: item.status, toStatus: "PUBLICADO", reason: "Publicado automaticamente nas redes" },
    }),
  ]);
}

function friendlyError(error: unknown): string {
  if (error instanceof MetaApiError) return `Meta: ${error.message}`;
  if (error instanceof Error) return error.message;
  return "Erro desconhecido.";
}

function isTokenError(error: unknown): boolean {
  if (!(error instanceof MetaApiError)) return false;
  const code = (error.body as { error?: { code?: number } } | null)?.error?.code;
  return code === 190 || code === 10 || code === 200;
}

async function runPublish(post: SocialPost, budgetMs: number): Promise<"published" | "processing" | "retried" | "failed"> {
  const full = await prisma.socialPost.findUniqueOrThrow({
    where: { id: post.id },
    include: {
      connection: true,
      version: { include: { media: { orderBy: { position: "asc" } } } },
    },
  });

  try {
    if (full.connection.status === "REVOKED" || !full.connection.accessTokenEnc) {
      throw new Error("A conta foi desconectada. Conecte de novo no perfil do cliente.");
    }
    const token = decryptSecret(full.connection.accessTokenEnc);
    const media = await Promise.all(
      (full.version?.media ?? []).map(async (m) => ({
        url: await signContentMediaRead(m.key, MEDIA_URL_TTL_SECONDS),
        isVideo: m.contentType.startsWith("video/"),
      })),
    );
    const caption = full.caption ?? "";

    let result: PublishResult;
    if (full.platform === "INSTAGRAM") {
      result = full.externalContainerId
        ? await finishInstagramContainer({ igUserId: full.connection.externalId, token, containerId: full.externalContainerId, budgetMs })
        : await publishToInstagram({ igUserId: full.connection.externalId, token, caption, media, format: full.format, budgetMs });
    } else if (full.platform === "FACEBOOK") {
      if (full.format === "STORY") throw new Error("Story no Facebook ainda não é suportado — use Feed.");
      result = await publishToFacebookPage({ pageId: full.connection.externalId, token, caption, media });
    } else {
      throw new Error("Google Meu Negócio ainda não está disponível.");
    }

    await prisma.socialPost.update({
      where: { id: full.id },
      data: {
        status: "PUBLISHED",
        externalPostId: result.externalPostId,
        permalink: result.permalink,
        publishedAt: new Date(),
        lastError: null,
        externalContainerId: null,
        nextAttemptAt: null,
      },
    });
    await prisma.auditLog.create({
      data: {
        agencyId: full.agencyId,
        actorType: "system",
        action: "social_post.published",
        resourceType: "social_post",
        resourceId: full.id,
        metadata: { platform: full.platform, permalink: result.permalink },
      },
    });
    await markContentPublishedIfDone(full.contentItemId);
    return "published";
  } catch (error) {
    // Vídeo ainda processando: guarda o container e confere no próximo ciclo (não conta tentativa).
    if (error instanceof RetryableSocialError && error.containerId) {
      await prisma.socialPost.update({
        where: { id: full.id },
        data: {
          status: "PROCESSING",
          externalContainerId: error.containerId,
          nextAttemptAt: new Date(Date.now() + PROCESSING_RECHECK_MS),
          attempts: { decrement: 1 },
          lastError: null,
        },
      });
      return "processing";
    }

    const message = friendlyError(error);
    if (isTokenError(error)) {
      await prisma.socialConnection.update({
        where: { id: full.connectionId },
        data: { status: "ERROR", lastError: "Acesso expirado ou removido. Reconecte no perfil do cliente." },
      });
    }
    // Erros de validação nossos (Error comum) não adiantam repetir; erros da Meta/rede sim.
    const retryable = (error instanceof MetaApiError || error instanceof RetryableSocialError) && !isTokenError(error);
    if (retryable && full.attempts < MAX_ATTEMPTS) {
      const delay = RETRY_DELAYS_MIN[Math.min(full.attempts - 1, RETRY_DELAYS_MIN.length - 1)] ?? 15;
      await prisma.socialPost.update({
        where: { id: full.id },
        data: { status: "SCHEDULED", nextAttemptAt: new Date(Date.now() + delay * 60_000), lastError: message },
      });
      return "retried";
    }

    await prisma.socialPost.update({
      where: { id: full.id },
      data: { status: "FAILED", lastError: message, nextAttemptAt: null },
    });
    await prisma.auditLog.create({
      data: {
        agencyId: full.agencyId,
        actorType: "system",
        action: "social_post.failed",
        resourceType: "social_post",
        resourceId: full.id,
        metadata: { platform: full.platform, error: message },
      },
    });
    return "failed";
  }
}

/** Publica um post agora (botão "Publicar agora" / reenviar). Devolve o status final. */
export async function publishSocialPostNow(postId: string, budgetMs: number) {
  if (!(await claim(postId))) return null;
  const post = await prisma.socialPost.findUniqueOrThrow({ where: { id: postId } });
  return runPublish(post, budgetMs);
}

/** Um ciclo do cron: publica o que venceu e confere vídeos em processamento, dentro do tempo disponível. */
export async function publishDueSocialPosts(budgetMs: number, now = new Date()): Promise<PublishRunSummary> {
  const started = Date.now();
  const summary: PublishRunSummary = { published: 0, processing: 0, retried: 0, failed: 0, skipped: 0 };

  await prisma.socialPost.updateMany({
    where: { status: "PUBLISHING", updatedAt: { lt: new Date(now.getTime() - STALE_PUBLISHING_MS) } },
    data: { status: "FAILED", lastError: "A publicação foi interrompida. Confira na rede se o post saiu antes de reenviar." },
  });

  const due = await prisma.socialPost.findMany({
    where: {
      OR: [
        { status: "SCHEDULED", publishAt: { lte: now }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { status: "PROCESSING", nextAttemptAt: { lte: now } },
      ],
    },
    orderBy: { publishAt: "asc" },
    take: 10,
  });

  for (const post of due) {
    const remaining = budgetMs - (Date.now() - started);
    if (remaining < 15_000) break;
    if (!(await claim(post.id))) {
      summary.skipped++;
      continue;
    }
    const fresh = await prisma.socialPost.findUniqueOrThrow({ where: { id: post.id } });
    const outcome = await runPublish(fresh, Math.min(remaining - 5_000, 40_000));
    summary[outcome]++;
  }
  return summary;
}
