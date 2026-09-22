import { Skeleton } from "@zenite-mkt/ui";

export default function CarteiraLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-none border-b border-[#F2F4F7] last:border-0" />
        ))}
      </div>
    </div>
  );
}
