'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Search, Loader2, Check, Plus, X, Minus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover-image';
import { Input } from '@/components/ui/input';
import { searchCatalog, type CatalogEntry } from '@/lib/api/catalog';
import { batchAddItems, addCollectionItem, deleteCollectionItem, getOwnedIds } from '@/lib/api/collection';
import { useCollection } from '@/contexts/collection-context';

const PAGE_SIZE = 30;

interface BatchAddQuickProps {
  onAdded: (count: number) => void;
  sessionCount: number;
}

export function BatchAddQuick({ onAdded, sessionCount }: BatchAddQuickProps) {
  const t = useTranslations('batchAdd');
  const locale = useLocale();

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<CatalogEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);
  const [sortBy, setSortBy] = useState<'createdAt' | 'title'>('createdAt');
  const [sortOrder] = useState<'desc' | 'asc'>('desc');
  const { incrementCount, decrementCount } = useCollection();
  const [totalResults, setTotalResults] = useState(0);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  // Map catalogEntryId -> collectionItemId for items user already owns
  const [ownedMap, setOwnedMap] = useState<Map<string, string>>(new Map());
  const activeQuery = useRef('');

  // Track quantity per entry for adding
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());

  const getQty = (entryId: string) => quantities.get(entryId) ?? 1;
  const setQty = (entryId: string, qty: number) => {
    setQuantities((prev) => { const next = new Map(prev); next.set(entryId, Math.max(1, qty)); return next; });
  };

  // Load user's full collection to know what they already have
  useEffect(() => {
    getOwnedIds()
      .then((items) => {
        const map = new Map<string, string>();
        items.forEach((item) => map.set(item.catalogEntryId, item.id));
        setOwnedMap(map);
      })
      .catch(() => {});
  }, []);

  // Debounced search (resets to page 1)
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      setHasMore(false);
      setTotalResults(0);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setPage(1);
      activeQuery.current = searchQuery;
      try {
        const result = await searchCatalog({ title: searchQuery, limit: PAGE_SIZE, page: 1, sortBy, sortOrder });
        setResults(result.data);
        setTotalResults(result.pagination.total);
        setHasMore(result.pagination.page < result.pagination.totalPages);
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, sortBy, sortOrder]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const result = await searchCatalog({ title: activeQuery.current, limit: PAGE_SIZE, page: nextPage, sortBy, sortOrder });
      setResults((prev) => [...prev, ...result.data]);
      setPage(nextPage);
      setHasMore(result.pagination.page < result.pagination.totalPages);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page]);

  const handleQuickAdd = useCallback(async (entry: CatalogEntry) => {
    setAddingId(entry.id);
    const qty = getQty(entry.id);
    try {
      const item = await addCollectionItem({
        catalogEntryId: entry.id,
        quantity: qty,
        condition: 'VERY_GOOD',
      });

      setAddedIds((prev) => new Set(prev).add(entry.id));
      setOwnedMap((prev) => { const next = new Map(prev); next.set(entry.id, item.id); return next; });
      onAdded(1);
      incrementCount(qty);
      toast.success(`"${entry.title}" adicionado (${qty}x)`);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setAddedIds((prev) => new Set(prev).add(entry.id));
        toast.info(t('alreadyInCollection'));
      } else {
        const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
        toast.error(message || 'Erro ao adicionar');
      }
    } finally {
      setAddingId(null);
    }
  }, [onAdded, t, quantities]);

  const handleRemove = useCallback(async (catalogEntryId: string) => {
    const collectionItemId = ownedMap.get(catalogEntryId);
    if (!collectionItemId) return;

    setRemovingId(catalogEntryId);
    try {
      await deleteCollectionItem(collectionItemId);
      setOwnedMap((prev) => {
        const next = new Map(prev);
        next.delete(catalogEntryId);
        return next;
      });
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(catalogEntryId);
        return next;
      });
      decrementCount();
      toast.success('Removido da coleção');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(message || 'Erro ao remover');
    } finally {
      setRemovingId(null);
    }
  }, [ownedMap]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('searchCatalog')}
          className="pl-10"
        />
      </div>

      {/* Sort options */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Ordenar:</span>
        <button
          className={`px-2 py-1 rounded ${sortBy === 'createdAt' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
          onClick={() => setSortBy('createdAt')}
        >
          Mais recentes
        </button>
        <button
          className={`px-2 py-1 rounded ${sortBy === 'title' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
          onClick={() => setSortBy('title')}
        >
          A-Z
        </button>
      </div>

      {searching && (
        <div className="flex items-center gap-2 text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Buscando...</span>
        </div>
      )}

      {!searching && results.length === 0 && searchQuery.length < 2 && (
        <p className="text-center text-muted-foreground py-8">{t('searchToStartQuick')}</p>
      )}

      {!searching && results.length === 0 && searchQuery.length >= 2 && (
        <p className="text-center text-muted-foreground py-8">{t('noResults')}</p>
      )}

      {/* Results count */}
      {results.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Mostrando {results.length} de {totalResults} resultados
        </p>
      )}

      {/* Results list */}
      <div className="flex flex-col gap-2">
        {results.map((entry) => {
          const justAdded = addedIds.has(entry.id);
          const isAdding = addingId === entry.id;
          const isOwned = ownedMap.has(entry.id);
          const isRemoving = removingId === entry.id;

          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                justAdded
                  ? 'bg-green-500/10 border border-green-500/20'
                  : isOwned
                    ? 'bg-muted/20 border border-muted'
                    : 'bg-muted/30 hover:bg-muted/50'
              }`}
            >
              {/* Cover thumbnail — click to zoom */}
              <div
                className="w-10 h-14 bg-muted rounded overflow-hidden flex-shrink-0 cursor-zoom-in"
                onClick={() => entry.coverImageUrl && setZoomImage({ url: entry.coverImageUrl, title: entry.title })}
              >
                {entry.coverImageUrl ? (
                  <CoverImage
                    src={entry.coverImageUrl}
                    alt={entry.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[8px] text-muted-foreground">
                    sem capa
                  </div>
                )}
              </div>

              {/* Info — title links to detail */}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/${locale}/catalog/${entry.slug || entry.id}`}
                  target="_blank"
                  className="font-medium text-xs sm:text-sm truncate block hover:text-primary hover:underline"
                >
                  {entry.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {entry.publisher ?? ''}
                  {entry.publishYear ? ` · ${entry.publishYear}` : ''}
                </p>
              </div>

              {/* Action */}
              {justAdded ? (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="flex items-center gap-1 text-green-500 text-sm">
                    <Check className="h-4 w-4" />
                    {t('added')}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(entry.id)}
                    disabled={isRemoving}
                    title="Remover da coleção"
                  >
                    {isRemoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ) : isOwned ? (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground">{t('alreadyInCollection')}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(entry.id)}
                    disabled={isRemoving}
                    title="Remover da coleção"
                  >
                    {isRemoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  {/* Quantity selector */}
                  <div className="flex items-center border rounded-md">
                    <button
                      className="h-7 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); setQty(entry.id, getQty(entry.id) - 1); }}
                      disabled={getQty(entry.id) <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="h-7 w-6 flex items-center justify-center text-xs font-medium">
                      {getQty(entry.id)}
                    </span>
                    <button
                      className="h-7 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); setQty(entry.id, getQty(entry.id) + 1); }}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleQuickAdd(entry)}
                    disabled={isAdding}
                    className="shrink-0 bg-green-600 hover:bg-green-700"
                  >
                    {isAdding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        {t('add')}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Carregando...
              </>
            ) : (
              `Carregar mais (${results.length} de ${totalResults})`
            )}
          </Button>
        </div>
      )}

      {/* Session counter */}
      {sessionCount > 0 && (
        <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
          <span className="text-sm text-green-500">
            {t('addedCount', { count: sessionCount })}
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${locale}/collection`}>{t('viewCollection')}</Link>
          </Button>
        </div>
      )}
      {/* Image zoom modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setZoomImage(null)}
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={zoomImage.url}
            alt={zoomImage.title}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
