import { LotCardSkeleton } from "@/components/lot-card";

export default function Loading() {
  return (
    <main className="mx-auto max-w-canvas px-4 py-8 md:px-8">
      <div className="h-8 w-64 animate-pulse rounded bg-surface-2" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <LotCardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
