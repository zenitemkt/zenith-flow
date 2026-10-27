import { redirect } from "next/navigation";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import type { FlowStep } from "@/lib/instagram-flow-model";
import { InstagramRulesClient } from "./InstagramRulesClient";

interface PageProps {
  searchParams: { clientId?: string };
}

export default async function InstagramAutomationPage({ searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");

  const clients = await prisma.client.findMany({
    where: { agencyId: membership.agencyId, socialConnections: { some: { platform: "INSTAGRAM" } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const selectedClientId = searchParams.clientId && clients.some((c) => c.id === searchParams.clientId) ? searchParams.clientId : (clients[0]?.id ?? null);

  const [rules, instagramConnection] = selectedClientId
    ? await Promise.all([
        prisma.instagramAutomationRule.findMany({ where: { agencyId: membership.agencyId, clientId: selectedClientId }, orderBy: { createdAt: "desc" } }),
        prisma.socialConnection.findUnique({ where: { clientId_platform: { clientId: selectedClientId, platform: "INSTAGRAM" } } }),
      ])
    : [[], null];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Mini-chat de Instagram</h1>
        <p className="text-sm text-[#667085]">
          Responde DM, resposta de story e comentário automaticamente, pela conexão de Facebook/Instagram já feita no
          agendador de redes (seção 4 do manual) — sem ferramenta terceira.
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-6 text-center text-sm text-[#667085]">
          Nenhum cliente com Instagram conectado ainda. Conecte em{" "}
          <span className="font-medium text-[#344054]">Clientes → perfil do cliente → Conectar Facebook/Instagram</span> primeiro.
        </div>
      ) : (
        <InstagramRulesClient
          clients={clients}
          selectedClientId={selectedClientId!}
          initialRules={rules.map((r) => ({
            id: r.id,
            triggerType: r.triggerType,
            keyword: r.keyword,
            responseText: r.responseText,
            buttons: Array.isArray(r.buttons) ? (r.buttons as Array<{ text: string; url: string }>) : [],
            mediaId: r.mediaId,
            mediaCaption: r.mediaCaption,
            mediaPermalink: r.mediaPermalink,
            publicReplyTexts: r.publicReplyTexts,
            flow: Array.isArray(r.flow) ? (r.flow as unknown as FlowStep[]) : null,
            active: r.active,
          }))}
          instagramConnected={Boolean(instagramConnection)}
          instagramUsername={instagramConnection?.username ?? null}
        />
      )}
    </div>
  );
}
