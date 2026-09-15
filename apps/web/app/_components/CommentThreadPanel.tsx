"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CommentEntityType, CommentView, CommentThreadView } from "@/lib/comments";

export interface MentionableMember {
  id: string;
  name: string;
  email: string;
}

export interface AssigneeOption {
  userId: string;
  name: string;
}

export function CommentThreadPanel({
  entityType,
  entityId,
  thread,
  mentionableMembers,
  currentUserId,
  onMutated,
  assignableMembers,
}: {
  entityType: CommentEntityType;
  entityId: string;
  thread: CommentThreadView;
  mentionableMembers: MentionableMember[];
  currentUserId: string;
  /** Chamado após qualquer mutação bem-sucedida. Sem isso, usa router.refresh() (páginas SSR). */
  onMutated?: () => void;
  /** Quando presente, "Converter em tarefa" ganha campos de responsável e prazo. */
  assignableMembers?: AssigneeOption[];
}) {
  const router = useRouter();

  function afterMutation() {
    if (onMutated) onMutated();
    else router.refresh();
  }
  const [body, setBody] = useState("");
  const [mentioned, setMentioned] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertTitle, setConvertTitle] = useState("");
  const [convertAssigneeId, setConvertAssigneeId] = useState("");
  const [convertDueDate, setConvertDueDate] = useState("");
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertLoading, setConvertLoading] = useState(false);

  function startConvert(comment: CommentView) {
    setConvertingId(comment.id);
    setConvertTitle(comment.body.slice(0, 120));
    setConvertAssigneeId("");
    setConvertDueDate("");
    setConvertError(null);
  }

  async function submitConvert(commentId: string) {
    if (!convertTitle.trim()) {
      setConvertError("Informe um título.");
      return;
    }
    setConvertError(null);
    setConvertLoading(true);
    const response = await fetch(`/api/comments/${commentId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: convertTitle.trim(),
        assigneeUserId: convertAssigneeId || null,
        dueDate: convertDueDate || null,
      }),
    });
    setConvertLoading(false);
    if (!response.ok) {
      const responseBody = await response.json().catch(() => null);
      setConvertError(responseBody?.error ?? "Não foi possível converter.");
      return;
    }
    setConvertingId(null);
    afterMutation();
  }

  function toggleMention(userId: string) {
    setMentioned((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setError(null);
    setLoading(true);

    const response = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId, body, mentionedUserIds: mentioned }),
    });

    setLoading(false);
    if (!response.ok) {
      const responseBody = await response.json().catch(() => null);
      setError(responseBody?.error ?? "Não foi possível salvar o comentário.");
      return;
    }

    setBody("");
    setMentioned([]);
    afterMutation();
  }

  async function saveEdit(commentId: string) {
    if (!editBody.trim()) return;
    const response = await fetch(`/api/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editBody.trim() }),
    });
    if (response.ok) {
      setEditingId(null);
      afterMutation();
    }
  }

  async function removeComment(commentId: string) {
    const response = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    if (response.ok) {
      afterMutation();
    }
  }

  async function toggleThread(resolved: boolean) {
    if (!thread.id) return;
    const response = await fetch(`/api/comment-threads/${thread.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved }),
    });
    if (response.ok) {
      afterMutation();
    }
  }

  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#101828]">Comentários</h2>
        {thread.id && (
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                thread.status === "RESOLVIDA"
                  ? "bg-[#DCFCE7] text-[#166534]"
                  : "bg-[#F2F4F7] text-[#475467]"
              }`}
            >
              {thread.status === "RESOLVIDA" ? "Resolvida" : "Aberta"}
            </span>
            <button
              type="button"
              onClick={() => toggleThread(thread.status !== "RESOLVIDA")}
              className="text-xs font-medium text-[#FF2B00] hover:underline"
            >
              {thread.status === "RESOLVIDA" ? "Reabrir" : "Marcar como resolvida"}
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3">
        {thread.comments.length === 0 && (
          <p className="text-sm text-[#98A2B3]">Nenhum comentário ainda.</p>
        )}
        {thread.comments.map((comment: CommentView) => (
          <div key={comment.id} className="rounded-lg border border-[#EEF0F3] px-3 py-2">
            {comment.status === "REMOVIDO" ? (
              <p className="text-sm italic text-[#98A2B3]">Comentário removido.</p>
            ) : editingId === comment.id ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={2}
                  autoFocus
                  className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium text-[#475467] hover:bg-[#F6F7FB]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEdit(comment.id)}
                    className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold text-white"
                    style={{ backgroundColor: "#FF2B00" }}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-[#101828]">{comment.body}</p>
                {comment.mentionNames.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {comment.mentionNames.map((name, idx) => (
                      <span
                        key={idx}
                        className="rounded-full bg-[#FFF1EC] px-1.5 py-0.5 text-[10px] font-medium text-[#FF2B00]"
                      >
                        @{name}
                      </span>
                    ))}
                  </p>
                )}
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-[#98A2B3]">
                    {comment.authorName} · {new Date(comment.createdAt).toLocaleString("pt-BR")}
                    {comment.status === "EDITADO" ? " · editado" : ""}
                  </p>
                  <div className="flex gap-2">
                    {comment.convertedTaskId ? (
                      <span className="text-xs font-medium text-[#3730A3]">Convertido em tarefa</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startConvert(comment)}
                        className="text-xs font-medium text-[#FF2B00] hover:underline"
                      >
                        Converter
                      </button>
                    )}
                    {comment.authorUserId === currentUserId && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(comment.id);
                            setEditBody(comment.body);
                          }}
                          className="text-xs font-medium text-[#FF2B00] hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => removeComment(comment.id)}
                          className="text-xs font-medium text-[#D94343] hover:underline"
                        >
                          Remover
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {convertingId === comment.id && (
                  <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] p-2.5">
                    <input
                      value={convertTitle}
                      onChange={(e) => setConvertTitle(e.target.value)}
                      placeholder="Título da tarefa"
                      className="h-8 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#FF2B00]"
                    />
                    {assignableMembers && assignableMembers.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={convertAssigneeId}
                          onChange={(e) => setConvertAssigneeId(e.target.value)}
                          className="h-8 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#FF2B00]"
                        >
                          <option value="">Sem responsável</option>
                          {assignableMembers.map((member) => (
                            <option key={member.userId} value={member.userId}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="datetime-local"
                          value={convertDueDate}
                          onChange={(e) => setConvertDueDate(e.target.value)}
                          className="h-8 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#FF2B00]"
                        />
                      </div>
                    )}
                    {convertError && <p className="text-xs font-medium text-[#D94343]">{convertError}</p>}
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={convertLoading}
                        onClick={() => void submitConvert(comment.id)}
                        className="flex h-7 flex-1 items-center justify-center rounded-md text-xs font-semibold text-white disabled:opacity-60"
                        style={{ backgroundColor: "#FF2B00" }}
                      >
                        {convertLoading ? "Convertendo..." : "Confirmar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConvertingId(null)}
                        className="flex h-7 flex-1 items-center justify-center rounded-md border border-[#D0D5DD] text-xs font-medium text-[#344054]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva um comentário..."
          rows={2}
          className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
        />
        {mentionableMembers.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[#98A2B3]">Marcar:</span>
            {mentionableMembers
              .filter((m) => m.id !== currentUserId)
              .map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleMention(member.id)}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    mentioned.includes(member.id)
                      ? "bg-[#FF2B00] text-white"
                      : "border border-[#E4E7EC] text-[#475467] hover:bg-[#F6F7FB]"
                  }`}
                >
                  @{member.name}
                </button>
              ))}
          </div>
        )}
        {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
        <button
          type="submit"
          disabled={loading || !body.trim()}
          className="self-end flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#FF2B00" }}
        >
          {loading ? "Salvando..." : "Comentar"}
        </button>
      </form>
    </section>
  );
}
