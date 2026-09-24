import { PORTAL_REQUEST_STATUS_BADGE_CLASS, PORTAL_REQUEST_STATUS_LABELS } from "@/lib/portal-requests";
import { panelClass } from "./ui";

export interface RequestListItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: Date;
}

export function RequestList({ items }: { items: RequestListItem[] }) {
  return (
    <ul className={`${panelClass} divide-y divide-white/[0.05] overflow-hidden`}>
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-[#F5F2EE]">{item.title}</p>
            {item.description && (
              <p className="mt-1 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-[#A3A5B2]">
                {item.description}
              </p>
            )}
            <p className="mt-2 text-xs text-[#6B6D7C]">Enviada em {item.createdAt.toLocaleDateString("pt-BR")}</p>
          </div>
          <span
            className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${PORTAL_REQUEST_STATUS_BADGE_CLASS[item.status]}`}
          >
            {PORTAL_REQUEST_STATUS_LABELS[item.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}
