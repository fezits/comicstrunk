'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { SeriesProgressItem } from '@/lib/api/collection';

interface SeriesProgressCardProps {
  progress: SeriesProgressItem;
}

export function SeriesProgressCard({ progress }: SeriesProgressCardProps) {
  const locale = useLocale();
  const t = useTranslations('collection.seriesProgress');

  return (
    <Link
      href={`/${locale}/collection?seriesId=${progress.seriesId}`}
      className="block"
    >
      <Card className="transition-shadow hover:shadow-lg">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold truncate">{progress.seriesTitle}</h3>
            <span className="text-sm text-muted-foreground shrink-0 ml-2">
              {progress.collected}/{progress.totalEditions}
            </span>
          </div>

          <Progress value={progress.percentage} className="h-2" />

          <p className="text-sm text-muted-foreground">
            {t('collected', {
              count: progress.collected,
              total: progress.totalEditions,
              percentage: Math.round(progress.percentage),
            })}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
