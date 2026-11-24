import { describe, expect, it } from "vitest";
import { detectCounterpartBot, looksLikeMenuText } from "./bot-detection";

const text = (content: string) => ({ type: "text", content });
const none = { prospect: true, recentInbound: [] };

describe("detectCounterpartBot", () => {
  it("menu com botões (unsupported) numa conversa de prospecção é robô", () => {
    expect(detectCounterpartBot({ type: "unsupported", content: "[mensagem do tipo unsupported]" }, none)).toBe("menu com botões");
  });

  it("unsupported fora da prospecção não decide sozinho (pode ser enquete de uma pessoa)", () => {
    expect(detectCounterpartBot({ type: "unsupported", content: "" }, { prospect: false, recentInbound: [] })).toBeNull();
  });

  it("frases típicas de menu automático", () => {
    for (const t of [
      "Mensagem inválida! Por favor, selecione uma das opções acima.",
      "Me conta, com qual setor você gostaria de falar?",
      "Digite o número da opção desejada",
      "Olá, sou a assistente virtual da Imobiliária X",
      "Este é um atendimento automático.",
      "Escolha uma opção: 1 - Vendas 2 - Locação",
      "Opção inválida, tente novamente",
    ]) {
      expect(looksLikeMenuText(t), t).toBe(true);
    }
  });

  it("não confunde com resposta de pessoa nem com saudação de WhatsApp Business", () => {
    for (const t of [
      "Oi, quem fala?",
      "Pode me mandar mais informações por favor",
      "Olá! Obrigado pelo contato, em breve retornaremos.",
      "Seja bem-vindo à Imobiliária Naidelice",
      "Não tenho interesse, obrigado",
      "Qual o valor do site?",
      "Me informe o número do seu CNPJ",
    ]) {
      expect(detectCounterpartBot(text(t), none), t).toBeNull();
    }
  });

  it("mesma mensagem longa repetida é resposta automática", () => {
    const msg = "Nosso horário de atendimento é de segunda a sexta.";
    expect(detectCounterpartBot(text(msg), { prospect: false, recentInbound: [msg] })).toBe("mensagem automática repetida");
    expect(detectCounterpartBot(text("ok"), { prospect: false, recentInbound: ["ok"] })).toBeNull();
  });
});
