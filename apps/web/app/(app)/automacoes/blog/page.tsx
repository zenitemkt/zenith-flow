import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { BlogSettingsForm } from "./BlogSettingsForm";
import { BlogDraftCard, type BlogDraftSummary } from "./BlogDraftCard";
import { ManualBlogRecordForm } from "./ManualBlogRecordForm";

export default async function BlogAutomationPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");

  const [agency, drafts] = await Promise.all([
    prisma.agency.findUnique({ where: { id: membership.agencyId }, select: { blogAutoPublish: true, blogVoiceNotes: true } }),
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
    reviewedAt: draft.reviewedAt ? draft.reviewedAt.toISOString() : null,
    comments: draft.comments.map((c) => ({ id: c.id, body: c.body, status: c.status, agentReply: c.agentReply, createdAt: c.createdAt.toISOString() })),
    suggestedRelated: Array.isArray(draft.suggestedRelated) ? (draft.suggestedRelated as string[]) : null,
    suggestedFaq: Array.isArray(draft.suggestedFaq) ? (draft.suggestedFaq as Array<{ q: string; a: string }>) : null,
    suggestedCoverSearchTerm: draft.suggestedCoverSearchTerm,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Blog automático</h1>
        <p className="text-sm text-[#667085]">
          O agente externo (rotina agendada) escreve, valida e publica os artigos todo dia útil, sem aprovação manual
          por padrão — ajuste em &quot;Configurações de publicação&quot; abaixo se quiser revisar antes.
        </p>
      </div>

      <BlogSettingsForm initialAutoPublish={agency?.blogAutoPublish ?? true} initialVoiceNotes={agency?.blogVoiceNotes ?? ""} />

      <p className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-4 text-sm text-[#667085]">
        A conexão com o repositório do GitHub e com o Google Search Console agora fica em{" "}
        <Link href="/integracoes?tab=conteudo" className="font-semibold text-[#FF2B00]">Integrações → Conteúdo</Link>.
      </p>

      <ManualBlogRecordForm canManage={canManageIntegrations(membership.role)} />

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
