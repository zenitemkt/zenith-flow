import { ContentDetailView } from "@/app/(app)/conteudo/[id]/ContentDetailView";
import { ModalOverlay } from "../../ModalOverlay";

interface PageProps {
  params: { id: string };
}

export default async function ContentModalPage({ params }: PageProps) {
  return (
    <ModalOverlay>
      <ContentDetailView id={params.id} />
    </ModalOverlay>
  );
}
