import { Skeleton } from "@zenith/ui";

export default function OperacaoLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, col) => (
          <div key={col} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            {Array.from({ length: 2 }).map((_, card) => (
              <Skeleton key={card} className="h-24 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
