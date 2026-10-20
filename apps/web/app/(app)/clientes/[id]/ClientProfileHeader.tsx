"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Camera, Facebook, FolderOpen, Globe, ImagePlus, Instagram, Linkedin, MessageCircle, Music2, Youtube, type LucideIcon } from "lucide-react";
import { SOCIAL_NETWORKS, socialChipLabel, type SocialNetworkId } from "@/lib/clients";

const SOCIAL_ICONS: Record<SocialNetworkId, LucideIcon> = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Music2,
  youtube: Youtube,
  linkedin: Linkedin,
  site: Globe,
  whatsapp: MessageCircle,
};

const SOCIAL_LABEL = Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n.id, n.label])) as Record<SocialNetworkId, string>;

type ImageKind = "avatar" | "banner";

/**
 * Cabeçalho de perfil do cliente (pedido do usuário, 2026-10-20): mesmo visual
 * do cartão da carteira, com troca de logo e banner num clique, direto na
 * imagem — o formulário completo continua em "Editar cadastro".
 */
export function ClientProfileHeader({
  clientId,
  name,
  initials,
  segment,
  active,
  statusLabel,
  avatarUrl,
  bannerUrl,
  bannerGradient,
  socials,
  contactLine,
  driveUrl,
  badges,
  actions,
  canEdit,
}: {
  clientId: string;
  name: string;
  initials: string;
  segment: string | null;
  active: boolean;
  statusLabel: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bannerGradient: string;
  socials: { network: SocialNetworkId; url: string }[];
  contactLine: string;
  driveUrl: string | null;
  badges?: ReactNode;
  actions?: ReactNode;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState<ImageKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  async function upload(kind: ImageKind, file: File) {
    setError(null);
    setUploading(kind);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/clients/${clientId}/image/${kind}`, { method: "POST", body: form });
    setUploading(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Não foi possível enviar a imagem.");
      return;
    }
    router.refresh();
  }

  function fileInput(kind: ImageKind, ref: React.RefObject<HTMLInputElement>) {
    return (
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(kind, file);
          e.target.value = "";
        }}
      />
    );
  }

  return (
    <section className="overflow-hidden rounded-[20px] border border-[#EEF0F3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)]">
      <div
        className="relative h-32 w-full bg-cover bg-center sm:h-44"
        style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : { background: bannerGradient }}
      >
        {canEdit && (
          <>
            {fileInput("banner", bannerInput)}
            <button
              type="button"
              onClick={() => bannerInput.current?.click()}
              disabled={uploading !== null}
              className="absolute bottom-3 right-3 flex h-9 items-center gap-1.5 rounded-lg bg-black/55 px-3 text-xs font-semibold text-white backdrop-blur hover:bg-black/70 disabled:opacity-60"
            >
              <ImagePlus size={14} aria-hidden />
              {uploading === "banner" ? "Enviando..." : bannerUrl ? "Trocar banner" : "Adicionar banner"}
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col gap-4 px-4 pb-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="relative -mt-10 sm:-mt-12">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-[#3b3f4a] text-xl font-bold text-white shadow-sm sm:h-24 sm:w-24">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            {canEdit && (
              <>
                {fileInput("avatar", avatarInput)}
                <button
                  type="button"
                  onClick={() => avatarInput.current?.click()}
                  disabled={uploading !== null}
                  aria-label={avatarUrl ? "Trocar logo" : "Adicionar logo"}
                  title={avatarUrl ? "Trocar logo" : "Adicionar logo"}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#101828] text-white shadow hover:bg-[#344054] disabled:opacity-60"
                >
                  <Camera size={14} aria-hidden />
                </button>
              </>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        {uploading === "avatar" && <p className="text-xs text-[#667085]">Enviando logo...</p>}
        {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}

        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-[#16A36A]" : "bg-[#D94343]"}`} aria-hidden />
            <h1 className="text-xl font-bold tracking-[-0.01em] text-[#101828] sm:text-2xl">{name}</h1>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                active ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE4E2] text-[#B42318]"
              }`}
              title={`Ciclo de vida: ${statusLabel}`}
            >
              {active ? "Ativo" : "Inativo"} · {statusLabel}
            </span>
            {badges}
          </div>
          <p className="text-sm text-[#667085]">{segment ?? "Ramo de atuação não informado"}</p>
          <p className="text-sm text-[#98A2B3]">{contactLine}</p>
        </div>

        {(socials.length > 0 || driveUrl) && (
          <div className="flex flex-wrap gap-1.5">
            {driveUrl && (
              <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full bg-[#101828] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#344054]"
              >
                <FolderOpen size={13} aria-hidden />
                Pasta no Drive
              </a>
            )}
            {socials.map(({ network, url }) => {
              const Icon = SOCIAL_ICONS[network];
              return (
                <a
                  key={network}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={SOCIAL_LABEL[network]}
                  className="flex items-center gap-1.5 rounded-full bg-[#F2F4F7] px-3 py-1.5 text-xs font-medium text-[#475467] hover:bg-[#E4E7EC]"
                >
                  <Icon size={13} aria-hidden />
                  {socialChipLabel(network, url)}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
