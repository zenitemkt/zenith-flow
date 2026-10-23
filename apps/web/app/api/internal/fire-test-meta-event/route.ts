import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";
import { sendMetaCapiEvent } from "@/lib/meta-capi";

/**
 * Disparo único e temporário (2026-10-23) pra confirmar no Gerenciador de
 * Eventos que o evento personalizado FormSubmit chega — sem precisar de
 * sessão de admin nem de um envio de formulário de verdade. Protegido por
 * `INTERNAL_TEST_SECRET` (só pra esse teste pontual); remover depois.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_TEST_SECRET) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const connection = await prisma.adAccountConnection.findFirst({
    where: { platform: "META", status: "ACTIVE", metaPixelId: { not: null } },
  });
  if (!connection?.metaPixelId) return NextResponse.json({ error: "Nenhuma conexão Meta ativa com Pixel configurado." }, { status: 400 });

  const accessToken = decryptSecret(connection.accessTokenEnc);
  const eventId = `internal_test_${Date.now()}`;
  const results: Array<{ eventName: string; ok: boolean; error?: string }> = [];

  for (const eventName of ["Lead", "FormSubmit"]) {
    try {
      await sendMetaCapiEvent(connection.metaPixelId, accessToken, {
        eventName,
        eventId: `${eventId}-${eventName}`,
        occurredAt: new Date(),
        url: "https://hubzenite.com.br/orcamento",
        email: "teste-interno@hubzenite.com.br",
        clientUserAgent: "ZenithFlowDiagnosticoInterno/1.0",
        testEventCode: process.env.META_CAPI_TEST_EVENT_CODE || null,
      });
      results.push({ eventName, ok: true });
    } catch (error) {
      results.push({ eventName, ok: false, error: error instanceof Error ? error.message : "Erro desconhecido." });
    }
  }

  return NextResponse.json({ results });
}
