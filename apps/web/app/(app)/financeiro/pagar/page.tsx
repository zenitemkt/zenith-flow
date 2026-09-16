import { FinanceListPageContent } from "../FinanceListPageContent";
import { parsePage } from "@/lib/pagination";

export default function ContasAPagarPage({ searchParams }: { searchParams: { page?: string } }) {
  return <FinanceListPageContent type="DESPESA" page={parsePage(searchParams.page)} />;
}
