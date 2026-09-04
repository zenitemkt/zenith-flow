"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenith/ui";
import { FormField } from "@/app/_components/FormField";

export interface ClientFormValues {
  name: string;
  document: string;
  email: string;
  phone: string;
  whatsapp: string;
}

const EMPTY_VALUES: ClientFormValues = {
  name: "",
  document: "",
  email: "",
  phone: "",
  whatsapp: "",
};

interface ClientFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  clientId?: string;
  initialValues?: Partial<ClientFormValues>;
}

export function ClientFormModal({ open, onClose, mode, clientId, initialValues }: ClientFormModalProps) {
  const router = useRouter();
  const [values, setValues] = useState<ClientFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelEmail, setResponsavelEmail] = useState("");
  const [responsavelTelefone, setResponsavelTelefone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof ClientFormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function close() {
    setValues({ ...EMPTY_VALUES, ...initialValues });
    setResponsavelNome("");
    setResponsavelEmail("");
    setResponsavelTelefone("");
    setError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const url = mode === "create" ? "/api/clients" : `/api/clients/${clientId}`;
    const payload =
      mode === "create"
        ? { ...values, responsavelNome, responsavelEmail, responsavelTelefone }
        : values;

    const response = await fetch(url, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível salvar o cliente.");
      return;
    }

    if (mode === "create") {
      const body = await response.json();
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
            style={{ backgroundColor: "#6847F5" }}
          >
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
