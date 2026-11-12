import { createHmac } from "node:crypto";
import { prisma, Prisma } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";
import { META_GRAPH_API_VERSION, MetaApiError, getAppBaseUrl } from "@/lib/meta-ads";
import { LeadIdentityConflictError, upsertLeadSubmission } from "@/lib/lead-contact";
import { mapLeadFields } from "@/lib/meta-lead-fields";
import { raiseSystemAlert } from "@/lib/system-alerts";

/**
 * Lead Ads (formulário nativo da Meta) → CRM. O app da Meta assina o campo
 * `leadgen` das Páginas; a Meta só manda o `leadgen_id` no webhook e os dados
 * são buscados com o token da Página (permissão `leads_retrieval`). O botão
 * "Conectar CRM" do Gerenciador só lista parceiros oficiais — este caminho
 * não depende dele.
 */
const GRAPH = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;
export const META_LEADS_SCOPES = ["leads_retrieval", "pages_manage_ads"] as const;
export const META_LEAD_SOURCE = "Meta Lead Ads";

async function graph<T>(method: "GET" | "POST", path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  const init: RequestInit = { method, cache: "no-store" };
  if (method === "GET") for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  else init.body = new URLSearchParams(params);
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as { error?: { message?: string; error_user_msg?: string } } | null)?.error;
    throw new MetaApiError(error?.error_user_msg ?? error?.message ?? "Erro na Graph API da Meta.", response.status, body);
  }
  return body as T;
}

function appSecret(): string {
  const secret = process.env.META_APP_SECRET;
  if (!secret) throw new Error("META_APP_SECRET não configurada.");
  return secret;
}

/** Derivado do segredo do app — não precisa de variável de ambiente nova e nunca aparece na tela. */
export function leadsWebhookVerifyToken(): string {
  return createHmac("sha256", appSecret()).update("meta-leadgen-webhook").digest("hex").slice(0, 32);
}

export function leadsWebhookUrl(): string {
  return `${getAppBaseUrl()}/api/meta/leads/webhook`;
}

/** Assina o campo `leadgen` no app (uma vez) e na Página (por Página). */
export async function subscribePageToLeads(pageId: string, pageToken: string): Promise<void> {
  const appId = process.env.META_APP_ID;
  if (!appId) throw new Error("META_APP_ID não configurada.");
  await graph("POST", `/${appId}/subscriptions`, {
    object: "page",
    callback_url: leadsWebhookUrl(),
    fields: "leadgen",
    verify_token: leadsWebhookVerifyToken(),
    access_token: `${appId}|${appSecret()}`,
  });
  await graph("POST", `/${pageId}/subscribed_apps`, { subscribed_fields: "leadgen", access_token: pageToken });
}

export interface LeadForm {
  id: string;
  name: string;
  status: string;
  leadsCount: number | null;
}

export async function listLeadForms(pageId: string, pageToken: string): Promise<LeadForm[]> {
  const result = await graph<{ data: Array<{ id: string; name: string; status: string; leads_count?: number }> }>("GET", `/${pageId}/leadgen_forms`, {
    fields: "id,name,status,leads_count",
    limit: "50",
    access_token: pageToken,
  });
  return result.data.map((f) => ({ id: f.id, name: f.name, status: f.status, leadsCount: f.leads_count ?? null }));
}

interface GraphLead {
  id: string;
  created_time?: string;
  form_id?: string;
  ad_id?: string;
  ad_name?: string;
  campaign_name?: string;
  platform?: string;
  field_data?: Array<{ name: string; values?: string[] }>;
}

const LEAD_FIELDS = "id,created_time,form_id,ad_id,ad_name,campaign_name,platform,field_data";

async function loadConnectionByPage(pageId: string) {
  return prisma.socialConnection.findFirst({ where: { platform: "FACEBOOK", externalId: pageId, leadsEnabled: true, status: "ACTIVE" } });
}

/**
 * Busca e grava um lead. Idempotente pelo `leadgenId` único: reenvio do
 * webhook ou importação repetida não duplica. Devolve o status final.
 */
