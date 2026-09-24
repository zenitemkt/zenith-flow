"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { FormField } from "@/app/_components/FormField";
import { useSubmitGuard } from "@/lib/useSubmitGuard";

export function NewCampaignModal({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [channel, setChannel] = useState("");
  const [objective, setObjective] = useState("");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardSubmit = useSubmitGuard();

  function close() {
    setName("");
    setClientId("");
    setChannel("");
    setObjective("");
    setBudget("");
    setStartDate("");
    setEndDate("");
    setUtmSource("");
    setUtmCampaign("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await guardSubmit(async () => {
      setError(null);
      setLoading(true);

      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          clientId: clientId || null,
          channel,
          objective,
          budget: budget || null,
          startDate: startDate || null,
          endDate: endDate || null,
          utmSource,
          utmCampaign,
        }),
      });

      setLoading(false);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Não foi possível criar a campanha.");
        return;
      }

      const body = await response.json();
      close();
      router.push(`/comercial/campanhas/${body.id}`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "#FF2B00" }}
      >
        Nova campanha
      </button>
      <Modal open={open} onClose={close} title="Nova campanha">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField label="Nome" name="name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="campaign-client" className="text-sm font-medium text-[#344054]">
              Cliente (opcional)
            </label>
            <select
              id="campaign-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
            >
              <option value="">Nenhum — campanha da própria agência</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-[#98A2B3]">
              Escolhendo um cliente, ele passa a ver esta campanha e as métricas em{" "}
              <span className="font-medium">Portal → Tráfego pago</span>.
            </p>
          </div>
          <FormField
            label="Canal"
            name="channel"
            required
            placeholder="Meta Ads, Google Ads, Orgânico..."
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          />
          <FormField
            label="Objetivo (opcional)"
            name="objective"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Geração de leads, tráfego, conversão..."
          />
          <FormField
            label="Orçamento em R$ (opcional)"
            name="budget"
            type="number"
            min="0"
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Início (opcional)" name="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <FormField label="Fim (opcional)" name="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="utm_source (opcional)"
              name="utmSource"
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
              placeholder="google, meta..."
            />
            <FormField
              label="utm_campaign (opcional)"
              name="utmCampaign"
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
              placeholder="usado pra casar com o tracking"
            />
          </div>

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
              {loading ? "Criando..." : "Criar campanha"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
