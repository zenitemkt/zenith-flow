import { prisma, Prisma } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";
import { getAppBaseUrl } from "@/lib/meta-ads";
import {
  fetchInstagramUserProfile,
  sendInstagramDirectMessage,
  sendInstagramPrivateReplyToComment,
  sendInstagramTypingOn,
  type MessageButton,
} from "@/lib/instagram-automation";
import {
  FLOW_LIMITS,
  MESSAGING_WINDOW_MS,
  parseFlow,
  pickBranch,
  pickQuickReply,
  renderTemplate,
  stepById,
  typingDelayMs,
  validateAnswer,
  type FlowStep,
} from "@/lib/instagram-flow-model";

/**
 * Motor das sequências do mini-chat. Cada sessão anda passo a passo até
 * precisar esperar (atraso longo, pergunta, resposta rápida ou a resposta
 * da pessoa depois de uma resposta privada a comentário); o webhook retoma
 * quando a pessoa responde e o agendador de minuto em minuto retoma atrasos
 * e desistências por tempo. A trava contra execução dupla é o UPDATE
 * condicional no status (mesmo padrão do agendador de redes).
 */

export interface MessagingTarget {
  agencyId: string;
  clientId: string;
  igToken: string;
  igAccountId: string;
}

/**
 * Casada pelo `messagingAccountId` (token IGAA), não pelo `externalId`
 * antigo (token de Página) — são IDs em espaços diferentes (seção 4.1,
 * correção de 2026-10-23).
 */
export async function loadMessagingTarget(where: { igAccountId: string } | { clientId: string }): Promise<MessagingTarget | null> {
  const connection = await prisma.socialConnection.findFirst({
    where: { platform: "INSTAGRAM", status: "ACTIVE", ...("igAccountId" in where ? { messagingAccountId: where.igAccountId } : { clientId: where.clientId }) },
  });
  if (!connection?.messagingAccessTokenEnc || !connection.messagingAccountId) return null;
  return {
    agencyId: connection.agencyId,
    clientId: connection.clientId,
    igToken: decryptSecret(connection.messagingAccessTokenEnc),
    igAccountId: connection.messagingAccountId,
  };
}

/** Troca os links reais por URLs do nosso redirecionador de clique (seção 4.4 — a Meta só avisa leitura, não clique). */
export function buildTrackedButtons(buttons: unknown, logId: string): { send: MessageButton[]; realUrls: string[] } {
  const parsed = Array.isArray(buttons) ? (buttons as Array<{ text?: string; url?: string }>) : [];
  const valid = parsed.filter((b): b is { text: string; url: string } => Boolean(b.text && b.url));
  return {
    send: valid.map((b, index) => ({ text: b.text, url: `${getAppBaseUrl()}/api/instagram/click/${logId}/${index}` })),
    realUrls: valid.map((b) => b.url),
  };
}

// ---------------------------------------------------------------------------
// Contatos
// ---------------------------------------------------------------------------

interface ContactRow {
  id: string;
  igsid: string;
  name: string | null;
  username: string | null;
  tags: string[];
  fields: Record<string, string>;
  lastInboundAt: Date | null;
}

function toContactRow(row: { id: string; igsid: string; name: string | null; username: string | null; tags: string[]; fields: unknown; lastInboundAt: Date | null }): ContactRow {
  const fields = row.fields && typeof row.fields === "object" && !Array.isArray(row.fields) ? (row.fields as Record<string, string>) : {};
  return { ...row, fields };
}

