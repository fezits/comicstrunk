'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SeriesCard } from '@/components/features/series/series-card';
import { getSeries } from '@/lib/api/series';
import type { Series, PaginationMeta } from '@/lib/api/series';

const PAGE_LIMIT = 20;

export default function SeriesPage() {
  const t = useTranslations('series');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read initial values from URL search params
  const currentTitle = searchParams.get('title') || '';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const [searchInput, setSearchInput] = useState(currentTitle);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update URL search params
  const updateParams = useCallback(
    (title: string, page: number) => {
      const params = new URLSearchParams();
      if (title) params.set('title', title);
      if (page > 1) params.set('page', String(page));
      const queryString = params.toString();
      router.replace(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false });
    },
    [router, pathname],
  );

  // Fetch series data
  useEffect(() => {
    let cancelled = false;

    async function fetchSeries() {
      setLoading(true);
      setError(null);
      try {
        const result = await getSeries({
          title: currentTitle || undefined,
          page: currentPage,
          limit: PAGE_LIMIT,
        });
        if (!cancelled) {
          setSeriesList(result.data);
          setPagination(result.pagination);
        }
      } catch (_err) {
        if (!cancelled) {
          setError(tCommon('error'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchSeries();

    return () => {
      cancelled = true;
    };
  }, [currentTitle, currentPage, tCommon]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      updateParams(value, 1);
    }, 300);
  };

  const handlePageChange = (page: number) => {
    updateParams(currentTitle, page);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-[140px] w-full rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="text-center py-12">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && seriesList.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('noResults')}</p>
        </div>
      )}

      {/* Series grid */}
      {!loading && !error && seriesList.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {seriesList.map((series) => (
              <SeriesCard key={series.id} series={series} />
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('previousPage')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('pageOf', { current: currentPage, total: pagination.totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= pagination.totalPages}
              >
                {t('nextPage')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
