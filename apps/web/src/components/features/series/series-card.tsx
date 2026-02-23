'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Series } from '@/lib/api/series';

interface SeriesCardProps {
  series: Series;
}

export function SeriesCard({ series }: SeriesCardProps) {
  const t = useTranslations('series');
  const locale = useLocale();
  const editionCount = series._count?.catalogEntries ?? 0;

  return (
    <Link href={`/${locale}/series/${series.id}`} className="block group">
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-1">
              {series.title}
            </CardTitle>
            <Badge variant="secondary" className="shrink-0">
              <BookOpen className="h-3 w-3 mr-1" />
              {editionCount} {t('editions')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {series.description ? (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {series.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground/50 italic">
              {t('noDescription')}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
