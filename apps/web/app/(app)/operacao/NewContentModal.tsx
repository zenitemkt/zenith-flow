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

interface PersonOption {
  userId: string;
  name: string;
}

const CHANNELS = Object.entries(CONTENT_CHANNEL_LABELS);
const FORMAT_OPTIONS = ["Reels", "Carrossel", "Stories", "Post estático", "Vídeo", "Outro"];

export function NewContentModal({ clients, people }: { clients: ClientOption[]; people: PersonOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [channels, setChannels] = useState<string[]>(["INSTAGRAM"]);
  const [assigneeUserIds, setAssigneeUserIds] = useState<string[]>([]);
  const [format, setFormat] = useState("");
  const [campaign, setCampaign] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setTitle("");
    setDescription("");
    setChannels(["INSTAGRAM"]);
    setAssigneeUserIds([]);
    setFormat("");
    setCampaign("");
    setScheduledDate("");
    setCaption("");
    setError(null);
    setOpen(false);
  }

  function toggleChannel(value: string) {
    setChannels((prev) => (prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]));
  }

  function toggleAssignee(userId: string) {
    setAssigneeUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (channels.length === 0) {
      setError("Selecione ao menos um canal.");
      return;
    }

    setLoading(true);

    const responses = await Promise.all(
      channels.map((channel) =>
        fetch("/api/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            clientId,
            channel,
            format,
            campaign,
            scheduledDate,
            caption,
            assigneeUserIds,
          }),
        }),
      ),
    );

    setLoading(false);

    const failed = responses.find((response) => !response.ok);
    if (failed) {
      const body = await failed.json().catch(() => null);
      setError(body?.error ?? "Não foi possível criar a peça.");
      return;
    }

    const bodies = await Promise.all(responses.map((response) => response.json()));
    close();
    if (bodies.length === 1) {
      router.push(`/conteudo/${bodies[0].id}`);
    } else {
      router.push("/operacao");
      router.refresh();
    }
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
        style={{ backgroundColor: "#FF2B00" }}
      >
        Nova tarefa
      </button>
      <Modal open={open} onClose={close} title="Nova tarefa">
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
          <div className="flex flex-col gap-1.5">
            <label htmlFor="content-description" className="text-sm font-medium text-[#344054]">
              Descrição (opcional)
            </label>
            <textarea
              id="content-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="O que precisa ser feito, referências, instruções para quem for produzir..."
              className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="content-client" className="text-sm font-medium text-[#344054]">
              Cliente
            </label>
            <select
              id="content-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          {people.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#344054]">Responsável (opcional)</label>
              <div className="flex flex-wrap gap-1.5">
                {people.map((person) => {
                  const active = assigneeUserIds.includes(person.userId);
                  return (
                    <button
                      key={person.userId}
                      type="button"
                      onClick={() => toggleAssignee(person.userId)}
                      aria-pressed={active}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-[#FF2B00] text-white"
                          : "border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB]"
                      }`}
                    >
                      {person.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-[#98A2B3]">
                Sem responsável, o card entra na coluna "Backend". Com mais de um, ele entra na coluna de quem foi
                marcado primeiro.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#344054]">
              Canais para publicar
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map(([value, label]) => {
                const active = channels.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleChannel(value)}
                    aria-pressed={active}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[#FF2B00] text-white"
                        : "border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#98A2B3]">
              Selecionando mais de um canal, uma peça é criada para cada um.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="content-format" className="text-sm font-medium text-[#344054]">
                Formato (opcional)
              </label>
              <select
                id="content-format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
              >
                <option value="">Selecione...</option>
                {FORMAT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
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
              {loading ? "Criando..." : "Criar peça"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
