import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGooglePlace, searchGooglePlaces } from "./google-places";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Google Places de concorrentes", () => {
  it("pesquisa somente identificação e endereço, sem cobrar detalhes a cada busca", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ places: [{ id: "place_12345", displayName: { text: "Zenite" }, formattedAddress: "Americana, SP" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(searchGooglePlaces("Zenite Americana")).resolves.toEqual([{ id: "place_12345", name: "Zenite", address: "Americana, SP" }]);
    expect(fetchMock.mock.calls[0]?.[1]?.headers["X-Goog-FieldMask"]).toBe("places.id,places.displayName,places.formattedAddress");
  });

  it("busca nota e quantidade sem baixar textos de avaliações", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "place_12345", displayName: { text: "Zenite" }, rating: 4.8, userRatingCount: 71 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchGooglePlace("place_12345")).resolves.toMatchObject({ rating: 4.8, reviewCount: 71 });
    expect(fetchMock.mock.calls[0]?.[1]?.headers["X-Goog-FieldMask"]).not.toContain("reviews");
  });

  it("não expõe chamada externa quando falta a chave", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    await expect(searchGooglePlaces("empresa cidade")).rejects.toThrow("GOOGLE_PLACES_API_KEY");
  });
});
