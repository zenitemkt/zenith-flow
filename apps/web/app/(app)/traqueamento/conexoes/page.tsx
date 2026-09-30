import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { ConnectMetaButton } from "./ConnectMetaButton";
import { DisconnectMetaButton } from "./DisconnectMetaButton";
import { MetaOAuthResultToast } from "./MetaOAuthResultToast";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  EXPIRED: "Expirada",
  REVOKED: "Revogada",
  ERROR: "Com erro",
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-[#ECFDF3] text-[#027A48]",
  EXPIRED: "bg-[#FFFAEB] text-[#B54708]",
  REVOKED: "bg-[#F2F4F7] text-[#667085]",
  ERROR: "bg-[#FEF3F2] text-[#B42318]",
};

const STATUS_DOT: Record<string, string> = {
  ACTIVE: "bg-[#12B76A]",
  EXPIRED: "bg-[#F79009]",
  REVOKED: "bg-[#98A2B3]",
  ERROR: "bg-[#F04438]",
};

export default async function TraqueamentoPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const canManage = canManageIntegrations(membership.role);
  const metaConnection = await prisma.adAccountConnection.findUnique({
    where: { agencyId_platform: { agencyId: membership.agencyId, platform: "META" } },
  });

  return (
    <div className="flex flex-col gap-6">
      <Suspense>
        <MetaOAuthResultToast />
      </Suspense>

      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Conexões</h1>
        <p className="text-sm text-[#667085]">
          Conexões com as plataformas de anúncio de {membership.agency.name} (seções 37/38 do manual) — primeira
          fatia: ler estrutura e métricas de campanha. Enviar eventos de conversão automaticamente vem numa próxima
          fatia.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#EEF0F3] p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-[#101828]">Meta Ads</h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${
                  metaConnection ? STATUS_STYLES[metaConnection.status] : "bg-[#F2F4F7] text-[#667085]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    metaConnection ? STATUS_DOT[metaConnection.status] : "bg-[#98A2B3]"
                  }`}
                />
                {metaConnection ? STATUS_LABELS[metaConnection.status] : "Não conectada"}
              </span>
            </div>
            {metaConnection ? (
              <p className="max-w-2xl text-sm text-[#667085]">
                Conta <span className="font-medium text-[#344054]">{metaConnection.externalAccountName}</span> (
                {metaConnection.externalAccountId})
                {metaConnection.tokenExpiresAt && (
                  <>
                    {" "}
                    — acesso válido até{" "}
                    <span className="font-medium text-[#344054]">
                      {metaConnection.tokenExpiresAt.toLocaleDateString("pt-BR")}
                    </span>
                  </>
                )}
              </p>
            ) : (
              <p className="max-w-2xl text-sm text-[#667085]">
                Conecte a conta de anúncios da agência pra ler campanhas e (numa próxima fatia) mandar eventos de
                conversão automaticamente.
              </p>
            )}
          </div>
          {canManage && (metaConnection ? <DisconnectMetaButton /> : <ConnectMetaButton />)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F9FAFB] px-4 py-3 text-xs text-[#667085]">
          <span>O token de acesso fica criptografado e nunca é exibido nesta tela.</span>
          <span>Desconectar não apaga campanhas ou métricas já lidas.</span>
        </div>
      </section>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-[#101828]">Google Ads / GA4</h2>
        <p className="text-sm text-[#98A2B3]">Ainda não conectado — próxima fatia.</p>
      </section>
    </div>
  );
}
