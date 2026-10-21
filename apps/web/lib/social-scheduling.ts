import { prisma, type SocialPlatform, type SocialPostFormat } from "@zenite-mkt/db";

/**
 * Regras de agendamento de publicações (2026-10-20). Usado pela API do
 * cartão (Agendar / Publicar agora) e pelo agendamento automático quando o
 * cliente aprova no portal.
 */
export const SCHEDULABLE_PLATFORMS: SocialPlatform[] = ["INSTAGRAM", "FACEBOOK"];
export const CAPTION_MAX = 2200;

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  GOOGLE_BUSINESS: "Google Meu Negócio",
};

/** Canal da peça → rede usada no agendamento automático. */
export function platformForChannel(channel: string): SocialPlatform | null {
  if (channel === "INSTAGRAM") return "INSTAGRAM";
  if (channel === "FACEBOOK") return "FACEBOOK";
  return null;
}

/** Formato da peça (texto livre do cadastro) → formato da publicação. */
export function postFormatFor(format: string | null): SocialPostFormat {
  const f = (format ?? "").toLowerCase();
  if (f.includes("reel")) return "REEL";
  if (f.includes("stor")) return "STORY";
  return "FEED";
}

/** Data `AAAA-MM-DD` + hora `HH:MM` no fuso de São Paulo. */
export function spDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export class ScheduleError extends Error {}

/**
 * Cria (ou atualiza, se já houver um pendente na mesma rede) os posts da
 * peça. Valida conexão ativa, arte anexada e limites de cada rede. Peça
 * aprovada passa a "Agendado".
 */
export async function scheduleContentPosts(input: {
  contentItemId: string;
  platforms: SocialPlatform[];
  format: SocialPostFormat;
  caption: string;
  publishAt: Date;
  userId: string | null;
  autoScheduled?: boolean;
}): Promise<string[]> {
  const item = await prisma.contentItem.findUnique({
    where: { id: input.contentItemId },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: { media: { select: { contentType: true } } },
      },
    },
  });
  if (!item) throw new ScheduleError("Conteúdo não encontrado.");
  const platforms = [...new Set(input.platforms)].filter((p) => SCHEDULABLE_PLATFORMS.includes(p));
  if (platforms.length === 0) throw new ScheduleError("Escolha pelo menos uma rede.");
  if (input.caption.length > CAPTION_MAX) throw new ScheduleError(`A legenda passa de ${CAPTION_MAX} caracteres.`);
  if (input.publishAt.getTime() < Date.now() - 60_000) throw new ScheduleError("Escolha uma data e hora no futuro.");

  const version = item.versions[0] ?? null;
  const media = version?.media ?? [];
  const hasVideo = media.some((m) => m.contentType.startsWith("video/"));

  if (platforms.includes("INSTAGRAM") && media.length === 0) {
    throw new ScheduleError("O Instagram precisa da arte em arquivo. Envie os arquivos numa nova versão.");
  }
  if (input.format === "STORY" && media.length !== 1) throw new ScheduleError("Story aceita exatamente um arquivo.");
  if (input.format === "REEL" && (media.length !== 1 || !hasVideo)) throw new ScheduleError("Reels precisa de um único vídeo.");
  if (platforms.includes("FACEBOOK") && input.format === "STORY") {
    throw new ScheduleError("Story no Facebook ainda não é suportado — desmarque o Facebook ou use Feed.");
  }
  if (platforms.includes("FACEBOOK") && media.length > 1 && hasVideo) {
    throw new ScheduleError("O Facebook não aceita carrossel com vídeo.");
  }

  const connections = await prisma.socialConnection.findMany({
    where: { clientId: item.clientId, platform: { in: platforms }, status: "ACTIVE" },
  });
  const missing = platforms.filter((p) => !connections.some((c) => c.platform === p));
  if (missing.length > 0) {
    throw new ScheduleError(`Conecte ${missing.map((p) => PLATFORM_LABELS[p]).join(" e ")} no perfil do cliente antes de agendar.`);
  }

  const ids: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const connection of connections) {
      const data = {
        versionId: version?.id ?? null,
        connectionId: connection.id,
        format: input.format,
        caption: input.caption || null,
        publishAt: input.publishAt,
        status: "SCHEDULED" as const,
        attempts: 0,
        nextAttemptAt: null,
        lastError: null,
        externalContainerId: null,
        autoScheduled: input.autoScheduled ?? false,
      };
      // Já existe um pendente nesta rede para esta peça? Reagenda em vez de duplicar.
      const existing = await tx.socialPost.findFirst({
        where: { contentItemId: item.id, platform: connection.platform, status: { in: ["SCHEDULED", "FAILED"] } },
        select: { id: true },
      });
      const post = existing
        ? await tx.socialPost.update({ where: { id: existing.id }, data })
        : await tx.socialPost.create({
            data: {
              ...data,
              agencyId: item.agencyId,
              clientId: item.clientId,
              contentItemId: item.id,
              platform: connection.platform,
              createdByUserId: input.userId,
            },
          });
      ids.push(post.id);
    }

    if (item.status === "APROVADO") {
      await tx.contentItem.update({ where: { id: item.id }, data: { status: "AGENDADO" } });
      await tx.contentStatusHistory.create({
        data: {
          contentItemId: item.id,
          fromStatus: item.status,
          toStatus: "AGENDADO",
          reason: input.autoScheduled ? "Agendado automaticamente após aprovação do cliente" : "Agendado nas redes",
          actorUserId: input.userId,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        agencyId: item.agencyId,
        actorUserId: input.userId,
        actorType: input.userId ? "user" : "system",
        action: input.autoScheduled ? "social_post.auto_scheduled" : "social_post.scheduled",
        resourceType: "content_item",
        resourceId: item.id,
        metadata: { platforms: connections.map((c) => c.platform), publishAt: input.publishAt.toISOString(), format: input.format },
      },
    });
  });
  return ids;
}

/**
 * Depois que o cliente aprova: se o cliente tem o automático ligado, a peça
 * tem data de publicação, arte em arquivo e a rede do canal está conectada,
 * agenda sozinho no horário padrão. Qualquer falta só registra o motivo —
 * nunca quebra a aprovação.
 */
export async function autoScheduleAfterApproval(contentItemId: string): Promise<void> {
  const item = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    include: { client: { select: { autoScheduleOnApproval: true, defaultPublishTime: true } } },
  });
  if (!item || !item.client.autoScheduleOnApproval || !item.scheduledDate) return;
  const platform = platformForChannel(item.channel);
  if (!platform) return;

  // scheduledDate é guardada como data (meia-noite UTC do dia escolhido).
  const date = item.scheduledDate.toISOString().slice(0, 10);
  let publishAt = spDateTime(date, item.client.defaultPublishTime);
  if (!publishAt) return;
  if (publishAt.getTime() < Date.now()) publishAt = new Date(Date.now() + 5 * 60_000);

  try {
    await scheduleContentPosts({
      contentItemId,
      platforms: [platform],
      format: postFormatFor(item.format),
      caption: item.caption ?? "",
      publishAt,
      userId: null,
      autoScheduled: true,
    });
  } catch (error) {
    await prisma.auditLog.create({
      data: {
        agencyId: item.agencyId,
        actorType: "system",
        action: "social_post.auto_schedule_skipped",
        resourceType: "content_item",
        resourceId: item.id,
        metadata: { reason: error instanceof Error ? error.message : "Erro desconhecido." },
      },
    });
  }
}
