'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Filter, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import type { MarketplaceSearchParams } from '@/lib/api/marketplace';
import type { ItemCondition } from '@/lib/api/collection';

interface MarketplaceFiltersProps {
  filters: MarketplaceSearchParams;
  onFiltersChange: (filters: MarketplaceSearchParams) => void;
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
        <span className="text-xs text-muted-foreground">{open ? '-' : '+'}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function MarketplaceFilters({
  filters,
  onFiltersChange,
}: MarketplaceFiltersProps) {
  const t = useTranslations('marketplace');
  const pubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback(
    (partial: Partial<MarketplaceSearchParams>) => {
      onFiltersChange({ ...filters, ...partial, page: 1 });
    },
    [filters, onFiltersChange],
  );

  const clearAll = () => {
    onFiltersChange({ page: 1, limit: filters.limit });
  };

  const hasActiveFilters =
    filters.condition ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.publisher;

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

      {/* Condition */}
      <FilterSection title={t('condition')}>
        <Select
          value={filters.condition ?? '_all'}
          onValueChange={(v) =>
            update({ condition: v === '_all' ? undefined : (v as ItemCondition) })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder={t('allConditions')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('allConditions')}</SelectItem>
            {CONDITIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`conditionLabels.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      {/* Price range */}
      <FilterSection title={t('priceRange')}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">{t('minPrice')}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="R$ 0,00"
                defaultValue={filters.minPrice ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  update({ minPrice: val });
                }}
                className="h-8 text-sm"
              />
            </div>
            <span className="text-xs text-muted-foreground mt-5">-</span>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">{t('maxPrice')}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="R$ 999,99"
                defaultValue={filters.maxPrice ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  update({ maxPrice: val });
                }}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>
      </FilterSection>

      {/* Publisher */}
      <FilterSection title={t('publisher')} defaultOpen={false}>
        <Input
          placeholder={t('publisherPlaceholder')}
          defaultValue={filters.publisher ?? ''}
          onChange={(e) => {
            if (pubTimer.current) clearTimeout(pubTimer.current);
            pubTimer.current = setTimeout(() => {
              update({ publisher: e.target.value || undefined });
            }, 300);
          }}
          className="h-8 text-sm"
        />
      </FilterSection>

      {/* Sort */}
      <FilterSection title={t('sortBy')}>
        <div className="space-y-2">
          <Select
            value={filters.sortBy ?? 'newest'}
            onValueChange={(v) =>
              update({ sortBy: v as MarketplaceSearchParams['sortBy'] })
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price">{t('sortPrice')}</SelectItem>
              <SelectItem value="newest">{t('sortNewest')}</SelectItem>
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
