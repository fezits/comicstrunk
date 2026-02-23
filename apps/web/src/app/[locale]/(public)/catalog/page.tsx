'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import { CatalogCard } from '@/components/features/catalog/catalog-card';
import { CatalogListItem } from '@/components/features/catalog/catalog-list-item';
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

type ViewMode = 'grid' | 'list';

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

const sortOptions = [
  { value: 'title', labelKey: 'sortTitle' },
  { value: 'createdAt', labelKey: 'sortDate' },
  { value: 'averageRating', labelKey: 'sortRating' },
] as const;

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

  const [categories, setCategories] = useState<Category[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);

  const [view, setView] = useState<ViewMode>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleSearchChange = (value: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      handleFiltersChange({ ...filters, title: value || undefined, page: 1 });
    }, 400);
  };

  const handleSortChange = (sortBy: CatalogSearchParams['sortBy']) => {
    const newOrder =
      filters.sortBy === sortBy && filters.sortOrder === 'asc' ? 'desc' : 'asc';
    handleFiltersChange({ ...filters, sortBy, sortOrder: newOrder, page: 1 });
  };

  const removeFilter = (key: string, value?: string) => {
    const next = { ...filters, page: 1 };
    if (key === 'title') next.title = undefined;
    if (key === 'publisher') next.publisher = undefined;
    if (key === 'seriesId') next.seriesId = undefined;
    if (key === 'yearFrom') next.yearFrom = undefined;
    if (key === 'yearTo') next.yearTo = undefined;
    if (key === 'categoryIds' && value) {
      next.categoryIds = (next.categoryIds ?? []).filter((id) => id !== value);
      if (next.categoryIds.length === 0) next.categoryIds = undefined;
    }
    if (key === 'characterIds' && value) {
      next.characterIds = (next.characterIds ?? []).filter((id) => id !== value);
      if (next.characterIds.length === 0) next.characterIds = undefined;
    }
    handleFiltersChange(next);
  };

  const currentPage = filters.page ?? 1;
  const currentSortLabel =
    sortOptions.find((o) => o.value === (filters.sortBy ?? 'createdAt'))?.labelKey ?? 'sortDate';

  // Build active filter tags for display
  const activeFilterTags: { key: string; value?: string; label: string }[] = [];
  if (filters.title) activeFilterTags.push({ key: 'title', label: filters.title });
  if (filters.publisher) activeFilterTags.push({ key: 'publisher', label: filters.publisher });
  if (filters.seriesId) {
    const s = seriesList.find((s) => s.id === filters.seriesId);
    activeFilterTags.push({ key: 'seriesId', label: s?.title ?? filters.seriesId });
  }
  if (filters.categoryIds) {
    for (const id of filters.categoryIds) {
      const cat = categories.find((c) => c.id === id);
      activeFilterTags.push({ key: 'categoryIds', value: id, label: cat?.name ?? id });
    }
  }
  if (filters.characterIds) {
    for (const id of filters.characterIds) {
      const char = characters.find((c) => c.id === id);
      activeFilterTags.push({ key: 'characterIds', value: id, label: char?.name ?? id });
    }
  }
  if (filters.yearFrom) activeFilterTags.push({ key: 'yearFrom', label: `${t('yearFrom')}: ${filters.yearFrom}` });
  if (filters.yearTo) activeFilterTags.push({ key: 'yearTo', label: `${t('yearTo')}: ${filters.yearTo}` });

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
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        {pagination && !loading && (
          <p className="text-sm text-muted-foreground mt-1">
            {pagination.total} {t('comics')}
          </p>
        )}
      </div>

      {/* Toolbar row 1: view toggle + count | filter button */}
      <div className="flex flex-col sm:flex-row justify-between space-y-4 sm:space-y-0 sm:items-center px-1">
        <div className="flex items-center gap-4">
          {/* View switcher */}
          <div className="flex items-center rounded-md border border-border">
            <Button
              variant={view === 'grid' ? 'default' : 'ghost'}
              size="sm"
              className="h-9 px-2.5 rounded-r-none"
              onClick={() => setView('grid')}
              title={t('cards')}
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
              {pagination.total} {t('comics')}
            </span>
          )}
        </div>

        {/* Show/hide filters — desktop */}
        <Button
          variant="default"
          size="sm"
          className="h-9 gap-2 hidden sm:flex"
          onClick={() => setFiltersOpen((prev) => !prev)}
        >
          <Filter className="h-4 w-4" />
          {filtersOpen ? t('hideFilters') : t('showFilters')}
        </Button>

        {/* Show filters — mobile (Sheet) */}
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

      {/* Simple filter bar: sort + search */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="h-10 gap-2">
              <ArrowUpDown className="h-4 w-4" />
              {t('sortByLabel')}: {t(currentSortLabel)}
              {filters.sortOrder === 'asc' ? ' ↑' : ' ↓'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {sortOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => handleSortChange(opt.value as CatalogSearchParams['sortBy'])}
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
            defaultValue={filters.title ?? ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 h-10 focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
      </div>

      {/* Collapsible filter panel — desktop */}
      {filtersOpen && (
        <div className="hidden sm:block rounded-lg bg-card border border-border shadow-md animate-in slide-in-from-top-2 duration-200">
          {/* Panel header */}
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
                  onClick={() => handleFiltersChange({ page: 1, limit: LIMIT })}
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

          {/* Filter content */}
          <div className="border-t border-border p-4">
            {filterSidebar}
          </div>

          {/* Applied filter tags */}
          {activeFilterTags.length > 0 && (
            <div className="border-t border-border p-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                {t('activeFilters')}
              </p>
              <div className="flex flex-wrap gap-2">
                {activeFilterTags.map((tag, i) => (
                  <button
                    key={`${tag.key}-${tag.value ?? i}`}
                    className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full hover:bg-primary/20 transition-colors"
                    onClick={() => removeFilter(tag.key, tag.value)}
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
        ) : entries.length === 0 ? (
          <div className="flex flex-col w-full py-8 items-center justify-center p-8 text-center">
            <p className="text-xl text-muted-foreground mb-2">{t('noResults')}</p>
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              onClick={() => handleFiltersChange({ page: 1, limit: LIMIT })}
            >
              {t('clearFilters')}
            </Button>
          </div>
        ) : (
          <>
            {view === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 justify-items-center">
                {entries.map((entry) => (
                  <CatalogCard key={entry.id} entry={entry} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entries.map((entry) => (
                  <CatalogListItem key={entry.id} entry={entry} />
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
