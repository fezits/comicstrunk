'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowUpDown,
  ChevronUp,
  Filter,
  LayoutGrid,
  List,
  Search,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MarketplaceCard } from './marketplace-card';
import { MarketplaceFilters } from './marketplace-filters';
import {
  searchMarketplace,
  type MarketplaceListing,
  type MarketplaceSearchParams,
} from '@/lib/api/marketplace';
import { addToCart } from '@/lib/api/cart';
import { useAuth } from '@/lib/auth/use-auth';
import { PageSizeSelect } from '@/components/ui/page-size-select';
import type { PaginationMeta } from '@/lib/api/catalog';

const DEFAULT_LIMIT = 20;

type ViewMode = 'grid' | 'list';

function parseFiltersFromParams(sp: URLSearchParams): MarketplaceSearchParams {
  return {
    query: sp.get('query') || undefined,
    condition: (sp.get('condition') as MarketplaceSearchParams['condition']) || undefined,
    minPrice: sp.get('minPrice') ? Number(sp.get('minPrice')) : undefined,
    maxPrice: sp.get('maxPrice') ? Number(sp.get('maxPrice')) : undefined,
    publisher: sp.get('publisher') || undefined,
    characterId: sp.get('characterId') || undefined,
    seriesId: sp.get('seriesId') || undefined,
    sortBy: (sp.get('sortBy') as MarketplaceSearchParams['sortBy']) || undefined,
    sortOrder: (sp.get('sortOrder') as 'asc' | 'desc') || undefined,
    page: sp.get('page') ? Number(sp.get('page')) : 1,
    limit: sp.get('limit') ? Number(sp.get('limit')) : DEFAULT_LIMIT,
  };
}

function filtersToParams(f: MarketplaceSearchParams): string {
  const p = new URLSearchParams();
  if (f.query) p.set('query', f.query);
  if (f.condition) p.set('condition', f.condition);
  if (f.minPrice !== undefined) p.set('minPrice', String(f.minPrice));
  if (f.maxPrice !== undefined) p.set('maxPrice', String(f.maxPrice));
  if (f.publisher) p.set('publisher', f.publisher);
  if (f.characterId) p.set('characterId', f.characterId);
  if (f.seriesId) p.set('seriesId', f.seriesId);
  if (f.sortBy && f.sortBy !== 'newest') p.set('sortBy', f.sortBy);
  if (f.sortOrder && f.sortOrder !== 'desc') p.set('sortOrder', f.sortOrder);
  if (f.page && f.page > 1) p.set('page', String(f.page));
  if (f.limit && f.limit !== DEFAULT_LIMIT) p.set('limit', String(f.limit));
  return p.toString();
}

const sortOptions = [
  { value: 'price', labelKey: 'sortPrice' },
  { value: 'newest', labelKey: 'sortNewest' },
  { value: 'condition', labelKey: 'sortCondition' },
] as const;

