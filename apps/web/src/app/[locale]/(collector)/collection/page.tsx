'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Download, Upload, SlidersHorizontal, BarChart3 } from 'lucide-react';
import { PageSizeSelect } from '@/components/ui/page-size-select';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ViewToggle, type ViewMode } from '@/components/ui/view-toggle';
import { SearchBar } from '@/components/ui/search-bar';
import { CollectionItemCard } from '@/components/features/collection/collection-item-card';
import { CollectionItemCompact } from '@/components/features/collection/collection-item-compact';
import { CollectionItemList } from '@/components/features/collection/collection-item-list';
import { CollectionFilters } from '@/components/features/collection/collection-filters';
import { CollectionStats } from '@/components/features/collection/collection-stats';
import {
  getCollectionItems,
  getCollectionStats,
  markAsRead,
  markForSale,
  updateCollectionItem,
  exportCollection,
  type CollectionItem,
  type CollectionStats as CollectionStatsType,
  type CollectionSearchParams,
  type ItemCondition,
} from '@/lib/api/collection';
import type { PaginationMeta } from '@/lib/api/catalog';

const DEFAULT_LIMIT = 20;

function parseFiltersFromParams(sp: URLSearchParams): CollectionSearchParams {
  const isReadParam = sp.get('isRead');
  const isForSaleParam = sp.get('isForSale');
  const duplicatesParam = sp.get('duplicates');

  return {
    query: sp.get('query') || undefined,
    condition: (sp.get('condition') as CollectionSearchParams['condition']) || undefined,
    isRead: isReadParam === 'true' ? true : isReadParam === 'false' ? false : undefined,
    isForSale:
      isForSaleParam === 'true' ? true : isForSaleParam === 'false' ? false : undefined,
    seriesId: sp.get('seriesId') || undefined,
    duplicates: duplicatesParam === 'true' ? true : undefined,
    sortBy: (sp.get('sortBy') as CollectionSearchParams['sortBy']) || undefined,
    sortOrder: (sp.get('sortOrder') as 'asc' | 'desc') || undefined,
    page: sp.get('page') ? Number(sp.get('page')) : 1,
    limit: sp.get('limit') ? Number(sp.get('limit')) : DEFAULT_LIMIT,
  };
}

function filtersToParams(f: CollectionSearchParams): string {
  const p = new URLSearchParams();
  if (f.query) p.set('query', f.query);
  if (f.condition) p.set('condition', f.condition);
  if (f.isRead !== undefined) p.set('isRead', String(f.isRead));
  if (f.isForSale !== undefined) p.set('isForSale', String(f.isForSale));
  if (f.seriesId) p.set('seriesId', f.seriesId);
  if (f.duplicates) p.set('duplicates', 'true');
  if (f.sortBy && f.sortBy !== 'createdAt') p.set('sortBy', f.sortBy);
  if (f.sortOrder && f.sortOrder !== 'desc') p.set('sortOrder', f.sortOrder);
  if (f.page && f.page > 1) p.set('page', String(f.page));
  if (f.limit && f.limit !== DEFAULT_LIMIT) p.set('limit', String(f.limit));
  return p.toString();
}

