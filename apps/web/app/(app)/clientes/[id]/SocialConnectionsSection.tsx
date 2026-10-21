import { cookies } from "next/headers";
import { Facebook, Instagram, MapPin } from "lucide-react";
import { prisma, type SocialPlatform } from "@zenite-mkt/db";
import { fetchMetaPages, type MetaPageOption } from "@/lib/meta-social";
import { SOCIAL_OAUTH_PENDING_COOKIE, decodeSocialOAuthPending } from "@/lib/social-oauth-pending";
import { DisconnectSocialButton, SocialPagePicker, SocialSettingsForm } from "./SocialConnectionsClient";

const ERROR_TEXT: Record<string, string> = {
  authorization_denied: "A autorização foi cancelada na Meta.",
  missing_code: "A Meta não devolveu a autorização. Tente de novo.",
  client_not_found: "Cliente não encontrado.",
  meta_api_error: "A Meta recusou a conexão. Confira se o app tem as permissões de Páginas e Instagram e tente de novo.",
};

const PLATFORMS: { id: SocialPlatform; label: string; icon: typeof Facebook }[] = [
  { id: "INSTAGRAM", label: "Instagram", icon: Instagram },
  { id: "FACEBOOK", label: "Facebook", icon: Facebook },
  { id: "GOOGLE_BUSINESS", label: "Google Meu Negócio", icon: MapPin },
];

/**
 * Redes do cliente para o agendador (2026-10-20). Conecta Facebook +
 * Instagram de uma vez (o Instagram profissional vem vinculado à Página).
 * Google Meu Negócio aguarda a liberação da API pelo Google.
 */
export async function SocialConnectionsSection({
  clientId,
  socialParam,
  reasonParam,
  autoScheduleOnApproval,
  defaultPublishTime,
}: {
  clientId: string;
  socialParam?: string;
  reasonParam?: string;
  autoScheduleOnApproval: boolean;
  defaultPublishTime: string;
}) {
  const connections = await prisma.socialConnection.findMany({
    where: { clientId, status: { not: "REVOKED" } },
    select: { id: true, platform: true, name: true, pictureUrl: true, status: true, lastError: true },
  });
  const byPlatform = new Map(connections.map((c) => [c.platform, c]));

  let pages: MetaPageOption[] | null = null;
  let pagesError: string | null = null;
  if (socialParam === "choose") {
    const pending = decodeSocialOAuthPending(cookies().get(SOCIAL_OAUTH_PENDING_COOKIE)?.value);
    if (pending && pending.clientId === clientId) {
      try {
        pages = await fetchMetaPages(pending.userAccessToken);
      } catch (error) {
        pagesError = error instanceof Error ? error.message : "Não foi possível listar as Páginas.";
      }
    } else {
      pagesError = "A autorização expirou. Clique em Conectar de novo.";
    }
  }

  const hasMeta = byPlatform.has("FACEBOOK") || byPlatform.has("INSTAGRAM");

  return (
    <section id="redes" className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#101828]">Redes conectadas</h2>
          <p className="text-xs text-[#667085]">Para agendar e publicar direto pelo sistema.</p>
        </div>
        <a
          href={`/api/social/meta/start?clientId=${clientId}`}
          className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white"
          style={{ backgroundColor: "#FF2B00" }}
        >
          {hasMeta ? "Reconectar Facebook/Instagram" : "Conectar Facebook/Instagram"}
        </a>
      </div>

      {socialParam === "error" && (
        <p className="mb-3 rounded-lg bg-[#FEE4E2] px-3 py-2 text-sm text-[#B42318]">
          {ERROR_TEXT[reasonParam ?? ""] ?? "Não foi possível conectar."}
        </p>
      )}
      {pagesError && <p className="mb-3 rounded-lg bg-[#FEE4E2] px-3 py-2 text-sm text-[#B42318]">{pagesError}</p>}
      {pages && (
        <SocialPagePicker
          clientId={clientId}
          pages={pages.map((p) => ({ id: p.id, name: p.name, pictureUrl: p.pictureUrl, instagram: p.instagram ? { username: p.instagram.username, pictureUrl: p.instagram.pictureUrl } : null }))}
        />
      )}

      <ul className="flex flex-col gap-2">
        {PLATFORMS.map(({ id, label, icon: Icon }) => {
          const connection = byPlatform.get(id);
          return (
            <li key={id} className="flex items-center gap-3 rounded-lg border border-[#EEF0F3] px-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F2F4F7] text-[#475467]">
                {connection?.pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={connection.pictureUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Icon size={16} aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#101828]">{label}</p>
                <p className="truncate text-xs text-[#667085]">
                  {connection
                    ? connection.status === "ERROR"
                      ? `Com erro: ${connection.lastError ?? "reconecte"}`
                      : connection.name
                    : id === "GOOGLE_BUSINESS"
                      ? "Em breve — aguardando liberação da API pelo Google"
                      : id === "INSTAGRAM" && byPlatform.has("FACEBOOK")
                        ? "A Página escolhida não tem Instagram profissional vinculado"
                        : "Não conectado"}
                </p>
              </div>
              {connection ? (
                <>
                  <span
                    className={`hidden rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline ${
                      connection.status === "ACTIVE" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE4E2] text-[#B42318]"
                    }`}
                  >
                    {connection.status === "ACTIVE" ? "Conectado" : "Erro"}
                  </span>
                  <DisconnectSocialButton connectionId={connection.id} label={label} />
                </>
              ) : null}
            </li>
          );
        })}
      </ul>

      {hasMeta && <SocialSettingsForm clientId={clientId} autoScheduleOnApproval={autoScheduleOnApproval} defaultPublishTime={defaultPublishTime} />}
    </section>
  );
}
