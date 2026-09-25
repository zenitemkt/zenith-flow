"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { FormField } from "@/app/_components/FormField";
import { useSubmitGuard } from "@/lib/useSubmitGuard";

export function AddGeoTargetModal({ campaignId, open, onClose }: { campaignId: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radiusKm, setRadiusKm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardSubmit = useSubmitGuard();

  function close() {
    setLabel("");
    setLat("");
    setLng("");
    setRadiusKm("");
    setError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await guardSubmit(async () => {
      setError(null);
      setLoading(true);
      const response = await fetch(`/api/campaigns/${campaignId}/geo-targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, lat, lng, radiusKm: radiusKm || null }),
      });
      setLoading(false);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Não foi possível salvar o ponto.");
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Novo ponto no Mapa do Tráfego"
      description="Dica: clique com o botão direito no local desejado no Google Maps — ele mostra a latitude e a longitude pra copiar."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormField
          label="Cidade/região"
          name="label"
          required
          autoFocus
          placeholder="Ex.: São Paulo, SP"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Latitude" name="lat" type="number" step="any" required value={lat} onChange={(e) => setLat(e.target.value)} />
          <FormField label="Longitude" name="lng" type="number" step="any" required value={lng} onChange={(e) => setLng(e.target.value)} />
        </div>
        <FormField
          label="Raio em km (opcional — deixe vazio pra um pino simples)"
          name="radiusKm"
          type="number"
          min="0"
          step="0.1"
          value={radiusKm}
          onChange={(e) => setRadiusKm(e.target.value)}
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
            {loading ? "Salvando..." : "Salvar ponto"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
