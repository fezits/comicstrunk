'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { BookOpen, Heart, Plus } from 'lucide-react';

import { StarRating } from './star-rating';
import type { CatalogEntry } from '@/lib/api/catalog';

interface CatalogListItemProps {
  entry: CatalogEntry;
}

export function CatalogListItem({ entry }: CatalogListItemProps) {
  const locale = useLocale();
  const t = useTranslations('catalog');

  return (
    <Link href={`/${locale}/catalog/${entry.slug ?? entry.id}`} className="block group">
      <div className="relative flex bg-card text-card-foreground p-4 rounded-lg shadow-md border border-border/50 dark:border-transparent hover:scale-[1.02] cursor-pointer transition-transform duration-300">
        {/* Cover */}
        <div className="w-24 h-32 shrink-0 mr-4 rounded overflow-hidden bg-muted">
          {entry.coverImageUrl ? (
            <img
              src={entry.coverImageUrl}
              alt={entry.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/5 dark:bg-muted">
              <BookOpen className="h-8 w-8 text-primary/20" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg line-clamp-1 group-hover:text-primary transition-colors">
            {entry.title}
          </h3>

          <div className="text-sm text-muted-foreground space-y-0.5 mt-1">
            {entry.author && (
              <p>
                <span className="font-semibold text-foreground">{t('detail.author')}:</span>{' '}
                {entry.author}
              </p>
            )}
            {entry.publisher && (
              <p>
                <span className="font-semibold text-foreground">{t('detail.publisher')}:</span>{' '}
                {entry.publisher}
              </p>
            )}
            {entry.createdAt && (
              <p>
                <span className="font-semibold text-foreground">{t('releaseDate')}:</span>{' '}
                {new Date(entry.createdAt).toLocaleDateString(locale)}
              </p>
            )}
          </div>

          {entry.series && (
            <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full mt-1.5">
              <BookOpen className="h-3 w-3 text-primary" />
              <span className="text-xs">{entry.series.title}</span>
            </span>
          )}

          <div className="mt-1.5">
            <StarRating rating={entry.averageRating} count={entry.ratingCount} size="sm" />
          </div>
        </div>

        {/* Action buttons — hover */}
        <div className="absolute top-4 right-4 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            className="w-10 h-10 flex items-center justify-center bg-primary hover:bg-primary/80 border-2 border-white rounded-full text-white transition"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            title={t('addToCollection')}
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            className="w-10 h-10 flex items-center justify-center bg-primary hover:bg-primary/80 border-2 border-white rounded-full text-white transition"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            title={t('favorite')}
          >
            <Heart className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Link>
  );
}
