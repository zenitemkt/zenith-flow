"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { FormField } from "@/app/_components/FormField";

interface MemberOption {
  userId: string;
  name: string;
}

interface PositionOption {
  id: string;
  title: string;
}

export function NewEmployeeModal({
  memberOptions,
  positions = [],
}: {
  memberOptions: MemberOption[];
  positions?: PositionOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [positionId, setPositionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setUserId("");
    setName("");
    setEmail("");
    setPhone("");
    setRole("");
    setPositionId("");
    setError(null);
    setOpen(false);
  }

  function handlePositionSelect(value: string) {
    setPositionId(value);
    const position = positions.find((p) => p.id === value);
    if (position) setRole(position.title);
  }

  function handleMemberSelect(value: string) {
    setUserId(value);
    const member = memberOptions.find((m) => m.userId === value);
    if (member) setName(member.name);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, role, userId: userId || null, positionId: positionId || null }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível cadastrar a pessoa.");
      return;
    }

    const body = await response.json();
    close();
    router.push(`/pessoas/equipe/${body.id}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "#FF2B00" }}
      >
        Nova pessoa
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Nova pessoa"
        description="Dado de contratação — separado do acesso ao sistema (isso continua em Configurações > Equipe)."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {memberOptions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="employee-member" className="text-sm font-medium text-[#344054]">
                Vincular a um membro com login (opcional)
              </label>
              <select
                id="employee-member"
                value={userId}
                onChange={(e) => handleMemberSelect(e.target.value)}
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
              >
                <option value="">Sem login (ex.: freelancer)</option>
                {memberOptions.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <FormField
            label="Nome"
            name="name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <FormField
            label="E-mail (opcional)"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FormField
            label="WhatsApp (opcional)"
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 91234-5678"
          />
          {positions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="employee-position" className="text-sm font-medium text-[#344054]">
                Cargo (catálogo, opcional)
              </label>
              <select
                id="employee-position"
                value={positionId}
                onChange={(e) => handlePositionSelect(e.target.value)}
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
              >
                <option value="">Nenhum</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <FormField
            label="Cargo — texto livre (opcional)"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Gestor de tráfego, Designer..."
          />

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
              {loading ? "Criando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
