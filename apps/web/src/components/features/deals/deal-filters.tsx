'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listStores, type PartnerStore, type ListDealsParams } from '@/lib/api/deals';
import { getCategories } from '@/lib/api/taxonomy';
import type { Category } from '@/lib/api/taxonomy';

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'COUPON', label: 'Cupons' },
  { value: 'PROMOTION', label: 'Promocoes' },
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'expiring', label: 'Expirando em breve' },
];

interface DealFiltersProps {
  filters: ListDealsParams;
  onFiltersChange: (filters: ListDealsParams) => void;
}

export function DealFilters({ filters, onFiltersChange }: DealFiltersProps) {
  const [stores, setStores] = useState<PartnerStore[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const loadFiltersData = useCallback(async () => {
    try {
      const [storesData, categoriesData] = await Promise.all([
        listStores(),
        getCategories(),
      ]);
      setStores(storesData);
      setCategories(categoriesData);
    } catch {
      // Silently fail - filters will just not show store/category options
    }
  }, []);

  useEffect(() => {
    loadFiltersData();
  }, [loadFiltersData]);

  const handleChange = (key: keyof ListDealsParams, value: string) => {
    const updated = { ...filters, page: 1 };

    if (value === 'ALL' || value === '') {
      delete updated[key];
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (updated as any)[key] = value;
    }

    onFiltersChange(updated);
  };

  return (
    <div className="flex flex-col sm:flex-row flex-wrap gap-3">
      {/* Store filter */}
      <Select
        value={filters.storeId ?? 'ALL'}
        onValueChange={(value) => handleChange('storeId', value)}
      >
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Todas as lojas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todas as lojas</SelectItem>
          {stores.map((store) => (
            <SelectItem key={store.id} value={store.id}>
              {store.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Category filter */}
      <Select
        value={filters.categoryId ?? 'ALL'}
        onValueChange={(value) => handleChange('categoryId', value)}
      >
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Todas as categorias" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todas as categorias</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Type filter */}
      <Select
        value={filters.type ?? 'ALL'}
        onValueChange={(value) => handleChange('type', value)}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort */}
      <Select
        value={filters.sort ?? 'recent'}
        onValueChange={(value) => handleChange('sort', value)}
      >
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Ordenar" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
