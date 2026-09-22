import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { prisma } from "@zenite-mkt/db";
import { ReactivationInfoForm } from "./ReactivationInfoForm";

export default async function ReativacoesPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const clients = await prisma.client.findMany({
    where: { agencyId: membership.agencyId, status: "ENCERRADO" },
    include: {
      statusHistory: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Reativações</h1>
        <p className="text-sm text-[#667085]">
          Clientes encerrados de {membership.agency.name} — motivo, concorrente e elegibilidade (seção 32.3 do
          manual). Playbook de reativação é manual nesta fase; sem MRR perdido ainda (sem modelo de receita
          recorrente).
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhum cliente encerrado no momento.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {clients.map((client) => {
            // O motivo obrigatório é capturado na transição para EM_ENCERRAMENTO
            // (seção 10: reason exigido ali, não em ENCERRADO em si) — procurar
            // primeiro por essa, com o evento ENCERRADO só como referência de data.
            const encerramentoEvent =
              client.statusHistory.find((h) => h.toStatus === "EM_ENCERRAMENTO") ??
              client.statusHistory.find((h) => h.toStatus === "ENCERRADO");
            const lastNote = client.notes[0];
            return (
              <div key={client.id} className="rounded-xl border border-[#E4E7EC] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/clientes/${client.id}`} className="font-medium text-[#101828] hover:text-[#FF2B00]">
                      {client.name}
                    </Link>
                    <p className="text-xs text-[#667085]">
                      Motivo: {encerramentoEvent?.reason ?? "não informado"}
                      {encerramentoEvent ? ` · ${encerramentoEvent.createdAt.toLocaleDateString("pt-BR")}` : ""}
                    </p>
                    <p className="text-xs text-[#98A2B3]">
                      Última nota: {lastNote ? `"${lastNote.body}" (${lastNote.createdAt.toLocaleDateString("pt-BR")})` : "nenhuma"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      client.reactivationEligible ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE4E2] text-[#B42318]"
                    }`}
                  >
                    {client.reactivationEligible ? "Elegível" : "Não elegível"}
                  </span>
                </div>
                <div className="mt-3">
                  <ReactivationInfoForm
                    clientId={client.id}
                    initialCompetitorName={client.competitorName ?? ""}
                    initialEligible={client.reactivationEligible}
                  />
                  {client.competitorName && (
                    <p className="mt-1 text-xs text-[#98A2B3]">Concorrente informado: {client.competitorName}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
