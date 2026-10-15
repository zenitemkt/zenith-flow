import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function MinhaContaPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828] dark:text-white">Minha conta</h1>
        <p className="text-sm text-[#667085] dark:text-[#AEB4C5]">Dados de acesso da sua própria conta.</p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
