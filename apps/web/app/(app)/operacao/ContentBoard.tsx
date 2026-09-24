"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { ContentChannel, ContentStatus } from "@zenite-mkt/db";
import {
  CONTENT_BOARD_COLUMNS,
  CONTENT_CHANNEL_LABELS,
  CONTENT_STATUS_BADGE_CLASS,
  CONTENT_STATUS_LABELS,
  contentBoardColumnForStatus,
  type ContentBoardColumnId,
} from "@/lib/content";
import { NewVersionModal } from "@/app/(app)/conteudo/[id]/NewVersionModal";

export interface PersonOption {
  userId: string;
  name: string;
}

export interface BoardContentItem {
  id: string;
  title: string;
  status: ContentStatus;
  channel: ContentChannel;
  format: string | null;
  scheduledDateISO: string | null;
  clientId: string;
  clientName: string;
  hasVersion: boolean;
  approvalToken: string | null;
  /** Ordem importa: o primeiro decide a coluna de responsável enquanto o card está em "A Fazer". */
  assigneeUserIds: string[];
}

/**
 * Status aplicado quando o card é solto numa coluna do pipeline. Livre
 * (pedido do usuário, 2026-09-16): dá pra arrastar de qualquer coluna pra
 * qualquer coluna, mesmo pulando etapas — ex. cliente aprovou pelo
 * WhatsApp e o card vai direto pra Concluído sem passar por aprovação
 * dentro do sistema.
 * "Concluído" cobre AGENDADO e PUBLICADO (ver CONTENT_BOARD_COLUMNS), mas
 * arrastar pra lá aplica PUBLICADO — "Agendado" ainda soa como pendente,
 * e quem arrasta direto pra essa coluna já considera a peça finalizada
 * (pedido do usuário, 2026-09-16: o log/card mostrava "Agendado" e
 * confundia por não parecer concluído).
 */
const COLUMN_TARGET_STATUS: Partial<Record<ContentBoardColumnId, ContentStatus>> = {
  fazendo: "PRODUCAO",
  aguardando_aprovacao: "REVISAO_INTERNA",
  agendar: "APROVADO",
  concluido: "PUBLICADO",
};

