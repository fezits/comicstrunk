'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Book, Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { CatalogEdition } from '@/lib/api/series';

interface SeriesEditionsListProps {
  editions: CatalogEdition[];
}

export function SeriesEditionsList({ editions }: SeriesEditionsListProps) {
  const t = useTranslations('series.detail');
  const locale = useLocale();

  if (editions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{t('noEditions')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {editions.map((edition) => (
        <Link
          key={edition.id}
          href={`/${locale}/catalog/${edition.slug ?? edition.id}`}
          className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-accent/50"
        >
          {/* Cover thumbnail */}
          <div className="h-24 w-16 shrink-0 overflow-hidden rounded bg-muted flex items-center justify-center">
            {edition.coverImageUrl ? (
              <img
                src={edition.coverImageUrl}
                alt={edition.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <Book className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {edition.editionNumber != null && (
                <Badge variant="outline" className="shrink-0">
                  #{edition.editionNumber}
                </Badge>
              )}
              {edition.volumeNumber != null && (
                <Badge variant="secondary" className="shrink-0">
                  {t('volume')} {edition.volumeNumber}
                </Badge>
              )}
            </div>
            <p className="mt-1 font-medium truncate">{edition.title}</p>
            <p className="text-sm text-muted-foreground truncate">
              {[edition.author, edition.publisher].filter(Boolean).join(' — ')}
            </p>
          </div>

          {/* Rating */}
          <div className="shrink-0 text-right">
            {edition.ratingCount > 0 ? (
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                <span>{(Number(edition.averageRating) || 0).toFixed(1)}</span>
                <span className="text-muted-foreground">({edition.ratingCount})</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">{t('noRatings')}</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
