import Link from "next/link";

interface ClientOption {
  id: string;
  name: string;
}

export function ClientFilterPills({
  clients,
  activeClientId,
  buildHref,
}: {
  clients: ClientOption[];
  activeClientId?: string;
  buildHref: (clientId?: string) => string;
}) {
  if (clients.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      <Link
        href={buildHref(undefined)}
        className={`rounded-full px-3 py-1.5 text-sm font-medium ${
          !activeClientId
            ? "bg-[#FF2B00] text-white"
            : "border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB]"
        }`}
      >
        Todos os clientes
      </Link>
      {clients.map((client) => (
        <Link
          key={client.id}
          href={buildHref(client.id)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            activeClientId === client.id
              ? "bg-[#FF2B00] text-white"
              : "border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB]"
          }`}
        >
          {client.name}
        </Link>
      ))}
    </div>
  );
}
