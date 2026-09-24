"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { FormField } from "@/app/_components/FormField";
import { useSubmitGuard } from "@/lib/useSubmitGuard";
import { GRAPHIC_ITEM_TYPES, GRAPHIC_REQUEST_TAG } from "@/lib/portal-requests";

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
        setError(body?.error ?? "Não foi possível enviar o pedido de cotação.");
        return;
      }

      close();
      router.refresh();
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
        Nova cotação
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Cotação de impressão"
        description="Conte o que você precisa — nossa equipe vai orçar e te retornar."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="graphic-item-type" className="text-sm font-medium text-[#344054]">
              Tipo de peça
            </label>
            <select
              id="graphic-item-type"
              value={itemType}
              onChange={(e) => setItemType(e.target.value)}
              className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
            >
              {GRAPHIC_ITEM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {itemType === "Outro" && (
            <FormField
              label="Qual peça?"
              name="customType"
              required
              autoFocus
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              placeholder="Ex.: Crachá, convite, folder..."
            />
          )}

          <FormField
            label="Quantidade (opcional)"
            name="quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Ex.: 500 unidades"
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="graphic-specs" className="text-sm font-medium text-[#344054]">
              Especificações (opcional)
            </label>
            <textarea
              id="graphic-specs"
              value={specs}
              onChange={(e) => setSpecs(e.target.value)}
              rows={3}
              placeholder="Tamanho, papel/material, cores, referência visual, prazo desejado..."
              className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
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
              {loading ? "Enviando..." : "Pedir cotação"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
