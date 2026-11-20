import { describe, expect, it } from "vitest";
import { isMobileBr, phoneVariants } from "@/lib/assistant/form-outreach";
import { DEFAULT_EMAIL_STEPS, DEFAULT_WHATSAPP_OPENER, emailHook, renderCopy, whatsappHook } from "./copy";
import { mergeProspectingConfig } from "./config";

const clinica = { name: "Clínica Sorriso", segment: "clínica odontológica", city: "Americana, SP", website: null, rating: 4.2, reviewCount: 30 };

describe("textos da prospecção", () => {
  it("preenche as variáveis e não sobra nenhuma", () => {
    const opener = renderCopy(DEFAULT_WHATSAPP_OPENER, clinica, whatsappHook(clinica));
    expect(opener).toContain("Clínica Sorriso");
    expect(opener).toContain("ainda não têm site próprio");
    for (const step of DEFAULT_EMAIL_STEPS) expect(renderCopy(step.body, clinica, emailHook(clinica))).not.toMatch(/\{\w+\}/);
    expect(renderCopy("{cidade}", clinica, "")).toBe("Americana");
  });

  it("textos padrão sem vícios de IA (travessão, 'é importante', 'não é X, é Y')", () => {
    const all = [DEFAULT_WHATSAPP_OPENER, ...DEFAULT_EMAIL_STEPS.flatMap((s) => [s.subject, s.body]), emailHook(clinica), whatsappHook(clinica)].join("\n");
    expect(all).not.toMatch(/[—–]/);
    expect(all.toLowerCase()).not.toContain("é importante");
    expect(all.toLowerCase()).not.toMatch(/não é .{1,40}, é /);
  });

  it("gancho muda conforme o perfil no Google", () => {
    expect(whatsappHook({ ...clinica, website: "https://x.com.br" })).toContain("ideia pra trazer mais clientes");
    expect(whatsappHook({ ...clinica, website: "https://x.com.br", rating: 4.8 })).toContain("30 avaliações");
  });
});

describe("telefone de prospect", () => {
  it("acha o mesmo celular com e sem o 9 extra", () => {
    expect(phoneVariants("5519998765432")).toEqual(["5519998765432", "551998765432"]);
    expect(phoneVariants("551998765432")).toEqual(["551998765432", "5519998765432"]);
    expect(phoneVariants("551934612000")).toEqual(["551934612000"]);
  });

  it("só celular pode receber WhatsApp", () => {
    expect(isMobileBr("5519998765432")).toBe(true);
    expect(isMobileBr("551934612000")).toBe(false);
  });
});

describe("configuração", () => {
  it("valida e-mails e mantém os textos padrão quando vazio", () => {
    const config = mergeProspectingConfig({ email: { enabled: true, fromEmail: "invalido", replyTo: "eu@zenite.com", steps: [{ subject: "", body: "" }] } });
    expect(config.email.enabled).toBe(true);
    expect(config.email.fromEmail).toBe("");
    expect(config.email.replyTo).toBe("eu@zenite.com");
    expect(config.email.steps).toEqual(DEFAULT_EMAIL_STEPS);
  });
});
