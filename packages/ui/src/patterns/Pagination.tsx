import type { ElementType } from "react";

export interface PaginationProps {
  page: number;
  pageCount: number;
  /** Monta a URL da página N — cada chamador decide como preservar outros query params. */
  hrefForPage: (page: number) => string;
  linkComponent?: ElementType;
}

/** Paginação simples com Anterior/Próxima — mesma convenção `linkComponent` do resto do design system. */
export function Pagination({ page, pageCount, hrefForPage, linkComponent }: PaginationProps) {
  const Link = linkComponent ?? "a";
  if (pageCount <= 1) return null;

  const prevDisabled = page <= 1;
  const nextDisabled = page >= pageCount;

  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <p className="text-xs text-[#98A2B3]">
        Página {page} de {pageCount}
      </p>
      <div className="flex gap-2">
        {prevDisabled ? (
          <span className="rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs font-medium text-[#D0D5DD] dark:border-[#303343] dark:text-[#454965]">
            Anterior
          </span>
        ) : (
          <Link
            href={hrefForPage(page - 1)}
            className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-medium text-[#344054] hover:bg-[#F6F7FB] dark:border-[#454965] dark:text-[#CFD3DF] dark:hover:bg-[#232532]"
          >
            Anterior
          </Link>
        )}
        {nextDisabled ? (
          <span className="rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs font-medium text-[#D0D5DD] dark:border-[#303343] dark:text-[#454965]">
            Próxima
          </span>
        ) : (
          <Link
            href={hrefForPage(page + 1)}
            className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-medium text-[#344054] hover:bg-[#F6F7FB] dark:border-[#454965] dark:text-[#CFD3DF] dark:hover:bg-[#232532]"
          >
            Próxima
          </Link>
        )}
      </div>
    </div>
  );
}