function toDateInputValue(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

function ScheduleDateField({
  item,
  onSaved,
}: {
  item: BoardContentItem;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(toDateInputValue(item.scheduledDateISO));
  const [saving, setSaving] = useState(false);

  async function save(next: string) {
    setSaving(true);
    await fetch(`/api/content/${item.id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledDate: next }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div data-card-control className="flex items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
      <span className="text-[10px] font-medium uppercase tracking-wide text-[#98A2B3]">Publicação</span>
      <input
        type="date"
        value={value}
        disabled={saving}
        onChange={(e) => {
          setValue(e.target.value);
          void save(e.target.value);
        }}
        className="h-6 flex-1 rounded-md border border-[#D0D5DD] px-1 text-[11px] text-[#344054] outline-none focus:border-[#FF2B00]"
      />
    </div>
  );
}

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="mt-1 flex h-6 items-center justify-center rounded-md border border-[#F9C7B4] bg-white px-2 text-[10px] font-semibold text-[#C2270A] hover:bg-[#FFF7F5]"
    >
      {copied ? "Link copiado!" : "Copiar link para enviar"}
    </button>
  );
}

/**
 * Clique em qualquer lugar do card abre a peça — exceto em controles
 * (botões, campo de data, links) e dentro de um popup aberto a partir do card.
 */
const CARD_OPEN_IGNORE =
  'button, a, input, select, textarea, label, [role="dialog"], [role="presentation"], [data-card-control]';

function ContentCard({
  item,
  canDrag,
  busy,
  justSubmittedUrl,
  assigneeNames,
  onAdvance,
  onSubmit,
  onRefresh,
  onOpen,
}: {
  item: BoardContentItem;
  canDrag: boolean;
  busy: boolean;
  justSubmittedUrl: string | null;
  assigneeNames: string[];
  onAdvance: (item: BoardContentItem, toStatus: ContentStatus) => void;
  onSubmit: (item: BoardContentItem) => void;
  onRefresh: () => void;
  onOpen: (item: BoardContentItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;
  const dragProps = canDrag ? { ...listeners, ...attributes } : {};
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const approvalUrl = item.approvalToken ? `${origin}/aprovar/${item.approvalToken}` : justSubmittedUrl;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...dragProps}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest(CARD_OPEN_IGNORE)) return;
        onOpen(item);
      }}
      className={`touch-none cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition-colors hover:border-[#FF2B00]/40 ${
        isDragging ? "opacity-50" : ""
      } border-[#E4E7EC]`}
    >
      <p className="mb-1 truncate text-[10px] font-semibold uppercase tracking-wide text-[#FF2B00]">
        {item.clientName}
      </p>
      <p className="text-sm font-medium text-[#101828]">{item.title}</p>
      <p className="mt-0.5 truncate text-xs text-[#667085]">
        {CONTENT_CHANNEL_LABELS[item.channel]}
        {item.format ? ` · ${item.format}` : ""}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${CONTENT_STATUS_BADGE_CLASS[item.status]}`}
        >
          {CONTENT_STATUS_LABELS[item.status]}
        </span>
        {assigneeNames.length > 0 && (
          <span className="inline-block rounded bg-[#EEF2FF] px-1.5 py-0.5 text-[10px] font-medium text-[#3730A3]">
            {assigneeNames.join(" + ")}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
        {(item.status === "IDEIA" || item.status === "PAUTA") && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAdvance(item, "PRODUCAO")}
            className="flex h-7 items-center justify-center rounded-md border border-[#D0D5DD] text-[11px] font-medium text-[#344054] hover:border-[#FF2B00] hover:text-[#FF2B00] disabled:opacity-60"
          >
            Mover pra Fazendo →
          </button>
        )}
        {(item.status === "PRODUCAO" || item.status === "AJUSTES") &&
          (item.hasVersion ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSubmit(item)}
              className="flex h-7 items-center justify-center rounded-md text-[11px] font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#FF2B00" }}
            >
              Enviar pra cliente aprovar
            </button>
          ) : (
            <div className="[&_button]:h-7 [&_button]:w-full [&_button]:text-[11px]">
              <NewVersionModal contentId={item.id} />
            </div>
          ))}
        {item.status === "REVISAO_INTERNA" && !item.hasVersion && (
          <div className="[&_button]:h-7 [&_button]:w-full [&_button]:text-[11px]">
            <NewVersionModal contentId={item.id} />
          </div>
        )}
        {item.status === "REVISAO_INTERNA" && item.hasVersion && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onSubmit(item)}
            className="flex h-7 items-center justify-center rounded-md text-[11px] font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#FF2B00" }}
          >
            Enviar pro cliente
          </button>
        )}
        {item.status === "AGUARDANDO_CLIENTE" && (
          <div data-card-control className="cursor-text rounded-md bg-[#FFF1EC] p-1.5 text-[10px] text-[#C2270A]">
            <p className="font-medium">Aguardando resposta do cliente</p>
            {approvalUrl && (
              <>
                <code className="mt-0.5 block truncate">{approvalUrl}</code>
                <CopyLinkButton url={approvalUrl} />
              </>
            )}
          </div>
        )}
        {item.status === "APROVADO" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAdvance(item, "AGENDADO")}
            className="flex h-7 items-center justify-center rounded-md text-[11px] font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#FF2B00" }}
          >
            Mover para Concluído
          </button>
        )}
        <ScheduleDateField item={item} onSaved={onRefresh} />
      </div>

      <Link
        href={`/conteudo/${item.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Abrir peça completa"
        title="Abrir peça completa"
        className="mt-2 flex h-7 w-7 ml-auto items-center justify-center rounded-full text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "#FF2B00" }}
      >
        <ArrowRight size={14} aria-hidden />
      </Link>
    </div>
  );
}

function BoardColumn({
  columnId,
  title,
  items,
  droppable,
  canDrag,
  busyId,
  justSubmitted,
  peopleById,
  onAdvance,
  onSubmit,
  onRefresh,
  onOpen,
}: {
  columnId: string;
  title: string;
  items: BoardContentItem[];
  droppable: boolean;
  canDrag: boolean;
  busyId: string | null;
  justSubmitted: Record<string, string>;
  peopleById: Map<string, string>;
  onAdvance: (item: BoardContentItem, toStatus: ContentStatus) => void;
  onSubmit: (item: BoardContentItem) => void;
  onRefresh: () => void;
  onOpen: (item: BoardContentItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId, disabled: !droppable });

  return (
    <div className="flex min-w-[260px] flex-col gap-2 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] p-2.5">
      <p className="px-0.5 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
        {title} · {items.length}
      </p>
      <div
        ref={setNodeRef}
        className={`flex min-h-[80px] flex-col gap-2 rounded-lg p-1 transition-colors ${
          isOver ? "bg-[#FFF1EC]" : ""
        }`}
      >
        {items.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            canDrag={canDrag}
            busy={busyId === item.id}
            justSubmittedUrl={justSubmitted[item.id] ?? null}
            assigneeNames={item.assigneeUserIds.map((id) => peopleById.get(id) ?? "Ex-membro")}
            onAdvance={onAdvance}
            onSubmit={onSubmit}
            onRefresh={onRefresh}
            onOpen={onOpen}
          />
        ))}
        {items.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#E4E7EC] px-3 py-4 text-center text-xs text-[#98A2B3]">
            Vazio
          </p>
        )}
      </div>
    </div>
  );
}

function sortByScheduledDate(items: BoardContentItem[]): BoardContentItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.scheduledDateISO ? new Date(a.scheduledDateISO).getTime() : Infinity;
    const bTime = b.scheduledDateISO ? new Date(b.scheduledDateISO).getTime() : Infinity;
    return aTime - bTime;
  });
}

