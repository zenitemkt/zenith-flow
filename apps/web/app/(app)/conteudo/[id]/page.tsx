import { ContentDetailView } from "./ContentDetailView";

interface PageProps {
  params: { id: string };
}

export default async function ContentDetailPage({ params }: PageProps) {
  return <ContentDetailView id={params.id} />;
}
