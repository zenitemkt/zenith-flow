import { redirect } from "next/navigation";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { ContentAutomationConnectionForm } from "./ContentAutomationConnectionForm";
import { SearchConsoleConnectionCard } from "./SearchConsoleConnectionCard";
import { BlogDraftCard, type BlogDraftSummary } from "./BlogDraftCard";

export default async function BlogAutomationPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");

  const [connection, searchConsole, drafts] = await Promise.all([
    prisma.contentAutomationConnection.findUnique({ where: { agencyId: membership.agencyId } }),
    prisma.searchConsoleConnection.findUnique({ where: { agencyId: membership.agencyId } }),
    prisma.blogDraft.findMany({
      where: { agencyId: membership.agencyId },
      orderBy: { createdAt: "desc" },
      include: { comments: { orderBy: { createdAt: "desc" } } },
      take: 50,
    }),
  ]);

  const pending = drafts.filter((d) => d.status === "PENDING");
  const reviewed = drafts.filter((d) => d.status !== "PENDING");

  const toSummary = (draft: (typeof drafts)[number]): BlogDraftSummary => ({
    id: draft.id,
    slug: draft.slug,
    title: draft.title,
    excerpt: draft.excerpt,
    content: draft.content,
    seoTitle: draft.seoTitle,
    focusKeyword: draft.focusKeyword,
    category: draft.category,
    cover: draft.cover,
    status: draft.status,
    origin: draft.origin,
    createdAt: draft.createdAt.toISOString(),
    comments: draft.comments.map((c) => ({ id: c.id, body: c.body, status: c.status, agentReply: c.agentReply, createdAt: c.createdAt.toISOString() })),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Blog automático</h1>
        <p className="text-sm text-[#667085]">
          O agente externo (rotina agendada) escreve os rascunhos; nada publica sozinho por enquanto — revise e aprove aqui.
        </p>
      </div>

      <ContentAutomationConnectionForm
        connected={Boolean(connection)}
        githubOwner={connection?.githubOwner ?? null}
        githubRepo={connection?.githubRepo ?? null}
        githubBranch={connection?.githubBranch ?? null}
      />

      <SearchConsoleConnectionCard
        connected={Boolean(searchConsole)}
        siteUrl={searchConsole?.siteUrl ?? null}
        lastError={searchConsole?.lastError ?? null}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[#101828]">Pendentes ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-6 text-center text-sm text-[#667085]">Nenhum rascunho pendente.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((draft) => (
              <BlogDraftCard key={draft.id} draft={toSummary(draft)} />
            ))}
          </div>
        )}
      </section>

      {reviewed.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Histórico</h2>
          <div className="flex flex-col gap-3">
            {reviewed.map((draft) => (
              <BlogDraftCard key={draft.id} draft={toSummary(draft)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