export default function CollectionPage() {
  const t = useTranslations('collection');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [items, setItems] = useState<CollectionItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [stats, setStats] = useState<CollectionStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [saleItemId, setSaleItemId] = useState<string | null>(null);
  const [salePrice, setSalePrice] = useState('');
  const [exporting, setExporting] = useState(false);

  const filters = parseFiltersFromParams(searchParams);
  const [searchInput, setSearchInput] = useState(filters.query ?? '');

  // Sync local input with URL changes (e.g. clearing filters)
  useEffect(() => {
    setSearchInput(filters.query ?? '');
  }, [filters.query]);

  // Load stats on mount
  useEffect(() => {
    setStatsLoading(true);
    getCollectionStats()
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  // Fetch items when URL params change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    getCollectionItems(filters)
      .then((res) => {
        if (!cancelled) {
          setItems(res.data);
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
  }, [searchParams.toString()]); // eslint-disable-line

  const handleFiltersChange = useCallback(
    (newFilters: CollectionSearchParams) => {
      const qs = filtersToParams(newFilters);
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
      setMobileFiltersOpen(false);
    },
    [router, pathname],
  );

  const handlePageChange = (page: number) => {
    handleFiltersChange({ ...filters, page });
  };

  const handleToggleRead = async (id: string, isRead: boolean) => {
    try {
      const updated = await markAsRead(id, isRead);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      toast.success(isRead ? t('markedAsRead') : t('markedAsUnread'));
      // Refresh stats
      getCollectionStats().then(setStats).catch(() => {});
    } catch {
      toast.error(tCommon('error'));
    }
  };

  const handleChangeCondition = async (id: string, condition: ItemCondition) => {
    try {
      const updated = await updateCollectionItem(id, { condition });
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      toast.success(t('conditionUpdated'));
    } catch {
      toast.error(tCommon('error'));
    }
  };

  const handleToggleSale = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    if (item.isForSale) {
      // Remove from sale — no price needed
      try {
        const updated = await markForSale(id, { isForSale: false });
        setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
        toast.success(t('removedFromSale'));
        getCollectionStats().then(setStats).catch(() => {});
      } catch {
        toast.error(tCommon('error'));
      }
    } else {
      // Mark for sale — need to ask for price
      setSaleItemId(id);
      setSalePrice('');
      setSaleDialogOpen(true);
    }
  };

  const handleConfirmSale = async () => {
    if (!saleItemId || !salePrice) return;
    const price = parseFloat(salePrice.replace(',', '.'));
    if (isNaN(price) || price <= 0) {
      toast.error('Informe um preço válido');
      return;
    }
    try {
      const updated = await markForSale(saleItemId, { isForSale: true, salePrice: price });
      setItems((prev) => prev.map((i) => (i.id === saleItemId ? updated : i)));
      toast.success(t('markedForSale'));
      getCollectionStats().then(setStats).catch(() => {});
      setSaleDialogOpen(false);
    } catch {
      toast.error(tCommon('error'));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportCollection();
      toast.success(t('exportSuccess'));
    } catch {
      toast.error(tCommon('error'));
    } finally {
      setExporting(false);
    }
  };

  const currentPage = filters.page ?? 1;

  const filterSidebar = (
    <CollectionFilters filters={filters} onFiltersChange={handleFiltersChange} />
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pagination ? `${pagination.total} ${t('items')}` : ' '}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild>
            <Link href={`/${locale}/collection/add`}>
              <Plus className="h-4 w-4 mr-2" />
              {t('addItem')}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/collection/series-progress`}>
              <BarChart3 className="h-4 w-4 mr-2" />
              {t('seriesProgressLink')}
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {t('export')}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/collection/add?mode=import`}>
              <Upload className="h-4 w-4 mr-2" />
              {t('import')}
            </Link>
          </Button>

          <ViewToggle value={viewMode} onChange={setViewMode} />

          <PageSizeSelect
            value={filters.limit || DEFAULT_LIMIT}
            onChange={(size) => {
              const newParams = filtersToParams({ ...filters, limit: size, page: 1 });
              router.push(`${pathname}${newParams ? '?' + newParams : ''}`);
            }}
          />

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
      </div>

      {/* Stats */}
      <CollectionStats stats={stats} loading={statsLoading} />

      {/* Search bar (matches catalog UX) */}
      <div className="flex justify-end">
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={(v) =>
            handleFiltersChange({ ...filters, query: v || undefined, page: 1 })
          }
          placeholder={t('searchPlaceholder')}
          className="w-full sm:max-w-lg"
        />
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
          ) : items.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-muted-foreground">{t('noItems')}</p>
              <Button asChild variant="outline" size="sm">
                <Link href={`/${locale}/collection/add`}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('addItem')}
                </Link>
              </Button>
            </div>
          ) : (
            <>
              {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {items.map((item) => (
                    <CollectionItemCard
                      key={item.id}
                      item={item}
                      onToggleRead={handleToggleRead}
                      onToggleSale={handleToggleSale}
                      onChangeCondition={handleChangeCondition}
                    />
                  ))}
                </div>
              )}

              {viewMode === 'compact' && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                  {items.map((item) => (
                    <CollectionItemCompact key={item.id} item={item} />
                  ))}
                </div>
              )}

              {viewMode === 'list' && (
                <div className="flex flex-col gap-2">
                  {items.map((item) => (
                    <CollectionItemList
                      key={item.id}
                      item={item}
                      onToggleRead={handleToggleRead}
                      onToggleSale={handleToggleSale}
                      onChangeCondition={handleChangeCondition}
                    />
                  ))}
                </div>
              )}

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

      {/* Sale price dialog */}
      <Dialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('markForSale')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="sale-price">Preço de venda (R$)</Label>
              <Input
                id="sale-price"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="29.90"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmSale()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmSale} disabled={!salePrice}>
              Colocar à venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
