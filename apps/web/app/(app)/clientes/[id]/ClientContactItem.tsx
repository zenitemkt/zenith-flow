"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export interface ClientContactData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  isPrimary: boolean;
}

export function ClientContactItem({ clientId, contact }: { clientId: string; contact: ClientContactData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [role, setRole] = useState(contact.role);
  const [isPrimary, setIsPrimary] = useState(contact.isPrimary);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/clients/${clientId}/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, role, isPrimary }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível salvar.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    setLoading(true);
    const response = await fetch(`/api/clients/${clientId}/contacts/${contact.id}`, { method: "DELETE" });
    setLoading(false);
    if (response.ok) router.refresh();
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex flex-col gap-2 rounded-lg border border-[#E4E7EC] p-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
          required
          className="h-9 rounded-lg border border-[#D0D5DD] px-2 text-sm outline-none focus:border-[#6847F5]"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            type="email"
            className="h-9 rounded-lg border border-[#D0D5DD] px-2 text-sm outline-none focus:border-[#6847F5]"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefone"
            className="h-9 rounded-lg border border-[#D0D5DD] px-2 text-sm outline-none focus:border-[#6847F5]"
          />
        </div>
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Finalidade (ex.: Geral, Financeiro)"
          className="h-9 rounded-lg border border-[#D0D5DD] px-2 text-sm outline-none focus:border-[#6847F5]"
        />
        <label className="flex items-center gap-1.5 text-xs text-[#344054]">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
          Contato principal
        </label>
        {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex h-8 items-center justify-center rounded-md px-3 text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#6847F5" }}
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex h-8 items-center justify-center rounded-md border border-[#D0D5DD] px-3 text-xs font-medium text-[#344054]"
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-lg border border-[#EEF0F3] px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[#101828]">
            {contact.name}
            {contact.isPrimary && (
              <span className="ml-2 rounded-full bg-[#F1EDFE] px-1.5 py-0.5 text-[10px] font-semibold text-[#6847F5]">
                Principal
              </span>
            )}
          </p>
          <p className="text-xs text-[#667085]">
            {contact.role} {contact.email ? `· ${contact.email}` : ""} {contact.phone ? `· ${contact.phone}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-[#6847F5] hover:underline"
          >
            Editar
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleDelete()}
            className="text-xs font-medium text-[#D94343] hover:underline disabled:opacity-60"
          >
            Remover
          </button>
        </div>
      </div>
    </div>
  );
}
