import { beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto-secrets";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

describe("cofre de credenciais de integração (AES-256-GCM)", () => {
  beforeEach(() => {
    process.env.INTEGRATIONS_ENCRYPTION_KEY = TEST_KEY;
  });

  it("decifra exatamente o que foi cifrado", () => {
    const token = "EAABsbCS1234567890abcdefTOKENDEEXEMPLO";
    const stored = encryptSecret(token);
    expect(decryptSecret(stored)).toBe(token);
  });

  it("nunca repete o texto cifrado pro mesmo valor (IV aleatório por chamada)", () => {
    const a = encryptSecret("mesmo-valor");
    const b = encryptSecret("mesmo-valor");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("mesmo-valor");
    expect(decryptSecret(b)).toBe("mesmo-valor");
  });

  it("rejeita texto cifrado adulterado (autenticação do GCM)", () => {
    const stored = encryptSecret("token-secreto");
    const parts = stored.split(":");
    // troca um caractere do ciphertext — deve falhar na verificação do authTag, não devolver lixo.
    const tampered = [parts[0], parts[1], parts[2], parts[3]!.slice(0, -4) + "AAAA"].join(":");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rejeita decifrar com a chave errada", () => {
    const stored = encryptSecret("token-secreto");
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    expect(() => decryptSecret(stored)).toThrow();
  });

  it("recusa formato desconhecido", () => {
    expect(() => decryptSecret("texto-qualquer-nao-criptografado")).toThrow();
  });

  it("exige INTEGRATIONS_ENCRYPTION_KEY configurada", () => {
    delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(/INTEGRATIONS_ENCRYPTION_KEY/);
  });
});