/** Cria/atualiza o contato. `inbound` = a pessoa mandou DM agora (abre a janela de 24h); comentário não abre. */
export async function touchContact(target: MessagingTarget, igsid: string, inbound: boolean): Promise<ContactRow> {
  const now = new Date();
  const row = await prisma.instagramContact.upsert({
    where: { clientId_igsid: { clientId: target.clientId, igsid } },
    create: { agencyId: target.agencyId, clientId: target.clientId, igsid, tags: [], fields: {}, lastInboundAt: inbound ? now : null },
    update: inbound ? { lastInboundAt: now } : {},
  });
  if (!row.username && !row.name) {
    const profile = await fetchInstagramUserProfile(target.igToken, igsid).catch(() => null);
    if (profile && (profile.username || profile.name)) {
      const updated = await prisma.instagramContact.update({ where: { id: row.id }, data: { username: profile.username, name: profile.name } });
      return toContactRow(updated);
    }
  }
  return toContactRow(row);
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

interface RunContext {
  target: MessagingTarget;
  sessionId: string;
  ruleId: string;
  steps: FlowStep[];
  contact: ContactRow;
  needsUserReply: boolean;
  /** Só no primeiro envio de uma regra de comentário: a mensagem sai como resposta privada. */
  commentId: string | null;
  /** Log do evento que disparou — o primeiro envio reaproveita (uma entrada → uma resposta nas métricas). */
  triggerLogId: string | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function setSession(sessionId: string, data: Prisma.InstagramFlowSessionUncheckedUpdateInput) {
  await prisma.instagramFlowSession.update({ where: { id: sessionId }, data });
}

/** Manda um passo de mensagem; devolve false se falhou (a sessão já fica marcada como falha). */
async function sendMessageStep(ctx: RunContext, step: Extract<FlowStep, { type: "message" }>): Promise<boolean> {
  const text = renderTemplate(step.text, ctx.contact);
  const logId =
    ctx.triggerLogId ??
    (
      await prisma.instagramAutomationLog.create({
        data: { agencyId: ctx.target.agencyId, clientId: ctx.target.clientId, ruleId: ctx.ruleId, senderIgsid: ctx.contact.igsid, status: "pending" },
        select: { id: true },
      })
    ).id;
  ctx.triggerLogId = null;
  const { send: buttons, realUrls } = buildTrackedButtons(step.buttons, logId);
  const quickReplies = step.quickReplies.map((reply, index) => ({ title: reply.title, payload: `qr:${index}` }));

  try {
    let sentMessageId: string | null;
    if (ctx.commentId) {
      sentMessageId = await sendInstagramPrivateReplyToComment(ctx.target.igToken, ctx.target.igAccountId, ctx.commentId, { text, buttons, quickReplies });
      ctx.commentId = null;
      ctx.needsUserReply = true;
      await setSession(ctx.sessionId, { needsUserReply: true });
    } else {
      if (step.typing) {
        await sendInstagramTypingOn(ctx.target.igToken, ctx.target.igAccountId, ctx.contact.igsid);
        await sleep(typingDelayMs(text));
      }
      sentMessageId = await sendInstagramDirectMessage(ctx.target.igToken, ctx.target.igAccountId, ctx.contact.igsid, { text, buttons, quickReplies });
    }
    await prisma.instagramAutomationLog.update({
      where: { id: logId },
      data: { status: "sent", sentText: text, buttonUrls: realUrls, ruleId: ctx.ruleId, sentMessageId },
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    await prisma.instagramAutomationLog.update({ where: { id: logId }, data: { status: "failed", error: message, ruleId: ctx.ruleId } });
    await setSession(ctx.sessionId, { status: "failed", error: message, resumeAt: null });
    return false;
  }
}

function windowClosed(contact: ContactRow, now = Date.now()): boolean {
  return !contact.lastInboundAt || now - contact.lastInboundAt.getTime() > MESSAGING_WINDOW_MS;
}

/** Anda a partir de `stepId` até precisar esperar ou acabar. */
async function runFrom(ctx: RunContext, stepId: string | null): Promise<void> {
  let current = stepId;
  for (let count = 0; current; count += 1) {
    if (count >= FLOW_LIMITS.maxStepsPerRun) {
      await setSession(ctx.sessionId, { status: "failed", error: "A sequência passou do limite de passos seguidos (provável laço).", resumeAt: null });
      return;
    }
    const step = stepById(ctx.steps, current);
    if (!step) break;

    if (step.type === "message") {
      if (ctx.needsUserReply && !ctx.commentId) {
        // A Meta só libera a próxima mensagem depois que a pessoa responder à resposta privada.
        await setSession(ctx.sessionId, { status: "waiting_reply", currentStepId: step.id, resumeAt: null });
        return;
      }
      if (!ctx.commentId && windowClosed(ctx.contact)) {
        await setSession(ctx.sessionId, { status: "expired", error: "Janela de 24h da Meta fechou antes do envio.", resumeAt: null });
        return;
      }
      if (!(await sendMessageStep(ctx, step))) return;
      if (step.quickReplies.length > 0) {
        await setSession(ctx.sessionId, { status: "waiting_input", currentStepId: step.id, resumeAt: null });
        return;
      }
      current = step.next;
    } else if (step.type === "delay") {
      if (step.seconds <= FLOW_LIMITS.inlineDelaySeconds) {
        await sleep(step.seconds * 1000);
        current = step.next;
      } else {
        if (!step.next) break;
        await setSession(ctx.sessionId, { status: "waiting_delay", currentStepId: step.next, resumeAt: new Date(Date.now() + step.seconds * 1000) });
        return;
      }
    } else if (step.type === "input") {
      await setSession(ctx.sessionId, {
        status: "waiting_input",
        currentStepId: step.id,
        resumeAt: step.timeoutMinutes ? new Date(Date.now() + step.timeoutMinutes * 60_000) : null,
      });
      return;
    } else if (step.type === "tag") {
      const tags = new Set(ctx.contact.tags);
      for (const tag of step.add) tags.add(tag);
      for (const tag of step.remove) tags.delete(tag);
      ctx.contact.tags = [...tags];
      await prisma.instagramContact.update({ where: { id: ctx.contact.id }, data: { tags: ctx.contact.tags } });
      current = step.next;
    } else {
      const profile = await fetchInstagramUserProfile(ctx.target.igToken, ctx.contact.igsid).catch(() => null);
      current = profile?.followsBusiness ? step.yes : step.no;
    }
  }
  await setSession(ctx.sessionId, { status: "done", currentStepId: null, resumeAt: null });
}

/** Inicia a sequência da regra pra essa pessoa (encerra qualquer outra que ela estivesse fazendo). */
export async function startFlow(input: {
  target: MessagingTarget;
  ruleId: string;
  flow: unknown;
  contact: ContactRow;
  commentId: string | null;
  triggerLogId: string;
}): Promise<boolean> {
  const steps = parseFlow(input.flow);
  if (!steps) return false;
  await prisma.instagramFlowSession.updateMany({
    where: { contactId: input.contact.id, status: { in: ["running", "waiting_delay", "waiting_input", "waiting_reply"] } },
    data: { status: "done", resumeAt: null },
  });
  const session = await prisma.instagramFlowSession.create({
    data: {
      agencyId: input.target.agencyId,
      clientId: input.target.clientId,
      contactId: input.contact.id,
      ruleId: input.ruleId,
      status: "running",
      currentStepId: steps[0]!.id,
    },
  });
  await runFrom(
    {
      target: input.target,
      sessionId: session.id,
      ruleId: input.ruleId,
      steps,
      contact: input.contact,
      needsUserReply: false,
      commentId: input.commentId,
      triggerLogId: input.triggerLogId,
    },
    steps[0]!.id,
  );
  return true;
}

const WAITING_FOR_PERSON = ["waiting_input", "waiting_reply"];

/**
 * DM que chegou enquanto a pessoa está no meio de uma sequência. Devolve
 * true quando a sequência "consumiu" a mensagem (aí as regras normais não
 * rodam pra ela).
 */
export async function continueFlowWithReply(input: {
  target: MessagingTarget;
  contact: ContactRow;
  text: string | null;
  quickReplyPayload: string | null;
}): Promise<{ consumed: boolean; ruleId: string | null }> {
  const staleBefore = new Date(Date.now() - MESSAGING_WINDOW_MS);
  const session = await prisma.instagramFlowSession.findFirst({
    where: { contactId: input.contact.id, status: { in: WAITING_FOR_PERSON }, updatedAt: { gte: staleBefore } },
    orderBy: { updatedAt: "desc" },
    include: { rule: { select: { flow: true, active: true } } },
  });
  if (!session || !session.rule.active) return { consumed: false, ruleId: null };
  const steps = parseFlow(session.rule.flow);
  const step = steps ? stepById(steps, session.currentStepId) : null;
  if (!steps || !step) {
    await setSession(session.id, { status: "done", resumeAt: null });
    return { consumed: false, ruleId: null };
  }

  // Reivindica: só um evento retoma a sessão.
  const claimed = await prisma.instagramFlowSession.updateMany({ where: { id: session.id, status: session.status }, data: { status: "running", resumeAt: null } });
  if (claimed.count === 0) return { consumed: true, ruleId: session.ruleId };

  const ctx: RunContext = {
    target: input.target,
    sessionId: session.id,
    ruleId: session.ruleId,
    steps,
    contact: input.contact,
    needsUserReply: false,
    commentId: null,
    triggerLogId: null,
  };

  if (session.status === "waiting_reply") {
    await setSession(session.id, { needsUserReply: false });
    await runFrom(ctx, step.id);
    return { consumed: true, ruleId: session.ruleId };
  }

  if (step.type === "message") {
    const reply = pickQuickReply(step.quickReplies, { payload: input.quickReplyPayload, text: input.text });
    if (!reply && !step.next) {
      // Digitou outra coisa e não há caminho pra isso: sai da sequência e deixa as regras normais responderem.
      await setSession(session.id, { status: "done", resumeAt: null });
      return { consumed: false, ruleId: null };
    }
    await runFrom(ctx, reply ? reply.next : step.next);
    return { consumed: true, ruleId: session.ruleId };
  }

  if (step.type === "input") {
    const answer = validateAnswer(input.text ?? "", step.validate);
    if (answer === null) {
      await sendMessageStep(ctx, {
        id: step.id,
        type: "message",
        text: step.retryText ?? "Não consegui entender, pode mandar de novo?",
        buttons: [],
        quickReplies: [],
        typing: true,
        next: null,
      });
      await prisma.instagramFlowSession.updateMany({
        where: { id: session.id, status: "running" },
        data: { status: "waiting_input", resumeAt: step.timeoutMinutes ? new Date(Date.now() + step.timeoutMinutes * 60_000) : null },
      });
      return { consumed: true, ruleId: session.ruleId };
    }
    if (step.saveAs) {
      ctx.contact.fields = { ...ctx.contact.fields, [step.saveAs]: answer };
      await prisma.instagramContact.update({ where: { id: ctx.contact.id }, data: { fields: ctx.contact.fields } });
    }
    const branch = pickBranch(step.branches, answer);
    await runFrom(ctx, branch ? branch.next : step.next);
    return { consumed: true, ruleId: session.ruleId };
  }

  await runFrom(ctx, step.id);
  return { consumed: true, ruleId: session.ruleId };
}

/** Agendador de minuto em minuto: retoma atrasos vencidos, aplica desistência por tempo e expira sessões paradas. */
export async function processDueFlowSessions(budgetMs: number): Promise<{ resumed: number; expired: number }> {
  const started = Date.now();
  const now = new Date();
  const expired = await prisma.instagramFlowSession.updateMany({
    where: { status: { in: ["waiting_input", "waiting_reply", "waiting_delay"] }, resumeAt: null, updatedAt: { lt: new Date(now.getTime() - MESSAGING_WINDOW_MS) } },
    data: { status: "expired" },
  });

  const due = await prisma.instagramFlowSession.findMany({
    where: { status: { in: ["waiting_delay", "waiting_input"] }, resumeAt: { lte: now } },
    orderBy: { resumeAt: "asc" },
    take: 30,
    include: { rule: { select: { flow: true, active: true } }, contact: true },
  });

  let resumed = 0;
  const targets = new Map<string, MessagingTarget | null>();
  for (const session of due) {
    if (Date.now() - started > budgetMs) break;
    const claimed = await prisma.instagramFlowSession.updateMany({ where: { id: session.id, status: session.status }, data: { status: "running", resumeAt: null } });
    if (claimed.count === 0) continue;

    const steps = parseFlow(session.rule.flow);
    if (!targets.has(session.clientId)) targets.set(session.clientId, await loadMessagingTarget({ clientId: session.clientId }));
    const target = targets.get(session.clientId);
    if (!steps || !target || !session.rule.active) {
      await setSession(session.id, { status: "done", error: !target ? "Instagram sem token de mensageria." : null });
      continue;
    }
    const ctx: RunContext = {
      target,
      sessionId: session.id,
      ruleId: session.ruleId,
      steps,
      contact: toContactRow(session.contact),
      needsUserReply: session.needsUserReply,
      commentId: null,
      triggerLogId: null,
    };
    const step = stepById(steps, session.currentStepId);
    // Pergunta sem resposta a tempo → caminho de desistência; atraso vencido → próximo passo (já guardado em currentStepId).
    const next = session.status === "waiting_input" ? (step?.type === "input" ? step.timeoutNext : null) : session.currentStepId;
    await runFrom(ctx, next);
    resumed += 1;
  }
  return { resumed, expired: expired.count };
}
