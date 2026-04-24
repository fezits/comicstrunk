'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { ZoomIn, ZoomOut, ChevronLeft, BookOpen, CalendarDays, Filter } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api/client';

interface TimelineItem {
  id: string;
  title: string;
  slug: string | null;
  coverImageUrl: string | null;
  publisher: string | null;
  seriesName: string | null;
  readAt: string;
}

interface TimelineGroup {
  key: string;
  label: string;
  count: number;
  items: TimelineItem[];
}

interface TimelineData {
  totalRead: number;
  periodStart: string | null;
  periodEnd: string | null;
  groups: TimelineGroup[];
}

interface TimelineFilters {
  publishers: string[];
  series: { id: string; title: string }[];
}

type ZoomLevel = 'year' | 'month' | 'day';

export function ReadingTimeline() {
  const locale = useLocale();
  const [data, setData] = useState<TimelineData | null>(null);
  const [filters, setFilters] = useState<TimelineFilters | null>(null);
  const [loading, setLoading] = useState(true);

  // Zoom state
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('year');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Filter state
  const [filterPublisher, setFilterPublisher] = useState<string>('');
  const [filterSeries, setFilterSeries] = useState<string>('');

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedYear) params.year = String(selectedYear);
      if (selectedMonth) params.month = String(selectedMonth);
      if (filterPublisher) params.publisher = filterPublisher;
      if (filterSeries) params.seriesId = filterSeries;

      const res = await apiClient.get('/collection/timeline', { params });
      setData(res.data.data);
    } catch {
      toast.error('Erro ao carregar timeline');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, filterPublisher, filterSeries]);

  const fetchFilters = useCallback(async () => {
    try {
      const res = await apiClient.get('/collection/timeline/filters');
      setFilters(res.data.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);
  useEffect(() => { fetchFilters(); }, [fetchFilters]);

  const handleZoomIn = (key: string) => {
    if (zoomLevel === 'year') {
      setSelectedYear(parseInt(key));
      setSelectedMonth(null);
      setZoomLevel('month');
    } else if (zoomLevel === 'month') {
      setSelectedMonth(parseInt(key));
      setZoomLevel('day');
    }
  };

  const handleZoomOut = () => {
    if (zoomLevel === 'day') {
      setSelectedMonth(null);
      setZoomLevel('month');
    } else if (zoomLevel === 'month') {
      setSelectedYear(null);
      setZoomLevel('year');
    }
  };

  const zoomLabel = zoomLevel === 'year' ? 'Anos'
    : zoomLevel === 'month' ? `${selectedYear}`
    : `${selectedMonth}/${selectedYear}`;

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  if (!data || data.totalRead === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <CalendarDays className="h-16 w-16 text-muted-foreground/30 mx-auto" />
        <h2 className="text-xl font-semibold">Nenhum gibi lido ainda</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Marque gibis como lidos na sua colecao para ver sua linha do tempo de leitura.
        </p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/collection`}>Ir para Minha Colecao</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Linha do Tempo
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.totalRead} gibis lidos
            {data.periodStart && data.periodEnd && ` · ${data.periodStart} a ${data.periodEnd}`}
          </p>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          {zoomLevel !== 'year' && (
            <Button variant="outline" size="sm" onClick={handleZoomOut} className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          <span className="text-sm font-medium bg-muted px-3 py-1 rounded">{zoomLabel}</span>
          {zoomLevel !== 'year' && (
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterPublisher} onValueChange={(v) => setFilterPublisher(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="Editora" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas editoras</SelectItem>
            {filters?.publishers.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSeries} onValueChange={(v) => setFilterSeries(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue placeholder="Serie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas series</SelectItem>
            {filters?.series.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(filterPublisher || filterSeries) && (
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => { setFilterPublisher(''); setFilterSeries(''); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Scrollable container */}
        <div className="overflow-x-auto pb-4">
          <div className="flex items-end gap-0 min-w-max px-4" style={{ minHeight: '350px' }}>
            {data.groups.map((group) => (
              <TimelinePoint
                key={group.key}
                group={group}
                zoomLevel={zoomLevel}
                locale={locale}
                onZoomIn={() => handleZoomIn(group.key)}
              />
            ))}
          </div>

          {/* Axis line */}
          <div className="h-[2px] bg-primary/30 mx-4 -mt-[1px]" />

          {/* Axis labels */}
          <div className="flex gap-0 min-w-max px-4 mt-2">
            {data.groups.map((group) => (
              <div
                key={group.key}
                className="flex-shrink-0 text-center cursor-pointer hover:text-primary transition-colors"
                style={{ width: `${Math.max(group.items.length * 52, 80)}px` }}
                onClick={() => zoomLevel !== 'day' && handleZoomIn(group.key)}
              >
                <div className="w-2 h-2 bg-primary/50 rounded-full mx-auto -mt-[5px] mb-1" />
                <span className="text-xs font-medium">{group.label}</span>
                <br />
                <span className="text-[10px] text-muted-foreground">{group.count} gibi{group.count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// === Timeline Point Component ===

function TimelinePoint({
  group,
  zoomLevel,
  locale,
  onZoomIn,
}: {
  group: TimelineGroup;
  zoomLevel: ZoomLevel;
  locale: string;
  onZoomIn: () => void;
}) {
  const width = Math.max(group.items.length * 52, 80);
  const maxVisible = 20;
  const visibleItems = group.items.slice(0, maxVisible);
  const overflow = group.count - maxVisible;

  return (
    <div
      className="flex-shrink-0 flex flex-col items-center justify-end"
      style={{ width: `${width}px`, minHeight: '300px' }}
    >
      {/* Covers stacked above the axis */}
      <div className="flex flex-wrap justify-center gap-1 mb-2">
        {visibleItems.map((item) => (
          <TimelineCover key={item.id} item={item} locale={locale} />
        ))}
        {overflow > 0 && (
          <button
            onClick={onZoomIn}
            className="w-10 h-14 rounded bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          >
            +{overflow}
          </button>
        )}
      </div>

      {/* Click to zoom indicator */}
      {zoomLevel !== 'day' && group.count > 0 && (
        <button
          onClick={onZoomIn}
          className="text-[9px] text-muted-foreground hover:text-primary mb-1 flex items-center gap-0.5"
        >
          <ZoomIn className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// === Timeline Cover Component ===

function TimelineCover({ item, locale }: { item: TimelineItem; locale: string }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <Link
        href={`/${locale}/catalog/${item.slug || item.id}`}
        className="block w-10 h-14 rounded overflow-hidden border border-border/50 hover:border-primary/50 hover:scale-110 transition-all shadow-sm"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {item.coverImageUrl ? (
          <img
            src={item.coverImageUrl}
            alt={item.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-muted flex items-center justify-center">
            <BookOpen className="h-3 w-3 text-muted-foreground/40" />
          </div>
        )}
      </Link>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-popover border border-border rounded-md shadow-lg px-2 py-1 text-xs whitespace-nowrap max-w-[200px]">
            <p className="font-medium truncate">{item.title}</p>
            {item.publisher && <p className="text-muted-foreground truncate">{item.publisher}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
