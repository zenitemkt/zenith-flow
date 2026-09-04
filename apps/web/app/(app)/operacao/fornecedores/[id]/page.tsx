import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { VENDOR_STATUS_LABELS, VENDOR_ORDER_STATUS_LABELS, VENDOR_ORDER_TRANSITIONS } from "@/lib/vendors";
import { prisma } from "@zenith/db";
import { VendorStatusToggle } from "./VendorStatusToggle";
import { NewOrderModal } from "./NewOrderModal";
import { OrderStatusActions } from "./OrderStatusActions";

interface PageProps {
  params: { id: string };
}

const ORDER_STATUS_BADGE_CLASS: Record<string, string> = {
  SOLICITADA: "bg-[#EEF2FF] text-[#3730A3]",
  EM_ANDAMENTO: "bg-[#FEF3C7] text-[#92600A]",
  CONCLUIDA: "bg-[#DCFCE7] text-[#166534]",
  CANCELADA: "bg-[#F2F4F7] text-[#98A2B3]",
};

export default async function VendorDetailPage({ params }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: params.id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: { task: { include: { project: true } } },
      },
    },
  });

  if (!vendor || vendor.agencyId !== membership.agencyId) {
    notFound();
  }

  const openTasks = await prisma.task.findMany({
    where: { project: { agencyId: membership.agencyId }, status: { notIn: ["CONCLUIDA", "CANCELADA"] } },
    include: { project: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">{vendor.name}</h1>
          <p className="text-sm text-[#667085]">
            {vendor.category ?? "Sem categoria"} · {VENDOR_STATUS_LABELS[vendor.status]}
          </p>
          <p className="mt-1 text-sm text-[#98A2B3]">
            {[vendor.contactEmail, vendor.contactPhone].filter(Boolean).join(" · ") ||
              "Sem contato cadastrado"}
          </p>
        </div>
        <VendorStatusToggle vendorId={vendor.id} status={vendor.status} />
      </div>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#101828]">Ordens</h2>
          <NewOrderModal
            vendorId={vendor.id}
            tasks={openTasks.map((t) => ({ id: t.id, title: t.title, projectName: t.project.name }))}
          />
        </div>
        {vendor.orders.length === 0 ? (
          <p className="text-sm text-[#98A2B3]">Nenhuma ordem ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {vendor.orders.map((order) => (
              <div
                key={order.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-[#EEF0F3] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[#101828]">{order.description}</p>
                  {order.task && (
                    <Link
                      href={`/operacao/projetos/${order.task.projectId}`}
                      className="text-xs text-[#6847F5] hover:underline"
                    >
                      tarefa: {order.task.title}
                    </Link>
                  )}
                  <p className="mt-0.5 text-xs text-[#98A2B3]">
                    {order.createdAt.toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_BADGE_CLASS[order.status]}`}
                  >
                    {VENDOR_ORDER_STATUS_LABELS[order.status]}
                  </span>
                  <OrderStatusActions orderId={order.id} options={VENDOR_ORDER_TRANSITIONS[order.status]} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
