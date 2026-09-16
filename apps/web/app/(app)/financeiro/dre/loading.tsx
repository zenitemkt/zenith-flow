import { Skeleton } from "@zenith/ui";

export default function DreLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-56 rounded-lg" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
