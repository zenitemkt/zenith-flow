"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/app/_components/FormField";
import { useSubmitGuard } from "@/lib/useSubmitGuard";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "AGENCY_ADMIN", label: "Admin da Agência" },
  { value: "MANAGER", label: "Gestor" },
  { value: "ANALYST", label: "Analista" },
  { value: "FINANCE", label: "Financeiro" },
  { value: "HR", label: "RH" },
];

type ChannelStatus = "idle" | "loading" | "done" | "error";

export function InviteMemberForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"direct" | "link">("direct");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("ANALYST");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardSubmit = useSubmitGuard();

  // Convite recém-criado, aguardando decisão explícita de enviar (ou não) — nunca dispara sozinho.
  const [createdInvite, setCreatedInvite] = useState<{ id: string; url: string; phone: string } | null>(null);
  const [emailStatus, setEmailStatus] = useState<ChannelStatus>("idle");
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [waStatus, setWaStatus] = useState<ChannelStatus>("idle");
  const [waMessage, setWaMessage] = useState<string | null>(null);

  function resetFeedback() {
    setError(null);
    setSuccess(null);
    setCreatedInvite(null);
    setEmailStatus("idle");
    setEmailMessage(null);
    setWaStatus("idle");
    setWaMessage(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await guardSubmit(async () => {
      resetFeedback();
      setLoading(true);

      const response = await fetch(mode === "direct" ? "/api/memberships/direct" : "/api/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "direct" ? { name, email, password, role } : { email, role }),
      });
      const body = await response.json().catch(() => null);

      setLoading(false);
      if (!response.ok) {
        setError(body?.error ?? "Não foi possível concluir.");
        return;
      }

      if (mode === "direct") {
        setSuccess(`Colaborador criado — ${email} já pode entrar com a senha definida.`);
      } else {
        setCreatedInvite({
          id: body.membershipId,
          url: new URL(body.inviteUrl, window.location.origin).toString(),
          phone,
        });
      }
      setName("");
      setEmail("");
      setPassword("");
      setPhone("");
      router.refresh();
    });
  }

  async function handleSendEmail() {
    if (!createdInvite) return;
    setEmailStatus("loading");
    setEmailMessage(null);
    const response = await fetch(`/api/memberships/${createdInvite.id}/send-invite-email`, { method: "POST" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setEmailStatus("error");
      setEmailMessage(body?.error ?? "Não foi possível enviar o e-mail.");
      return;
    }
    setEmailStatus("done");
    setEmailMessage("Enviado ✓");
  }

  async function handleSendWhatsapp() {
    if (!createdInvite) return;
    setWaStatus("loading");
    setWaMessage(null);
    const response = await fetch(`/api/memberships/${createdInvite.id}/send-invite-whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: createdInvite.phone }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setWaStatus("error");
      setWaMessage(body?.error ?? "Não foi possível gerar o link do WhatsApp.");
      return;
    }
    window.open(body.waLink, "_blank");
    setWaStatus("done");
    setWaMessage("Aberto ✓");
  }

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#101828]">Novo colaborador</h2>
        <div className="flex rounded-lg border border-[#E4E7EC] p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode("direct");
              resetFeedback();
            }}
            className={`rounded-md px-2.5 py-1 ${mode === "direct" ? "bg-[#FFF1EC] text-[#C2270A]" : "text-[#667085]"}`}
          >
            Já definir senha
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("link");
              resetFeedback();
            }}
            className={`rounded-md px-2.5 py-1 ${mode === "link" ? "bg-[#FFF1EC] text-[#C2270A]" : "text-[#667085]"}`}
          >
            Convite por link
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mode === "direct" && (
            <FormField
              label="Nome"
              name="member-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
            />
          )}
          <FormField
            label="E-mail (login)"
            type="email"
            name="invite-email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@agencia.com"
          />
          {mode === "link" && (
            <FormField
              label="WhatsApp (opcional)"
              name="invite-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 91234-5678"
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
          {mode === "direct" && (
            <FormField
              label="Senha"
              type="password"
              name="member-password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-role" className="text-sm font-medium text-[#344054]">
              Cargo (controla o que a pessoa vê no sistema)
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 items-center justify-center self-start whitespace-nowrap rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#FF2B00" }}
        >
          {loading ? "Salvando..." : mode === "direct" ? "Criar colaborador" : "Criar convite"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm font-medium text-[#D94343]">{error}</p>}

      {success && (
        <p className="mt-3 rounded-lg bg-[#DCFCE7] p-3 text-sm font-medium text-[#166534]">{success}</p>
      )}

      {createdInvite && (
        <div className="mt-3 flex flex-col gap-3 rounded-lg bg-[#FFF1EC] p-3 text-sm text-[#C2270A]">
          <div>
            <p className="mb-1 font-medium">Convite criado. Link:</p>
            <code className="block break-all text-xs">{createdInvite.url}</code>
          </div>
          <p className="text-xs font-medium text-[#344054]">Quer mandar agora?</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={emailStatus === "loading"}
                onClick={() => void handleSendEmail()}
                className="flex h-9 items-center justify-center rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "#FF2B00" }}
              >
                {emailStatus === "loading" ? "Enviando..." : "Enviar e-mail"}
              </button>
              {emailMessage && (
                <span className={`text-xs font-medium ${emailStatus === "error" ? "text-[#D94343]" : "text-[#166534]"}`}>
                  {emailMessage}
                </span>
              )}
            </div>
            {createdInvite.phone && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={waStatus === "loading"}
                  onClick={() => void handleSendWhatsapp()}
                  className="flex h-9 items-center justify-center rounded-lg border border-[#16A36A] px-3 text-xs font-semibold text-[#16A36A] hover:bg-[#DCFCE7] disabled:opacity-60"
                >
                  {waStatus === "loading" ? "Gerando link..." : "Abrir WhatsApp"}
                </button>
                {waMessage && (
                  <span className={`text-xs font-medium ${waStatus === "error" ? "text-[#D94343]" : "text-[#166534]"}`}>
                    {waMessage}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
