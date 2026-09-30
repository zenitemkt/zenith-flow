import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cofre genérico pra credenciais de integração de terceiros guardadas por
 * agência no banco (ex.: token OAuth da Meta, seção 38 do manual — Google
 * Ads reaproveita depois). AES-256-GCM: autenticado (detecta adulteração do
 * texto cifrado, não só decifra), IV aleatório por chamada (nunca reusar IV
 * com a mesma chave). Formato de armazenamento: uma única string
 * `v1:<iv base64>:<authTag base64>:<ciphertext base64>` — versionada no
 * prefixo pra permitir trocar de algoritmo no futuro sem quebrar linhas já
 * gravadas.
 *
 * `INTEGRATIONS_ENCRYPTION_KEY` é uma chave mestra única (32 bytes em
 * base64), nunca a mesma do `BETTER_AUTH_SECRET` — comprometer uma não deve
 * comprometer a outra. Nunca logar o valor decifrado.
 */

const ALGORITHM = "aes-256-gcm";
const FORMAT_VERSION = "v1";
const IV_LENGTH = 12; // recomendado pro GCM (96 bits)

function loadMasterKey(): Buffer {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "INTEGRATIONS_ENCRYPTION_KEY não configurada — necessária pra guardar credenciais de integração. Gerar com: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("INTEGRATIONS_ENCRYPTION_KEY inválida — precisa decodificar (base64) para exatamente 32 bytes.");
  }
  return key;
}

export function encryptSecret(plainText: string): string {
  const key = loadMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [FORMAT_VERSION, iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new Error("Formato de credencial criptografada não reconhecido.");
  }
  const [, ivB64, authTagB64, ciphertextB64] = parts;
  const key = loadMasterKey();
  const iv = Buffer.from(ivB64!, "base64");
  const authTag = Buffer.from(authTagB64!, "base64");
  const ciphertext = Buffer.from(ciphertextB64!, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
