"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/app/_components/FormField";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "AGENCY_ADMIN", label: "Admin da Agência" },
  { value: "MANAGER", label: "Gestor" },
  { value: "ANALYST", label: "Analista" },
  { value: "FINANCE", label: "Financeiro" },
  { value: "HR", label: "RH" },
];

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
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);

  function resetFeedback() {
    setError(null);
    setSuccess(null);
    setInviteUrl(null);
    setEmailSent(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    resetFeedback();
    setLoading(true);

    const response = await fetch(mode === "direct" ? "/api/memberships/direct" : "/api/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "direct" ? { name, email, password, role } : { email, role, phone: phone || undefined },
      ),
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
      setInviteUrl(new URL(body.inviteUrl, window.location.origin).toString());
      setEmailSent(Boolean(body.emailSent));
      if (body.waLink) {
        window.open(body.waLink, "_blank");
      }
    }
    setName("");
    setEmail("");
    setPassword("");
    setPhone("");
    router.refresh();
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
            Enviar link de convite
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
          {loading ? "Salvando..." : mode === "direct" ? "Criar colaborador" : "Enviar convite"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm font-medium text-[#D94343]">{error}</p>}

      {success && (
        <p className="mt-3 rounded-lg bg-[#DCFCE7] p-3 text-sm font-medium text-[#166534]">{success}</p>
      )}

      {inviteUrl && (
        <div className="mt-3 rounded-lg bg-[#FFF1EC] p-3 text-sm text-[#C2270A]">
          <p className="mb-1 font-medium">
            {emailSent
              ? "Convite criado e e-mail enviado. Link, se precisar mandar de novo:"
              : "Convite criado (e-mail não configurado ou falhou) — envie este link manualmente:"}
          </p>
          <code className="block break-all text-xs">{inviteUrl}</code>
        </div>
      )}
    </div>
  );
}
