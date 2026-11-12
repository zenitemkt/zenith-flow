import { prisma, type Prisma } from "@zenite-mkt/db";
import { ShareError, parseSharesBody, sharesError, splitProportionally, type ShareInput } from "@/lib/finance-shares";

type Db = Prisma.TransactionClient | typeof prisma;

export interface PartnerOption {
  id: string;
  name: string;
  active: boolean;
}

/** Sócios da agência (ativos primeiro, por nome). */
export async function listFinancePartners(agencyId: string): Promise<PartnerOption[]> {
  return prisma.financePartner.findMany({
    where: { agencyId },
    select: { id: true, name: true, active: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

async function assertPartnersOfAgency(db: Db, agencyId: string, shares: ShareInput[]) {
  if (shares.length === 0) return;
  const found = await db.financePartner.count({ where: { agencyId, id: { in: shares.map((s) => s.partnerId) } } });
  if (found !== shares.length) throw new ShareError("Sócio inválido na divisão.");
}

/**
 * `shares` do corpo → partes validadas para um lançamento de `totalCents`.
 * `undefined` quando o campo não veio (quem chama aplica o padrão).
 */
export async function readEntryShares(db: Db, agencyId: string, raw: unknown, totalCents: number): Promise<ShareInput[] | undefined> {
  const shares = parseSharesBody(raw, totalCents);
  if (shares === undefined) return undefined;
  const error = sharesError(shares, totalCents);
  if (error) throw new ShareError(error);
  await assertPartnersOfAgency(db, agencyId, shares);
  return shares;
}

/** Padrão do cliente aplicado a um valor (vazio se o cliente não tem padrão). */
export async function clientDefaultShares(db: Db, clientId: string | null, totalCents: number): Promise<ShareInput[]> {
  if (!clientId) return [];
  const weights = await db.clientPartnerShare.findMany({
    where: { clientId },
    select: { partnerId: true, amountCents: true },
    orderBy: { createdAt: "asc" },
  });
  return splitProportionally(totalCents, weights);
}

/** Troca a divisão de um lançamento (apaga e recria — a soma já foi validada). */
export async function replaceEntryShares(db: Db, financeEntryId: string, shares: ShareInput[]) {
  await db.financeEntryShare.deleteMany({ where: { financeEntryId } });
  if (shares.length > 0) {
    await db.financeEntryShare.createMany({ data: shares.map((s) => ({ financeEntryId, partnerId: s.partnerId, amountCents: s.amountCents })) });
  }
}

/**
 * `partnerShares` do cadastro do cliente → padrão de divisão. Aqui os valores
 * são só a referência da proporção (não há total para fechar); sócio único
 * sem valor vira peso 1.
 */
export async function readClientShares(db: Db, agencyId: string, raw: unknown): Promise<ShareInput[] | undefined> {
  const shares = parseSharesBody(raw, 1);
  if (shares === undefined) return undefined;
  if (new Set(shares.map((s) => s.partnerId)).size !== shares.length) throw new ShareError("O mesmo sócio aparece duas vezes na divisão.");
  if (shares.some((s) => s.amountCents <= 0)) throw new ShareError("O valor de cada sócio precisa ser maior que zero.");
  await assertPartnersOfAgency(db, agencyId, shares);
  return shares;
}

export async function replaceClientShares(db: Db, clientId: string, shares: ShareInput[]) {
  await db.clientPartnerShare.deleteMany({ where: { clientId } });
  if (shares.length > 0) {
    await db.clientPartnerShare.createMany({ data: shares.map((s) => ({ clientId, partnerId: s.partnerId, amountCents: s.amountCents })) });
  }
}

/** Padrão de divisão de cada cliente da agência, para pré-preencher formulários. */
export async function clientSharesByClient(agencyId: string): Promise<Record<string, ShareInput[]>> {
  const rows = await prisma.clientPartnerShare.findMany({
    where: { client: { agencyId } },
    select: { clientId: true, partnerId: true, amountCents: true },
    orderBy: { createdAt: "asc" },
  });
  const out: Record<string, ShareInput[]> = {};
  for (const row of rows) (out[row.clientId] ??= []).push({ partnerId: row.partnerId, amountCents: row.amountCents });
  return out;
}
