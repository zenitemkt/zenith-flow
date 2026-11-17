import { describe, expect, it } from "vitest";
import { followUpState, suggestFollowUp, timeAgo } from "./follow-up";

const now = new Date("2026-11-17T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe("retomada de conversa no WhatsApp", () => {
  it("sinaliza quando a última fala foi nossa há 2 dias ou mais", () => {
    expect(followUpState({ conversationId: "c", lastMessageAt: hoursAgo(49), lastMessageRole: "assistant" }, "EM_ANDAMENTO", now).needsFollowUp).toBe(true);
    expect(followUpState({ conversationId: "c", lastMessageAt: hoursAgo(50), lastMessageRole: "partner" }, "QUALIFICADO", now).needsFollowUp).toBe(true);
  });

  it("aguarda, mas ainda não cobra, antes de 2 dias", () => {
    const state = followUpState({ conversationId: "c", lastMessageAt: hoursAgo(10), lastMessageRole: "assistant" }, "EM_ANDAMENTO", now);
    expect(state.awaitingReply).toBe(true);
    expect(state.needsFollowUp).toBe(false);
  });

  it("não cobra quando o lead falou por último, não há conversa ou o lead está fechado", () => {
    expect(followUpState({ conversationId: "c", lastMessageAt: hoursAgo(100), lastMessageRole: "user" }, "EM_ANDAMENTO", now).awaitingReply).toBe(false);
    expect(followUpState(null, "EM_ANDAMENTO", now).awaitingReply).toBe(false);
    expect(followUpState({ conversationId: "c", lastMessageAt: hoursAgo(100), lastMessageRole: "assistant" }, "CONVERTIDO", now).needsFollowUp).toBe(false);
    expect(followUpState({ conversationId: "c", lastMessageAt: hoursAgo(100), lastMessageRole: "assistant" }, "DESQUALIFICADO", now).needsFollowUp).toBe(false);
  });

  it("mostra o tempo relativo em português", () => {
    expect(timeAgo(now, now)).toBe("agora");
    expect(timeAgo(hoursAgo(0.25), now)).toBe("há 15 min");
    expect(timeAgo(hoursAgo(5), now)).toBe("há 5 h");
    expect(timeAgo(hoursAgo(24), now)).toBe("há 1 dia");
    expect(timeAgo(hoursAgo(50), now)).toBe("há 2 dias");
  });

  it("sugere mensagem amigável com o primeiro nome e muda na segunda tentativa", () => {
    const first = suggestFollowUp("MARIA souza");
    expect(first).toContain("Oi, Maria!");
    expect(first).toContain("Ficou alguma dúvida?");
    expect(suggestFollowUp("Maria", 1)).not.toBe(first);
    expect(suggestFollowUp(null)).toMatch(/^Oi! /);
  });
});
