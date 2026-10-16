/**
 * Busca automática de foto de capa no Wikimedia Commons — mesma fonte que o
 * Zenite Hub já usa hoje (`tools/fetch-blog-photos.mjs`), só que lá é um
 * mapa fixo slug→arquivo escolhido à mão; aqui busca pelo termo de busca que
 * o agente escreve pro artigo (`coverSearchTerm`, de preferência em inglês —
 * Commons indexa melhor assim). Sem chave de API, sem custo.
 */

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "ZeniteFlowBlogAutomation/1.0 (contato gabri.espi@hotmail.com)";

/** Mesmo espírito do filtro de "termos bloqueados" do blueprint (seção 2.6) — evita foto errada por acidente. */
const BANNED_ALT_TERMS = [/beer|wine|whisky|vodka|cerveja|vinho|alcohol|cigarette|cigarro|nude|naked/i];

/**
 * Achado em produção (2026-10-16): termos neutros de escritório ("cluttered
 * desk", "office corner") batem com fotos de evidência do caso Epstein (lote
 * "EFTA..." liberado pelo DOJ/FBI em dez/2025) por coincidência de descrição,
 * não por conteúdo visual relacionado. Bloqueia pelo título/descrição/autor
 * qualquer coisa ligada a prova criminal, não só termos de bebida/nudez.
 */
const BANNED_SENSITIVE_TERMS = [
  /\bEFTA\d/i,
  /epstein/i,
  /\bDOJ\b/i,
  /\bFBI\b/i,
  /crime scene/i,
  /evidence (photo|file)/i,
  /court exhibit/i,
  /department of justice/i,
];

/** `list=search` no namespace de arquivo devolve qualquer tipo (PDF, SVG, áudio...), não só foto — filtra pela extensão real. */
const PHOTO_EXTENSION_PATTERN = /\.(jpe?g|png)$/i;

export interface CommonsPhotoResult {
  slug: string;
  file: string;
  thumbUrl: string;
  jpegBuffer: Buffer;
  alt: string;
  author: string;
  license: string | null;
  licenseUrl: string;
  sourceUrl: string;
}

interface CommonsSearchHit {
  title: string;
}

interface CommonsImageInfo {
  thumburl?: string;
  descriptionurl?: string;
  extmetadata?: {
    ImageDescription?: { value?: string };
    Artist?: { value?: string };
    LicenseShortName?: { value?: string };
    LicenseUrl?: { value?: string };
  };
}

function stripHtml(value: string | undefined): string {
  return (value ?? "").replace(/<[^>]+>/g, "").trim();
}

async function searchCommonsFiles(term: string, limit = 20): Promise<string[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    list: "search",
    srnamespace: "6", // File namespace
    srlimit: String(limit),
    srsearch: term,
  });
  const response = await fetch(`${COMMONS_API}?${params}`, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Busca no Commons falhou: ${response.status}`);
  const data = (await response.json()) as { query?: { search?: CommonsSearchHit[] } };
  return (data.query?.search ?? []).map((hit) => hit.title);
}

async function getImageInfo(fileTitle: string): Promise<CommonsImageInfo | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    titles: fileTitle,
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
    iiurlwidth: "1600",
  });
  const response = await fetch(`${COMMONS_API}?${params}`, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) return null;
  const data = (await response.json()) as { query?: { pages?: Record<string, { imageinfo?: CommonsImageInfo[] }> } };
  const page = Object.values(data.query?.pages ?? {})[0];
  return page?.imageinfo?.[0] ?? null;
}

/**
 * Busca `searchTerm` no Commons, tenta os primeiros resultados em ordem até
 * achar um com licença livre e sem termo bloqueado no alt/descrição, baixa
 * o JPEG e devolve pronto pra gravar em disco + registrar o crédito.
 */
export async function findAndDownloadCommonsPhoto(slug: string, searchTerm: string): Promise<CommonsPhotoResult> {
  const candidates = await searchCommonsFiles(searchTerm);
  if (candidates.length === 0) throw new Error(`Nenhum resultado no Commons pra "${searchTerm}"`);

  for (const title of candidates) {
    if (!PHOTO_EXTENSION_PATTERN.test(title)) continue; // pula PDF/SVG/áudio/etc. — só foto de verdade
    if (BANNED_SENSITIVE_TERMS.some((pattern) => pattern.test(title))) continue;
    const info = await getImageInfo(title);
    if (!info?.thumburl) continue;
    const alt = stripHtml(info.extmetadata?.ImageDescription?.value) || searchTerm;
    const artist = stripHtml(info.extmetadata?.Artist?.value);
    if (BANNED_ALT_TERMS.some((pattern) => pattern.test(alt))) continue;
    if (BANNED_SENSITIVE_TERMS.some((pattern) => pattern.test(alt) || pattern.test(artist))) continue;
    const license = info.extmetadata?.LicenseShortName?.value ?? null;
    if (!license) continue; // sem licença identificada no metadata, pula por segurança

    const imageResponse = await fetch(info.thumburl, { headers: { "user-agent": USER_AGENT } });
    if (!imageResponse.ok) continue;
    const jpegBuffer = Buffer.from(await imageResponse.arrayBuffer());

    return {
      slug,
      file: title.replace(/^File:/, ""),
      thumbUrl: info.thumburl,
      jpegBuffer,
      alt,
      author: stripHtml(info.extmetadata?.Artist?.value) || "Wikimedia Commons",
      license,
      licenseUrl: info.extmetadata?.LicenseUrl?.value ?? "",
      sourceUrl: info.descriptionurl ?? "",
    };
  }

  throw new Error(`Nenhum resultado utilizável no Commons pra "${searchTerm}" (licença ausente ou termo bloqueado)`);
}
