'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { DealCard } from './deal-card';
import { type Deal } from '@/lib/api/deals';

interface DealsGridProps {
  deals: Deal[];
  loading: boolean;
}

function DealCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card shadow overflow-hidden">
      {/* Banner skeleton */}
      <Skeleton className="h-40 w-full rounded-none" />
      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-sm" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
    </div>
  );
}

export function DealsGrid({ deals, loading }: DealsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <DealCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {deals.map((deal) => (
        <DealCard key={deal.id} deal={deal} />
      ))}
    </div>
  );
}
