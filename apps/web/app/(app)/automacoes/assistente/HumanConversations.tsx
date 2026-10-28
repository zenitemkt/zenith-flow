"use client";

import { useState } from "react";

interface Props {
  conversations: { id: string; name: string; updatedAt: string }[];
}

/** Conversas em atendimento humano (assistente pausada) com o botão de devolver para ela. */
export function HumanConversations({ conversations }: Props) {
  const [list, setList] = useState(conversations);

  async function giveBack(id: string) {
    const response = await fetch("/api/admin/assistant-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: id }) });
    if (response.ok) setList((current) => current.filter((c) => c.id !== id));
  }

  return (
    <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5">
      <h2 className="text-sm font-semibold text-[#101828]">Em atendimento humano</h2>
      <p className="mb-3 text-xs text-[#667085]">A assistente para quando alguém pede um humano ou quando a equipe responde pelo celular.</p>
      {list.length === 0 ? (
        <p className="rounded-lg bg-[#F9FAFB] py-6 text-center text-sm text-[#667085]">Nenhuma conversa pausada.</p>
      ) : (
        <ul className="divide-y divide-[#EEF0F3] text-sm">
          {list.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span>{c.name}</span>
              <button type="button" onClick={() => giveBack(c.id)} className="rounded-lg border border-[#D0D5DD] px-3 py-1 text-xs font-medium text-[#344054] hover:bg-[#F9FAFB]">
                Devolver para a assistente
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
