"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { FormField } from "@/app/_components/FormField";
import { SOCIAL_NETWORKS, type SocialNetworkId } from "@/lib/clients";

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

const EMPTY_SOCIALS = Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n.id, ""])) as Record<SocialNetworkId, string>;

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
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = preview ?? (removed ? null : existingUrl);

  return (
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
          {shown && (
            <button type="button" onClick={onRemove} className="text-xs font-medium text-[#667085] hover:underline">
              Remover
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ClientFormModal({ open, onClose, mode, clientId, initialValues, hasAvatar, hasBanner }: ClientFormModalProps) {
  const router = useRouter();
  const [values, setValues] = useState<ClientFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [segments, setSegments] = useState<string[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [bannerRemoved, setBannerRemoved] = useState(false);
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelEmail, setResponsavelEmail] = useState("");
  const [responsavelTelefone, setResponsavelTelefone] = useState("");
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [portalEmail, setPortalEmail] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [portalRole, setPortalRole] = useState<"CLIENT_ADMIN" | "CLIENT_VIEWER">("CLIENT_VIEWER");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends "name" | "document" | "email" | "phone" | "whatsapp" | "segmentName" | "driveUrl">(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateSocial(network: SocialNetworkId, value: string) {
    setValues((prev) => ({ ...prev, socials: { ...prev.socials, [network]: value } }));
  }

  // Sugestões de ramo: carrega só quando o modal abre (lista pequena, por agência).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/client-segments")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!cancelled && Array.isArray(body?.segments)) setSegments(body.segments);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function syncImage(id: string, kind: ImageKind, file: File | null, removed: boolean) {
    if (file) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/clients/${id}/image/${kind}`, { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return (body?.error as string | undefined) ?? "Não foi possível enviar a imagem.";
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
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const url = mode === "create" ? "/api/clients" : `/api/clients/${clientId}`;
    const { socials, ...baseValues } = values;
    const common = { ...baseValues, socialLinks: socials };
    const payload =
      mode === "create"
        ? {
            ...common,
            responsavelNome,
            responsavelEmail,
            responsavelTelefone,
            ...(portalEnabled ? { portalEmail, portalPassword, portalRole } : {}),
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
    const savedId: string = mode === "create" ? savedBody.id : (clientId as string);
    // Imagens vão depois do cadastro (precisam do id). Falha aqui não desfaz o cliente, só avisa.
    const imageError =
      (await syncImage(savedId, "avatar", avatarFile, avatarRemoved)) ??
      (await syncImage(savedId, "banner", bannerFile, bannerRemoved));
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
          existingUrl={mode === "edit" && hasAvatar && clientId ? `/api/clients/${clientId}/image/avatar` : null}
          file={avatarFile}
          removed={avatarRemoved}
          onPick={(f) => {
            setAvatarFile(f);
            setAvatarRemoved(false);
          }}
          onRemove={() => {
            setAvatarFile(null);
            setAvatarRemoved(true);
          }}
        />
        <ImagePicker
          kind="banner"
          label="Banner do cartão"
          hint="Horizontal, até 5MB. Sem imagem, o cartão usa uma cor."
          existingUrl={mode === "edit" && hasBanner && clientId ? `/api/clients/${clientId}/image/banner` : null}
          file={bannerFile}
          removed={bannerRemoved}
          onPick={(f) => {
            setBannerFile(f);
            setBannerRemoved(false);
          }}
          onRemove={() => {
            setBannerFile(null);
            setBannerRemoved(true);
          }}
        />
        <div className="flex flex-col gap-1.5">
          <FormField
            label="Ramo de atuação"
            name="segment"
            list="client-segments"
            autoComplete="off"
            value={values.segmentName}
            onChange={(e) => update("segmentName", e.target.value)}
            placeholder="Escolha um ramo ou digite um novo"
          />
          <datalist id="client-segments">
            {segments.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
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
          <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Redes sociais (opcional)</p>
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
                  Cria o login agora — o cliente já entra no portal dele sem precisar de convite por
                  link.
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
                    <label htmlFor="portal-role" className="text-sm font-medium text-[#344054]">
                      Papel
                    </label>
                    <select
                      id="portal-role"
                      value={portalRole}
                      onChange={(e) => setPortalRole(e.target.value as "CLIENT_ADMIN" | "CLIENT_VIEWER")}
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
