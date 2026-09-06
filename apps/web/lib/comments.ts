import { prisma, type CommentStatus, type CommentThreadStatus } from "@zenith/db";

/**
 * Tipos de entidade comentável — texto livre no banco (não enum), mas
 * fechado em código pra manter as rotas que consomem thread de comentário
 * honestas sobre o que sabem carregar (checagem de posse do recurso).
 * "request" saiu quando Demandas foi substituída pelo Kanban unificado de
 * Operação (ver docs/DECISIONS.md, 2026-09-06).
 */
export type CommentEntityType = "content_item";

export function isCommentEntityType(value: unknown): value is CommentEntityType {
  return value === "content_item";
}

/** Confere que a entidade existe e pertence à agência do chamador. */
export async function resolveCommentableEntity(
  entityType: CommentEntityType,
  entityId: string,
  agencyId: string,
): Promise<boolean> {
  if (entityType === "content_item") {
    const item = await prisma.contentItem.findUnique({ where: { id: entityId } });
    return Boolean(item && item.agencyId === agencyId);
  }
  return false;
}

/** `clientId` da entidade de origem, se houver — usado ao converter um comentário em tarefa. */
export async function resolveCommentEntityClientId(
  entityType: CommentEntityType,
  entityId: string,
): Promise<string | null> {
  if (entityType === "content_item") {
    const item = await prisma.contentItem.findUnique({ where: { id: entityId }, select: { clientId: true } });
    return item?.clientId ?? null;
  }
  return null;
}

/** Membros da equipe interna (não-cliente) que podem ser mencionados. */
export async function getMentionableMembers(agencyId: string) {
  const members = await prisma.membership.findMany({
    where: {
      agencyId,
      status: "ACTIVE",
      role: { notIn: ["CLIENT_ADMIN", "CLIENT_VIEWER"] },
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return members
    .filter((m) => m.user)
    .map((m) => ({ id: m.user!.id, name: m.user!.name, email: m.user!.email }));
}

export interface CommentView {
  id: string;
  body: string;
  status: CommentStatus;
  authorUserId: string;
  authorName: string;
  createdAt: Date;
  editedAt: Date | null;
  mentionNames: string[];
  convertedTaskId: string | null;
}

export interface CommentThreadView {
  id: string | null;
  status: CommentThreadStatus;
  comments: CommentView[];
}

/**
 * Monta a thread de comentários pronta pra renderizar — resolve nomes de
 * autor e menções (guardadas só como userId) num único round-trip extra.
 * `entityType`/`entityId` já devem ter sido validados como pertencentes à
 * agência do chamador antes de usar isto.
 */
export async function loadCommentThreadView(
  entityType: CommentEntityType,
  entityId: string,
): Promise<CommentThreadView> {
  const thread = await prisma.commentThread.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
    include: { comments: { orderBy: { createdAt: "asc" }, include: { mentions: true } } },
  });

  if (!thread) {
    return { id: null, status: "ABERTA", comments: [] };
  }

  const userIds = new Set<string>();
  for (const comment of thread.comments) {
    userIds.add(comment.authorUserId);
    for (const mention of comment.mentions) userIds.add(mention.mentionedUserId);
  }
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(userIds) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return {
    id: thread.id,
    status: thread.status,
    comments: thread.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      status: comment.status,
      authorUserId: comment.authorUserId,
      authorName: nameById.get(comment.authorUserId) ?? "Ex-membro",
      createdAt: comment.createdAt,
      editedAt: comment.editedAt,
      convertedTaskId: comment.convertedTaskId,
      mentionNames: comment.mentions.map((m) => nameById.get(m.mentionedUserId) ?? "Ex-membro"),
    })),
  };
}
