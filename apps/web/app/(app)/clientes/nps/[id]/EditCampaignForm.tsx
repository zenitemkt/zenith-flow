"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const TEXTAREA_CLASS =
  "min-h-[64px] rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]";

interface Props {
  campaignId: string;
  initial: {
    name: string;
    question: string;
    commentPrompt: string;
    headerText: string;
    footerText: string;
  };
}

export function EditCampaignForm({ campaignId, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [question, setQuestion] = useState(initial.question);
  const [commentPrompt, setCommentPrompt] = useState(initial.commentPrompt);
  const [headerText, setHeaderText] = useState(initial.headerText);
  const [footerText, setFooterText] = useState(initial.footerText);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/nps/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        question,
        commentPrompt: commentPrompt || null,
        headerText: headerText || null,
        footerText: footerText || null,
      }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível salvar.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-name" className="text-sm font-medium text-[#344054]">
          Nome da pesquisa
        </label>
        <input
          id="edit-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5]"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-header" className="text-sm font-medium text-[#344054]">
          Cabeçalho
        </label>
        <textarea id="edit-header" value={headerText} onChange={(e) => setHeaderText(e.target.value)} className={TEXTAREA_CLASS} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-question" className="text-sm font-medium text-[#344054]">
          Pergunta (0 a 10)
        </label>
        <textarea
          id="edit-question"
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className={TEXTAREA_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-comment-prompt" className="text-sm font-medium text-[#344054]">
          Pergunta de comentário
        </label>
        <input
          id="edit-comment-prompt"
          value={commentPrompt}
          onChange={(e) => setCommentPrompt(e.target.value)}
          className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5]"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-footer" className="text-sm font-medium text-[#344054]">
          Rodapé
        </label>
        <textarea id="edit-footer" value={footerText} onChange={(e) => setFooterText(e.target.value)} className={TEXTAREA_CLASS} />
      </div>

      {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#6847F5" }}
        >
          {loading ? "Salvando..." : "Salvar alterações"}
        </button>
        {saved && <span className="text-xs font-medium text-[#166534]">Salvo!</span>}
      </div>
    </form>
  );
}
