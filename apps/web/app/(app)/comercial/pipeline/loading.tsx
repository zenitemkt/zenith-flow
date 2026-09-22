import { Skeleton } from "@zenite-mkt/ui";

export default function PipelineLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 3 }).map((_, card) => (
              <Skeleton key={card} className="h-28 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
