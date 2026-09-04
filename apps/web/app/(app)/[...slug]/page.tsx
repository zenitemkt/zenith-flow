import { notFound } from "next/navigation";
import { ComingSoon, findNavigationItemByHref } from "@zenith/ui";

interface PageProps {
  params: { slug: string[] };
}

/**
 * Rota genérica: todo item de nav-config.ts vira uma página automaticamente,
 * sem precisar de um arquivo por aba (seção 13 do manual). Enquanto o item
 * tiver comingSoon = true, ele renderiza o Empty State padrão.
 */
export default function CatchAllPage({ params }: PageProps) {
  const path = `/${params.slug.join("/")}`;
  const item = findNavigationItemByHref(path);

  if (!item) {
    notFound();
  }

  return <ComingSoon title={item.label} />;
}
