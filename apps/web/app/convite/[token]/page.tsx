import { prisma } from "@zenith/db";
import { ROLE_LABELS } from "@/lib/rbac";
import { AcceptInviteForm } from "./AcceptInviteForm";

interface PageProps {
  params: { token: string };
}

export default async function ConvitePage({ params }: PageProps) {
  const membership = await prisma.membership.findUnique({
    where: { inviteToken: params.token },
    include: { agency: true },
  });

  const expired =
    !membership ||
    membership.status !== "INVITED" ||
    (membership.inviteExpiresAt && membership.inviteExpiresAt < new Date());

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F7FB] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
        {expired || !membership ? (
          <>
            <h1 className="mb-1 text-lg font-semibold text-[#101828]">Convite inválido</h1>
            <p className="text-sm text-[#667085]">
              Este link de convite não existe mais, já foi usado ou expirou. Peça um novo convite
              para quem administra sua agência.
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-1 text-lg font-semibold text-[#101828]">
              Você foi convidado para {membership.agency.name}
            </h1>
            <p className="mb-6 text-sm text-[#667085]">
              Papel: <strong>{ROLE_LABELS[membership.role]}</strong>
            </p>
            <AcceptInviteForm token={params.token} email={membership.email} />
          </>
        )}
      </div>
    </div>
  );
}
