"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import type { ContentChannel, ContentStatus } from "@zenith/db";
import {
  CONTENT_BOARD_COLUMNS,
  CONTENT_CHANNEL_LABELS,
  CONTENT_STATUS_BADGE_CLASS,
  CONTENT_STATUS_LABELS,
  contentBoardColumnForStatus,
  type ContentBoardColumnId,
} from "@/lib/content";
import { NewVersionModal } from "@/app/(app)/conteudo/[id]/NewVersionModal";

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
}

const COLUMN_TARGET_STATUS: Partial<Record<ContentBoardColumnId, ContentStatus>> = {
  fazendo: "PRODUCAO",
  aguardando_aprovacao: "REVISAO_INTERNA",
  concluido: "AGENDADO",
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
    <div className="flex items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
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

function ContentCard({
  item,
  canDrag,
  busy,
  justSubmittedUrl,
  onAdvance,
  onSubmit,
  onRefresh,
}: {
  item: BoardContentItem;
  canDrag: boolean;
  busy: boolean;
  justSubmittedUrl: string | null;
  onAdvance: (item: BoardContentItem, toStatus: ContentStatus) => void;
  onSubmit: (item: BoardContentItem) => void;
  onRefresh: () => void;
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
      className={`touch-none rounded-lg border bg-white p-3 shadow-sm ${
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
      <span
        className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${CONTENT_STATUS_BADGE_CLASS[item.status]}`}
      >
        {CONTENT_STATUS_LABELS[item.status]}
      </span>

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
        {item.status === "AJUSTES" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAdvance(item, "PRODUCAO")}
            className="flex h-7 items-center justify-center rounded-md border border-[#D0D5DD] text-[11px] font-medium text-[#344054] hover:border-[#FF2B00] hover:text-[#FF2B00] disabled:opacity-60"
          >
            Corrigido, mover pra Produção →
          </button>
        )}
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
          <div className="rounded-md bg-[#FFF1EC] p-1.5 text-[10px] text-[#C2270A]">
            <p className="font-medium">Aguardando resposta do cliente</p>
            {approvalUrl && (
              <>
                <code className="mt-0.5 block truncate">{approvalUrl}</code>
                <CopyLinkButton url={approvalUrl} />
              </>
            )}
          </div>
        )}
        <ScheduleDateField item={item} onSaved={onRefresh} />
      </div>

      <Link
        href={`/conteudo/${item.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        className="mt-2 block text-[11px] font-medium text-[#667085] hover:text-[#FF2B00] hover:underline"
      >
        Abrir peça completa →
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
  onAdvance,
  onSubmit,
  onRefresh,
}: {
  columnId: ContentBoardColumnId;
  title: string;
  items: BoardContentItem[];
  droppable: boolean;
  canDrag: boolean;
  busyId: string | null;
  justSubmitted: Record<string, string>;
  onAdvance: (item: BoardContentItem, toStatus: ContentStatus) => void;
  onSubmit: (item: BoardContentItem) => void;
  onRefresh: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId, disabled: !droppable });

  return (
    <div className="flex min-w-[260px] flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
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
            onAdvance={onAdvance}
            onSubmit={onSubmit}
            onRefresh={onRefresh}
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

export function ContentBoard({ items, canManage }: { items: BoardContentItem[]; canManage: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState<Record<string, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const columns = useMemo(
    () =>
      CONTENT_BOARD_COLUMNS.map((column) => ({
        ...column,
        items: items
          .filter((item) => contentBoardColumnForStatus(item.status) === column.id)
          .sort((a, b) => {
            const aTime = a.scheduledDateISO ? new Date(a.scheduledDateISO).getTime() : Infinity;
            const bTime = b.scheduledDateISO ? new Date(b.scheduledDateISO).getTime() : Infinity;
            return aTime - bTime;
          }),
      })),
    [items],
  );

  async function changeStatus(item: BoardContentItem, toStatus: ContentStatus) {
    setError(null);
    setBusyId(item.id);
    const response = await fetch(`/api/content/${item.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus }),
    });
    setBusyId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mover o card.");
      return;
    }
    router.refresh();
  }

  async function submitForApproval(item: BoardContentItem) {
    setError(null);
    setBusyId(item.id);
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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const item = items.find((i) => i.id === String(active.id));
    if (!item) return;
    const targetColumn = over.id as ContentBoardColumnId;
    const currentColumn = contentBoardColumnForStatus(item.status);
    if (targetColumn === currentColumn) return;
    const targetStatus = COLUMN_TARGET_STATUS[targetColumn];
    if (!targetStatus) return;
    await changeStatus(item, targetStatus);
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded-lg bg-[#FEE4E2] px-3 py-2 text-sm font-medium text-[#B42318]">{error}</p>}
      <DndContext sensors={sensors} onDragEnd={(e) => void handleDragEnd(e)}>
        <div className="grid auto-cols-[260px] grid-flow-col gap-4 overflow-x-auto pb-2">
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              columnId={column.id}
              title={column.title}
              items={column.items}
              droppable={column.id in COLUMN_TARGET_STATUS}
              canDrag={canManage}
              busyId={busyId}
              justSubmitted={justSubmitted}
              onAdvance={(item, toStatus) => void changeStatus(item, toStatus)}
              onSubmit={(item) => void submitForApproval(item)}
              onRefresh={() => router.refresh()}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
