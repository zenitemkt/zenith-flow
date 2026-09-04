import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { VENDOR_STATUS_LABELS } from "@/lib/vendors";
import { prisma } from "@zenith/db";
import { NewVendorModal } from "./NewVendorModal";

const STATUS_BADGE_CLASS: Record<string, string> = {
  HOMOLOGADO: "bg-[#DCFCE7] text-[#166534]",
  BLOQUEADO: "bg-[#FEE4E2] text-[#B42318]",
};

export default async function FornecedoresPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const vendors = await prisma.vendor.findMany({
    where: { agencyId: membership.agencyId },
    include: { _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Fornecedores</h1>
          <p className="text-sm text-[#667085]">
            {vendors.length} fornecedor{vendors.length === 1 ? "" : "es"} em {membership.agency.name}.
          </p>
        </div>
        <NewVendorModal />
      </div>

      {vendors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">
            Nenhum fornecedor ainda. Cadastre parceiros externos que atendem a agência.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Ordens</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="border-t border-[#EEF0F3] hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/operacao/fornecedores/${vendor.id}`}
                      className="font-medium text-[#101828] hover:text-[#6847F5]"
                    >
                      {vendor.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#475467]">
                    {vendor.category ?? <span className="text-[#98A2B3]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[#475467]">{vendor._count.orders}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[vendor.status]}`}
                    >
                      {VENDOR_STATUS_LABELS[vendor.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
