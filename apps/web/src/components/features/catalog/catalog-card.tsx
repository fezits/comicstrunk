'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { BookOpen, Check, Loader2, Plus, Repeat2 } from 'lucide-react';
import { CoverImage } from '@/components/ui/cover-image';
import { toast } from 'sonner';
import { AxiosError } from 'axios';

import { StarRating } from './star-rating';
import { FavoriteButton } from '@/components/features/favorites/favorite-button';
import { useAuth } from '@/lib/auth/use-auth';
import { addCollectionItem } from '@/lib/api/collection';
import type { CatalogEntry } from '@/lib/api/catalog';

interface CatalogCardProps {
  entry: CatalogEntry;
  isOwned?: boolean;
  onOwnedChange?: (entryId: string, owned: boolean) => void;
}

export function CatalogCard({ entry, isOwned = false, onOwnedChange }: CatalogCardProps) {
  const locale = useLocale();
  const t = useTranslations('catalog');
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [added, setAdded] = useState(isOwned);
  const [adding, setAdding] = useState(false);

  // Sync local state when parent updates the owned status (e.g., after refresh)
  useEffect(() => {
    setAdded(isOwned);
  }, [isOwned]);

  return (
    <Link href={`/${locale}/catalog/${entry.slug ?? entry.id}`} className="block group">
      <div className="w-full flex flex-col bg-card text-card-foreground rounded-lg shadow-lg border border-border/50 dark:border-transparent hover:scale-[1.02] transition-transform duration-300 overflow-hidden">
        {/* Cover image */}
        <div className="relative aspect-[2/3] bg-muted overflow-hidden">
          {entry.coverImageUrl ? (
            <CoverImage src={entry.coverImageUrl} alt={entry.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-primary/5 dark:bg-muted">
              <BookOpen className="h-16 w-16 text-primary/20" />
            </div>
          )}

          {/* Owned badge — always visible */}
          {added && (
            <div className="absolute top-2 left-2 bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow">
              <Check className="h-3 w-3" />
              Tenho
            </div>
          )}

          {/* Action buttons — top-right */}
          <div className="absolute top-2 right-2 flex flex-col items-end space-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              className={`w-8 h-8 flex items-center justify-center border-2 border-white rounded-full text-white transition ${
                added
                  ? 'bg-green-600'
                  : 'bg-primary hover:bg-primary/80'
              }`}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (adding) return;
                if (!isAuthenticated) {
                  router.push(`/${locale}/login`);
                  return;
                }
                setAdding(true);
                try {
                  await addCollectionItem({ catalogEntryId: entry.id });
                  setAdded(true);
                  onOwnedChange?.(entry.id, true);
                  toast.success(t('addedToCollection'));
                } catch (error) {
                  toast.error(t('addToCollectionError'));
                } finally {
                  setAdding(false);
                }
              }}
              disabled={adding}
              title={t('addToCollection')}
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : added ? (
                <Check className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
            <FavoriteButton
              catalogEntryId={entry.id}
              size="sm"
              className="bg-background/80 backdrop-blur-sm shadow-sm"
            />
            <button
              className="w-8 h-8 flex items-center justify-center bg-primary hover:bg-primary/80 border-2 border-white rounded-full text-white transition opacity-50 cursor-not-allowed"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              title={t('trade')}
              disabled
            >
              <Repeat2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 px-3 py-2 overflow-hidden">
          {/* Star rating — centered */}
          <div className="flex justify-center mb-1">
            <StarRating rating={entry.averageRating} count={entry.ratingCount} size="sm" />
          </div>

          {/* Title — fixed height for 2 lines */}
          <h3 className="font-bold text-sm line-clamp-2 h-10 mb-1">
            {entry.title}
          </h3>

          {/* Series badge — always reserve space */}
          <div className="h-7 mb-1">
            {entry.series && (
              <span className="inline-flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
                <BookOpen className="h-3 w-3 text-primary" />
                <span className="text-xs text-foreground line-clamp-1">{entry.series.title}</span>
              </span>
            )}
          </div>

          {/* Details — fills remaining space */}
          <div className="text-xs space-y-0.5 text-muted-foreground flex-1">
            {entry.author && (
              <p className="truncate">
                <span className="font-semibold text-foreground">{t('detail.author')}:</span>{' '}
                {entry.author}
              </p>
            )}
            {entry.publisher && (
              <p className="truncate">
                <span className="font-semibold text-foreground">{t('detail.publisher')}:</span>{' '}
                {entry.publisher}
              </p>
            )}
            {entry.createdAt && (
              <p className="truncate">
                <span className="font-semibold text-foreground">{t('releaseDate')}:</span>{' '}
                {new Date(entry.createdAt).toLocaleDateString(locale)}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
