'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Search, CheckSquare, Square, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getSeries, getSeriesById, type Series, type SeriesDetail, type CatalogEdition } from '@/lib/api/series';
import { useAuth } from '@/lib/auth/use-auth';
import { COLLECTION_LIMITS } from '@comicstrunk/contracts';

function extractNumber(edition: CatalogEdition): string {
  if (edition.editionNumber != null) return String(edition.editionNumber);
  if (edition.volumeNumber != null) return String(edition.volumeNumber);
  // Try to extract number from title (e.g. "Batman # 43" -> "43")
  const match = edition.title.match(/#\s*(\d+)/);
  if (match) return match[1];
  const matchVol = edition.title.match(/Vol\.?\s*(\d+)/i);
  if (matchVol) return matchVol[1];
  return '?';
}
import { batchAddItems, getCollectionStats } from '@/lib/api/collection';
import { useCollection } from '@/contexts/collection-context';

interface BatchAddBySeriesProps {
  onAdded: (count: number) => void;
}

export function BatchAddBySeries({ onAdded }: BatchAddBySeriesProps) {
  const t = useTranslations('batchAdd');
  const locale = useLocale();
  const { incrementCount } = useCollection();

  const [searchQuery, setSearchQuery] = useState('');
  const [seriesResults, setSeriesResults] = useState<Series[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<SeriesDetail | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [condition, setCondition] = useState('VERY_GOOD');
  const [isRead, setIsRead] = useState(false);
  const [adding, setAdding] = useState(false);

  const [totalItems, setTotalItems] = useState(0);

  // Load current collection count
  useEffect(() => {
    getCollectionStats().then((s) => setTotalItems(s.totalItems)).catch(() => {});
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSeriesResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await getSeries({ title: searchQuery, limit: 100 });
        setSeriesResults(result.data);
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load series detail + owned items
  const handleSelectSeries = useCallback(async (series: Series) => {
    setLoadingSeries(true);
    setSelectedSeries(null);
    setSelectedIds(new Set());
    setSeriesResults([]);
    setSearchQuery(series.title);

    try {
      const detail = await getSeriesById(series.slug ?? series.id);

      // Check which editions the user already owns
      const { default: apiClient } = await import('@/lib/api/client');
      const resp = await apiClient.get('/collection', {
        params: { seriesId: series.id, limit: 100 },
      });
      const owned = new Set<string>(
        (resp.data.data || []).map((item: { catalogEntryId: string }) => item.catalogEntryId),
      );

      setOwnedIds(owned);

      // Sort editions by number ascending
      if (detail.catalogEntries) {
        detail.catalogEntries.sort((a, b) => {
          const numA = parseInt(extractNumber(a), 10) || 9999;
          const numB = parseInt(extractNumber(b), 10) || 9999;
          return numA - numB;
        });
      }

      setSelectedSeries(detail);
    } catch {
      toast.error('Erro ao carregar serie');
    } finally {
      setLoadingSeries(false);
    }
  }, []);

  const availableEditions = selectedSeries?.catalogEntries.filter((e) => !ownedIds.has(e.id)) ?? [];

  const toggleEdition = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(availableEditions.map((e) => e.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Plan limit check — ADMIN has no limit
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const planLimit = isAdmin ? Infinity : COLLECTION_LIMITS.FREE;
  const currentCount = totalItems;
  const available = isAdmin ? Infinity : planLimit - currentCount;
  const overLimit = !isAdmin && selectedIds.size > available;

  const handleBatchAdd = async () => {
    if (selectedIds.size === 0 || overLimit) return;
    setAdding(true);
    try {
      const result = await batchAddItems({
        catalogEntryIds: Array.from(selectedIds),
        condition,
        isRead,
      });
      toast.success(t('success', { added: result.added, skipped: result.skipped }));
      onAdded(result.added);
      incrementCount(result.added);

      // Move added items to owned
      setOwnedIds((prev) => {
        const next = new Set(prev);
        selectedIds.forEach((id) => next.add(id));
        return next;
      });
      setSelectedIds(new Set());

      // Refresh count
      getCollectionStats().then((s) => setTotalItems(s.totalItems)).catch(() => {});
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(message || 'Erro ao adicionar gibis');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedSeries(null);
          }}
          placeholder={t('searchSeries')}
          className="pl-10"
        />
      </div>

      {/* Search results dropdown */}
      {seriesResults.length > 0 && !selectedSeries && (
        <div className="rounded-lg border bg-popover shadow-md">
          {seriesResults.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelectSeries(s)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
            >
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-muted-foreground">
                  {t('editions', { count: s._count?.catalogEntries ?? s.totalEditions ?? 0 })}
                  {(s as unknown as { yearBegan?: number }).yearBegan && ` · ${(s as unknown as { yearBegan: number }).yearBegan}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {searching && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Buscando...</span>
        </div>
      )}

      {!selectedSeries && !searching && seriesResults.length === 0 && searchQuery.length < 2 && (
        <p className="text-center text-muted-foreground py-8">{t('searchToStart')}</p>
      )}

      {loadingSeries && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Series editions grid */}
      {selectedSeries && (
        <div className="space-y-4">
          {/* Series header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{selectedSeries.title}</h2>
              <p className="text-sm text-muted-foreground">
                {t('editions', { count: selectedSeries.catalogEntries.length })}
                {ownedIds.size > 0 && ` · ${ownedIds.size} ja na colecao`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                <CheckSquare className="h-4 w-4 mr-1" />
                {t('selectAll')}
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                {t('clearSelection')}
              </Button>
            </div>
          </div>

          {/* Editions grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {selectedSeries.catalogEntries.map((edition) => {
              const owned = ownedIds.has(edition.id);
              const selected = selectedIds.has(edition.id);

              return (
                <button
                  key={edition.id}
                  onClick={() => !owned && toggleEdition(edition.id)}
                  disabled={owned}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                    owned
                      ? 'border-muted opacity-40 cursor-not-allowed'
                      : selected
                        ? 'border-primary bg-primary/10 scale-[1.02]'
                        : 'border-transparent hover:border-muted-foreground/30'
                  }`}
                >
                  {/* Cover */}
                  <div className="aspect-[2/3] bg-muted flex items-center justify-center">
                    {edition.coverImageUrl ? (
                      <img
                        src={edition.coverImageUrl}
                        alt={edition.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        #{extractNumber(edition)}
                      </span>
                    )}
                  </div>

                  {/* Selection indicator */}
                  {selected && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground w-5 h-5 rounded flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                  )}

                  {/* Owned badge */}
                  {owned && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                      <Badge variant="secondary" className="text-[10px]">Tenho</Badge>
                    </div>
                  )}

                  {/* Edition title — clickable link */}
                  <Link
                    href={`/${locale}/catalog/${edition.slug || edition.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block text-center text-[10px] py-0.5 truncate px-1 hover:text-primary hover:underline"
                    target="_blank"
                  >
                    #{extractNumber(edition)}
                  </Link>
                </button>
              );
            })}
          </div>

          {/* Options bar */}
          <div className="flex flex-wrap gap-4 items-center p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('defaultCondition')}:</span>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">Novo</SelectItem>
                  <SelectItem value="VERY_GOOD">Muito Bom</SelectItem>
                  <SelectItem value="GOOD">Bom</SelectItem>
                  <SelectItem value="FAIR">Regular</SelectItem>
                  <SelectItem value="POOR">Ruim</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('readStatus')}:</span>
              <Select value={isRead ? 'read' : 'unread'} onValueChange={(v) => setIsRead(v === 'read')}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">{t('read')}</SelectItem>
                  <SelectItem value="unread">{t('unread')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              {t('planLimit', { current: currentCount, limit: planLimit })}
            </span>
          </div>

          {/* Limit warning */}
          {overLimit && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
              {t('limitWarning', { selected: selectedIds.size, available })}
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <span className="text-sm text-muted-foreground">
              {t('selectedCount', { count: selectedIds.size })}
            </span>
            <Button
              onClick={handleBatchAdd}
              disabled={adding || selectedIds.size === 0 || overLimit}
              size="lg"
            >
              {adding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('adding')}
                </>
              ) : (
                t('addToCollection', { count: selectedIds.size })
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
