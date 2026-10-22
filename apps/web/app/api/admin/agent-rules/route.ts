import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { resolveContentAutomationActor } from "@/lib/content-automation-auth";

/**
 * Serve as regras de escrita do blog como texto puro (Blueprint, seção 1.1)
 * — base versionada em código, igual pra toda agência. Quando a agência tem
 * `blogVoiceNotes` preenchido (seção 2.3 do Blueprint: "marcas de tom
 * pessoal configuradas por cliente"), esse texto entra anexado no final.
 */
export async function GET(request: Request) {
  const actor = await resolveContentAutomationActor(request);
  if (!actor) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const rulesPath = path.join(process.cwd(), "content", "blog-agent-rules.md");
  const baseRules = readFileSync(rulesPath, "utf8");

  const agency = await prisma.agency.findUnique({ where: { id: actor.agencyId }, select: { blogVoiceNotes: true } });
  const voiceNotes = agency?.blogVoiceNotes?.trim();
  const text = voiceNotes
    ? `${baseRules}\n\n## Tom de voz específico desta agência\n\n${voiceNotes}\n`
    : baseRules;

  return new NextResponse(text, { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
