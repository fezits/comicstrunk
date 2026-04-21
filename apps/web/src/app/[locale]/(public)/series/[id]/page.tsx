'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, BookOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SeriesEditionsList } from '@/components/features/series/series-editions-list';
import { getSeriesById, type SeriesDetail } from '@/lib/api/series';

function isCuid(str: string): boolean {
  return /^c[a-z0-9]{24}$/.test(str);
}

export default function SeriesDetailPage() {
  const t = useTranslations('series.detail');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const idOrSlug = params.id as string;

  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchSeries() {
      setLoading(true);
      setNotFound(false);
      try {
        const data = await getSeriesById(idOrSlug);
        if (!cancelled) {
          // Redirect CUID URLs to slug URLs
          if (isCuid(idOrSlug) && data.slug) {
            router.replace(`/${locale}/series/${data.slug}`);
            return;
          }
          setSeries(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 404) {
            setNotFound(true);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSeries();
    return () => {
      cancelled = true;
    };
  }, [idOrSlug, locale, router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (notFound || !series) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-2xl font-bold">{t('notFound')}</h2>
        <p className="text-muted-foreground">{t('notFoundDescription')}</p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/series`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToSeries')}
          </Link>
        </Button>
      </div>
    );
  }

  const entryCount = series.catalogEntries.length;
  const progressText =
    series.totalEditions != null
      ? t('catalogProgress', { count: entryCount, total: series.totalEditions })
      : t('catalogProgressUnknown', { count: entryCount });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/${locale}/series`} className="hover:text-foreground transition-colors">
          {tCommon('back')}
        </Link>
        <span>/</span>
        <span className="text-foreground truncate">{series.title}</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{series.title}</h1>
        {series.description && (
          <p className="text-muted-foreground mt-2">{series.description}</p>
        )}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="text-sm">
          <BookOpen className="h-3.5 w-3.5 mr-1.5" />
          {progressText}
        </Badge>
      </div>

      {/* Editions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{t('allEditions')}</h2>
        <SeriesEditionsList editions={series.catalogEntries} />
      </div>
    </div>
  );
}
