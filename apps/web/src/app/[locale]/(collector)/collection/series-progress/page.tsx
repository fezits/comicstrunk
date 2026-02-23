'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, BarChart3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SeriesProgressCard } from '@/components/features/collection/series-progress-card';
import { getSeriesProgress, type SeriesProgressItem } from '@/lib/api/collection';

export default function SeriesProgressPage() {
  const t = useTranslations('collection.seriesProgress');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [progressList, setProgressList] = useState<SeriesProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchProgress() {
      setLoading(true);
      setError(false);
      try {
        const data = await getSeriesProgress();
        if (!cancelled) setProgressList(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProgress();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/${locale}/collection`}
          className="hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToCollection')}
        </Link>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive">{tCommon('error')}</p>
        </div>
      ) : progressList.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-muted-foreground">{t('noProgress')}</p>
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/collection/add`}>{t('startCollecting')}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {progressList.map((progress) => (
            <SeriesProgressCard key={progress.seriesId} progress={progress} />
          ))}
        </div>
      )}
    </div>
  );
}
