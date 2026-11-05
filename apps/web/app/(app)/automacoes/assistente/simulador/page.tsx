import { redirect } from "next/navigation";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { mergeAssistantConfig } from "@/lib/assistant/config";
import { Simulator } from "./Simulator";

export default async function AssistantSimulatorPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");
  const settings = await prisma.assistantSettings.findUnique({ where: { agencyId: membership.agencyId } });
  const config = mergeAssistantConfig(settings?.config);
  return <Simulator name={config.name} initialInstructions={config.conversation.extraInstructions} />;
}
