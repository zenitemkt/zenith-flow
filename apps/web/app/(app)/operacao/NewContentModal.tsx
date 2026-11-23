"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { FormField } from "@/app/_components/FormField";
import { ChannelFormatPicker } from "@/app/_components/ChannelFormatPicker";
import { useSubmitGuard } from "@/lib/useSubmitGuard";
import type { ContentKind } from "@zenite-mkt/db";
import { CONTENT_KINDS, CONTENT_KIND_HINTS, CONTENT_KIND_LABELS, isDesignKind } from "@/lib/content-kind";

interface ClientOption {
  id: string;
  name: string;
}

interface PersonOption {
  userId: string;
  name: string;
}


export function NewContentModal({
  clients,
  people,
  defaultClientId,
}: {
  clients: ClientOption[];
  people: PersonOption[];
  /** Cliente do filtro da página: a nova tarefa já abre nele. */
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedClientId, setClientId] = useState("");
  // Sem escolha explícita (ou se a lista de clientes só chegou depois do primeiro
  // render, ex.: primeiro cliente recém-cadastrado), vale o primeiro da lista —
  // é o que o <select> já mostra. Antes o estado ficava "" e a API respondia
  // "Escolha o cliente." mesmo com um cliente aparecendo selecionado.
  const clientId = clients.some((client) => client.id === selectedClientId)
    ? selectedClientId
    : clients.some((client) => client.id === defaultClientId)
      ? (defaultClientId as string)
      : (clients[0]?.id ?? "");
  const [kind, setKind] = useState<ContentKind>("DESIGN");
  const design = isDesignKind(kind);
  const [channels, setChannels] = useState<string[]>(["INSTAGRAM"]);
  const [assigneeUserIds, setAssigneeUserIds] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [campaign, setCampaign] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardSubmit = useSubmitGuard();

  function close() {
    setTitle("");
    setDescription("");
    setKind("DESIGN");
    setChannels(["INSTAGRAM"]);
    setAssigneeUserIds([]);
    setFormats([]);
    setCampaign("");
    setScheduledDate("");
    setCaption("");
    setError(null);
    setOpen(false);
  }

  function toggleAssignee(userId: string) {
    setAssigneeUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await guardSubmit(async () => {
    setError(null);

    if (design && channels.length === 0) {
      setError("Selecione ao menos uma rede.");
      return;
    }

    setLoading(true);

    try {
      // Um cartão só com todas as redes e formatos (antes era um cartão por canal).
      const response = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Só Design manda redes/formatos/campanha/legenda (o servidor também ignora nos demais tipos).
        body: JSON.stringify(
          design
            ? { kind, title, description, clientId, channels, formats, campaign, scheduledDate, caption, assigneeUserIds }
            : { kind, title, description, clientId, scheduledDate, assigneeUserIds },
        ),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? (design ? "Não foi possível criar a peça." : "Não foi possível criar a tarefa."));
        return;
      }

      close();
      router.push(`/conteudo/${body.id}`);
      // O quadro por baixo (`/operacao`) ganhou card novo — sem isso, só aparece
      // depois de uma navegação nova (bug reportado pelo Kevin: card criado não
      // aparecia até trocar de aba e voltar).
      router.refresh();
    } finally {
      setLoading(false);
    }
    });
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
      <Modal open={open} onClose={() => { if (!loading) close(); }} title="Nova tarefa">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" aria-busy={loading}>
          <fieldset disabled={loading} className="flex min-w-0 flex-col gap-3 border-0 p-0 disabled:opacity-70">
          <div className="flex flex-col gap-1.5">
            <span id="content-kind-label" className="text-sm font-medium text-[#344054]">
              Tipo de cartão
            </span>
            <div role="radiogroup" aria-labelledby="content-kind-label" className="flex flex-wrap gap-1.5">
              {CONTENT_KINDS.map((option) => {
                const active = kind === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setKind(option)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[#FF2B00] text-white"
                        : "border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    {CONTENT_KIND_LABELS[option]}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#98A2B3]">
              {CONTENT_KIND_HINTS[kind]}
              {!design && " Fluxo: A fazer → Fazendo → Concluído."}
            </p>
          </div>
          <FormField
            label="Título"
            name="title"
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={design ? "Reel de lançamento" : kind === "FINANCEIRO" ? "Enviar fechamento financeiro de novembro" : kind === "ATENDIMENTO" ? "Ligar para o cliente sobre a campanha" : kind === "SITE" ? "Ajustar banner da home do site" : "O que precisa ser feito"}
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
                Sem responsável, o card entra na coluna &quot;Backend&quot;. Com mais de um, ele entra na coluna de quem foi
                marcado primeiro.
              </p>
            </div>
          )}
          {design && (
            <>
              <ChannelFormatPicker channels={channels} formats={formats} onChannelsChange={setChannels} onFormatsChange={setFormats} />
              <p className="-mt-1 text-xs text-[#98A2B3]">Tudo vira um cartão só: o designer replica a arte em cada tamanho e o cliente aprova tudo junto.</p>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label={design ? "Data agendada (opcional)" : "Prazo (opcional)"}
              name="scheduledDate"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>
          {design && (
          <>
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
          </>
          )}

          </fieldset>

          {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              disabled={loading}
              className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB] disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#FF2B00" }}
            >
              {loading ? "Criando..." : design ? "Criar peça" : "Criar tarefa"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
