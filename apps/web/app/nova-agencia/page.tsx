"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/app/_components/FormField";

export default function NovaAgenciaPage() {
  const router = useRouter();
  const [agencyName, setAgencyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/agencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agencyName }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível criar a agência.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F7FB] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold text-[#101828]">Crie sua agência</h1>
        <p className="mb-6 text-sm text-[#667085]">
          Sua conta ainda não está vinculada a nenhuma agência.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField
            label="Nome da agência"
            name="agencyName"
            required
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
          />
          {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex h-11 items-center justify-center rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#6847F5" }}
          >
            {loading ? "Criando..." : "Criar agência"}
          </button>
        </form>
      </div>
    </div>
  );
}
