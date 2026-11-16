"use client";

import { ComboInput } from "@/components/ComboInput";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { FormField } from "@/app/_components/FormField";
import { SOCIAL_NETWORKS, type SocialNetworkId } from "@/lib/clients";
import {
  EMPTY_SPLIT,
  splitValueFromShares,
  splitValueToBody,
  type SplitFormValue,
} from "@/lib/finance-shares";
import {
  PartnerSplitFields,
  type PartnerChoice,
} from "@/app/(app)/financeiro/PartnerSplitFields";

export interface ClientFormValues {
  name: string;
  document: string;
  email: string;
  phone: string;
  whatsapp: string;
  segmentName: string;
  driveUrl: string;
  socials: Record<SocialNetworkId, string>;
}

const EMPTY_SOCIALS = Object.fromEntries(
  SOCIAL_NETWORKS.map((n) => [n.id, ""]),
) as Record<SocialNetworkId, string>;

const EMPTY_VALUES: ClientFormValues = {
  name: "",
  document: "",
  email: "",
  phone: "",
  whatsapp: "",
  segmentName: "",
  driveUrl: "",
  socials: EMPTY_SOCIALS,
};

interface ClientFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  clientId?: string;
  initialValues?: Partial<ClientFormValues>;
  /** Imagens já salvas (modo edição) — mostradas como prévia via /api/clients/:id/image/:kind. */
  hasAvatar?: boolean;
  hasBanner?: boolean;
}

type ImageKind = "avatar" | "banner";

