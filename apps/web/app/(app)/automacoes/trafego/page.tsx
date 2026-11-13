import { redirect } from "next/navigation";

/** O Gestor de tráfego mudou para dentro do Tráfego - Raio X; links antigos (alertas, favoritos) continuam valendo. */
export default function OldTrafficManagerPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) if (typeof value === "string") params.set(key, value);
  const qs = params.toString();
  redirect(qs ? `/trafego-raio-x/gestor?${qs}` : "/trafego-raio-x/gestor");
}
