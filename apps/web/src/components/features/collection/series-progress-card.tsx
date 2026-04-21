'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, BookOpen, Search, CheckCircle } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getMissingEditions,
  type SeriesProgressItem,
  type MissingEdition,
} from '@/lib/api/collection';

interface SeriesProgressCardProps {
  progress: SeriesProgressItem;
}

export function SeriesProgressCard({ progress }: SeriesProgressCardProps) {
  const locale = useLocale();
  const t = useTranslations('collection.seriesProgress');

  const [expanded, setExpanded] = useState(false);
  const [missingEditions, setMissingEditions] = useState<MissingEdition[] | null>(null);
  const [loadingMissing, setLoadingMissing] = useState(false);

  const isComplete = progress.collected >= progress.totalEditions;
  const missingCount = progress.totalEditions - progress.collected;

  const handleToggleMissing = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);

    // Only fetch if we haven't yet
    if (missingEditions === null) {
      setLoadingMissing(true);
      try {
        const editions = await getMissingEditions(progress.seriesId);
        setMissingEditions(editions);
      } catch {
        setMissingEditions([]);
      } finally {
        setLoadingMissing(false);
      }
    }
  };

  return (
    <Card className="transition-shadow hover:shadow-lg">
      <CardContent className="p-4 space-y-3">
        {/* Header: title + count */}
        <div className="flex items-center justify-between">
          <Link
            href={`/${locale}/collection?seriesId=${progress.seriesId}`}
            className="font-semibold truncate hover:text-primary transition-colors"
          >
            {progress.seriesTitle}
          </Link>
          <span className="text-sm text-muted-foreground shrink-0 ml-2">
            {progress.collected}/{progress.totalEditions}
          </span>
        </div>

        {/* Progress bar */}
        <Progress value={progress.percentage} className="h-2" />

        {/* Stats and toggle */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('collected', {
              count: progress.collected,
              total: progress.totalEditions,
              percentage: Math.round(progress.percentage),
            })}
          </p>

          {isComplete ? (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              {t('noMissing')}
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleToggleMissing}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  {t('hideMissing')}
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  {t('showMissing')} ({missingCount})
                </>
              )}
            </Button>
          )}
        </div>

        {/* Missing editions panel */}
        {expanded && !isComplete && (
          <div className="border-t pt-3 mt-1 space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('missingEditions')}
            </h4>

            {loadingMissing ? (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded" />
                ))}
              </div>
            ) : missingEditions && missingEditions.length > 0 ? (
              <div className="grid grid-cols-1 gap-1.5 max-h-64 overflow-y-auto">
                {missingEditions.map((edition) => (
                  <Link
                    key={edition.id}
                    href={`/${locale}/catalog/${edition.slug ?? edition.id}`}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors text-sm group"
                  >
                    <div className="w-8 h-11 bg-muted rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {edition.coverImageUrl ? (
                        <img
                          src={edition.coverImageUrl}
                          alt={edition.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <BookOpen className="h-3 w-3 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate group-hover:text-primary transition-colors">
                        {edition.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          edition.editionNumber != null
                            ? t('edition', { number: edition.editionNumber })
                            : null,
                          edition.volumeNumber != null
                            ? t('volume', { number: edition.volumeNumber })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' / ')}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('noMissing')}</p>
            )}

            {/* Search in catalog link */}
            <Button variant="outline" size="sm" className="w-full text-xs" asChild>
              <Link href={`/${locale}/catalog?seriesId=${progress.seriesId}`}>
                <Search className="h-3 w-3 mr-1" />
                {t('searchInCatalog')}
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
