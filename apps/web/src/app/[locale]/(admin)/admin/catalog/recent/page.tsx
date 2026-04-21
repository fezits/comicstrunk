'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PaginationMeta } from '@/lib/api/catalog';
import { getRecentCatalogEntries, type RecentCatalogEntry } from '@/lib/api/admin-catalog';

type SourceFilter = 'all' | 'sync_panini' | 'sync_rika' | 'manual' | 'import';
type DaysFilter = '7' | '30' | '90' | 'all';

const SOURCE_BADGE_STYLES: Record<string, string> = {
  sync_panini: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25',
  sync_rika: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/25',
  manual: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/25',
  import: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/25',
};

function SourceBadge({ source, label }: { source: string; label: string }) {
  const style = SOURCE_BADGE_STYLES[source] ?? '';
  return (
    <Badge variant="outline" className={style}>
      {label}
    </Badge>
  );
}

function sourceLabel(
  source: string,
  t: ReturnType<typeof useTranslations<'admin.catalog.recent'>>,
): string {
  switch (source) {
    case 'sync_panini':
      return t('syncPanini');
    case 'sync_rika':
      return t('syncRika');
    case 'manual':
      return t('manual');
    case 'import':
      return t('import');
    default:
      return source;
  }
}

export default function AdminRecentCatalogPage() {
  const t = useTranslations('admin.catalog.recent');
  const tCatalog = useTranslations('admin.catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [entries, setEntries] = useState<RecentCatalogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [daysFilter, setDaysFilter] = useState<DaysFilter>('7');
  const [page, setPage] = useState(1);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRecentCatalogEntries({
        page,
        limit: 20,
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        days: daysFilter === 'all' ? undefined : Number(daysFilter),
      });
      setEntries(res.data);
      setPagination(res.pagination);
    } catch {
      toast.error(tCommon('error'));
    } finally {
      setLoading(false);
    }
  }, [page, sourceFilter, daysFilter, tCommon]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSourceChange = (value: string) => {
    setSourceFilter(value as SourceFilter);
    setPage(1);
  };

  const handleDaysChange = (value: string) => {
    setDaysFilter(value as DaysFilter);
    setPage(1);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === 'pt-BR' ? 'pt-BR' : locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Source tabs */}
        <Tabs value={sourceFilter} onValueChange={handleSourceChange}>
          <TabsList>
            <TabsTrigger value="all">{t('allSources')}</TabsTrigger>
            <TabsTrigger value="sync_panini">{t('syncPanini')}</TabsTrigger>
            <TabsTrigger value="sync_rika">{t('syncRika')}</TabsTrigger>
            <TabsTrigger value="manual">{t('manual')}</TabsTrigger>
            <TabsTrigger value="import">{t('import')}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Date range selector */}
        <Select value={daysFilter} onValueChange={handleDaysChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">{t('last7days')}</SelectItem>
            <SelectItem value="30">{t('last30days')}</SelectItem>
            <SelectItem value="90">{t('last90days')}</SelectItem>
            <SelectItem value="all">{t('allTime')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">{t('noEntries')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16"></TableHead>
              <TableHead>{tCatalog('form.title')}</TableHead>
              <TableHead>{tCatalog('form.publisher')}</TableHead>
              <TableHead>{t('source')}</TableHead>
              <TableHead>{t('addedBy')}</TableHead>
              <TableHead className="text-right">{tCatalog('form.create')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <div className="w-10 h-14 bg-muted rounded overflow-hidden">
                    {entry.coverImageUrl && (
                      <img
                        src={entry.coverImageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-medium max-w-[200px] truncate">
                  <Link
                    href={`/${locale}/admin/catalog/${entry.id}/edit`}
                    className="hover:underline"
                  >
                    {entry.title}
                  </Link>
                </TableCell>
                <TableCell>{entry.publisher ?? '—'}</TableCell>
                <TableCell>
                  <SourceBadge
                    source={entry.source}
                    label={sourceLabel(entry.source, t)}
                  />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {entry.createdByName ?? '—'}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatDate(entry.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {tCatalog('previousPage')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage(page + 1)}
          >
            {tCatalog('nextPage')}
          </Button>
        </div>
      )}
    </div>
  );
}
