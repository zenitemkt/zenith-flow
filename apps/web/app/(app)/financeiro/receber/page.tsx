import { FinanceListPageContent } from "../FinanceListPageContent";
import { parsePage } from "@/lib/pagination";
import { parseFinancePeriod } from "@/lib/finance";

export default function ContasAReceberPage({
  searchParams,
}: {
  searchParams: { page?: string; period?: string };
}) {
  return (
    <FinanceListPageContent
      type="RECEITA"
      page={parsePage(searchParams.page)}
      period={parseFinancePeriod(searchParams.period)}
    />
  );
}
