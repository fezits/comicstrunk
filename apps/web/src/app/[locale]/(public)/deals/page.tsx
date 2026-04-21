'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Tag, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AffiliateDisclosure } from '@/components/features/deals/affiliate-disclosure';
import { DealFilters } from '@/components/features/deals/deal-filters';
import { DealsGrid } from '@/components/features/deals/deals-grid';
import {
  listActiveDeals,
  type Deal,
  type ListDealsParams,
  type PaginationMeta,
} from '@/lib/api/deals';

export default function DealsPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  // Read filters from URL search params
  const filtersFromParams: ListDealsParams = {
    storeId: searchParams.get('storeId') ?? undefined,
    categoryId: searchParams.get('categoryId') ?? undefined,
    type: (searchParams.get('type') as ListDealsParams['type']) ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
    page: Number(searchParams.get('page') ?? '1'),
    limit: 12,
  };

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listActiveDeals(filtersFromParams);
      setDeals(result.data);
      setPagination(result.pagination);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [searchParams]); // eslint-disable-line

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const updateSearchParams = (newFilters: ListDealsParams) => {
    const params = new URLSearchParams();

    if (newFilters.storeId) params.set('storeId', newFilters.storeId);
    if (newFilters.categoryId) params.set('categoryId', newFilters.categoryId);
    if (newFilters.type) params.set('type', newFilters.type);
    if (newFilters.sort && newFilters.sort !== 'recent') params.set('sort', newFilters.sort);
    if (newFilters.page && newFilters.page > 1) params.set('page', String(newFilters.page));

    const qs = params.toString();
    router.push(`/${locale}/deals${qs ? `?${qs}` : ''}`);
  };

  const handleFiltersChange = (newFilters: ListDealsParams) => {
    updateSearchParams({ ...newFilters, page: 1 });
  };

  const currentPage = filtersFromParams.page ?? 1;

  const handlePageChange = (page: number) => {
    updateSearchParams({ ...filtersFromParams, page });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Tag className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ofertas e Cupons</h1>
          <p className="text-sm text-muted-foreground">
            As melhores ofertas de quadrinhos em um so lugar
          </p>
        </div>
      </div>

      {/* Affiliate disclosure */}
      <AffiliateDisclosure />

      {/* Filters */}
      <DealFilters
        filters={filtersFromParams}
        onFiltersChange={handleFiltersChange}
      />

      {/* Results */}
      {!loading && deals.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <Inbox className="h-16 w-16 text-muted-foreground/30 mx-auto" />
          <p className="text-lg text-muted-foreground">
            Nenhuma oferta disponivel no momento
          </p>
          <p className="text-sm text-muted-foreground">
            Volte mais tarde para conferir novas ofertas e cupons
          </p>
        </div>
      ) : (
        <DealsGrid deals={deals} loading={loading} />
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Pagina {currentPage} de {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pagination.totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Proxima
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
