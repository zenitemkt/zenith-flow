import { describe, expect, it } from "vitest";
import { isTrivialFlow, normalizeFieldName, parseFlow, pickBranch, pickQuickReply, renderTemplate, validateAnswer } from "./instagram-flow-model";

describe("sequência do mini-chat — parseFlow", () => {
  it("força o primeiro passo a ser mensagem e solta referências pra passos inexistentes", () => {
    const flow = parseFlow([
      { id: "a", type: "delay", text: "Oi!", next: "b" },
      { id: "b", type: "delay", seconds: 999999, next: "zzz" },
    ]);
    expect(flow?.[0]).toMatchObject({ id: "a", type: "message", text: "Oi!", next: "b" });
    expect(flow?.[1]).toMatchObject({ type: "delay", seconds: 23 * 60 * 60, next: null });
  });

  it("descarta passo de mensagem vazia e corrige quem apontava pra ele", () => {
    const flow = parseFlow([
      { id: "a", type: "message", text: "Oi", quickReplies: [{ title: "Sim", next: "b" }] },
      { id: "b", type: "message", text: "  " },
    ]);
    expect(flow).toHaveLength(1);
    expect(flow?.[0]).toMatchObject({ quickReplies: [{ title: "Sim", next: null }] });
  });

  it("mensagem com botão de link não leva respostas rápidas", () => {
    const flow = parseFlow([{ id: "a", type: "message", text: "Oi", buttons: [{ text: "Site", url: "https://x.com" }], quickReplies: [{ title: "Sim" }] }]);
    expect(flow?.[0]).toMatchObject({ quickReplies: [] });
    expect(isTrivialFlow(flow!)).toBe(true);
  });
});

describe("sequência do mini-chat — respostas", () => {
  it("valida e normaliza e-mail, telefone e número", () => {
    expect(validateAnswer("meu email é Fulano@Site.com.br", "email")).toBe("fulano@site.com.br");
    expect(validateAnswer("(19) 99999-0000", "phone")).toBe("19999990000");
    expect(validateAnswer("123", "phone")).toBeNull();
    expect(validateAnswer("uns 3,5 kg", "number")).toBe("3.5");
  });

  it("ramifica por palavra sem acento nem maiúscula", () => {
    const branches = [{ keywords: ["preço", "valor"], next: "p" }, { keywords: ["agendar"], next: "a" }];
    expect(pickBranch(branches, "Qual o PRECO?")?.next).toBe("p");
    expect(pickBranch(branches, "oi")).toBeNull();
  });

  it("acha a resposta rápida pelo payload ou pelo título digitado", () => {
    const replies = [{ title: "Quero saber mais", next: "x" }, { title: "Não", next: "y" }];
    expect(pickQuickReply(replies, { payload: "qr:1", text: null })?.next).toBe("y");
    expect(pickQuickReply(replies, { payload: null, text: "quero saber mais" })?.next).toBe("x");
    expect(pickQuickReply(replies, { payload: null, text: "talvez" })).toBeNull();
  });

  it("troca variáveis do contato e some com as vazias", () => {
    const contact = { name: "Ana Paula", username: "anap", fields: { email: "a@b.com" } };
    expect(renderTemplate("Oi {{primeiro_nome}} ({{usuario}}), {{email}}{{cidade}}", contact)).toBe("Oi Ana (@anap), a@b.com");
    expect(normalizeFieldName("E-mail do Lead")).toBe("e_mail_do_lead");
  });
});
