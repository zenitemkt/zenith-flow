"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@zenite-mkt/ui";
import { VALID_BLOG_CATEGORIES, VALID_COVER_KEYS } from "@/lib/blog-validation";

function nowLocalInputValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

/** Pra artigo publicado por fora da esteira normal (ex.: extraordinário, feito direto no repositório) — só registra o histórico, nunca escreve no GitHub. */
export function ManualBlogRecordForm({ canManage }: { canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("");
  const [cover, setCover] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [content, setContent] = useState("");
  const [publishedAt, setPublishedAt] = useState(nowLocalInputValue());

  if (!canManage) return null;

  async function submit() {
    if (!slug.trim() || !title.trim() || !category || !cover) {
      toast.error("Preencha slug, título, categoria e capa.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/blog-drafts/manual-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug.trim(), title, excerpt, category, cover, focusKeyword, content, publishedAt: new Date(publishedAt).toISOString() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data?.error ?? "Não foi possível registrar.");
        return;
      }
      toast.success("Registrado no histórico.");
      setOpen(false);
      setSlug(""); setTitle(""); setExcerpt(""); setCategory(""); setCover(""); setFocusKeyword(""); setContent(""); setPublishedAt(nowLocalInputValue());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm font-semibold text-[#344054]">
        {open ? "Fechar" : "+ Registrar artigo publicado por fora desta tela"}
      </button>
      {!open ? (
        <p className="mt-1 text-xs text-[#667085]">Use quando um artigo foi publicado direto no repositório (ex.: uma edição extraordinária) e precisa aparecer aqui no histórico, com a data real de publicação.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug-do-artigo (igual ao arquivo do repositório)" className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm" />
          <input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Resumo curto (opcional)" className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm" />
          <div className="grid gap-2 sm:grid-cols-3">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm">
              <option value="">Categoria…</option>
              {VALID_BLOG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={cover} onChange={(e) => setCover(e.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm">
              <option value="">Capa…</option>
              {VALID_COVER_KEYS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={focusKeyword} onChange={(e) => setFocusKeyword(e.target.value)} placeholder="Focus keyword (opcional)" className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm" />
          </div>
          <label className="block text-xs font-medium text-[#475467]">
            Publicado em (data e hora reais)
            <input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[#D0D5DD] px-3 text-sm" />
          </label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} placeholder="Conteúdo (opcional — só pra referência nesta tela, não republica nada)" className="rounded-lg border border-[#D0D5DD] p-3 font-mono text-xs" />
          <button type="button" disabled={busy} onClick={() => void submit()} className="h-9 self-start rounded-lg bg-[#101828] px-4 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Registrando..." : "Registrar no histórico"}
          </button>
        </div>
      )}
    </section>
  );
}
