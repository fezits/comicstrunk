'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { ChevronLeft, BookOpen, CalendarDays, ZoomIn, ZoomOut, X } from 'lucide-react';

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

// === Types ===

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

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

// === Main Component ===

export function ReadingTimeline() {
  const locale = useLocale();
  const [data, setData] = useState<TimelineData | null>(null);
  const [filters, setFilters] = useState<TimelineFilters | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('year');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
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

  const zoomIn = (key: string) => {
    if (zoomLevel === 'year') {
      setSelectedYear(parseInt(key));
      setSelectedMonth(null);
      setZoomLevel('month');
    } else if (zoomLevel === 'month') {
      setSelectedMonth(parseInt(key));
      setZoomLevel('day');
    }
    scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  };

  const zoomOut = () => {
    if (zoomLevel === 'day') { setSelectedMonth(null); setZoomLevel('month'); }
    else if (zoomLevel === 'month') { setSelectedYear(null); setZoomLevel('year'); }
  };

  const getTimeLabel = (group: TimelineGroup): string => {
    if (zoomLevel === 'year') return group.label;
    if (zoomLevel === 'month') return MONTH_SHORT[parseInt(group.key) - 1] || group.label;
    return `${group.label}/${selectedMonth}`;
  };

  // Available years for filter
  const availableYears = data?.groups.map(g => g.key) ?? [];

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[500px] w-full rounded-xl" />
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Linha do Tempo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.totalRead} gibi{data.totalRead !== 1 ? 's' : ''} lido{data.totalRead !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Zoom buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={zoomLevel === 'year'}
            onClick={zoomOut}
            className="gap-1"
          >
            <ZoomOut className="h-4 w-4" />
            Menos detalhe
          </Button>
          <div className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
            {zoomLevel === 'year' ? 'Anos' : zoomLevel === 'month' ? 'Meses' : 'Dias'}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={zoomLevel === 'day'}
            onClick={() => {
              if (data.groups.length > 0) zoomIn(data.groups[0].key);
            }}
            className="gap-1"
          >
            <ZoomIn className="h-4 w-4" />
            Mais detalhe
          </Button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap bg-muted/30 rounded-lg p-3">
        {/* Year picker */}
        <Select
          value={selectedYear ? String(selectedYear) : 'all'}
          onValueChange={(v) => {
            if (v === 'all') { setSelectedYear(null); setSelectedMonth(null); setZoomLevel('year'); }
            else { setSelectedYear(parseInt(v)); setSelectedMonth(null); setZoomLevel('month'); }
          }}
        >
          <SelectTrigger className="w-[120px] h-9 rounded-full text-sm">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos anos</SelectItem>
            {(zoomLevel === 'year' ? availableYears : [String(selectedYear)]).map(y => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Month picker */}
        <Select
          value={selectedMonth ? String(selectedMonth) : 'all'}
          disabled={!selectedYear}
          onValueChange={(v) => {
            if (v === 'all') { setSelectedMonth(null); setZoomLevel('month'); }
            else { setSelectedMonth(parseInt(v)); setZoomLevel('day'); }
          }}
        >
          <SelectTrigger className="w-[140px] h-9 rounded-full text-sm">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos meses</SelectItem>
            {MONTH_NAMES.map((m, i) => (
              <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Publisher */}
        <Select value={filterPublisher || 'all'} onValueChange={(v) => setFilterPublisher(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px] h-9 rounded-full text-sm">
            <SelectValue placeholder="Editora" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas editoras</SelectItem>
            {filters?.publishers.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Series */}
        <Select value={filterSeries || 'all'} onValueChange={(v) => setFilterSeries(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px] h-9 rounded-full text-sm">
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
          <Button variant="ghost" size="sm" className="h-9 rounded-full text-xs gap-1" onClick={() => { setFilterPublisher(''); setFilterSeries(''); }}>
            <X className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      {/* Breadcrumb */}
      {zoomLevel !== 'year' && (
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => { setSelectedYear(null); setSelectedMonth(null); setZoomLevel('year'); }} className="text-primary hover:underline">
            Todos os anos
          </button>
          {selectedYear && (
            <>
              <span className="text-muted-foreground mx-1">›</span>
              {zoomLevel === 'day' ? (
                <button onClick={() => { setSelectedMonth(null); setZoomLevel('month'); }} className="text-primary hover:underline">
                  {selectedYear}
                </button>
              ) : (
                <span className="font-medium">{selectedYear}</span>
              )}
            </>
          )}
          {selectedMonth && (
            <>
              <span className="text-muted-foreground mx-1">›</span>
              <span className="font-medium">{MONTH_NAMES[selectedMonth - 1]}</span>
            </>
          )}
        </div>
      )}

      {/* Timeline — alternating above/below like the reference */}
      <div className="bg-card border border-border rounded-xl p-6 overflow-hidden">
        <div ref={scrollRef} className="overflow-x-auto">
          <div className="min-w-max px-8">
            {/* Top row (even items — above the line) */}
            <div className="flex items-end min-h-[160px]">
              {data.groups.map((group, i) => (
                <TimelineNode
                  key={group.key}
                  group={group}
                  position={i % 2 === 0 ? 'above' : 'hidden'}
                  label={getTimeLabel(group)}
                  locale={locale}
                  zoomLevel={zoomLevel}
                  onZoomIn={() => zoomIn(group.key)}
                />
              ))}
            </div>

            {/* The line with dots */}
            <div className="relative h-[3px] bg-gradient-to-r from-primary/30 via-primary to-primary/30 rounded-full my-0">
              <div className="absolute inset-0 flex items-center">
                {data.groups.map((group, i) => {
                  const totalWidth = data.groups.length;
                  const left = totalWidth <= 1 ? 50 : (i / (totalWidth - 1)) * 100;
                  return (
                    <div
                      key={group.key}
                      className="absolute w-4 h-4 bg-primary rounded-full border-[3px] border-background shadow-md cursor-pointer hover:scale-125 transition-transform"
                      style={{ left: `${left}%`, transform: 'translate(-50%, 0)' }}
                      onClick={() => zoomLevel !== 'day' && zoomIn(group.key)}
                      title={`${getTimeLabel(group)} — ${group.count} gibi${group.count !== 1 ? 's' : ''}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Bottom row (odd items — below the line) */}
            <div className="flex items-start min-h-[160px]">
              {data.groups.map((group, i) => (
                <TimelineNode
                  key={group.key}
                  group={group}
                  position={i % 2 === 1 ? 'below' : 'hidden'}
                  label={getTimeLabel(group)}
                  locale={locale}
                  zoomLevel={zoomLevel}
                  onZoomIn={() => zoomIn(group.key)}
                />
              ))}
            </div>
          </div>
        </div>

        {data.groups.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            Nenhum gibi lido neste periodo
          </div>
        )}
      </div>
    </div>
  );
}

// === Timeline Node (card above or below the line) ===

function TimelineNode({
  group,
  position,
  label,
  locale,
  zoomLevel,
  onZoomIn,
}: {
  group: TimelineGroup;
  position: 'above' | 'below' | 'hidden';
  label: string;
  locale: string;
  zoomLevel: ZoomLevel;
  onZoomIn: () => void;
}) {
  const nodeWidth = Math.max(140, Math.min(group.items.length * 50, 300));

  if (position === 'hidden') {
    return <div className="flex-shrink-0" style={{ width: `${nodeWidth}px` }} />;
  }

  const isAbove = position === 'above';

  return (
    <div className="flex-shrink-0 flex flex-col items-center" style={{ width: `${nodeWidth}px` }}>
      {/* Connector line */}
      {isAbove && <div className="w-px h-6 bg-primary/30" />}

      {/* Card */}
      <div
        className={`bg-primary/5 border border-primary/20 rounded-xl p-3 w-full cursor-pointer hover:border-primary/50 hover:bg-primary/10 transition-all ${
          zoomLevel !== 'day' ? 'hover:scale-[1.02]' : ''
        }`}
        onClick={() => zoomLevel !== 'day' ? onZoomIn() : undefined}
      >
        {/* Date badge */}
        <div className="text-center mb-2">
          <span className="inline-block bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
            {label}
          </span>
        </div>

        {/* Covers row */}
        <div className="flex flex-wrap justify-center gap-1">
          {group.items.slice(0, 6).map((item) => (
            <CoverThumb key={item.id} item={item} locale={locale} />
          ))}
          {group.count > 6 && (
            <div className="w-9 h-12 rounded bg-muted/50 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
              +{group.count - 6}
            </div>
          )}
        </div>

        {/* Count */}
        <p className="text-center text-[10px] text-muted-foreground mt-2">
          {group.count} gibi{group.count !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Connector line */}
      {!isAbove && <div className="w-px h-6 bg-primary/30" />}
    </div>
  );
}

// === Cover Thumbnail ===

function CoverThumb({ item, locale }: { item: TimelineItem; locale: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={`/${locale}/catalog/${item.slug || item.id}`}
        className="block w-9 h-12 rounded overflow-hidden border border-border/30 hover:border-primary transition-all hover:shadow-md"
        style={{
          transform: hovered ? 'scale(1.4) translateY(-4px)' : 'scale(1)',
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          zIndex: hovered ? 30 : 1,
          position: 'relative',
        }}
      >
        {item.coverImageUrl ? (
          <img src={item.coverImageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full bg-muted flex items-center justify-center">
            <BookOpen className="h-2 w-2 text-muted-foreground/40" />
          </div>
        )}
      </Link>

      {/* Compact tooltip */}
      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 pointer-events-none">
          <div className="bg-popover border border-border rounded px-2 py-1 shadow-lg text-[10px] whitespace-nowrap max-w-[180px]">
            <p className="font-semibold truncate">{item.title}</p>
            <p className="text-primary">{formatDate(item.readAt)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
