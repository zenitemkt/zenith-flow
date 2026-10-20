import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { prisma } from "@zenite-mkt/db";
import { ThemeToggleForm } from "./ThemeToggleForm";
import { UiStyleForm } from "./UiStyleForm";

export default async function AparenciaPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { themePreference: true, uiStyle: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828] dark:text-white">Aparência</h1>
        <p className="text-sm text-[#667085] dark:text-[#AEB4C5]">Estilo e tema da interface para a sua conta.</p>
      </div>
      <UiStyleForm initialStyle={user?.uiStyle ?? "ZENITE"} />
      {user?.uiStyle !== "MINIMALISTA" && <ThemeToggleForm initialTheme={user?.themePreference ?? "LIGHT"} />}
    </div>
  );
}
