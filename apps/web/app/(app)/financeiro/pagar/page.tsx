import { FinanceListPageContent } from "../FinanceListPageContent";
import { parsePage } from "@/lib/pagination";
import { parseFinancePeriod } from "@/lib/finance";

export default function ContasAPagarPage({
  searchParams,
}: {
  searchParams: { page?: string; period?: string };
}) {
  return (
    <FinanceListPageContent
      type="DESPESA"
      page={parsePage(searchParams.page)}
      period={parseFinancePeriod(searchParams.period)}
    />
  );
}
