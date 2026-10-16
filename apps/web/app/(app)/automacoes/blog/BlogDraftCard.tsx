"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@zenite-mkt/ui";
import { VALID_BLOG_CATEGORIES, VALID_COVER_KEYS } from "@/lib/blog-validation";

interface DraftComment {
  id: string;
  body: string;
  status: string;
  agentReply: string | null;
  createdAt: string;
}

export interface BlogDraftSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  seoTitle: string | null;
  focusKeyword: string | null;
  category: string | null;
  cover: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  origin: string;
  createdAt: string;
  comments: DraftComment[];
  suggestedRelated: string[] | null;
  suggestedFaq: Array<{ q: string; a: string }> | null;
  suggestedCoverSearchTerm: string | null;
}

const STATUS_LABELS: Record<string, string> = { PENDING: "Pendente", APPROVED: "Publicado", REJECTED: "Rejeitado" };
const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-[#FFFAEB] text-[#B54708]",
  APPROVED: "bg-[#ECFDF3] text-[#027A48]",
  REJECTED: "bg-[#FEF3F2] text-[#B42318]",
};

export function BlogDraftCard({ draft }: { draft: BlogDraftSummary }) {
  const router = useRouter();
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [commentText, setCommentText] = useState("");

  const [title, setTitle] = useState(draft.title);
  const [excerpt, setExcerpt] = useState(draft.excerpt);
  const [content, setContent] = useState(draft.content);
  const [category, setCategory] = useState(draft.category ?? "");
  const [cover, setCover] = useState(draft.cover ?? "");
  const [focusKeyword, setFocusKeyword] = useState(draft.focusKeyword ?? "");

  const [relatedCsv, setRelatedCsv] = useState((draft.suggestedRelated ?? []).join(", "));
  const [coverSearchTerm, setCoverSearchTerm] = useState(draft.suggestedCoverSearchTerm ?? draft.focusKeyword ?? "");
  const [faqText, setFaqText] = useState((draft.suggestedFaq ?? []).map((item) => `${item.q} :: ${item.a}`).join("\n"));

  async function saveEdits() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/blog-drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, excerpt, content, category, cover, focusKeyword }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Não foi possível salvar.");
        return;
      }
      toast.success("Rascunho atualizado.");
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    const related = relatedCsv.split(",").map((s) => s.trim()).filter(Boolean);
    let faq: Array<{ q: string; a: string }> = [];
    try {
      faq = faqText.trim()
        ? faqText
            .split("\n")
            .filter((line) => line.includes("::"))
            .map((line) => {
              const [q, ...rest] = line.split("::");
              return { q: q!.trim(), a: rest.join("::").trim() };
            })
        : [];
    } catch {
      toast.error('FAQ inválido — use uma linha por pergunta, no formato "pergunta :: resposta".');
      return;
    }
    if (faq.length < 3) {
      toast.error("Informe pelo menos 3 linhas de FAQ (pergunta :: resposta).");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/blog-drafts/${draft.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ related, faq, coverSearchTerm }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const issuesText = Array.isArray(data?.issues) ? ` — ${data.issues.map((i: { message: string }) => i.message).join(" · ")}` : "";
        toast.error((data?.error ?? "Não foi possível publicar.") + issuesText);
        return;
      }
      toast.success("Artigo publicado.");
      setApproving(false);
      router.refresh();
    } catch {
      toast.error("Erro de rede — tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function sendComment() {
    if (!commentText.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/blog-drafts/${draft.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentText }),
      });
      if (!response.ok) {
        toast.error("Não foi possível enviar o comentário.");
        return;
      }
      toast.success("Solicitação enviada — o agente vai ler na próxima rodada.");
      setCommentText("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[draft.status]}`}>{STATUS_LABELS[draft.status]}</span>
            <span className="text-xs text-[#98A2B3]">{draft.category ?? "sem categoria"}</span>
          </div>
          <h3 className="text-sm font-semibold text-[#101828]">{draft.title}</h3>
          <p className="mt-0.5 text-xs text-[#667085]">/{draft.slug}</p>
        </div>
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs font-semibold text-[#FF2B00]">
          {expanded ? "Recolher" : "Ver detalhes"}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-[#EEF0F3] pt-3">
          {!editing ? (
            <>
              <p className="whitespace-pre-wrap text-sm text-[#344054]">{draft.excerpt}</p>
              <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#F9FAFB] p-3 text-xs text-[#475467]">{draft.content}</pre>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm" placeholder="Título" />
              <input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm" placeholder="Excerpt (70-160 caracteres)" />
              <div className="grid gap-2 sm:grid-cols-3">
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm">
                  <option value="">Categoria…</option>
                  {VALID_BLOG_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select value={cover} onChange={(e) => setCover(e.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm">
                  <option value="">Capa…</option>
                  {VALID_COVER_KEYS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input value={focusKeyword} onChange={(e) => setFocusKeyword(e.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm" placeholder="Focus keyword" />
              </div>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12} className="rounded-lg border border-[#D0D5DD] p-3 font-mono text-xs" />
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={saveEdits} className="h-9 rounded-lg bg-[#101828] px-4 text-sm font-semibold text-white disabled:opacity-50">
                  Salvar
                </button>
                <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-lg border border-[#D0D5DD] px-4 text-sm font-medium text-[#475467]">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {draft.status === "PENDING" && !editing && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setEditing(true)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-xs font-semibold text-[#475467]">
                Editar texto
              </button>
              <button type="button" onClick={() => setApproving((v) => !v)} className="h-9 rounded-lg bg-[#16A36A] px-3 text-xs font-semibold text-white">
                {approving ? "Fechar aprovação" : "Aprovar e publicar"}
              </button>
            </div>
          )}

          {approving && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-[#EEF0F3] bg-[#F9FAFB] p-3">
              <label className="text-xs font-medium text-[#475467]">
                Slugs relacionados (separados por vírgula, 1-3)
                <input value={relatedCsv} onChange={(e) => setRelatedCsv(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[#D0D5DD] px-3 text-sm" placeholder="seo-na-pratica, custo-por-lead-como-calcular" />
              </label>
              <label className="text-xs font-medium text-[#475467]">
                Termo de busca da foto no Wikimedia Commons (em inglês, 2-4 palavras)
                <input value={coverSearchTerm} onChange={(e) => setCoverSearchTerm(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[#D0D5DD] px-3 text-sm" placeholder="laptop analytics dashboard" />
              </label>
              <label className="text-xs font-medium text-[#475467]">
                FAQ (uma linha por pergunta, formato &quot;pergunta :: resposta&quot;, mín. 3)
                <textarea value={faqText} onChange={(e) => setFaqText(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-[#D0D5DD] p-2 text-sm" placeholder={"Qual é um bom CPL? :: Depende do ticket médio..."} />
              </label>
              <button type="button" disabled={busy} onClick={approve} className="h-9 self-start rounded-lg bg-[#16A36A] px-4 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? "Publicando…" : "Confirmar publicação"}
              </button>
            </div>
          )}

          <div className="mt-3 border-t border-[#EEF0F3] pt-3">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Solicitar alteração à IA</h4>
            {draft.comments.map((comment) => (
              <div key={comment.id} className="mb-2 rounded-lg bg-[#F9FAFB] p-2 text-xs">
                <p className="text-[#344054]">{comment.body}</p>
                <p className="mt-0.5 text-[#98A2B3]">{comment.status === "open" ? "Aguardando o agente" : "Respondido"}</p>
                {comment.agentReply && <p className="mt-1 text-[#027A48]">Resposta do agente: {comment.agentReply}</p>}
              </div>
            ))}
            <div className="flex gap-2">
              <input value={commentText} onChange={(e) => setCommentText(e.target.value)} className="h-9 flex-1 rounded-lg border border-[#D0D5DD] px-3 text-sm" placeholder="Ex.: encurte o segundo parágrafo" />
              <button type="button" disabled={busy || !commentText.trim()} onClick={sendComment} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-xs font-semibold text-[#475467] disabled:opacity-50">
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
