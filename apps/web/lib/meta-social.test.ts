import { afterEach, describe, expect, it, vi } from "vitest";
import { MetaApiError } from "./meta-ads";
import { RetryableSocialError, finishInstagramContainer, isIgMediaNotReadyError } from "./meta-social";

const NOT_READY = {
  error: { message: "A mídia não está pronta para ser publicada. Aguarde um momento.", code: 9007, error_subcode: 2207027 },
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Responde por endpoint: status do container sempre FINISHED; media_publish segue a fila dada. */
function mockGraph(publishResponses: Response[]) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/media_publish")) return publishResponses.shift() ?? json(500, { error: { message: "sem resposta" } });
      if (url.includes("fields=permalink")) return json(200, { permalink: "https://instagram.com/p/abc" });
      return json(200, { status_code: "FINISHED" });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Instagram — mídia ainda não pronta (9007)", () => {
  it("reconhece o erro pela code ou subcode", () => {
    expect(isIgMediaNotReadyError(new MetaApiError("x", 400, NOT_READY))).toBe(true);
    expect(isIgMediaNotReadyError(new MetaApiError("x", 400, { error: { code: 100 } }))).toBe(false);
    expect(isIgMediaNotReadyError(new Error("x"))).toBe(false);
  });

  it("espera e publica o MESMO container de novo", async () => {
    vi.useFakeTimers();
    const calls = mockGraph([json(400, NOT_READY), json(200, { id: "ig-post-1" })]);
    const promise = finishInstagramContainer({ igUserId: "ig1", token: "t", containerId: "c1", budgetMs: 30_000 });
    await vi.advanceTimersByTimeAsync(6_000);
    await expect(promise).resolves.toEqual({ externalPostId: "ig-post-1", permalink: "https://instagram.com/p/abc" });
    expect(calls.filter((u) => u.includes("/media_publish"))).toHaveLength(2);
  });

  it("sem tempo: devolve o container para o cron terminar, sem recriar a mídia", async () => {
    mockGraph([json(400, NOT_READY)]);
    const error = await finishInstagramContainer({ igUserId: "ig1", token: "t", containerId: "c1", budgetMs: 1_000 }).catch((e) => e);
    expect(error).toBeInstanceOf(RetryableSocialError);
    expect((error as RetryableSocialError).containerId).toBe("c1");
  });

  it("outros erros da Meta continuam subindo", async () => {
    mockGraph([json(400, { error: { message: "Formato inválido", code: 36003 } })]);
    await expect(finishInstagramContainer({ igUserId: "ig1", token: "t", containerId: "c1", budgetMs: 30_000 })).rejects.toBeInstanceOf(MetaApiError);
  });
});
