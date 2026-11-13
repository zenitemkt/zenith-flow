"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "DRAFT" | "UPLOADING" | "IN_REVIEW" | "ACTIVE" | "PAUSED" | "REJECTED" | "FAILED";

export interface Creative {
  id: string;
  driveFileId: string;
  name: string;
  fileName: string;
  kind: "IMAGE" | "VIDEO";
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  status: Status;
  missingInDrive: boolean;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  linkUrl: string | null;
  callToAction: string | null;
  lastError: string | null;
  warnings: string[];
}

interface Props {
  serviceEmail: string | null;
  /** Conta Google que envia os arquivos pelo portal (null = não conectada). */
  driveUserEmail: string | null;
  folders: { id: string; name: string; rootFolderId: string; lastSyncAt: string | null; lastSyncError: string | null }[];
  metaAccount: { name: string; canWrite: boolean; active: boolean } | null;
  creatives: Creative[];
}

const STATUS: Record<Status, { label: string; cls: string }> = {
  DRAFT: { label: "Rascunho", cls: "bg-[#F2F4F7] text-[#344054]" },
  UPLOADING: { label: "Enviando", cls: "bg-[#EFF8FF] text-[#175CD3]" },
  IN_REVIEW: { label: "Em análise", cls: "bg-[#FFFAEB] text-[#B54708]" },
  ACTIVE: { label: "No ar", cls: "bg-[#ECFDF3] text-[#027A48]" },
  PAUSED: { label: "Pausado", cls: "bg-[#F2F4F7] text-[#475467]" },
  REJECTED: { label: "Reprovado pela Meta", cls: "bg-[#FEF3F2] text-[#B42318]" },
  FAILED: { label: "Falha no envio", cls: "bg-[#FEF3F2] text-[#B42318]" },
};
const ORDER: Status[] = ["DRAFT", "UPLOADING", "IN_REVIEW", "ACTIVE", "PAUSED", "REJECTED", "FAILED"];
const CTAS: [string, string][] = [
  ["", "Sem botão"],
  ["LEARN_MORE", "Saiba mais"],
  ["WHATSAPP_MESSAGE", "Enviar mensagem no WhatsApp"],
  ["SEND_MESSAGE", "Enviar mensagem"],
  ["SIGN_UP", "Cadastre-se"],
  ["CONTACT_US", "Fale conosco"],
  ["GET_QUOTE", "Pedir orçamento"],
  ["BOOK_NOW", "Agendar"],
  ["SHOP_NOW", "Comprar agora"],
];
const INPUT = "w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00]";

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function CreativeLibrary({ serviceEmail, driveUserEmail, folders, metaAccount, creatives }: Props) {
  const router = useRouter();
  const [folderLink, setFolderLink] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState<Status | "ALL">("ALL");
  const [editing, setEditing] = useState<Creative | null>(null);

  async function call(label: string, url: string, body?: unknown) {
    setBusy(label);
    setMessage(null);
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Não deu certo.");
      setMessage({ ok: true, text: `${data.added ?? 0} novo(s), ${data.updated ?? 0} atualizado(s)${data.missing ? `, ${data.missing} sumiu(ram) do Drive` : ""}.` });
      setFolderLink("");
      router.refresh();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Não deu certo." });
    } finally {
      setBusy(null);
    }
  }

  const counts = new Map<Status, number>();
  for (const c of creatives) counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
  const shown = creatives.filter((c) => filter === "ALL" || c.status === filter);

  return (
    <>
      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="text-sm font-semibold text-[#101828]">Google Drive</h2>
          {!serviceEmail ? (
            <p className="mt-1 text-sm text-[#B54708]">Falta configurar a conta de serviço do Google (variável GOOGLE_DRIVE_SA_JSON na Vercel). Sem ela o sistema não lê o Drive.</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-[#667085]">
                Compartilhe a pasta dos criativos como <strong>Editor</strong> com este e-mail e cole o link dela aqui:
              </p>
              <p className="mt-1 select-all break-all rounded-lg bg-[#F9FAFB] px-3 py-2 font-mono text-xs text-[#101828]">{serviceEmail}</p>
              {folders.map((f) => (
                <div key={f.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#EEF0F3] px-3 py-2 text-sm">
                  <a href={`https://drive.google.com/drive/folders/${f.rootFolderId}`} target="_blank" rel="noreferrer" className="font-medium text-[#101828] hover:underline">
                    {f.name}
                  </a>
                  <span className={`text-xs ${f.lastSyncError ? "text-[#B42318]" : "text-[#667085]"}`}>
                    {f.lastSyncError ?? (f.lastSyncAt ? `lida ${new Date(f.lastSyncAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "ainda não lida")}
                  </span>
                </div>
              ))}
              <p className="mt-2 text-xs text-[#667085]">
                Envio pelo portal:{" "}
                {driveUserEmail ? <strong className="text-[#027A48]">{driveUserEmail}</strong> : <span className="text-[#B54708]">conta Google não conectada</span>} ·{" "}
                <a href="/api/admin/traffic-drive-oauth/start" className="font-semibold text-[#FF2B00]">{driveUserEmail ? "trocar" : "conectar"}</a>
              </p>
              <div className="mt-2 flex gap-2">
                <input value={folderLink} onChange={(e) => setFolderLink(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." className={INPUT} />
                <button type="button" disabled={!folderLink.trim() || busy !== null} onClick={() => call("connect", "/api/ad-creatives/folders", { folder: folderLink })} className="shrink-0 rounded-lg bg-[#101828] px-3 text-sm font-medium text-white disabled:opacity-50">
                  {busy === "connect" ? "Conectando…" : folders.length ? "Adicionar pasta" : "Conectar pasta"}
                </button>
              </div>
            </>
          )}
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="text-sm font-semibold text-[#101828]">Conta de anúncios da Meta</h2>
          {!metaAccount ? (
            <p className="mt-1 text-sm text-[#B54708]">Nenhuma conta de anúncios conectada. Conecte em Sistema → Integrações.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-[#101828]">{metaAccount.name}</p>
              <p className={`mt-1 text-xs ${metaAccount.canWrite && metaAccount.active ? "text-[#027A48]" : "text-[#B54708]"}`}>
                {!metaAccount.active
                  ? "A conexão está com erro. Reconecte em Sistema → Integrações."
                  : metaAccount.canWrite
                    ? "Com permissão para criar e editar anúncios."
                    : "Hoje só com permissão de leitura. O envio dos criativos e a criação de campanhas entram na próxima etapa, que pede a permissão de escrita."}
              </p>
            </>
          )}
        </div>
      </section>

      {message && <p className={`rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#FEF3F2] text-[#B42318]"}`}>{message.text}</p>}

      {folders.length > 0 && (
        <>
          {driveUserEmail ? (
            <CreativeUploader onDone={() => router.refresh()} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FEDF89] bg-[#FFFAEB] p-4">
              <p className="text-sm text-[#B54708]">Para enviar criativos direto pelo portal, conecte a conta Google dona da pasta. O arquivo fica no seu Drive, no seu espaço.</p>
              <a href="/api/admin/traffic-drive-oauth/start" className="shrink-0 rounded-lg bg-[#101828] px-4 py-2 text-sm font-medium text-white">Conectar conta Google</a>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setFilter("ALL")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${filter === "ALL" ? "bg-[#101828] text-white" : "border border-[#D0D5DD] bg-white text-[#344054]"}`}>
              Todos ({creatives.length})
            </button>
            {ORDER.filter((s) => counts.get(s)).map((s) => (
              <button key={s} type="button" onClick={() => setFilter(s)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${filter === s ? "bg-[#101828] text-white" : "border border-[#D0D5DD] bg-white text-[#344054]"}`}>
                {STATUS[s].label} ({counts.get(s)})
              </button>
            ))}
            <button type="button" disabled={busy !== null} onClick={() => call("sync", "/api/ad-creatives/sync")} className="ml-auto rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50">
              {busy === "sync" ? "Lendo o Drive…" : "Sincronizar com o Drive"}
            </button>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#D0D5DD] bg-white p-10 text-center text-sm text-[#667085]">
              {creatives.length === 0 ? 'Nenhum criativo ainda. Coloque imagens ou vídeos na pasta "1 - Para subir" do Drive e clique em Sincronizar.' : "Nenhum criativo nessa situação."}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shown.map((c) => {
                const textsOk = Boolean(c.primaryText && c.linkUrl);
                return (
                  <article key={c.id} className="flex flex-col overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
                    <div className="relative aspect-square bg-[#F2F4F7]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/ad-creatives/${c.id}/thumbnail`} alt="" loading="lazy" className="h-full w-full object-contain" />
                      <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span>
                      {c.kind === "VIDEO" && <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">Vídeo</span>}
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5 p-3">
                      <p className="truncate text-sm font-semibold text-[#101828]" title={c.name}>{c.name}</p>
                      <p className="text-xs text-[#667085]">
                        {c.width && c.height ? `${c.width}×${c.height}` : "tamanho não lido"}
                        {c.sizeBytes ? ` · ${fmtSize(c.sizeBytes)}` : ""}
                      </p>
                      <p className={`text-xs font-medium ${textsOk ? "text-[#027A48]" : "text-[#B54708]"}`}>{textsOk ? "Textos do anúncio preenchidos" : "Faltam os textos do anúncio"}</p>
                      {c.missingInDrive && <p className="text-xs text-[#B42318]">O arquivo não está mais no Drive.</p>}
                      {c.lastError && <p className="break-words text-xs text-[#B42318]">{c.lastError}</p>}
                      {c.warnings.map((w) => (
                        <p key={w} className="text-xs text-[#B54708]">{w}</p>
                      ))}
                      <div className="mt-auto flex gap-2 pt-2">
                        <button type="button" onClick={() => setEditing(c)} className="flex-1 rounded-lg bg-[#101828] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1D2939]">
                          Textos do anúncio
                        </button>
                        <a href={`https://drive.google.com/file/d/${c.driveFileId}/view`} target="_blank" rel="noreferrer" className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-medium text-[#344054] hover:bg-[#F9FAFB]">
                          Drive
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {editing && <CreativeEditor creative={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />}
    </>
  );
}

export function CreativeEditor({ creative, onClose, onSaved }: { creative: Pick<Creative, "id" | "name" | "fileName" | "primaryText" | "headline" | "description" | "linkUrl" | "callToAction">; onClose: () => void; onSaved: (values: { name: string; primaryText: string; headline: string; description: string; linkUrl: string; callToAction: string }) => void }) {
  const [form, setForm] = useState({
    name: creative.name,
    primaryText: creative.primaryText ?? "",
    headline: creative.headline ?? "",
    description: creative.description ?? "",
    linkUrl: creative.linkUrl ?? "",
    callToAction: creative.callToAction ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save() {
    setSaving(true);
    setError("");
    const response = await fetch(`/api/ad-creatives/${creative.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (!response.ok) {
      setError((await response.json().catch(() => null))?.error ?? "Não consegui salvar.");
      return;
    }
    onSaved(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-[#101828]">Textos do anúncio</h2>
        <p className="mb-4 text-xs text-[#667085]">{creative.fileName}</p>
        <div className="flex flex-col gap-3 text-sm font-medium text-[#344054]">
          <label className="flex flex-col gap-1">Nome do criativo<input value={form.name} onChange={set("name")} className={INPUT} /></label>
          <label className="flex flex-col gap-1">Texto principal<textarea value={form.primaryText} onChange={set("primaryText")} rows={5} className={INPUT} /></label>
          <label className="flex flex-col gap-1">Título<input value={form.headline} onChange={set("headline")} maxLength={255} className={INPUT} /></label>
          <label className="flex flex-col gap-1">Descrição (opcional)<input value={form.description} onChange={set("description")} maxLength={255} className={INPUT} /></label>
          <label className="flex flex-col gap-1">Link de destino<input value={form.linkUrl} onChange={set("linkUrl")} placeholder="https://..." className={INPUT} /></label>
          <label className="flex flex-col gap-1">
            Botão
            <select value={form.callToAction} onChange={set("callToAction")} className={INPUT}>
              {CTAS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="mt-3 text-xs text-[#B42318]">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#D0D5DD] px-4 py-2 text-sm font-medium text-[#344054]">Cancelar</button>
          <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-[#101828] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

interface UploadItem {
  name: string;
  progress: number;
  error?: string;
  done?: boolean;
}

/** Envia arquivos do computador direto para "1 - Para subir" no Drive e sincroniza a biblioteca no fim. */
export function CreativeUploader({ onDone, compact = false }: { onDone: (driveFileIds: string[]) => void; compact?: boolean }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const patch = (index: number, change: Partial<UploadItem>) => setItems((list) => list.map((x, i) => (i === index ? { ...x, ...change } : x)));

  function put(url: string, file: File, onProgress: (pct: number) => void): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(`O Drive recusou o arquivo (${xhr.status}).`));
        try {
          resolve((JSON.parse(xhr.responseText) as { id?: string }).id ?? null);
        } catch {
          resolve(null);
        }
      };
      xhr.onerror = () => reject(new Error("Falha de conexão durante o envio."));
      xhr.send(file);
    });
  }

  async function upload(files: File[]) {
    if (!files.length || busy) return;
    const start = items.length;
    setItems((list) => [...list, ...files.map((f) => ({ name: f.name, progress: 0 }))]);
    setBusy(true);
    const sentIds: string[] = [];
    for (const [offset, file] of files.entries()) {
      const index = start + offset;
      try {
        const res = await fetch("/api/ad-creatives/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, mimeType: file.type, size: file.size }) });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Não consegui preparar o envio.");
        const driveId = await put(data.uploadUrl, file, (pct) => patch(index, { progress: pct }));
        if (driveId) sentIds.push(driveId);
        patch(index, { progress: 100, done: true });
      } catch (error) {
        patch(index, { error: error instanceof Error ? error.message : "Falhou." });
      }
    }
    if (sentIds.length) await fetch("/api/ad-creatives/sync", { method: "POST" }).catch(() => null);
    setBusy(false);
    onDone(sentIds);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        upload(Array.from(e.dataTransfer.files));
      }}
      className={`rounded-xl border-2 border-dashed ${compact ? "p-3" : "p-5"} text-center ${dragging ? "border-[#FF2B00] bg-[#FFF4ED]" : "border-[#D0D5DD] bg-white"}`}
    >
      <p className="text-sm font-semibold text-[#101828]">Arraste imagens ou vídeos aqui</p>
      <p className="text-xs text-[#667085]">Vão direto para a pasta &quot;1 - Para subir&quot; do Drive e aparecem abaixo como Rascunho. JPG ou PNG até 30 MB, MP4 ou MOV até 4 GB.</p>
      <label className="mt-3 inline-block cursor-pointer rounded-lg bg-[#101828] px-4 py-2 text-sm font-medium text-white">
        {busy ? "Enviando…" : "Escolher arquivos"}
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,video/mp4,video/quicktime"
          hidden
          disabled={busy}
          onChange={(e) => {
            upload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </label>
      {items.length > 0 && (
        <ul className="mx-auto mt-3 max-w-xl space-y-1.5 text-left">
          {items.map((item, i) => (
            <li key={i} className="text-xs">
              <div className="flex justify-between gap-2">
                <span className="truncate text-[#344054]">{item.name}</span>
                <span className={item.error ? "text-[#B42318]" : item.done ? "text-[#027A48]" : "text-[#667085]"}>{item.error ? "falhou" : item.done ? "enviado" : `${item.progress}%`}</span>
              </div>
              {item.error ? <p className="text-[#B42318]">{item.error}</p> : <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[#F2F4F7]"><div className="h-full bg-[#FF2B00] transition-all" style={{ width: `${item.progress}%` }} /></div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