function ImagePicker({
  kind,
  label,
  hint,
  existingUrl,
  file,
  removed,
  onPick,
  onRemove,
  round,
  preset,
  onPreset,
}: {
  kind: ImageKind;
  label: string;
  hint: string;
  existingUrl: string | null;
  file: File | null;
  removed: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
  round?: boolean;
  preset: string | null;
  onPreset: (preset: string) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [gallery, setGallery] = useState(false);
  const presets =
    kind === "avatar"
      ? Array.from({ length: 12 }, (_, i) => `a${i + 1}`)
      : Array.from({ length: 8 }, (_, i) => `b${i + 1}`);
  const presetUrl = (p: string) =>
    `/presets/${kind === "avatar" ? "avatars" : "banners"}/${p}.svg`;
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown =
    preview ?? (preset ? presetUrl(preset) : removed ? null : existingUrl);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden border border-[#E4E7EC] bg-[#F2F4F7] text-xs text-[#98A2B3] ${
            round ? "h-16 w-16 rounded-xl" : "h-16 w-32 rounded-lg"
          }`}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            "Sem imagem"
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[#344054]">{label}</span>
          <span className="text-xs text-[#98A2B3]">{hint}</span>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer text-xs font-semibold text-[#FF2B00] hover:underline">
              {shown ? "Trocar" : "Enviar imagem"}
              <input
                type="file"
                name={`client-${kind}`}
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                onChange={(e) => {
                  const picked = e.target.files?.[0];
                  if (picked) onPick(picked);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => setGallery((g) => !g)}
              className="text-xs font-semibold text-[#344054] hover:underline"
            >
              {gallery ? "Fechar opções" : "Escolher imagem pronta"}
            </button>
            {shown && (
              <button
                type="button"
                onClick={onRemove}
                className="text-xs font-medium text-[#667085] hover:underline"
              >
                Remover
              </button>
            )}
          </div>
        </div>
      </div>
      {gallery && (
        <div
          className={`grid gap-2 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] p-2 ${kind === "avatar" ? "grid-cols-6" : "grid-cols-2 sm:grid-cols-4"}`}
        >
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                onPreset(p);
                setGallery(false);
              }}
              aria-label={`Imagem pronta ${p}`}
              className={`overflow-hidden ring-offset-2 hover:ring-2 hover:ring-[#FF2B00] ${preset === p ? "ring-2 ring-[#FF2B00]" : ""} ${kind === "avatar" ? "aspect-square rounded-xl" : "aspect-[3/1] rounded-lg"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={presetUrl(p)}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ClientFormModal({
  open,
  onClose,
  mode,
  clientId,
  initialValues,
  hasAvatar,
  hasBanner,
}: ClientFormModalProps) {
  const router = useRouter();
  const [values, setValues] = useState<ClientFormValues>({
    ...EMPTY_VALUES,
    ...initialValues,
  });
  const [segments, setSegments] = useState<string[]>([]);
  const [partners, setPartners] = useState<PartnerChoice[]>([]);
  const [split, setSplit] = useState<SplitFormValue>(EMPTY_SPLIT);
  /** Só envia a divisão se a lista de sócios carregou — senão um erro de rede apagaria o padrão salvo. */
  const [splitLoaded, setSplitLoaded] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreset, setAvatarPreset] = useState<string | null>(null);
  const [bannerPreset, setBannerPreset] = useState<string | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [bannerRemoved, setBannerRemoved] = useState(false);
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelEmail, setResponsavelEmail] = useState("");
  const [responsavelTelefone, setResponsavelTelefone] = useState("");
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [portalEmail, setPortalEmail] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [portalRole, setPortalRole] = useState<
    "CLIENT_ADMIN" | "CLIENT_VIEWER"
  >("CLIENT_VIEWER");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<
    K extends
      | "name"
      | "document"
      | "email"
      | "phone"
      | "whatsapp"
      | "segmentName"
      | "driveUrl",
  >(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateSocial(network: SocialNetworkId, value: string) {
    setValues((prev) => ({
      ...prev,
      socials: { ...prev.socials, [network]: value },
    }));
  }

  // Sócios e a divisão padrão deste cliente (modo edição): carrega quando o modal abre.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSplitLoaded(false);
    fetch(
      `/api/finance/partners${mode === "edit" && clientId ? `?clientId=${clientId}` : ""}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !Array.isArray(body?.partners)) return;
        setPartners(body.partners);
        setSplit(
          splitValueFromShares(
            Array.isArray(body.clientShares) ? body.clientShares : [],
          ),
        );
        setSplitLoaded(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, mode, clientId]);

  // Sugestões de ramo: carrega só quando o modal abre (lista pequena, por agência).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/client-segments")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!cancelled && Array.isArray(body?.segments))
          setSegments(body.segments);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function syncImage(
    id: string,
    kind: ImageKind,
    file: File | null,
    removed: boolean,
    preset: string | null,
  ) {
    if (preset && !file) {
      const res = await fetch(`/api/clients/${id}/image/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset }),
      });
      if (!res.ok) return "Não foi possível salvar a imagem pronta.";
      return null;
    }
    if (file) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/clients/${id}/image/${kind}`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return (
          (body?.error as string | undefined) ??
          "Não foi possível enviar a imagem."
        );
      }
    } else if (removed) {
      await fetch(`/api/clients/${id}/image/${kind}`, { method: "DELETE" });
    }
    return null;
  }

  function close() {
    setValues({ ...EMPTY_VALUES, ...initialValues });
    setResponsavelNome("");
    setResponsavelEmail("");
    setResponsavelTelefone("");
    setPortalEnabled(false);
    setPortalEmail("");
    setPortalPassword("");
    setPortalRole("CLIENT_VIEWER");
    setError(null);
    setAvatarFile(null);
    setBannerFile(null);
    setAvatarRemoved(false);
    setBannerRemoved(false);
    setAvatarPreset(null);
    setBannerPreset(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const url = mode === "create" ? "/api/clients" : `/api/clients/${clientId}`;
    const { socials, ...baseValues } = values;
    const common = {
      ...baseValues,
      socialLinks: socials,
      ...(splitLoaded ? { partnerShares: splitValueToBody(split) } : {}),
    };
    const payload =
      mode === "create"
        ? {
            ...common,
            responsavelNome,
            responsavelEmail,
            responsavelTelefone,
            ...(portalEnabled
              ? { portalEmail, portalPassword, portalRole }
              : {}),
          }
        : common;

    const response = await fetch(url, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setLoading(false);
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível salvar o cliente.");
      return;
    }

    const savedBody = mode === "create" ? await response.json() : null;
    const savedId: string =
      mode === "create" ? savedBody.id : (clientId as string);
    // Imagens vão depois do cadastro (precisam do id). Falha aqui não desfaz o cliente, só avisa.
    const imageError =
      (await syncImage(
        savedId,
        "avatar",
        avatarFile,
        avatarRemoved,
        avatarPreset,
      )) ??
      (await syncImage(
        savedId,
        "banner",
        bannerFile,
        bannerRemoved,
        bannerPreset,
      ));
    setLoading(false);
    if (imageError && mode === "edit") {
      setError(`Dados salvos, mas: ${imageError}`);
      router.refresh();
      return;
    }

    if (mode === "create") {
      const body = savedBody;
      close();
      router.push(`/clientes/${body.id}`);
      return;
    }

    close();
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={mode === "create" ? "Novo cliente" : "Editar dados do cliente"}
      description="Só o nome fantasia é obrigatório — pode salvar assim e completar o resto depois."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormField
          label="Nome fantasia"
          name="name"
          required
          autoFocus
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="9FOURGYM"
        />
        <ImagePicker
          kind="avatar"
          label="Logo / avatar"
          hint="Quadrado, até 5MB."
          round
          existingUrl={
            mode === "edit" && hasAvatar && clientId
              ? `/api/clients/${clientId}/image/avatar`
              : null
          }
          file={avatarFile}
          removed={avatarRemoved}
          onPick={(f) => {
            setAvatarFile(f);
            setAvatarPreset(null);
            setAvatarRemoved(false);
          }}
          onRemove={() => {
            setAvatarFile(null);
            setAvatarPreset(null);
            setAvatarRemoved(true);
          }}
          preset={avatarPreset}
          onPreset={(p) => {
            setAvatarPreset(p);
            setAvatarFile(null);
            setAvatarRemoved(false);
          }}
        />
        <ImagePicker
          kind="banner"
          label="Banner do cartão"
          hint="Horizontal, até 5MB. Sem imagem, o cartão usa uma cor."
          existingUrl={
            mode === "edit" && hasBanner && clientId
              ? `/api/clients/${clientId}/image/banner`
              : null
          }
          file={bannerFile}
          removed={bannerRemoved}
          onPick={(f) => {
            setBannerFile(f);
            setBannerPreset(null);
            setBannerRemoved(false);
          }}
          onRemove={() => {
            setBannerFile(null);
            setBannerPreset(null);
            setBannerRemoved(true);
          }}
          preset={bannerPreset}
          onPreset={(p) => {
            setBannerPreset(p);
            setBannerFile(null);
            setBannerRemoved(false);
          }}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="client-segment" className="text-sm font-medium text-[#344054]">
            Ramo de atuação
          </label>
          <ComboInput
            id="client-segment"
            value={values.segmentName}
            onChange={(v) => update("segmentName", v)}
            options={segments}
            placeholder="Escolha um ramo ou digite um novo"
            className="h-11 w-full rounded-lg border border-[#D0D5DD] px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
          />
        </div>
        <FormField
          label="Pasta do cliente no Google Drive"
          name="driveUrl"
          type="url"
          inputMode="url"
          value={values.driveUrl}
          onChange={(e) => update("driveUrl", e.target.value)}
          placeholder="https://drive.google.com/drive/folders/..."
        />
        {partners.length > 0 && (
          <PartnerSplitFields
            partners={partners}
            value={split}
            onChange={setSplit}
            label="Quem recebe deste cliente"
            hint="Um sócio só, ou dividido: informe quanto fica com cada um (ex.: de R$ 1.500, 1.000 e 500). Os recebimentos deste cliente já vêm divididos nessa proporção."
            idPrefix="client-split"
          />
        )}
        <FormField
          label="CNPJ / documento"
          name="document"
          value={values.document}
          onChange={(e) => update("document", e.target.value)}
          placeholder="00.000.000/0001-00"
        />
        <FormField
          label="E-mail"
          type="email"
          name="email"
          value={values.email}
          onChange={(e) => update("email", e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Telefone"
            name="phone"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
          <FormField
            label="WhatsApp"
            name="whatsapp"
            value={values.whatsapp}
            onChange={(e) => update("whatsapp", e.target.value)}
          />
        </div>

        <div className="mt-1 flex flex-col gap-3 rounded-lg border border-[#EEF0F3] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
            Redes sociais (opcional)
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SOCIAL_NETWORKS.map((network) => (
              <FormField
                key={network.id}
                label={network.label}
                name={`social-${network.id}`}
                value={values.socials[network.id]}
                onChange={(e) => updateSocial(network.id, e.target.value)}
                placeholder={network.placeholder}
              />
            ))}
          </div>
        </div>

        {mode === "create" && (
          <div className="mt-1 flex flex-col gap-3 rounded-lg border border-[#EEF0F3] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
              Responsável (opcional)
            </p>
            <FormField
              label="Nome"
              name="responsavel-nome"
              value={responsavelNome}
              onChange={(e) => setResponsavelNome(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="E-mail"
                type="email"
                name="responsavel-email"
                value={responsavelEmail}
                onChange={(e) => setResponsavelEmail(e.target.value)}
              />
              <FormField
                label="Telefone"
                name="responsavel-telefone"
                value={responsavelTelefone}
                onChange={(e) => setResponsavelTelefone(e.target.value)}
              />
            </div>
          </div>
        )}

        {mode === "create" && (
          <div className="mt-1 flex flex-col gap-3 rounded-lg border border-[#EEF0F3] p-3">
            <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
              Acesso ao portal do cliente (opcional)
              <input
                type="checkbox"
                checked={portalEnabled}
                onChange={(e) => setPortalEnabled(e.target.checked)}
              />
            </label>
            {portalEnabled && (
              <>
                <p className="text-xs text-[#98A2B3]">
                  Cria o login agora — o cliente já entra no portal dele sem
                  precisar de convite por link.
                </p>
                <FormField
                  label="E-mail de acesso"
                  type="email"
                  name="portal-email"
                  required={portalEnabled}
                  value={portalEmail}
                  onChange={(e) => setPortalEmail(e.target.value)}
                  placeholder="contato@cliente.com"
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    label="Senha"
                    type="password"
                    name="portal-password"
                    required={portalEnabled}
                    minLength={8}
                    autoComplete="new-password"
                    value={portalPassword}
                    onChange={(e) => setPortalPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                  />
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="portal-role"
                      className="text-sm font-medium text-[#344054]"
                    >
                      Papel
                    </label>
                    <select
                      id="portal-role"
                      value={portalRole}
                      onChange={(e) =>
                        setPortalRole(
                          e.target.value as "CLIENT_ADMIN" | "CLIENT_VIEWER",
                        )
                      }
                      className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
                    >
                      <option value="CLIENT_VIEWER">Visualizador</option>
                      <option value="CLIENT_ADMIN">Admin</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#FF2B00" }}
          >
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
