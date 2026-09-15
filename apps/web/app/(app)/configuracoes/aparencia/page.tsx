import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { prisma } from "@zenith/db";
import { ThemeToggleForm } from "./ThemeToggleForm";

export default async function AparenciaPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { themePreference: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828] dark:text-white">Aparência</h1>
        <p className="text-sm text-[#667085] dark:text-[#AEB4C5]">Tema da interface para a sua conta.</p>
      </div>
      <ThemeToggleForm initialTheme={user?.themePreference ?? "LIGHT"} />
    </div>
  );
}
