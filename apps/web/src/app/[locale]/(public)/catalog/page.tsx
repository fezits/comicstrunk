'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { CatalogCard } from '@/components/features/catalog/catalog-card';
import { CatalogFilters } from '@/components/features/catalog/catalog-filters';
import {
  searchCatalog,
  type CatalogEntry,
  type CatalogSearchParams,
  type PaginationMeta,
} from '@/lib/api/catalog';
import { getCategories, getCharacters, type Category, type Character } from '@/lib/api/taxonomy';
import { getSeries, type Series } from '@/lib/api/series';

const LIMIT = 20;

function parseFiltersFromParams(sp: URLSearchParams): CatalogSearchParams {
  return {
    title: sp.get('title') || undefined,
    publisher: sp.get('publisher') || undefined,
    seriesId: sp.get('seriesId') || undefined,
    categoryIds: sp.get('categoryIds')?.split(',').filter(Boolean) || undefined,
    characterIds: sp.get('characterIds')?.split(',').filter(Boolean) || undefined,
    yearFrom: sp.get('yearFrom') ? Number(sp.get('yearFrom')) : undefined,
    yearTo: sp.get('yearTo') ? Number(sp.get('yearTo')) : undefined,
    sortBy: (sp.get('sortBy') as CatalogSearchParams['sortBy']) || undefined,
    sortOrder: (sp.get('sortOrder') as 'asc' | 'desc') || undefined,
    page: sp.get('page') ? Number(sp.get('page')) : 1,
    limit: LIMIT,
  };
}

function filtersToParams(f: CatalogSearchParams): string {
  const p = new URLSearchParams();
  if (f.title) p.set('title', f.title);
  if (f.publisher) p.set('publisher', f.publisher);
  if (f.seriesId) p.set('seriesId', f.seriesId);
  if (f.categoryIds?.length) p.set('categoryIds', f.categoryIds.join(','));
  if (f.characterIds?.length) p.set('characterIds', f.characterIds.join(','));
  if (f.yearFrom) p.set('yearFrom', String(f.yearFrom));
  if (f.yearTo) p.set('yearTo', String(f.yearTo));
  if (f.sortBy && f.sortBy !== 'createdAt') p.set('sortBy', f.sortBy);
  if (f.sortOrder && f.sortOrder !== 'desc') p.set('sortOrder', f.sortOrder);
  if (f.page && f.page > 1) p.set('page', String(f.page));
  return p.toString();
}

export default function CatalogPage() {
  const t = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Filter dropdown data
  const [categories, setCategories] = useState<Category[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filters = parseFiltersFromParams(searchParams);

  // Load dropdown data on mount
  useEffect(() => {
    Promise.all([
      getCategories(),
      getCharacters(1, 100),
      getSeries({ limit: 100 }),
    ]).then(([cats, chars, ser]) => {
      setCategories(cats);
      setCharacters(chars.data);
      setSeriesList(ser.data);
    });
  }, []);

  // Fetch catalog when URL params change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    searchCatalog(filters)
      .then((res) => {
        if (!cancelled) {
          setEntries(res.data);
          setPagination(res.pagination);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams.toString()]); // re-fetch when URL params change

  const handleFiltersChange = useCallback(
    (newFilters: CatalogSearchParams) => {
      const qs = filtersToParams(newFilters);
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
      setMobileFiltersOpen(false);
    },
    [router, pathname],
  );

  const handlePageChange = (page: number) => {
    handleFiltersChange({ ...filters, page });
  };

  const currentPage = filters.page ?? 1;

  const filterSidebar = (
    <CatalogFilters
      filters={filters}
      onFiltersChange={handleFiltersChange}
      categories={categories}
      characters={characters}
      series={seriesList}
    />
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          {pagination && !loading && (
            <p className="text-sm text-muted-foreground mt-1">
              {pagination.total} {t('results')}
            </p>
          )}
        </div>

        {/* Mobile filter toggle */}
        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="lg:hidden">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              {t('filters')}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            {filterSidebar}
          </SheetContent>
        </Sheet>
      </div>

      {/* Layout: sidebar + grid */}
      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
            {filterSidebar}
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[2/4] rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-destructive">{tCommon('error')}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-muted-foreground">{t('noResults')}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFiltersChange({ page: 1, limit: LIMIT })}
              >
                {t('clearFilters')}
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {entries.map((entry) => (
                  <CatalogCard key={entry.id} entry={entry} />
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    {t('previousPage')}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {t('pageOf', { current: currentPage, total: pagination.totalPages })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= pagination.totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    {t('nextPage')}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