export function ContentBoard({
  items,
  people,
  canManage,
}: {
  items: BoardContentItem[];
  people: PersonOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState<Record<string, string>>({});

  /**
   * Espelho local de `items`, atualizado otimisticamente antes da resposta do
   * servidor (arrastar card muda a tela na hora, sem esperar o round-trip) e
   * resincronizado sempre que o servidor manda dados novos via
   * `router.refresh()` — mesmo padrão já usado em `PipelineBoard`.
   */
  const [localItems, setLocalItems] = useState(items);
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  // O navegador dispara "click" logo depois de soltar um card arrastado —
  // sem essa trava, todo arraste terminaria abrindo a peça.
  const justDraggedRef = useRef(false);

  function openItem(item: BoardContentItem) {
    if (justDraggedRef.current) return;
    router.push(`/conteudo/${item.id}`);
  }

  function releaseDragLock() {
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 0);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const peopleById = useMemo(() => new Map(people.map((p) => [p.userId, p.name])), [people]);

  const columns = useMemo(() => {
    const aFazer = localItems.filter((item) => contentBoardColumnForStatus(item.status) === "a_fazer");
    const backendColumn = {
      id: "backend",
      title: "Backend",
      items: sortByScheduledDate(aFazer.filter((item) => item.assigneeUserIds.length === 0)),
    };
    const personColumns = people.map((person) => ({
      id: `person-${person.userId}`,
      title: person.name,
      items: sortByScheduledDate(aFazer.filter((item) => item.assigneeUserIds[0] === person.userId)),
    }));
    const pipelineColumns = CONTENT_BOARD_COLUMNS.filter((column) => column.id !== "a_fazer").map((column) => ({
      id: column.id,
      title: column.title,
      items: sortByScheduledDate(localItems.filter((item) => contentBoardColumnForStatus(item.status) === column.id)),
    }));
    return [backendColumn, ...personColumns, ...pipelineColumns];
  }, [localItems, people]);

  async function changeStatus(item: BoardContentItem, toStatus: ContentStatus) {
    setError(null);
    setBusyId(item.id);
    const previous = localItems;
    setLocalItems((current) => current.map((i) => (i.id === item.id ? { ...i, status: toStatus } : i)));
    const response = await fetch(`/api/content/${item.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus }),
    });
    setBusyId(null);
    if (!response.ok) {
      setLocalItems(previous);
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mover o card.");
      return;
    }
    router.refresh();
  }

  async function submitForApproval(item: BoardContentItem) {
    setError(null);
    setBusyId(item.id);

    if (item.status === "PRODUCAO") {
      const moveResponse = await fetch(`/api/content/${item.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: "REVISAO_INTERNA" }),
      });
      if (!moveResponse.ok) {
        const moveBody = await moveResponse.json().catch(() => null);
        setBusyId(null);
        setError(moveBody?.error ?? "Não foi possível mover para revisão interna.");
        return;
      }
    }

    const response = await fetch(`/api/content/${item.id}/submit`, { method: "POST" });
    const body = await response.json().catch(() => null);
    setBusyId(null);
    if (!response.ok) {
      setError(body?.error ?? "Não foi possível enviar para aprovação.");
      return;
    }
    setJustSubmitted((prev) => ({ ...prev, [item.id]: new URL(body.approvalUrl, window.location.origin).toString() }));
    router.refresh();
  }

  async function reassign(item: BoardContentItem, assigneeUserIds: string[]) {
    setError(null);
    setBusyId(item.id);
    const previous = localItems;
    setLocalItems((current) => current.map((i) => (i.id === item.id ? { ...i, assigneeUserIds } : i)));
    const response = await fetch(`/api/content/${item.id}/assignees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeUserIds }),
    });
    setBusyId(null);
    if (!response.ok) {
      setLocalItems(previous);
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mudar o responsável.");
      return;
    }
    router.refresh();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const item = localItems.find((i) => i.id === String(active.id));
    if (!item) return;
    const targetId = String(over.id);

    if (targetId === "backend" || targetId.startsWith("person-")) {
      const targetUserId = targetId === "backend" ? null : targetId.slice("person-".length);
      const currentUserId = item.assigneeUserIds[0] ?? null;
      const needsStatusChange = contentBoardColumnForStatus(item.status) !== "a_fazer";
      if (needsStatusChange) {
        await changeStatus(item, "IDEIA");
      }
      if (targetUserId !== currentUserId) {
        await reassign(item, targetUserId ? [targetUserId] : []);
      }
      return;
    }

    const targetColumn = targetId as ContentBoardColumnId;
    const currentColumn = contentBoardColumnForStatus(item.status);
    if (targetColumn === currentColumn) return;
    const targetStatus = COLUMN_TARGET_STATUS[targetColumn];
    if (!targetStatus) return;
    await changeStatus(item, targetStatus);
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded-lg bg-[#FEE4E2] px-3 py-2 text-sm font-medium text-[#B42318]">{error}</p>}
      <DndContext
        sensors={sensors}
        onDragStart={() => {
          justDraggedRef.current = true;
        }}
        onDragCancel={releaseDragLock}
        onDragEnd={(e) => {
          releaseDragLock();
          void handleDragEnd(e);
        }}
      >
        <div className="grid auto-cols-[260px] grid-flow-col gap-4 overflow-x-auto pb-2">
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              columnId={column.id}
              title={column.title}
              items={column.items}
              droppable={column.id === "backend" || column.id.startsWith("person-") || column.id in COLUMN_TARGET_STATUS}
              canDrag={canManage}
              busyId={busyId}
              justSubmitted={justSubmitted}
              peopleById={peopleById}
              onAdvance={(item, toStatus) => void changeStatus(item, toStatus)}
              onSubmit={(item) => void submitForApproval(item)}
              onRefresh={() => router.refresh()}
              onOpen={openItem}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
