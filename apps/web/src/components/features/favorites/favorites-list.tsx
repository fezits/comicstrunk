'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Heart, BookOpen, Library } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StarRating } from '@/components/features/catalog/star-rating';
import { FavoriteButton } from './favorite-button';
import { getUserFavorites, type FavoriteItem } from '@/lib/api/favorites';
import type { PaginationMeta } from '@/lib/api/catalog';

const PAGE_SIZE = 20;

export function FavoritesList() {
  const t = useTranslations('favorites');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);

  const fetchFavorites = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setError(false);
      try {
        const result = await getUserFavorites({ page: pageNum, limit: PAGE_SIZE });
        setFavorites(result.data);
        setPagination(result.pagination);
        setPage(pageNum);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchFavorites(1);
  }, [fetchFavorites]);

  const handleUnfavorite = useCallback(
    (catalogEntryId: string, favorited: boolean) => {
      if (!favorited) {
        // Remove from list with smooth transition
        setFavorites((prev) => prev.filter((f) => f.catalogEntry.id !== catalogEntryId));
        // Update pagination total
        setPagination((prev) =>
          prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev,
        );
      }
    },
    [],
  );

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[2/3] rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-destructive">{tCommon('error')}</p>
        <Button variant="outline" onClick={() => fetchFavorites(page)}>
          {tCommon('back')}
        </Button>
      </div>
    );
  }

  // Empty state
  if (favorites.length === 0 && page === 1) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <Heart className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground text-center max-w-md">{t('empty')}</p>
          <Button asChild variant="outline">
            <Link href={`/${locale}/catalog`}>
              <Library className="h-4 w-4 mr-2" />
              {t('exploreCatalog')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          {pagination && (
            <p className="text-sm text-muted-foreground mt-1">
              {t('count', { count: pagination.total })}
            </p>
          )}
        </div>
      </div>

      {/* Favorites grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {favorites.map((fav) => (
          <FavoriteCard
            key={fav.id}
            favorite={fav}
            locale={locale}
            onToggle={handleUnfavorite}
          />
        ))}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => fetchFavorites(page - 1)}
          >
            {t('previousPage')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('pageOf', { current: page, total: pagination.totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => fetchFavorites(page + 1)}
          >
            {t('nextPage')}
          </Button>
        </div>
      )}
    </div>
  );
}

// --- Individual favorite card ---

interface FavoriteCardProps {
  favorite: FavoriteItem;
  locale: string;
  onToggle: (catalogEntryId: string, favorited: boolean) => void;
}

function FavoriteCard({ favorite, locale, onToggle }: FavoriteCardProps) {
  const entry = favorite.catalogEntry;

  return (
    <div className="group relative w-full flex flex-col bg-card text-card-foreground rounded-lg shadow-lg border border-border/50 dark:border-transparent hover:scale-[1.02] transition-all duration-300 overflow-hidden">
      {/* Cover image */}
      <Link
        href={`/${locale}/catalog/${entry.id}`}
        className="relative aspect-[2/3] bg-muted overflow-hidden block"
      >
        {entry.coverImageUrl ? (
          <img
            src={entry.coverImageUrl}
            alt={entry.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-primary/5 dark:bg-muted">
            <BookOpen className="h-16 w-16 text-primary/20" />
          </div>
        )}

        {/* Favorite button — top-right */}
        <div className="absolute top-2 right-2">
          <FavoriteButton
            catalogEntryId={entry.id}
            initialFavorited={true}
            size="sm"
            className="bg-background/80 backdrop-blur-sm shadow-sm"
            onToggle={(favorited) => onToggle(entry.id, favorited)}
          />
        </div>
      </Link>

      {/* Content */}
      <div className="flex flex-col flex-1 px-3 py-2 overflow-hidden">
        {/* Rating */}
        <div className="flex justify-center mb-1">
          <StarRating rating={Number(entry.averageRating) || 0} count={Number(entry.ratingCount) || 0} size="sm" />
        </div>

        {/* Title */}
        <Link href={`/${locale}/catalog/${entry.id}`}>
          <h3 className="font-bold text-sm line-clamp-2 h-10 mb-1 hover:text-primary transition-colors">
            {entry.title}
          </h3>
        </Link>

        {/* Series badge */}
        <div className="h-7 mb-1">
          {entry.series && (
            <span className="inline-flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
              <BookOpen className="h-3 w-3 text-primary" />
              <span className="text-xs text-foreground line-clamp-1">{entry.series.title}</span>
            </span>
          )}
        </div>

        {/* Details */}
        <div className="text-xs space-y-0.5 text-muted-foreground flex-1">
          {entry.author && <p className="truncate">{entry.author}</p>}
          {entry.publisher && <p className="truncate">{entry.publisher}</p>}
        </div>
      </div>
    </div>
  );
}
