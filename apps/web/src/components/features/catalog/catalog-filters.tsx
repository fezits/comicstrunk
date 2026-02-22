'use client';

import { useCallback, useRef, useState } from 'react';
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
import type { CatalogSearchParams } from '@/lib/api/catalog';
import type { Category, Character } from '@/lib/api/taxonomy';
import type { Series } from '@/lib/api/series';

interface CatalogFiltersProps {
  filters: CatalogSearchParams;
  onFiltersChange: (filters: CatalogSearchParams) => void;
  categories: Category[];
  characters: Character[];
  series: Series[];
}

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

export function CatalogFilters({
  filters,
  onFiltersChange,
  categories,
  characters,
  series,
}: CatalogFiltersProps) {
  const t = useTranslations('catalog');
  const [charSearch, setCharSearch] = useState('');
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback(
    (partial: Partial<CatalogSearchParams>) => {
      onFiltersChange({ ...filters, ...partial, page: 1 });
    },
    [filters, onFiltersChange],
  );

  const handleDebouncedChange = (
    timerRef: React.RefObject<ReturnType<typeof setTimeout> | null>,
    field: keyof CatalogSearchParams,
    value: string,
  ) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      update({ [field]: value || undefined });
    }, 300);
  };

  const toggleArrayItem = (
    field: 'categoryIds' | 'characterIds',
    id: string,
    checked: boolean,
  ) => {
    const current = filters[field] ?? [];
    const next = checked ? [...current, id] : current.filter((x) => x !== id);
    update({ [field]: next.length > 0 ? next : undefined });
  };

  const clearAll = () => {
    onFiltersChange({ page: 1, limit: filters.limit });
  };

  const hasActiveFilters =
    filters.title ||
    filters.publisher ||
    filters.seriesId ||
    (filters.categoryIds && filters.categoryIds.length > 0) ||
    (filters.characterIds && filters.characterIds.length > 0) ||
    filters.yearFrom ||
    filters.yearTo;

  const filteredCharacters = charSearch
    ? characters.filter((c) => c.name.toLowerCase().includes(charSearch.toLowerCase()))
    : characters;

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

      {/* Title search */}
      <FilterSection title={t('searchTitle').replace('...', '')}>
        <Input
          placeholder={t('searchTitle')}
          defaultValue={filters.title ?? ''}
          onChange={(e) => handleDebouncedChange(titleTimer, 'title', e.target.value)}
          className="h-8 text-sm"
        />
      </FilterSection>

      {/* Publisher search */}
      <FilterSection title={t('searchPublisher').replace('...', '')}>
        <Input
          placeholder={t('searchPublisher')}
          defaultValue={filters.publisher ?? ''}
          onChange={(e) => handleDebouncedChange(pubTimer, 'publisher', e.target.value)}
          className="h-8 text-sm"
        />
      </FilterSection>

      {/* Series */}
      <FilterSection title={t('series')}>
        <Select
          value={filters.seriesId ?? '_all'}
          onValueChange={(v) => update({ seriesId: v === '_all' ? undefined : v })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder={t('allSeries')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('allSeries')}</SelectItem>
            {series.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      {/* Categories */}
      <FilterSection title={t('categories')}>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2">
              <Checkbox
                id={`cat-${cat.id}`}
                checked={filters.categoryIds?.includes(cat.id) ?? false}
                onCheckedChange={(checked) =>
                  toggleArrayItem('categoryIds', cat.id, checked === true)
                }
              />
              <Label htmlFor={`cat-${cat.id}`} className="text-sm cursor-pointer">
                {cat.name}
              </Label>
            </div>
          ))}
        </div>
      </FilterSection>

      {/* Characters */}
      <FilterSection title={t('characters')} defaultOpen={false}>
        <div className="space-y-2">
          <Input
            placeholder={t('searchCharacter')}
            value={charSearch}
            onChange={(e) => setCharSearch(e.target.value)}
            className="h-7 text-xs"
          />
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {filteredCharacters.map((char) => (
              <div key={char.id} className="flex items-center gap-2">
                <Checkbox
                  id={`char-${char.id}`}
                  checked={filters.characterIds?.includes(char.id) ?? false}
                  onCheckedChange={(checked) =>
                    toggleArrayItem('characterIds', char.id, checked === true)
                  }
                />
                <Label htmlFor={`char-${char.id}`} className="text-sm cursor-pointer">
                  {char.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </FilterSection>

      {/* Year range */}
      <FilterSection title={t('yearRange')} defaultOpen={false}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder={t('yearFrom')}
            defaultValue={filters.yearFrom ?? ''}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              update({ yearFrom: val });
            }}
            className="h-8 text-sm"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <Input
            type="number"
            placeholder={t('yearTo')}
            defaultValue={filters.yearTo ?? ''}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              update({ yearTo: val });
            }}
            className="h-8 text-sm"
          />
        </div>
      </FilterSection>

      {/* Sort */}
      <FilterSection title={t('sortBy')}>
        <div className="space-y-2">
          <Select
            value={filters.sortBy ?? 'createdAt'}
            onValueChange={(v) =>
              update({ sortBy: v as CatalogSearchParams['sortBy'] })
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">{t('sortTitle')}</SelectItem>
              <SelectItem value="createdAt">{t('sortDate')}</SelectItem>
              <SelectItem value="averageRating">{t('sortRating')}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.sortOrder ?? 'desc'}
            onValueChange={(v) =>
              update({ sortOrder: v as 'asc' | 'desc' })
            }
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
