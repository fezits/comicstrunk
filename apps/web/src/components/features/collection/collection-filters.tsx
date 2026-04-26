'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Filter, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { CollectionSearchParams, ItemCondition } from '@/lib/api/collection';

interface CollectionFiltersProps {
  filters: CollectionSearchParams;
  onFiltersChange: (filters: CollectionSearchParams) => void;
}

const CONDITIONS: ItemCondition[] = ['NEW', 'VERY_GOOD', 'GOOD', 'FAIR', 'POOR'];

function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium hover:text-primary transition-colors">
        {title}
        <span className="text-xs text-muted-foreground">{open ? '−' : '+'}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function CollectionFilters({ filters, onFiltersChange }: CollectionFiltersProps) {
  const t = useTranslations('collection');
  const [searchInput, setSearchInput] = useState(filters.query ?? '');

  useEffect(() => {
    setSearchInput(filters.query ?? '');
  }, [filters.query]);

  const update = useCallback(
    (partial: Partial<CollectionSearchParams>) => {
      onFiltersChange({ ...filters, ...partial, page: 1 });
    },
    [filters, onFiltersChange],
  );

  const submitSearch = () => {
    update({ query: searchInput.trim() || undefined });
  };

  const clearAll = () => {
    onFiltersChange({ page: 1, limit: filters.limit });
  };

  const hasActiveFilters =
    filters.query ||
    filters.condition ||
    filters.isRead !== undefined ||
    filters.isForSale !== undefined ||
    filters.seriesId;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Filter className="h-4 w-4" />
          {t('filters')}
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs">
            <X className="h-3 w-3 mr-1" />
            {t('clearFilters')}
          </Button>
        )}
      </div>

      {/* Search */}
      <FilterSection title={t('searchPlaceholder')}>
        <Input
          placeholder={t('searchPlaceholder')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }}
          onBlur={submitSearch}
          className="h-8 text-sm"
        />
      </FilterSection>

      {/* Condition */}
      <FilterSection title={t('conditionLabel')}>
        <Select
          value={filters.condition ?? '_all'}
          onValueChange={(v) => update({ condition: v === '_all' ? undefined : (v as ItemCondition) })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder={t('allConditions')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('allConditions')}</SelectItem>
            {CONDITIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`condition.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      {/* Read status */}
      <FilterSection title={t('readStatus')}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="filter-read"
              checked={filters.isRead === true}
              onCheckedChange={(checked) =>
                update({ isRead: checked === true ? true : undefined })
              }
            />
            <Label htmlFor="filter-read" className="text-sm cursor-pointer">
              {t('onlyRead')}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="filter-unread"
              checked={filters.isRead === false}
              onCheckedChange={(checked) =>
                update({ isRead: checked === true ? false : undefined })
              }
            />
            <Label htmlFor="filter-unread" className="text-sm cursor-pointer">
              {t('onlyUnread')}
            </Label>
          </div>
        </div>
      </FilterSection>

      {/* For sale */}
      <FilterSection title={t('saleStatus')}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="filter-sale"
              checked={filters.isForSale === true}
              onCheckedChange={(checked) =>
                update({ isForSale: checked === true ? true : undefined })
              }
            />
            <Label htmlFor="filter-sale" className="text-sm cursor-pointer">
              {t('onlyForSale')}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="filter-not-sale"
              checked={filters.isForSale === false}
              onCheckedChange={(checked) =>
                update({ isForSale: checked === true ? false : undefined })
              }
            />
            <Label htmlFor="filter-not-sale" className="text-sm cursor-pointer">
              {t('onlyNotForSale')}
            </Label>
          </div>
        </div>
      </FilterSection>

      {/* Sort */}
      <FilterSection title={t('sortBy')}>
        <div className="space-y-2">
          <Select
            value={filters.sortBy ?? 'createdAt'}
            onValueChange={(v) =>
              update({ sortBy: v as CollectionSearchParams['sortBy'] })
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">{t('sortTitle')}</SelectItem>
              <SelectItem value="createdAt">{t('sortDate')}</SelectItem>
              <SelectItem value="pricePaid">{t('sortPrice')}</SelectItem>
              <SelectItem value="condition">{t('sortCondition')}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.sortOrder ?? 'desc'}
            onValueChange={(v) => update({ sortOrder: v as 'asc' | 'desc' })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">{t('ascending')}</SelectItem>
              <SelectItem value="desc">{t('descending')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FilterSection>
    </div>
  );
}
