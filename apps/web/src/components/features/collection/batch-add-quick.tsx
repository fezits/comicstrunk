'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Search, Loader2, Check, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { searchCatalog, type CatalogEntry } from '@/lib/api/catalog';
import { batchAddItems } from '@/lib/api/collection';

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
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchCatalog({ title: searchQuery, limit: 15 });
        setResults(result.data);
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleQuickAdd = useCallback(async (entry: CatalogEntry) => {
    setAddingId(entry.id);
    try {
      const result = await batchAddItems({
        catalogEntryIds: [entry.id],
        condition: 'VERY_GOOD',
        isRead: false,
      });

      if (result.added > 0) {
        setAddedIds((prev) => new Set(prev).add(entry.id));
        onAdded(1);
        toast.success(`"${entry.title}" adicionado`);
      } else {
        setAddedIds((prev) => new Set(prev).add(entry.id));
        toast.info(t('alreadyInCollection'));
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(message || 'Erro ao adicionar');
    } finally {
      setAddingId(null);
    }
  }, [onAdded, t]);

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

      {/* Results list */}
      <div className="flex flex-col gap-2">
        {results.map((entry) => {
          const justAdded = addedIds.has(entry.id);
          const isAdding = addingId === entry.id;

          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                justAdded ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/30 hover:bg-muted/50'
              }`}
            >
              {/* Cover thumbnail */}
              <div className="w-10 h-14 bg-muted rounded overflow-hidden flex-shrink-0">
                {entry.coverImageUrl ? (
                  <img
                    src={entry.coverImageUrl}
                    alt={entry.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[8px] text-muted-foreground">
                    sem capa
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{entry.title}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.publisher ?? ''}
                  {entry.publishYear ? ` · ${entry.publishYear}` : ''}
                </p>
              </div>

              {/* Action */}
              {justAdded ? (
                <span className="flex items-center gap-1 text-green-500 text-sm shrink-0">
                  <Check className="h-4 w-4" />
                  {t('added')}
                </span>
              ) : (
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
              )}
            </div>
          );
        })}
      </div>

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
    </div>
  );
}
