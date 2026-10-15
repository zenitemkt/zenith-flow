import { prisma } from "@zenite-mkt/db";
import { decryptSecret } from "./crypto-secrets";
import { githubListDir, type GithubRepoRef } from "./github-content";

export async function loadGithubRef(agencyId: string): Promise<GithubRepoRef> {
  const connection = await prisma.contentAutomationConnection.findUnique({ where: { agencyId } });
  if (!connection) throw new Error("Nenhuma conexão de automação de conteúdo configurada pra esta agência.");
  return {
    owner: connection.githubOwner,
    repo: connection.githubRepo,
    branch: connection.githubBranch,
    token: decryptSecret(connection.githubTokenEnc),
  };
}

export async function listExistingBlogSlugs(ref: GithubRepoRef): Promise<string[]> {
  const names = await githubListDir(ref, "content/blog");
  return names.filter((name) => name.endsWith(".mjs")).map((name) => name.replace(/\.mjs$/, ""));
}
