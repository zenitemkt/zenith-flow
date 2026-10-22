import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import path from "node:path";
import type { BlogDraft } from "@zenite-mkt/db";
import { githubGetFile, githubListDir, githubPutFile, type GithubRepoRef } from "./github-content";
import { findAndDownloadCommonsPhoto } from "./commons-photo";

export interface PublishBlogDraftInput {
  draft: BlogDraft; // draft.cover precisa ser uma das 12 chaves fixas de arte SVG (seo, indexacao, inbound, ...)
  coverSearchTerm: string; // termo (de preferência em inglês) pra busca no Wikimedia Commons
  related: string[]; // 1-3 slugs relacionados já existentes
  faq: Array<{ q: string; a: string }>;
  /** true numa republicação por edição pós-aprovação (seção "revisions") — o texto mudou, a foto não precisa mudar junto. */
  skipCoverPhoto?: boolean;
}

/** Data de escrita (criação do rascunho), não de aprovação — e no fuso de Brasília, não UTC (virava o dia errado depois das 21h). */
function writingDate(createdAt: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(createdAt);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function buildMjsSource(input: PublishBlogDraftInput, preservedDate?: string): string {
  const { draft } = input;
  const isRefresh = draft.origin === "refresh" && preservedDate;
  const fields: Record<string, unknown> = {
    slug: draft.slug,
    title: draft.title,
    description: draft.excerpt,
    category: draft.category ?? "Marketing Digital",
    date: isRefresh ? preservedDate : writingDate(draft.createdAt),
    ...(isRefresh ? { modifiedDate: writingDate(draft.createdAt) } : {}),
    cover: draft.cover ?? "seo",
    keyword: draft.focusKeyword ?? "",
    answer: draft.excerpt,
    related: input.related,
    faq: input.faq,
  };
  const fieldLines = Object.entries(fields)
    .map(([key, value]) => `  ${key}: ${JSON.stringify(value, null, 2).replace(/\n/g, "\n  ")},`)
    .join("\n");
  // O corpo entra como template literal cru (igual aos posts já existentes,
  // que usam markdown com crases/tabelas) — só escapa o que quebraria a
  // sintaxe do próprio template literal (crase e `${`), nunca o markdown em si.
  const escapedBody = draft.content.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  return `export default {\n${fieldLines}\n  body: \`\n${escapedBody}\n\`,\n};\n`;
}

/**
 * Publica um `BlogDraft` aprovado: busca os arquivos necessários do repo do
 * site, escreve o `.mjs` novo + credita a foto do Commons, roda o
 * `tools/generate-blog.mjs` de verdade (sem reimplementar a lógica dele em
 * TypeScript — zero risco de divergir do gerador real) e commita só o que
 * de fato mudou.
 */
export async function publishBlogDraft(ref: GithubRepoRef, input: PublishBlogDraftInput): Promise<{ commitPaths: string[] }> {
  const workDir = mkdtempSync(path.join(tmpdir(), "blog-publish-"));
  try {
    const contentBlogDir = path.join(workDir, "content", "blog");
    const toolsDir = path.join(workDir, "tools");
    const distDir = path.join(workDir, "dist");
    mkdirSync(contentBlogDir, { recursive: true });
    mkdirSync(toolsDir, { recursive: true });
    mkdirSync(path.join(distDir, "assets", "blog", "photos"), { recursive: true });

    // 1. Busca o gerador real e todos os posts existentes.
    const generatorSource = await githubGetFile(ref, "tools/generate-blog.mjs");
    if (!generatorSource) throw new Error("tools/generate-blog.mjs não encontrado no repositório — publicação cancelada.");
    writeFileSync(path.join(toolsDir, "generate-blog.mjs"), generatorSource.content, "utf8");

    const existingMjsNames = await githubListDir(ref, "content/blog");
    const beforeFiles = new Map<string, string>(); // path relativo -> conteúdo original (pra diff depois)
    const existingSlugs: string[] = [];
    for (const name of existingMjsNames) {
      if (!name.endsWith(".mjs") && name !== "photo-credits.json") continue;
      const file = await githubGetFile(ref, `content/blog/${name}`);
      if (!file) continue;
      writeFileSync(path.join(contentBlogDir, name), file.content, "utf8");
      beforeFiles.set(`content/blog/${name}`, file.content);
      if (name.endsWith(".mjs")) existingSlugs.push(name.replace(/\.mjs$/, ""));
    }
    if (!beforeFiles.has("content/blog/photo-credits.json")) {
      writeFileSync(path.join(contentBlogDir, "photo-credits.json"), "{}\n", "utf8");
    }

    // "refresh" preserva a data original de publicação (seção 2.5 do
    // Blueprint) — lê do próprio arquivo .mjs já existente pra esse slug,
    // antes de sobrescrevê-lo no passo 3.
    let preservedDate: string | undefined;
    if (input.draft.origin === "refresh") {
      const existingPath = path.join(contentBlogDir, `${input.draft.slug}.mjs`);
      if (existsSync(existingPath)) {
        const mod = await import(pathToFileURL(existingPath).href + `?t=${Date.now()}`);
        if (typeof mod.default?.date === "string") preservedDate = mod.default.date;
      }
    }

    // Snapshot do HTML/SVG já publicado de cada post existente — só pra
    // comparar depois e não recommitar arquivo que o gerador reescreveu
    // idêntico (ele regenera TODO post a cada rodada, não só o novo).
    for (const slug of existingSlugs) {
      const articlePage = await githubGetFile(ref, `dist/blog/${slug}/index.html`);
      if (articlePage) beforeFiles.set(`dist/blog/${slug}/index.html`, articlePage.content);
      const cover = await githubGetFile(ref, `dist/assets/blog/${slug}.svg`);
      if (cover) beforeFiles.set(`dist/assets/blog/${slug}.svg`, cover.content);
    }

    const distIndex = await githubGetFile(ref, "dist/index.html");
    const sitemap = await githubGetFile(ref, "dist/sitemap.xml");
    if (!distIndex || !sitemap) throw new Error("dist/index.html ou dist/sitemap.xml ausente no repositório — publicação cancelada.");
    writeFileSync(path.join(distDir, "index.html"), distIndex.content, "utf8");
    beforeFiles.set("dist/index.html", distIndex.content);
    writeFileSync(path.join(distDir, "sitemap.xml"), sitemap.content, "utf8");
    beforeFiles.set("dist/sitemap.xml", sitemap.content);

    // 2. Foto real do Wikimedia Commons (mesma fonte do site, busca
    // automática) — pulado numa republicação por edição de texto
    // (`skipCoverPhoto`): a foto já publicada continua valendo, sem refazer
    // a busca (que pode falhar por motivo alheio ao texto corrigido).
    const creditsPath = path.join(contentBlogDir, "photo-credits.json");
    let photo: Awaited<ReturnType<typeof findAndDownloadCommonsPhoto>> | null = null;
    if (!input.skipCoverPhoto) {
      photo = await findAndDownloadCommonsPhoto(input.draft.slug, input.coverSearchTerm);
      writeFileSync(path.join(distDir, "assets", "blog", "photos", `${input.draft.slug}.jpg`), photo.jpegBuffer);
      const credits = JSON.parse(readFileSync(creditsPath, "utf8")) as Record<string, unknown>;
      credits[input.draft.slug] = {
        alt: photo.alt,
        author: photo.author,
        license: photo.license,
        licenseUrl: photo.licenseUrl,
        source: "Wikimedia Commons",
        sourceUrl: photo.sourceUrl,
      };
      writeFileSync(creditsPath, JSON.stringify(credits, null, 2) + "\n", "utf8");
    }

    // 3. Escreve o artigo (novo, atualizado ou corrigido).
    const mjsSource = buildMjsSource(input, preservedDate);
    const mjsPath = path.join(contentBlogDir, `${input.draft.slug}.mjs`);
    writeFileSync(mjsPath, mjsSource, "utf8");

    // 4. Roda o gerador de verdade — mesma lógica, sem duplicar em TS.
    execFileSync(process.execPath, [path.join(toolsDir, "generate-blog.mjs")], {
      cwd: workDir,
      stdio: "pipe",
    });

    // 5. Lê de volta tudo que o gerador escreveu/mudou e monta a lista de commit.
    const writes: Array<{ path: string; content: string | Buffer }> = [];
    const addIfChanged = (relPath: string, absPath: string) => {
      if (!existsSync(absPath)) return;
      const content = readFileSync(absPath);
      const before = beforeFiles.get(relPath);
      if (before !== undefined && Buffer.from(before, "utf8").equals(content)) return; // sem mudança, não commita
      writes.push({ path: relPath, content });
    };

    addIfChanged("content/blog/" + `${input.draft.slug}.mjs`, mjsPath);
    if (photo) {
      addIfChanged("content/blog/photo-credits.json", creditsPath);
      writes.push({ path: `dist/assets/blog/photos/${input.draft.slug}.jpg`, content: photo.jpegBuffer });
    }
    addIfChanged("dist/index.html", path.join(distDir, "index.html"));
    addIfChanged("dist/sitemap.xml", path.join(distDir, "sitemap.xml"));
    addIfChanged("dist/blog/index.html", path.join(distDir, "blog", "index.html"));

    const slugDirs = readdirSync(path.join(distDir, "blog"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    for (const slug of slugDirs) {
      addIfChanged(`dist/blog/${slug}/index.html`, path.join(distDir, "blog", slug, "index.html"));
    }
    const svgFiles = readdirSync(path.join(distDir, "assets", "blog")).filter((name) => name.endsWith(".svg"));
    for (const svgName of svgFiles) {
      addIfChanged(`dist/assets/blog/${svgName}`, path.join(distDir, "assets", "blog", svgName));
    }

    // Cada arquivo commita de forma independente: uma falha isolada (ex.: hiccup
    // da API do GitHub num arquivo do meio da lista) não pode impedir os
    // arquivos seguintes de ir — foi exatamente isso que deixou um artigo
    // publicado sem a capa SVG (ela é sempre o último item da lista) numa
    // falha real em produção. githubPutFile já tenta de novo uma vez sozinho;
    // aqui só evitamos que um `throw` no meio pare os demais.
    const verb = input.skipCoverPhoto ? "corrige" : input.draft.origin === "refresh" ? "atualiza" : "publica";
    const message = `feat(blog): ${verb} "${input.draft.title}" (${input.draft.slug})`;
    const failed: Array<{ path: string; error: string }> = [];
    for (const write of writes) {
      try {
        await githubPutFile(ref, { path: write.path, content: write.content }, message);
      } catch (error) {
        failed.push({ path: write.path, error: error instanceof Error ? error.message : String(error) });
      }
    }
    if (failed.length > 0) {
      const detail = failed.map((f) => `${f.path}: ${f.error}`).join(" | ");
      throw new Error(`${failed.length} de ${writes.length} arquivo(s) não foram commitados mesmo após nova tentativa: ${detail}`);
    }

    return { commitPaths: writes.map((w) => w.path) };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
