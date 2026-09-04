"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenith/ui";
import { FormField } from "@/app/_components/FormField";
import { CONTENT_CHANNEL_LABELS } from "@/lib/content";

interface ClientOption {
  id: string;
  name: string;
}

const CHANNELS = Object.entries(CONTENT_CHANNEL_LABELS);

export function NewContentModal({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [channel, setChannel] = useState("INSTAGRAM");
  const [format, setFormat] = useState("");
  const [campaign, setCampaign] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setTitle("");
    setFormat("");
    setCampaign("");
    setScheduledDate("");
    setCaption("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, clientId, channel, format, campaign, scheduledDate, caption }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível criar a peça.");
      return;
    }

    const body = await response.json();
    close();
    router.push(`/conteudo/${body.id}`);
  }

  if (clients.length === 0) {
    return (
      <p className="text-sm text-[#98A2B3]">Cadastre um cliente antes de planejar conteúdo.</p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "#6847F5" }}
      >
        Novo conteúdo
      </button>
      <Modal open={open} onClose={close} title="Novo conteúdo">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField
            label="Título"
            name="title"
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Reel de lançamento"
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="content-client" className="text-sm font-medium text-[#344054]">
                Cliente
              </label>
              <select
                id="content-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5]"
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="content-channel" className="text-sm font-medium text-[#344054]">
                Canal
              </label>
              <select
                id="content-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5]"
              >
                {CHANNELS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Formato (opcional)"
              name="format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              placeholder="Reels, Carrossel..."
            />
            <FormField
              label="Data agendada (opcional)"
              name="scheduledDate"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>
          <FormField
            label="Campanha (opcional)"
            name="campaign"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="content-caption" className="text-sm font-medium text-[#344054]">
              Legenda (opcional)
            </label>
            <textarea
              id="content-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
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
              style={{ backgroundColor: "#6847F5" }}
            >
              {loading ? "Criando..." : "Criar peça"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
