import { describe, expect, it } from "vitest";
import { campaignStatusFromMeta } from "./meta-ads";

const NOW = new Date("2026-11-12T15:00:00.000Z");

describe("campanhas da Meta — situação → status do sistema", () => {
  it("ligada na Meta é Ativa; pausada é Pausada; arquivada e excluída são Encerrada", () => {
    expect(campaignStatusFromMeta("ACTIVE", null, NOW)).toBe("ATIVA");
    expect(campaignStatusFromMeta("WITH_ISSUES", null, NOW)).toBe("ATIVA");
    expect(campaignStatusFromMeta("PAUSED", null, NOW)).toBe("PAUSADA");
    expect(campaignStatusFromMeta("ARCHIVED", null, NOW)).toBe("ENCERRADA");
    expect(campaignStatusFromMeta("DELETED", null, NOW)).toBe("ENCERRADA");
  });

  it("ligada com data de término no passado é Encerrada (Concluída no Gerenciador)", () => {
    expect(campaignStatusFromMeta("ACTIVE", "2026-11-10T23:59:00-0300", NOW)).toBe("ENCERRADA");
    expect(campaignStatusFromMeta("ACTIVE", "2026-12-01T23:59:00-0300", NOW)).toBe("ATIVA");
  });

  it("situação desconhecida não altera o que está salvo", () => {
    expect(campaignStatusFromMeta("", null, NOW)).toBeNull();
    expect(campaignStatusFromMeta("ALGO_NOVO", null, NOW)).toBeNull();
  });
});