export function MarketplaceListingPage() {
  const t = useTranslations('marketplace');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [view, setView] = useState<ViewMode>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [addingToCartId, setAddingToCartId] = useState<string | null>(null);

  const filters = parseFiltersFromParams(searchParams);
  const [searchInput, setSearchInput] = useState(filters.query ?? '');

  useEffect(() => {
    setSearchInput(filters.query ?? '');
  }, [filters.query]);

  // Fetch marketplace when URL params change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    searchMarketplace(filters)
      .then((res) => {
        if (!cancelled) {
          setListings(res.data);
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
    (newFilters: MarketplaceSearchParams) => {
      const qs = filtersToParams(newFilters);
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
      setMobileFiltersOpen(false);
    },
    [router, pathname],
  );

  const handlePageChange = (page: number) => {
    handleFiltersChange({ ...filters, page });
  };

  const submitSearch = () => {
    handleFiltersChange({ ...filters, query: searchInput.trim() || undefined, page: 1 });
  };

  const handleSortChange = (sortBy: MarketplaceSearchParams['sortBy']) => {
    const newOrder =
      filters.sortBy === sortBy && filters.sortOrder === 'asc' ? 'desc' : 'asc';
    handleFiltersChange({ ...filters, sortBy, sortOrder: newOrder, page: 1 });
  };

  const handleAddToCart = async (listingId: string) => {
    if (!isAuthenticated) {
      toast.error(t('loginToAdd'));
      return;
    }

    // Check if own item
    const listing = listings.find((l) => l.id === listingId);
    if (listing && user && listing.seller.id === user.id) {
      toast.error(t('ownItem'));
      return;
    }

    setAddingToCartId(listingId);
    try {
      await addToCart(listingId);
      toast.success(t('addedToCart'));
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const message = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      if (status === 409) {
        toast.error(t('itemReserved'));
      } else {
        toast.error(message || t('addToCartError'));
      }
    } finally {
      setAddingToCartId(null);
    }
  };

  const removeFilter = (key: string) => {
    const next = { ...filters, page: 1 };
    if (key === 'query') next.query = undefined;
    if (key === 'condition') next.condition = undefined;
    if (key === 'minPrice') next.minPrice = undefined;
    if (key === 'maxPrice') next.maxPrice = undefined;
    if (key === 'publisher') next.publisher = undefined;
    if (key === 'characterId') next.characterId = undefined;
    if (key === 'seriesId') next.seriesId = undefined;
    handleFiltersChange(next);
  };

  const currentPage = filters.page ?? 1;
  const currentSortLabel =
    sortOptions.find((o) => o.value === (filters.sortBy ?? 'newest'))?.labelKey ?? 'sortNewest';

  // Build active filter tags
  const activeFilterTags: { key: string; label: string }[] = [];
  if (filters.query) activeFilterTags.push({ key: 'query', label: filters.query });
  if (filters.condition)
    activeFilterTags.push({
      key: 'condition',
      label: t(`conditionLabels.${filters.condition}`),
    });
  if (filters.minPrice !== undefined)
    activeFilterTags.push({ key: 'minPrice', label: `${t('minPrice')}: R$ ${filters.minPrice}` });
  if (filters.maxPrice !== undefined)
    activeFilterTags.push({ key: 'maxPrice', label: `${t('maxPrice')}: R$ ${filters.maxPrice}` });
  if (filters.publisher) activeFilterTags.push({ key: 'publisher', label: filters.publisher });

  const filterSidebar = (
    <MarketplaceFilters filters={filters} onFiltersChange={handleFiltersChange} />
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        {pagination && !loading && (
          <p className="text-sm text-muted-foreground mt-1">
            {pagination.total} {t('items')}
          </p>
        )}
      </div>

      {/* Toolbar: view toggle | filter button */}
      <div className="flex flex-col sm:flex-row justify-between space-y-4 sm:space-y-0 sm:items-center px-1">
        <div className="flex items-center gap-4">
          {/* View switcher */}
          <div className="flex items-center rounded-md border border-border">
            <Button
              variant={view === 'grid' ? 'default' : 'ghost'}
              size="sm"
              className="h-9 px-2.5 rounded-r-none"
              onClick={() => setView('grid')}
              title={t('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-9 px-2.5 rounded-l-none"
              onClick={() => setView('list')}
              title={t('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {pagination && !loading && (
            <span className="text-sm text-muted-foreground">
              {pagination.total} {t('items')}
            </span>
          )}

          <PageSizeSelect
            value={filters.limit || DEFAULT_LIMIT}
            onChange={(size) => {
              const newParams = filtersToParams({ ...filters, limit: size, page: 1 });
              router.push(`${pathname}${newParams ? '?' + newParams : ''}`);
            }}
          />
        </div>

        {/* Show/hide filters - desktop */}
        <Button
          variant="default"
          size="sm"
          className="h-9 gap-2 hidden sm:flex"
          onClick={() => setFiltersOpen((prev) => !prev)}
        >
          <Filter className="h-4 w-4" />
          {filtersOpen ? t('hideFilters') : t('showFilters')}
        </Button>

        {/* Show filters - mobile (Sheet) */}
        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="default" size="sm" className="h-9 gap-2 sm:hidden">
              <Filter className="h-4 w-4" />
              {t('showFilters')}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            {filterSidebar}
          </SheetContent>
        </Sheet>
      </div>

      {/* Sort + Search bar */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="h-10 gap-2">
              <ArrowUpDown className="h-4 w-4" />
              {t('sortBy')}: {t(currentSortLabel)}
              {filters.sortOrder === 'asc' ? ' \u2191' : ' \u2193'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {sortOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => handleSortChange(opt.value as MarketplaceSearchParams['sortBy'])}
                className="cursor-pointer"
              >
                {t(opt.labelKey)}
                {filters.sortBy === opt.value && (
                  <ArrowUpDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search bar */}
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }}
            onBlur={submitSearch}
            className="pl-9 h-10 focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
      </div>

      {/* Collapsible filter panel - desktop */}
      {filtersOpen && (
        <div className="hidden sm:block rounded-lg bg-card border border-border shadow-md animate-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center p-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <span className="text-foreground font-medium">{t('filters')}</span>
              {activeFilterTags.length > 0 && (
                <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                  {activeFilterTags.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeFilterTags.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handleFiltersChange({ page: 1, limit: DEFAULT_LIMIT })}
                >
                  {t('clearFilters')}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setFiltersOpen(false)}
              >
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <div className="border-t border-border p-4">{filterSidebar}</div>

          {activeFilterTags.length > 0 && (
            <div className="border-t border-border p-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                {t('activeFilters')}
              </p>
              <div className="flex flex-wrap gap-2">
                {activeFilterTags.map((tag) => (
                  <button
                    key={tag.key}
                    className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full hover:bg-primary/20 transition-colors"
                    onClick={() => removeFilter(tag.key)}
                  >
                    {tag.label}
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      <div className="h-full overflow-auto pb-20">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-primary rounded-full border-t-transparent" />
            <span className="ml-2 text-muted-foreground">{tCommon('loading')}</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive">{tCommon('error')}</p>
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col w-full py-8 items-center justify-center p-8 text-center">
            <p className="text-xl text-muted-foreground mb-2">{t('noResults')}</p>
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              onClick={() => handleFiltersChange({ page: 1, limit: DEFAULT_LIMIT })}
            >
              {t('clearFilters')}
            </Button>
          </div>
        ) : (
          <>
            {view === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {listings.map((listing) => (
                  <MarketplaceCard
                    key={listing.id}
                    listing={listing}
                    variant="grid"
                    onAddToCart={handleAddToCart}
                    isAddingToCart={addingToCartId === listing.id}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {listings.map((listing) => (
                  <MarketplaceCard
                    key={listing.id}
                    listing={listing}
                    variant="list"
                    onAddToCart={handleAddToCart}
                    isAddingToCart={addingToCartId === listing.id}
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
  );
}