export async function ingestMetaLead(input: {
  connection: { id: string; agencyId: string; externalId: string; accessTokenEnc: string };
  leadgenId: string;
  origin: "webhook" | "import";
  lead?: GraphLead;
  formName?: string | null;
}): Promise<"imported" | "duplicate" | "failed"> {
  const { connection } = input;
  let event;
  try {
    event = await prisma.metaLeadEvent.create({
      data: { agencyId: connection.agencyId, connectionId: connection.id, leadgenId: input.leadgenId, pageId: connection.externalId, status: "pending", origin: input.origin },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Já visto: só tenta de novo se a vez anterior falhou.
      const existing = await prisma.metaLeadEvent.findUnique({ where: { leadgenId: input.leadgenId } });
      if (!existing || existing.status !== "failed") return "duplicate";
      event = await prisma.metaLeadEvent.update({ where: { id: existing.id }, data: { status: "pending", error: null } });
    } else throw error;
  }

  try {
    const token = decryptSecret(connection.accessTokenEnc);
    const lead = input.lead ?? (await graph<GraphLead>("GET", `/${input.leadgenId}`, { fields: LEAD_FIELDS, access_token: token }));
    const formName =
      input.formName ??
      (lead.form_id ? await graph<{ name?: string }>("GET", `/${lead.form_id}`, { fields: "name", access_token: token }).then((f) => f.name ?? null).catch(() => null) : null);
    const fields = mapLeadFields(lead.field_data);
    const name = fields.name ?? fields.email ?? fields.phone ?? "Lead do formulário da Meta";
    const summary = [
      formName ? `Formulário: ${formName}` : null,
      lead.campaign_name ? `Campanha: ${lead.campaign_name}` : null,
      lead.ad_name ? `Anúncio: ${lead.ad_name}` : null,
      ...fields.extras,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await prisma.$transaction((tx) =>
      upsertLeadSubmission(tx, {
        agencyId: connection.agencyId,
        name,
        email: fields.email,
        phone: fields.phone,
        company: fields.company,
        city: fields.city,
        service: fields.service,
        investment: fields.investment,
        employees: fields.employees,
        interest: fields.interest,
        source: META_LEAD_SOURCE,
        summary: summary || null,
        trackingContext: {
          leadgenId: input.leadgenId,
          formId: lead.form_id ?? null,
          formName,
          adId: lead.ad_id ?? null,
          adName: lead.ad_name ?? null,
          campaignName: lead.campaign_name ?? null,
          platform: lead.platform ?? null,
        },
        createOpportunity: "always",
      }),
    );
    await prisma.metaLeadEvent.update({
      where: { id: event.id },
      data: {
        status: "imported",
        leadId: result.lead.id,
        submissionId: result.submission.id,
        formId: lead.form_id ?? null,
        formName,
        adId: lead.ad_id ?? null,
        campaignName: lead.campaign_name ?? null,
        leadCreatedAt: lead.created_time ? new Date(lead.created_time) : null,
      },
    });
    return "imported";
  } catch (error) {
    const message =
      error instanceof LeadIdentityConflictError
        ? "E-mail e telefone pertencem a leads diferentes no CRM — confira manualmente."
        : error instanceof Error
          ? error.message
          : "Erro desconhecido.";
    await prisma.metaLeadEvent.update({ where: { id: event.id }, data: { status: "failed", error: message.slice(0, 500) } });
    await raiseSystemAlert({
      agencyId: connection.agencyId,
      key: `meta-leads:${input.leadgenId}`,
      category: "TRACKING",
      severity: "WARNING",
      title: "Lead do formulário da Meta não entrou no CRM",
      detail: message,
      href: "/comercial/leads",
    });
    return "failed";
  }
}

/** Webhook: um `leadgen_id` por mudança. */
export async function handleLeadgenChange(value: { leadgen_id?: string; page_id?: string }): Promise<void> {
  if (!value.leadgen_id || !value.page_id) return;
  const connection = await loadConnectionByPage(String(value.page_id));
  if (!connection) return;
  await ingestMetaLead({ connection, leadgenId: String(value.leadgen_id), origin: "webhook" });
}

/** Importa os leads dos últimos `days` dias de todos os formulários — recupera o que o webhook perdeu (ou o que veio antes de ativar). */
export async function importRecentLeads(connection: { id: string; agencyId: string; externalId: string; accessTokenEnc: string }, days = 90) {
  const token = decryptSecret(connection.accessTokenEnc);
  const forms = await listLeadForms(connection.externalId, token);
  const since = Math.floor((Date.now() - days * 86_400_000) / 1000);
  const summary = { imported: 0, duplicate: 0, failed: 0, forms: forms.length };
  for (const form of forms) {
    let next: string | null = `${GRAPH}/${form.id}/leads?${new URLSearchParams({
      fields: LEAD_FIELDS,
      limit: "100",
      filtering: JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }]),
      access_token: token,
    })}`;
    for (let page = 0; next && page < 20; page += 1) {
      const response: Response = await fetch(next, { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as { data?: GraphLead[]; paging?: { next?: string }; error?: { message?: string } } | null;
      if (!response.ok) throw new MetaApiError(body?.error?.message ?? "Erro ao listar leads.", response.status, body);
      for (const lead of body?.data ?? []) {
        summary[await ingestMetaLead({ connection, leadgenId: lead.id, origin: "import", lead, formName: form.name })] += 1;
      }
      next = body?.paging?.next ?? null;
    }
  }
  return summary;
}
