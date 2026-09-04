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
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ANALYST");
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInviteUrl(null);
    setLoading(true);

    const response = await fetch("/api/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const body = await response.json().catch(() => null);

    setLoading(false);
    if (!response.ok) {
      setError(body?.error ?? "Não foi possível enviar o convite.");
      return;
    }

    setInviteUrl(new URL(body.inviteUrl, window.location.origin).toString());
    setEmail("");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-[#101828]">Convidar membro</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <FormField
            label="E-mail"
            type="email"
            name="invite-email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@agencia.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-role" className="text-sm font-medium text-[#344054]">
            Papel
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm text-[#101828] outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex h-11 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#6847F5" }}
        >
          {loading ? "Enviando..." : "Convidar"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm font-medium text-[#D94343]">{error}</p>}

      {inviteUrl && (
        <div className="mt-3 rounded-lg bg-[#F1EDFE] p-3 text-sm text-[#4A2FD8]">
          <p className="mb-1 font-medium">
            Convite criado. O envio automático de e-mail chega na Fase 2 — por enquanto, envie este
            link manualmente:
          </p>
          <code className="block break-all text-xs">{inviteUrl}</code>
        </div>
      )}
    </div>
  );
}
