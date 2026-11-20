import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@zenite-mkt/db", () => ({ prisma: {} }));
vi.mock("@/lib/assistant/agent", () => ({ loadAssistant: vi.fn() }));
vi.mock("@/lib/assistant/notify", () => ({ notifyPartners: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));

const { OPT_OUT_REPLY, verifyResendWebhook } = await import("./inbound");

const secretBytes = Buffer.from("segredo-de-teste-123");
const secret = `whsec_${secretBytes.toString("base64")}`;
const sign = (id: string, ts: string, body: string) => `v1,${createHmac("sha256", secretBytes).update(`${id}.${ts}.${body}`).digest("base64")}`;

describe("webhook de resposta de e-mail (Resend/Svix)", () => {
  const body = JSON.stringify({ type: "email.received", data: { email_id: "x" } });
  const now = 1_800_000_000_000;
  const ts = String(now / 1000);

  it("aceita assinatura válida", () => {
    const headers = new Headers({ "svix-id": "msg_1", "svix-timestamp": ts, "svix-signature": sign("msg_1", ts, body) });
    expect(verifyResendWebhook(body, headers, secret, now)).toBe(true);
  });

  it("recusa corpo alterado, assinatura de outro segredo e horário muito antigo", () => {
    const good = sign("msg_1", ts, body);
    expect(verifyResendWebhook(`${body} `, new Headers({ "svix-id": "msg_1", "svix-timestamp": ts, "svix-signature": good }), secret, now)).toBe(false);
    expect(verifyResendWebhook(body, new Headers({ "svix-id": "msg_1", "svix-timestamp": ts, "svix-signature": good }), "whsec_b3V0cm8=", now)).toBe(false);
    expect(verifyResendWebhook(body, new Headers({ "svix-id": "msg_1", "svix-timestamp": ts, "svix-signature": good }), secret, now + 10 * 60_000)).toBe(false);
  });
});

describe("resposta pedindo pra sair", () => {
  it("reconhece pedido de remoção e não confunde com interesse", () => {
    expect(OPT_OUT_REPLY.test("Por favor, me remova da lista")).toBe(true);
    expect(OPT_OUT_REPLY.test("Não temos interesse, obrigado")).toBe(true);
    expect(OPT_OUT_REPLY.test("Oi! Tenho interesse sim, pode me ligar amanhã?")).toBe(false);
  });
});
