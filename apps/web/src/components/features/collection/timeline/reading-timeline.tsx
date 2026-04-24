'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { ChevronLeft, BookOpen, CalendarDays, Filter, X } from 'lucide-react';

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

function formatReadDate(dateStr: string): string {
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

  const handleZoomIn = (key: string) => {
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

  const handleZoomOut = () => {
    if (zoomLevel === 'day') {
      setSelectedMonth(null);
      setZoomLevel('month');
    } else if (zoomLevel === 'month') {
      setSelectedYear(null);
      setZoomLevel('year');
    }
  };

  // Breadcrumb label
  const breadcrumb = (() => {
    const parts: { label: string; onClick?: () => void }[] = [];
    parts.push({ label: 'Todos os anos', onClick: zoomLevel !== 'year' ? () => { setSelectedYear(null); setSelectedMonth(null); setZoomLevel('year'); } : undefined });
    if (selectedYear) {
      parts.push({ label: String(selectedYear), onClick: zoomLevel === 'day' ? () => { setSelectedMonth(null); setZoomLevel('month'); } : undefined });
    }
    if (selectedMonth) {
      parts.push({ label: MONTH_NAMES[selectedMonth - 1] });
    }
    return parts;
  })();

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
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          Linha do Tempo
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data.totalRead} gibi{data.totalRead !== 1 ? 's' : ''} lido{data.totalRead !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Zoom breadcrumb */}
      <div className="flex items-center gap-1 text-sm">
        {breadcrumb.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground mx-1">›</span>}
            {part.onClick ? (
              <button onClick={part.onClick} className="text-primary hover:underline">{part.label}</button>
            ) : (
              <span className="font-medium">{part.label}</span>
            )}
          </span>
        ))}
        {zoomLevel !== 'year' && (
          <Button variant="ghost" size="sm" className="h-6 ml-2 text-xs" onClick={handleZoomOut}>
            <ChevronLeft className="h-3 w-3 mr-1" />
            Voltar
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterPublisher || 'all'} onValueChange={(v) => setFilterPublisher(v === 'all' ? '' : v)}>
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

        <Select value={filterSeries || 'all'} onValueChange={(v) => setFilterSeries(v === 'all' ? '' : v)}>
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
          <Button variant="ghost" size="sm" className="text-xs h-8 gap-1" onClick={() => { setFilterPublisher(''); setFilterSeries(''); }}>
            <X className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      {/* Timeline */}
      <div className="relative bg-card border border-border rounded-xl p-6 overflow-hidden">
        <div ref={scrollRef} className="overflow-x-auto pb-4 scrollbar-thin">
          {/* Covers area */}
          <div className="flex items-end gap-0 min-w-max" style={{ minHeight: '280px', paddingBottom: '40px' }}>
            {data.groups.map((group) => (
              <TimelineColumn
                key={group.key}
                group={group}
                zoomLevel={zoomLevel}
                locale={locale}
                onZoomIn={() => handleZoomIn(group.key)}
              />
            ))}
            {data.groups.length === 0 && (
              <div className="w-full text-center text-muted-foreground py-20">
                Nenhum gibi lido neste periodo
              </div>
            )}
          </div>

          {/* Axis line */}
          <div className="relative mx-2">
            <div className="h-[3px] bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20 rounded-full" />

            {/* Tick marks with dates */}
            <div className="flex gap-0 min-w-max">
              {data.groups.map((group) => {
                const width = Math.max(group.items.length * 56, zoomLevel === 'day' ? 70 : 90);
                return (
                  <div key={group.key} className="flex-shrink-0 text-center" style={{ width: `${width}px` }}>
                    {/* Tick */}
                    <div className="w-[3px] h-3 bg-primary/50 mx-auto -mt-[2px] rounded-b" />
                    {/* Label */}
                    <button
                      onClick={() => zoomLevel !== 'day' && handleZoomIn(group.key)}
                      className={`mt-1 ${zoomLevel !== 'day' ? 'cursor-pointer hover:text-primary' : ''} transition-colors`}
                    >
                      <p className="text-xs font-semibold">
                        {zoomLevel === 'year' ? group.label
                          : zoomLevel === 'month' ? MONTH_SHORT[parseInt(group.key) - 1] || group.label
                          : `Dia ${group.label}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {group.count} gibi{group.count !== 1 ? 's' : ''}
                      </p>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Timeline Column (group of covers above a time point) ===

function TimelineColumn({
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
  const maxVisible = 15;
  const visibleItems = group.items.slice(0, maxVisible);
  const overflow = group.count - maxVisible;
  const width = Math.max(group.items.length * 56, zoomLevel === 'day' ? 70 : 90);

  return (
    <div className="flex-shrink-0 flex flex-col items-center justify-end" style={{ width: `${width}px` }}>
      {/* Covers — Mac dock style */}
      <DockRow items={visibleItems} locale={locale} overflow={overflow} onOverflowClick={onZoomIn} />

      {/* Zoom hint */}
      {zoomLevel !== 'day' && group.count > 0 && (
        <button
          onClick={onZoomIn}
          className="text-[9px] text-muted-foreground/50 hover:text-primary transition-colors mb-1 mt-1"
          title="Clique para ampliar"
        >
          ▼
        </button>
      )}
    </div>
  );
}

// === Mac Dock Row ===

function DockRow({
  items,
  locale,
  overflow,
  onOverflowClick,
}: {
  items: TimelineItem[];
  locale: string;
  overflow: number;
  onOverflowClick: () => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="flex items-end justify-center gap-[2px] mb-2" onMouseLeave={() => setHoveredIdx(null)}>
      {items.map((item, i) => {
        // Mac dock effect: hovered = biggest, neighbors scale down
        let scale = 1;
        if (hoveredIdx !== null) {
          const dist = Math.abs(i - hoveredIdx);
          if (dist === 0) scale = 1.8;
          else if (dist === 1) scale = 1.4;
          else if (dist === 2) scale = 1.15;
          else scale = 1;
        }

        return (
          <DockCover
            key={item.id}
            item={item}
            locale={locale}
            scale={scale}
            onMouseEnter={() => setHoveredIdx(i)}
          />
        );
      })}
      {overflow > 0 && (
        <button
          onClick={onOverflowClick}
          className="w-10 h-14 rounded bg-muted/50 border border-border/50 flex items-center justify-center text-xs font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all flex-shrink-0"
        >
          +{overflow}
        </button>
      )}
    </div>
  );
}

// === Single Cover with Dock Effect ===

function DockCover({
  item,
  locale,
  scale,
  onMouseEnter,
}: {
  item: TimelineItem;
  locale: string;
  scale: number;
  onMouseEnter: () => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const baseW = 40;
  const baseH = 56;

  return (
    <div
      className="relative flex-shrink-0 origin-bottom"
      style={{
        width: `${baseW}px`,
        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: `scale(${scale})`,
        zIndex: scale > 1.1 ? 20 : 1,
      }}
      onMouseEnter={() => { onMouseEnter(); setShowTooltip(true); }}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Link
        href={`/${locale}/catalog/${item.slug || item.id}`}
        className="block rounded overflow-hidden border border-border/50 hover:border-primary/50 shadow-sm hover:shadow-lg transition-shadow"
        style={{ width: `${baseW}px`, height: `${baseH}px` }}
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
      {showTooltip && scale > 1.5 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-popover border border-border rounded-lg shadow-xl px-3 py-2 text-xs whitespace-nowrap max-w-[250px]">
            <p className="font-semibold truncate">{item.title}</p>
            {item.publisher && <p className="text-muted-foreground">{item.publisher}</p>}
            {item.seriesName && <p className="text-muted-foreground">{item.seriesName}</p>}
            <p className="text-primary mt-1 font-medium">Lido em {formatReadDate(item.readAt)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
