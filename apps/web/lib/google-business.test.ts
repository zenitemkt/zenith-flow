import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGoogleBusinessAuthorizeUrl, getGoogleBusinessRedirectUri, googleBusinessConfigured, googleBusinessLocationParent, publishGoogleBusinessLocalPost } from "./google-business";

afterEach(() => vi.unstubAllEnvs());

describe("Google Business OAuth", () => {
  it("usa o callback público e solicita acesso offline", () => {
    vi.stubEnv("GOOGLE_BUSINESS_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_BUSINESS_CLIENT_SECRET", "client-secret");
    vi.stubEnv("MAIN_APP_URL", "https://portal.hubzenite.com.br");
    const url = new URL(buildGoogleBusinessAuthorizeUrl("state-signed"));
    expect(url.searchParams.get("redirect_uri")).toBe(getGoogleBusinessRedirectUri());
    expect(url.searchParams.get("scope")).toContain("business.manage");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("state-signed");
  });

  it("fica desativado enquanto as credenciais não existem", () => {
    vi.stubEnv("GOOGLE_BUSINESS_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_BUSINESS_CLIENT_SECRET", "");
    expect(googleBusinessConfigured()).toBe(false);
  });
  it("normaliza a localização no formato esperado pela API", () => {
    expect(googleBusinessLocationParent("123", "456")).toBe("accounts/123/locations/456");
    expect(googleBusinessLocationParent("accounts/123", "locations/456")).toBe("accounts/123/locations/456");
  });

  it("monta uma publicação padrão com foto e botão", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ name: "accounts/1/locations/2/localPosts/3", searchUrl: "https://google.com/post" }) });
    vi.stubGlobal("fetch", fetchMock);
    await publishGoogleBusinessLocalPost("token", { parent: "accounts/1/locations/2", summary: "Novidade", mediaUrl: "https://cdn.test/foto.jpg", callToAction: "LEARN_MORE", callToActionUrl: "https://hubzenite.com.br" });
    const request = fetchMock.mock.calls[0]!;
    expect(request[0]).toBe("https://mybusiness.googleapis.com/v4/accounts/1/locations/2/localPosts");
  });
});
