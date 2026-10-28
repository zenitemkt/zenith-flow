import { NextResponse } from "next/server";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";

const GRAPH = "https://graph.facebook.com/v23.0";

/**
 * Ações usadas para gravar os vídeos da Análise do App da Meta (acesso avançado do WhatsApp):
 * enviar uma mensagem e criar um modelo, com o número de teste. O token temporário vem do formulário
 * e não é guardado.
 */
export async function POST(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || !canManageIntegrations(membership.role)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? "").trim();
  if (!token) return NextResponse.json({ error: "Informe o token." }, { status: 400 });

  let url: string;
  let payload: Record<string, unknown>;
  if (body?.action === "send") {
    url = `${GRAPH}/${body.phoneNumberId}/messages`;
    const to = String(body.to ?? "").replace(/\D/g, "");
    payload = body.text
      ? { messaging_product: "whatsapp", to, type: "text", text: { body: String(body.text) } }
      : { messaging_product: "whatsapp", to, type: "template", template: { name: "hello_world", language: { code: "en_US" } } };
  } else if (body?.action === "template") {
    url = `${GRAPH}/${body.wabaId}/message_templates`;
    payload = {
      name: String(body.templateName || "aviso_milena"),
      language: "pt_BR",
      category: "UTILITY",
      components: [{ type: "BODY", text: "Aviso da assistente Milena: {{1}}", example: { body_text: [["novo contato no WhatsApp"]] } }],
    };
  } else {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json({ ok: response.ok, status: response.status, data }, { status: response.ok ? 200 : 400 });
}
