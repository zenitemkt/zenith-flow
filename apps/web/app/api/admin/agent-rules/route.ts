import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveContentAutomationActor } from "@/lib/content-automation-auth";

/** Serve as regras de escrita do blog como texto puro (Blueprint, seção 1.1) — versionado em código, não no banco. */
export async function GET(request: Request) {
  const actor = await resolveContentAutomationActor(request);
  if (!actor) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const rulesPath = path.join(process.cwd(), "content", "blog-agent-rules.md");
  const text = readFileSync(rulesPath, "utf8");
  return new NextResponse(text, { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
