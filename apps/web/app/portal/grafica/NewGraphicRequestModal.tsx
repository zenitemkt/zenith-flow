"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "@zenite-mkt/ui";
import { useSubmitGuard } from "@/lib/useSubmitGuard";
import { GRAPHIC_ITEM_TYPES, GRAPHIC_REQUEST_TAG } from "@/lib/portal-requests";
import { PortalField, inputClass, labelClass, primaryButtonClass, quietButtonClass } from "../_components/ui";

export function NewGraphicRequestModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [itemType, setItemType] = useState<string>(GRAPHIC_ITEM_TYPES[0]);
  const [customType, setCustomType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [specs, setSpecs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardSubmit = useSubmitGuard();

  function close() {
    setItemType(GRAPHIC_ITEM_TYPES[0]);
    setCustomType("");
    setQuantity("");
    setSpecs("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await guardSubmit(async () => {
      setError(null);

      const resolvedType = itemType === "Outro" ? customType.trim() : itemType;
      if (!resolvedType) {
        setError("Diga qual peça você precisa.");
        return;
      }

      const descriptionParts: string[] = [];
      if (quantity.trim()) descriptionParts.push(`Quantidade: ${quantity.trim()}`);
      if (specs.trim()) descriptionParts.push(`Especificações: ${specs.trim()}`);

      setLoading(true);

      const response = await fetch("/api/portal/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${GRAPHIC_REQUEST_TAG} ${resolvedType}`,
          description: descriptionParts.join("\n\n") || null,
        }),
      });

      setLoading(false);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Não foi possível enviar o pedido de cotação. Tente de novo.");
        return;
      }

      close();
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
        <Plus size={16} aria-hidden />
        Pedir cotação
      </button>
      <Modal
        open={open}
        onClose={close}
        tone="dark"
        title="Cotação de impressão"
        description="Quanto mais detalhe, mais certeiro o orçamento."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className={`${labelClass} mb-2`}>Tipo de peça</legend>
            <div className="flex flex-wrap gap-2">
              {GRAPHIC_ITEM_TYPES.map((type) => {
                const selected = itemType === type;
                return (
                  <label
                    key={type}
                    className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#FF7A1A] ${
                      selected
                        ? "border-[#FF2B00]/60 bg-[#FF2B00]/[0.14] text-white"
                        : "border-white/10 text-[#A3A5B2] hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="itemType"
                      value={type}
                      checked={selected}
                      onChange={() => setItemType(type)}
                      className="sr-only"
                    />
                    {type}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {itemType === "Outro" && (
            <PortalField
              label="Qual peça?"
              name="customType"
              required
              autoFocus
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              placeholder="Ex.: crachá, convite, folder…"
            />
          )}

          <PortalField
            label="Quantidade (opcional)"
            name="quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Ex.: 500 unidades"
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="graphic-specs" className={labelClass}>
              Detalhes (opcional)
            </label>
            <textarea
              id="graphic-specs"
              value={specs}
              onChange={(e) => setSpecs(e.target.value)}
              rows={3}
              placeholder="Tamanho, papel ou material, cores, prazo desejado…"
              className={`${inputClass} resize-none py-2.5`}
            />
          </div>

          {error && <p className="text-sm font-medium text-[#FF8A80]">{error}</p>}

          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={close} className={quietButtonClass}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className={primaryButtonClass}>
              {loading ? "Enviando…" : "Pedir cotação"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
