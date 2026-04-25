'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, BarChart3, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SeriesProgressCard } from '@/components/features/collection/series-progress-card';
import { getSeriesProgress, type SeriesProgressItem } from '@/lib/api/collection';

type StatusFilter = 'all' | 'complete' | 'incomplete';
type SortOption = 'name' | 'progress' | 'collected';

export default function SeriesProgressPage() {
  const t = useTranslations('collection.seriesProgress');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [progressList, setProgressList] = useState<SeriesProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');

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

  const filtered = useMemo(() => {
    let list = progressList;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.seriesTitle.toLowerCase().includes(q));
    }

    if (statusFilter === 'complete') {
      list = list.filter((p) => p.collected >= p.totalEditions);
    } else if (statusFilter === 'incomplete') {
      list = list.filter((p) => p.collected < p.totalEditions);
    }

    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return a.seriesTitle.localeCompare(b.seriesTitle);
      if (sortBy === 'progress') return b.percentage - a.percentage;
      return b.collected - a.collected;
    });

    return list;
  }, [progressList, searchQuery, statusFilter, sortBy]);

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

      {/* Filters */}
      {!loading && !error && progressList.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-8"
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filterAll')}</SelectItem>
              <SelectItem value="incomplete">{t('filterIncomplete')}</SelectItem>
              <SelectItem value="complete">{t('filterComplete')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">{t('sortName')}</SelectItem>
              <SelectItem value="progress">{t('sortProgress')}</SelectItem>
              <SelectItem value="collected">{t('sortCollected')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

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
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('noResults')}</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t('showing', { count: filtered.length, total: progressList.length })}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((progress) => (
              <SeriesProgressCard key={progress.seriesId} progress={progress} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
