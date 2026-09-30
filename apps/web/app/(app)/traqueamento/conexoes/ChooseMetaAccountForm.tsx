"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@zenite-mkt/ui";
import type { MetaAdAccount } from "@/lib/meta-ads";

interface Props {
  candidates: MetaAdAccount[];
}

/**
 * `/me/adaccounts` devolveu mais de uma conta (a Zenite administra contas de
 * cliente pela mesma conta pessoal usada pra autorizar) — em vez de adivinhar
 * qual conectar, mostra a lista e deixa o usuário escolher explicitamente.
 * O token já foi trocado no callback e está num cookie httpOnly de curta
 * duração; este componente só manda o `accountId` escolhido pra
 * `oauth/finalize`, que grava a conexão de fato.
 */
export function ChooseMetaAccountForm({ candidates }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function confirm() {
    if (!selectedId) return;
    setLoading(true);
    try {
      const response = await fetch("/api/integrations/meta/oauth/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: selectedId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Não foi possível conectar essa conta.");
        setLoading(false);
        return;
      }
      toast.success("Conta da Meta conectada.");
      router.replace("/traqueamento/conexoes");
      router.refresh();
    } catch {
      toast.error("Erro de rede — tente novamente.");
      setLoading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#FDB022] bg-[#FFFAEB]">
      <div className="border-b border-[#FEE9C7] p-4">
        <h2 className="text-sm font-semibold text-[#93400A]">Qual conta de anúncios é da Zenite?</h2>
        <p className="mt-1 text-sm text-[#93400A]">
          Encontramos {candidates.length} contas de anúncio no seu login da Meta — provavelmente porque a agência
          também administra contas de cliente. Escolha qual é a conta da própria Zenite antes de continuar.
        </p>
      </div>
      <div className="flex flex-col gap-2 p-4">
        {candidates.map((candidate) => (
          <label
            key={candidate.id}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
              selectedId === candidate.id ? "border-[#FF2B00] bg-white" : "border-[#EEF0F3] bg-white"
            }`}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="meta-account"
                checked={selectedId === candidate.id}
                onChange={() => setSelectedId(candidate.id)}
              />
              <span className="text-sm font-medium text-[#101828]">{candidate.name}</span>
              <span className="text-xs text-[#98A2B3]">({candidate.id})</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-[#FEE9C7] bg-white px-4 py-3">
        <button
          type="button"
          onClick={confirm}
          disabled={!selectedId || loading}
          className="h-9 rounded-lg bg-[#FF2B00] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Conectando…" : "Conectar esta conta"}
        </button>
      </div>
    </section>
  );
}
