import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@zenite-mkt/db";
import { AlertTriangle, CheckCircle2, Clock3, Link2, Star } from "lucide-react";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations, isClientRole } from "@/lib/rbac";
import { getHiddenClientIds } from "@/lib/client-access";
import { DEFAULT_RESPONSE_TONE } from "@/lib/google-business-reviews";
import { ReviewPolicyForm } from "./ReviewPolicyForm";
import { ReviewReplyEditor } from "./ReviewReplyEditor";

const STATUS_LABEL: Record<string, string> = { PENDING_AUTO: "Automação pendente", PENDING_MANUAL: "Revisão manual", DRAFT: "Rascunho", APPROVED: "Aguardando envio", REPLIED: "Respondida", IGNORED: "Ignorada", FAILED: "Falhou" };

export default async function GoogleReviewsPage({ searchParams }: { searchParams: { cliente?: string; nota?: string; status?: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");
  if (isClientRole(membership.role)) redirect("/");
  const hidden = await getHiddenClientIds(membership.agencyId, session.user.id);
  const visibleClient = { agencyId: membership.agencyId, id: hidden.length ? { notIn: hidden } : undefined };
  const rating = Number(searchParams.nota);
  const validStatus = ["PENDING_AUTO", "PENDING_MANUAL", "DRAFT", "APPROVED", "REPLIED", "IGNORED", "FAILED"].includes(searchParams.status ?? "") ? searchParams.status : undefined;
  const [connection, policy, clients, reviews, totals] = await Promise.all([
    prisma.googleBusinessConnection.findUnique({ where: { agencyId: membership.agencyId }, include: { _count: { select: { locations: true } } } }),
    prisma.googleBusinessReviewPolicy.findUnique({ where: { agencyId: membership.agencyId } }),
    prisma.client.findMany({ where: visibleClient, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.googleBusinessReview.findMany({ where: { agencyId: membership.agencyId, clientId: { ...(hidden.length ? { notIn: hidden } : {}), ...(searchParams.cliente ? { equals: searchParams.cliente } : {}) }, ...(Number.isInteger(rating) && rating >= 1 && rating <= 5 ? { starRating: rating } : {}), ...(validStatus ? { status: validStatus as never } : {}) }, include: { client: { select: { name: true } }, location: { select: { name: true } }, responses: { orderBy: { createdAt: "desc" }, take: 3 } }, orderBy: { reviewedAt: "desc" }, take: 100 }),
    prisma.googleBusinessReview.groupBy({ by: ["status"], where: { agencyId: membership.agencyId, clientId: hidden.length ? { notIn: hidden } : undefined }, _count: { _all: true } }),
  ]);
  const count = (statuses: string[]) => totals.filter((item) => statuses.includes(item.status)).reduce((sum, item) => sum + item._count._all, 0);
  const initial = policy ?? { autoReplyEnabled: false, autoReplyFourStars: true, autoReplyFiveStars: true, manualAtOrBelow: 3, responseTone: DEFAULT_RESPONSE_TONE, extraGuidelines: null, notifyLowRatings: true, requireCommentForAuto: false };

  return <div className="flex flex-col gap-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-lg font-semibold text-[#101828]">Avaliações Google</h1><p className="max-w-3xl text-sm text-[#667085]">Respostas rápidas para avaliações positivas e cuidado humano nas situações delicadas. Nenhuma resposta é enviada antes da conexão oficial.</p></div><Link href="/integracoes" className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm font-semibold text-[#344054]"><Link2 size={15} />Ver integração</Link></div>

    {!connection && <div className="flex items-start gap-3 rounded-xl border border-[#FEDF89] bg-[#FFFAEB] p-4 text-sm text-[#B54708]"><Clock3 className="mt-0.5 shrink-0" size={18} /><div><b>Estrutura pronta, aguardando o Google.</b><p className="mt-1 text-xs">Você já pode definir as regras. Depois da aprovação da API, conectaremos a conta e vincularemos as unidades dos clientes.</p></div></div>}
    {connection && connection._count.locations === 0 && <div className="flex items-start gap-3 rounded-xl border border-[#B2DDFF] bg-[#EFF8FF] p-4 text-sm text-[#175CD3]"><Link2 className="mt-0.5 shrink-0" size={18} /><div><b>Conta conectada, mas sem unidades vinculadas.</b><p className="mt-1 text-xs">Vincule uma localização do Google a cada cliente para iniciar a sincronização.</p></div></div>}

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[{ label: "Aguardando equipe", value: count(["PENDING_MANUAL", "DRAFT"]), icon: AlertTriangle, color: "text-[#B54708]" }, { label: "Automação pendente", value: count(["PENDING_AUTO", "APPROVED"]), icon: Clock3, color: "text-[#175CD3]" }, { label: "Respondidas", value: count(["REPLIED"]), icon: CheckCircle2, color: "text-[#027A48]" }, { label: "Total importado", value: totals.reduce((s, x) => s + x._count._all, 0), icon: Star, color: "text-[#FF2B00]" }].map(({ label, value, icon: Icon, color }) => <div key={label} className="rounded-xl border border-[#E4E7EC] bg-white p-4"><div className="flex items-center justify-between"><p className="text-xs text-[#667085]">{label}</p><Icon size={16} className={color} /></div><p className="mt-2 text-2xl font-semibold text-[#101828]">{value}</p></div>)}
    </div>

    <ReviewPolicyForm initial={{ autoReplyEnabled: initial.autoReplyEnabled, autoReplyFourStars: initial.autoReplyFourStars, autoReplyFiveStars: initial.autoReplyFiveStars, manualAtOrBelow: initial.manualAtOrBelow, responseTone: initial.responseTone, extraGuidelines: initial.extraGuidelines ?? "", notifyLowRatings: initial.notifyLowRatings, requireCommentForAuto: initial.requireCommentForAuto }} canManage={canManageIntegrations(membership.role)} />

    <section className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
      <div className="border-b border-[#EEF0F3] p-4"><form className="grid gap-2 sm:grid-cols-4"><select name="cliente" defaultValue={searchParams.cliente ?? ""} className="h-9 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#344054]"><option value="">Todos os clientes</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select><select name="nota" defaultValue={searchParams.nota ?? ""} className="h-9 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#344054]"><option value="">Todas as notas</option>{[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} estrelas</option>)}</select><select name="status" defaultValue={validStatus ?? ""} className="h-9 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#344054]"><option value="">Todos os status</option>{Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button className="h-9 rounded-lg bg-[#101828] px-3 text-sm font-semibold text-white">Filtrar</button></form></div>
      {reviews.length === 0 ? <div className="p-10 text-center"><Star size={28} className="mx-auto text-[#D0D5DD]" /><p className="mt-3 text-sm font-semibold text-[#101828]">Nenhuma avaliação nesta fila</p><p className="mt-1 text-xs text-[#667085]">Quando a API for conectada, as avaliações aparecerão aqui com a triagem já aplicada.</p></div> : <ul className="divide-y divide-[#EEF0F3]">{reviews.map((review) => <li key={review.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_220px]"><div><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-[#101828]">{review.reviewerName ?? "Cliente Google"}</b><span className="text-sm text-[#F79009]">{"★".repeat(review.starRating)}{"☆".repeat(5-review.starRating)}</span><span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-xs text-[#475467]">{STATUS_LABEL[review.status]}</span></div><p className="mt-1 text-xs text-[#667085]">{review.client.name} · {review.location.name} · {review.reviewedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p><p className="mt-3 whitespace-pre-wrap text-sm text-[#344054]">{review.comment || "Avaliação sem comentário."}</p>{review.status !== "REPLIED" && review.status !== "IGNORED" && <ReviewReplyEditor reviewId={review.id} initialText={review.replyText ?? ""} />}{review.status === "REPLIED" && review.replyText && <div className="mt-3 border-l-2 border-[#12B76A] pl-3"><p className="text-xs font-semibold text-[#667085]">Resposta publicada</p><p className="mt-1 text-sm text-[#344054]">{review.replyText}</p></div>}</div><div className="text-xs text-[#667085]"><p className="font-semibold text-[#344054]">Histórico</p>{review.responses.length ? review.responses.map((entry) => <p key={entry.id} className="mt-2">{entry.action.toLowerCase().replaceAll("_", " ")} · {entry.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>) : <p className="mt-2">Importada, sem ação ainda.</p>}</div></li>)}</ul>}
    </section>
  </div>;
}
