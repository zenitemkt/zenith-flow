import type { AssistantConfig } from "./config";
import { sendButtons, sendGroupText, sendTemplate, sendText } from "./whatsapp";

/**
 * Aviso aos sócios: tenta o grupo (API de grupos da Meta); se não houver grupo ou der erro, manda no privado
 * de cada sócio. Fora da janela de 24 h o texto livre falha, então cai no modelo aprovado
 * `ASSISTANT_PARTNER_TEMPLATE` (um parâmetro com o texto do aviso).
 */
export async function notifyPartners(config: AssistantConfig, text: string): Promise<boolean> {
  const { groupId, partnerPhones } = config.notifications;
  if (groupId) {
    try {
      await sendGroupText(groupId, text);
      return true;
    } catch (error) {
      console.error("assistant_group_notify_failed", error);
    }
  }
  let delivered = false;
  for (const phone of partnerPhones) {
    try {
      await sendText(phone, text);
      delivered = true;
    } catch {
      const template = process.env.ASSISTANT_PARTNER_TEMPLATE;
      if (!template) continue;
      try {
        await sendTemplate(phone, template, [text.slice(0, 1000)]);
        delivered = true;
      } catch (error) {
        console.error("assistant_partner_notify_failed", phone, error);
      }
    }
  }
  return delivered;
}

/** Pedido de aprovação aos sócios para horário com pouca antecedência (botões vão no privado, grupo não tem botão). */
export async function askPartnersApproval(config: AssistantConfig, bookingId: string, text: string): Promise<boolean> {
  let delivered = false;
  for (const phone of config.notifications.partnerPhones) {
    try {
      await sendButtons(phone, text, [
        { id: `approve_${bookingId}`, title: "Confirmar" },
        { id: `deny_${bookingId}`, title: "Não posso" },
      ]);
      delivered = true;
    } catch (error) {
      console.error("assistant_partner_approval_failed", phone, error);
    }
  }
  return delivered;
}
