import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Facebook, Instagram, MapPin } from "lucide-react";
import { prisma, type SocialPlatform, type SocialPostFormat, type SocialPostStatus } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { loadQuickPostClients } from "@/lib/quick-post-clients";
import { RescheduleSocialPostButton } from "@/components/RescheduleSocialPostButton";
import { PublishNowPanel } from "./PublishNowPanel";
import { getHiddenClientIds, visibleByClientWhere } from "@/lib/client-access";

const FORMAT_LABEL: Record<SocialPostFormat, string> = { FEED: "Feed", REEL: "Reels", STORY: "Story" };
const ICON: Record<SocialPlatform, typeof Instagram> = { INSTAGRAM: Instagram, FACEBOOK: Facebook, GOOGLE_BUSINESS: MapPin };
const LABEL: Record<SocialPlatform, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook", GOOGLE_BUSINESS: "Google" };
const STATUS: Record<SocialPostStatus, { label: string; cls: string }> = {
  SCHEDULED: { label: "Agendado", cls: "bg-[#EEF4FF] text-[#3538CD]" },
  PUBLISHING: { label: "Publicando", cls: "bg-[#FEF3C7] text-[#92600A]" },
  PROCESSING: { label: "Processando", cls: "bg-[#FEF3C7] text-[#92600A]" },
  PUBLISHED: { label: "Publicado", cls: "bg-[#DCFCE7] text-[#166534]" },
  FAILED: { label: "Falhou", cls: "bg-[#FEE4E2] text-[#B42318]" },
  CANCELED: { label: "Cancelado", cls: "bg-[#F2F4F7] text-[#475467]" },
};

interface PageProps {
  searchParams: { clientId?: string };
}

/**
 * Operação > Publicação (2026-11-06): publicar na hora, sem passar pelo
 * Calendário — escolhe o cliente, as redes, a arte e a legenda e publica.
 * Mesmo fluxo da publicação direta (cria a peça já aprovada, para ficar no
 * histórico e no Kanban). Embaixo, as últimas publicações com o status.
 */
export default async function PublicacaoPage({ searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");
  const hidden = await getHiddenClientIds(membership.agencyId, session.user.id);
  if (isClientRole(membership.role)) redirect("/portal");

  const postSelect = {
    id: true,
    platform: true,
    format: true,
    status: true,
    publishAt: true,
    publishedAt: true,
    permalink: true,
    lastError: true,
    contentItemId: true,
    contentItem: { select: { title: true } },
    client: { select: { name: true } },
  } as const;

  const [clients, recent, failed] = await Promise.all([
    loadQuickPostClients(membership.agencyId, searchParams.clientId, hidden),
    prisma.socialPost.findMany({
      where: { AND: [visibleByClientWhere(hidden)], agencyId: membership.agencyId, status: { notIn: ["CANCELED", "FAILED"] } },
      select: postSelect,
      orderBy: { publishAt: "desc" },
      take: 15,
    }),
    // Todas as que falharam (qualquer data) — para reagendar o que ficou para trás.
    prisma.socialPost.findMany({
      where: { AND: [visibleByClientWhere(hidden)], agencyId: membership.agencyId, status: "FAILED" },
      select: postSelect,
      orderBy: { publishAt: "asc" },
      take: 100,
    }),
  ]);

  const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

  function PostRow({ post }: { post: (typeof recent)[number] }) {
    const Icon = ICON[post.platform];
    const status = STATUS[post.status];
    const title = post.contentItem?.title ?? "Publicação";
    return (
      <li className="flex min-w-0 flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Icon size={16} className="mt-0.5 shrink-0 text-[#475467]" aria-label={LABEL[post.platform]} />
          <div className="min-w-0">
            {post.contentItemId ? (
              <Link href={`/conteudo/${post.contentItemId}`} className="block truncate text-sm font-medium text-[#101828] hover:text-[#FF2B00]">
                {title}
              </Link>
            ) : (
              <span className="block truncate text-sm font-medium text-[#101828]">{title}</span>
            )}
            <p className="truncate text-xs text-[#667085]">
              {post.client.name} · {LABEL[post.platform]} {FORMAT_LABEL[post.format]} · {fmt(post.publishedAt ?? post.publishAt)}
            </p>
            {post.status === "FAILED" && post.lastError && <p className="mt-0.5 text-xs text-[#B42318] [overflow-wrap:anywhere]">{post.lastError}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3 pl-[26px] sm:pl-0">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>
          {(post.status === "FAILED" || post.status === "SCHEDULED") && (
            <RescheduleSocialPostButton
              postId={post.id}
              publishAtISO={post.publishAt.toISOString()}
              label={`${LABEL[post.platform]} · ${FORMAT_LABEL[post.format]} — ${title} (${post.client.name}) · estava para ${fmt(post.publishAt)}`}
            />
          )}
          {post.permalink && (
            <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#101828] hover:underline">
              Ver post <ExternalLink size={12} aria-hidden />
            </a>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Publicação</h1>
        <p className="text-sm text-[#667085]">
          Publique na hora no Instagram e no Facebook do cliente. Para agendar com data e hora, use o{" "}
          <Link href="/operacao/calendario" className="font-semibold text-[#FF2B00] hover:underline">
            Calendário
          </Link>
          .
        </p>
      </div>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4 sm:p-6">
        <PublishNowPanel clients={clients} initialClientId={searchParams.clientId} />
      </section>

      {failed.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#B42318]">
              Não foram publicadas · {failed.length}
            </h2>
            <p className="text-xs text-[#667085]">Use Reagendar para escolher uma nova data e hora — o cartão muda de dia no Calendário.</p>
          </div>
          <ul className="flex flex-col divide-y divide-[#EEF0F3] rounded-xl border border-[#FDA29B] bg-white">
            {failed.map((post) => (
              <PostRow key={post.id} post={post} />
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[#101828]">Últimas publicações</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-[#98A2B3]">Nenhuma publicação ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[#EEF0F3] rounded-xl border border-[#E4E7EC] bg-white">
            {recent.map((post) => (
              <PostRow key={post.id} post={post} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
