"use client";

import { useState } from "react";

const inputClass = "w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#FC4C13]";

/** Cartão para gravar os vídeos da Análise do App da Meta (enviar mensagem e criar modelo). */
export function MetaReviewCard() {
  const [form, setForm] = useState({ token: "", phoneNumberId: "1446970091827002", wabaId: "2045560566093831", to: "", text: "", templateName: "aviso_milena" });
  const [result, setResult] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }) });

  async function run(action: "send" | "template") {
    setBusy(true);
    const response = await fetch("/api/admin/assistant-meta-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...form }) });
    const data = await response.json().catch(() => ({}));
    setResult(`${data.ok ? "Sucesso" : "Erro"} (${data.status ?? response.status}): ${JSON.stringify(data.data ?? data.error)}`);
    setBusy(false);
  }

  return (
    <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5">
      <h2 className="text-sm font-semibold text-[#101828]">Teste para a análise da Meta</h2>
      <p className="mb-4 text-xs text-[#667085]">Use com o número de teste para gravar os vídeos do acesso avançado do WhatsApp. O token não é salvo.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm text-[#344054]">Token de acesso (Etapa 1 da Meta)<input className={`${inputClass} mt-1`} {...field("token")} /></label>
        <label className="text-sm text-[#344054]">ID do número de teste<input className={`${inputClass} mt-1`} {...field("phoneNumberId")} /></label>
        <label className="text-sm text-[#344054]">ID da conta do WhatsApp Business<input className={`${inputClass} mt-1`} {...field("wabaId")} /></label>
        <label className="text-sm text-[#344054]">Enviar para (com DDI)<input className={`${inputClass} mt-1`} placeholder="5519999999999" {...field("to")} /></label>
        <label className="text-sm text-[#344054]">Texto (vazio = modelo hello_world)<input className={`${inputClass} mt-1`} {...field("text")} /></label>
        <label className="text-sm text-[#344054]">Nome do modelo a criar<input className={`${inputClass} mt-1`} {...field("templateName")} /></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => run("send")} className="rounded-lg bg-[#FC4C13] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Enviar mensagem de teste</button>
        <button type="button" disabled={busy} onClick={() => run("template")} className="rounded-lg border border-[#D0D5DD] px-4 py-2 text-sm font-semibold text-[#344054] disabled:opacity-50">Criar modelo de mensagem</button>
      </div>
      {result && <pre className="mt-3 overflow-x-auto rounded-lg bg-[#F9FAFB] p-3 text-xs text-[#344054]">{result}</pre>}
    </section>
  );
}
