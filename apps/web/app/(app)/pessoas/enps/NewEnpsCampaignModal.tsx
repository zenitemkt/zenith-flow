"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { DEFAULT_ENPS_QUESTION, DEFAULT_ENPS_COMMENT_PROMPT } from "@/lib/enps";

interface EmployeeOption {
  id: string;
  name: string;
  eligible: boolean;
}

const TEXTAREA_CLASS =
  "min-h-[64px] rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]";

export function NewEnpsCampaignModal({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [question, setQuestion] = useState(DEFAULT_ENPS_QUESTION);
  const [commentPrompt, setCommentPrompt] = useState(DEFAULT_ENPS_COMMENT_PROMPT);
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setName("");
    setQuestion(DEFAULT_ENPS_QUESTION);
    setCommentPrompt(DEFAULT_ENPS_COMMENT_PROMPT);
    setHeaderText("");
    setFooterText("");
    setSelected(new Set());
    setError(null);
    setOpen(false);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (selected.size === 0) {
      setError("Selecione ao menos uma pessoa.");
      return;
    }
    setLoading(true);

    const response = await fetch("/api/enps/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        question,
        commentPrompt,
        headerText: headerText || null,
        footerText: footerText || null,
        employeeIds: Array.from(selected),
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível criar a pesquisa.");
      return;
    }

    close();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "#FF2B00" }}
      >
        Nova pesquisa
      </button>
      <Modal open={open} onClose={close} title="Nova pesquisa de eNPS">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="rounded-lg bg-[#EEF2FF] px-3 py-2 text-xs text-[#3730A3]">
            Anônima: as respostas nunca são associadas a quem respondeu, mesmo pra quem gerencia a pesquisa.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="enps-name" className="text-sm font-medium text-[#344054]">
              Nome da pesquisa
            </label>
            <input
              id="enps-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: eNPS semestral — H2 2026"
              className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="enps-header" className="text-sm font-medium text-[#344054]">
              Cabeçalho (opcional)
            </label>
            <textarea id="enps-header" value={headerText} onChange={(e) => setHeaderText(e.target.value)} className={TEXTAREA_CLASS} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="enps-question" className="text-sm font-medium text-[#344054]">
              Pergunta (0 a 10)
            </label>
            <textarea
              id="enps-question"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className={TEXTAREA_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="enps-comment-prompt" className="text-sm font-medium text-[#344054]">
              Pergunta de comentário (opcional)
            </label>
            <input
              id="enps-comment-prompt"
              value={commentPrompt}
              onChange={(e) => setCommentPrompt(e.target.value)}
              className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="enps-footer" className="text-sm font-medium text-[#344054]">
              Rodapé (opcional)
            </label>
            <textarea id="enps-footer" value={footerText} onChange={(e) => setFooterText(e.target.value)} className={TEXTAREA_CLASS} />
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-[#344054]">Pessoas ({selected.size} selecionada(s))</p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-[#E4E7EC]">
              {employees.length === 0 && (
                <p className="p-3 text-sm text-[#98A2B3]">Nenhuma pessoa ativa com e-mail cadastrado.</p>
              )}
              {employees.map((e) => (
                <label
                  key={e.id}
                  className={`flex items-center gap-2 border-b border-[#EEF0F3] px-3 py-2 text-sm last:border-b-0 ${
                    e.eligible ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                  }`}
                >
                  <input type="checkbox" disabled={!e.eligible} checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                  <span className="text-[#101828]">{e.name}</span>
                  {!e.eligible && <span className="ml-auto text-xs text-[#98A2B3]">sem e-mail</span>}
                </label>
              ))}
            </div>
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
              {loading ? "Criando..." : "Criar pesquisa"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
