import { FinanceListPageContent } from "../FinanceListPageContent";
import { parsePage } from "@/lib/pagination";

export default function ContasAReceberPage({ searchParams }: { searchParams: { page?: string } }) {
  return <FinanceListPageContent type="RECEITA" page={parsePage(searchParams.page)} />;
}
