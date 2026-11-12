/**
 * Cliente mínimo da GitHub Contents API — usado pela automação de blog pra
 * ler/escrever arquivos no repositório do site do cliente (ex.: zenitehub),
 * sem precisar do `git` instalado no runtime serverless (só `fetch`).
 */

const GITHUB_API = "https://api.github.com";

export interface GithubRepoRef {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

export class GithubContentError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function githubFetch(ref: GithubRepoRef, path: string, init?: RequestInit): Promise<Response> {
  const url = `${GITHUB_API}/repos/${ref.owner}/${ref.repo}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${ref.token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });
  return response;
}

/** `null` quando o arquivo não existe (404) — útil pra decidir criar vs. atualizar. */
export async function githubGetFile(ref: GithubRepoRef, filePath: string): Promise<{ content: string; sha: string } | null> {
  const response = await githubFetch(ref, `/contents/${filePath}?ref=${encodeURIComponent(ref.branch)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new GithubContentError(`Falha ao ler ${filePath}: ${response.status}`, response.status);
  const data = (await response.json()) as { content: string; sha: string; encoding: string };
  if (data.encoding !== "base64") throw new GithubContentError(`Encoding inesperado pra ${filePath}: ${data.encoding}`, 500);
  return { content: Buffer.from(data.content, "base64").toString("utf8"), sha: data.sha };
}

export async function githubListDir(ref: GithubRepoRef, dirPath: string): Promise<string[]> {
  const response = await githubFetch(ref, `/contents/${dirPath}?ref=${encodeURIComponent(ref.branch)}`);
  if (response.status === 404) return [];
  if (!response.ok) throw new GithubContentError(`Falha ao listar ${dirPath}: ${response.status}`, response.status);
  const data = (await response.json()) as Array<{ name: string; type: string }>;
  return data.filter((entry) => entry.type === "file").map((entry) => entry.name);
}

export interface GithubFileWrite {
  path: string;
  /** Texto é UTF-8; binário (ex.: JPEG) precisa vir como `Buffer`, nunca como string decodificada. */
  content: string | Buffer;
}

/**
 * Cria ou atualiza um arquivo (precisa do `sha` atual pra atualizar — busca sozinho se não vier).
 * Faz uma segunda tentativa em caso de falha (hiccup transitório da API do GitHub ou sha
 * desatualizado) — achado em produção: um publish de blog com ~7 commits sequenciais travou no
 * penúltimo arquivo e deixou o rascunho "publicado pela metade" (html foi, SVG de capa não).
 */
export async function githubPutFile(ref: GithubRepoRef, write: GithubFileWrite, message: string, existingSha?: string | null): Promise<void> {
  const attempt = async (shaHint: string | null | undefined): Promise<void> => {
    let sha = shaHint;
    if (sha === undefined) {
      const existing = await githubGetFile(ref, write.path);
      sha = existing?.sha ?? null;
    }
    const base64Content = Buffer.isBuffer(write.content) ? write.content.toString("base64") : Buffer.from(write.content, "utf8").toString("base64");
    const response = await githubFetch(ref, `/contents/${write.path}`, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: base64Content,
        branch: ref.branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new GithubContentError(`Falha ao commitar ${write.path}: ${response.status} ${body}`, response.status);
    }
  };

  try {
    await attempt(existingSha);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await attempt(undefined); // busca o sha de novo — pode ter mudado entre as duas tentativas
  }
}

/** Commita vários arquivos em sequência (a Contents API não tem endpoint batch simples sem usar a Git Data API de baixo nível). */
export async function githubPutFiles(ref: GithubRepoRef, writes: GithubFileWrite[], message: string): Promise<void> {
  for (const write of writes) {
    await githubPutFile(ref, write, message);
  }
}

/**
 * Commita vários arquivos num ÚNICO commit pela Git Data API (blobs → tree → commit → ref).
 * Tudo ou nada: ou todos os arquivos entram juntos, ou nenhum (o ref só anda no fim).
 * Um commit = um deploy na Vercel (antes eram ~8 commits e ~8 deploys por artigo).
 * Tenta duas vezes; se o branch andou no meio (422 no PATCH do ref), recomeça do commit novo.
 */
export async function githubCommitFiles(ref: GithubRepoRef, writes: GithubFileWrite[], message: string): Promise<string> {
  const json = async <T>(response: Response, what: string): Promise<T> => {
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new GithubContentError(`Falha ao ${what}: ${response.status} ${body.slice(0, 300)}`, response.status);
    }
    return (await response.json()) as T;
  };
  const attempt = async (): Promise<string> => {
    const head = await json<{ object: { sha: string } }>(await githubFetch(ref, `/git/ref/heads/${encodeURIComponent(ref.branch)}`), "ler o branch");
    const parent = await json<{ tree: { sha: string } }>(await githubFetch(ref, `/git/commits/${head.object.sha}`), "ler o commit atual");
    const tree = [];
    for (const write of writes) {
      const content = Buffer.isBuffer(write.content) ? write.content.toString("base64") : Buffer.from(write.content, "utf8").toString("base64");
      const blob = await json<{ sha: string }>(
        await githubFetch(ref, "/git/blobs", { method: "POST", body: JSON.stringify({ content, encoding: "base64" }) }),
        `enviar ${write.path}`,
      );
      tree.push({ path: write.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const newTree = await json<{ sha: string }>(
      await githubFetch(ref, "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: parent.tree.sha, tree }) }),
      "montar a árvore",
    );
    const commit = await json<{ sha: string }>(
      await githubFetch(ref, "/git/commits", { method: "POST", body: JSON.stringify({ message, tree: newTree.sha, parents: [head.object.sha] }) }),
      "criar o commit",
    );
    await json(
      await githubFetch(ref, `/git/refs/heads/${encodeURIComponent(ref.branch)}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) }),
      "atualizar o branch",
    );
    return commit.sha;
  };
  try {
    return await attempt();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return attempt();
  }
}
