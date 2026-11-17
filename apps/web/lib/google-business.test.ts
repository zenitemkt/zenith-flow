import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGoogleBusinessAuthorizeUrl, getGoogleBusinessRedirectUri, googleBusinessConfigured } from "./google-business";

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
});
