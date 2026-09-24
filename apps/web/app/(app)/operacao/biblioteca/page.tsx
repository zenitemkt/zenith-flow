import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { prisma } from "@zenite-mkt/db";
import { DriveFolderCard } from "./DriveFolderCard";

/**
 * Biblioteca de conteúdo = atalho pra pasta de cada cliente no Google Drive
 * (pedido do Kevin, 2026-09-24): os arquivos ficam no Drive, onde a equipe já
 * trabalha, e o sistema só guarda o link — sem upload, sem custo de storage.
 * Todo cliente cadastrado aparece aqui automaticamente.
 */
export default async function BibliotecaPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const clients = await prisma.client.findMany({
    where: { agencyId: membership.agencyId },
    select: { id: true, name: true, driveUrl: true },
    orderBy: { name: "asc" },
  });

  const linked = clients.filter((client) => client.driveUrl).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Biblioteca de conteúdo</h1>
        <p className="text-sm text-[#667085]">
          A pasta de cada cliente no Google Drive, a um clique.{" "}
          {clients.length > 0 && `${linked} de ${clients.length} com pasta vinculada.`}
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">
            Cadastre um cliente e a pasta dele aparece aqui pra você vincular ao Drive.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clients.map((client) => (
            <DriveFolderCard key={client.id} clientId={client.id} clientName={client.name} driveUrl={client.driveUrl} />
          ))}
        </div>
      )}
    </div>
  );
}
