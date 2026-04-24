'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { ChevronLeft, BookOpen, CalendarDays, ZoomIn, ZoomOut, X, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter } from 'lucide-react';

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
type Orientation = 'horizontal' | 'vertical';

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

  const now = new Date();
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('day');
  const [selectedYear, setSelectedYear] = useState<number | null>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(now.getMonth() + 1);
  const [filterPublisher, setFilterPublisher] = useState<string>('');
  const [filterSeries, setFilterSeries] = useState<string>('');
  const [orientation, setOrientation] = useState<Orientation>('vertical');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [zoomedItem, setZoomedItem] = useState<TimelineItem | null>(null);

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
      setExpandedGroup(null);
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
    if (zoomLevel === 'year') { setSelectedYear(parseInt(key)); setSelectedMonth(null); setZoomLevel('month'); }
    else if (zoomLevel === 'month') { setSelectedMonth(parseInt(key)); setZoomLevel('day'); }
    setExpandedGroup(null);
    scrollRef.current?.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  };

  const zoomOut = () => {
    if (zoomLevel === 'day') { setSelectedMonth(null); setZoomLevel('month'); }
    else if (zoomLevel === 'month') { setSelectedYear(null); setZoomLevel('year'); }
    setExpandedGroup(null);
  };

  const getTimeLabel = (group: TimelineGroup): string => {
    if (zoomLevel === 'year') return group.label;
    if (zoomLevel === 'month') return MONTH_SHORT[parseInt(group.key) - 1] || group.label;
    return `Dia ${group.label}`;
  };

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

        <div className="flex items-center gap-2">
          {/* Orientation toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')}
            className="gap-1"
            title={orientation === 'horizontal' ? 'Mudar para vertical' : 'Mudar para horizontal'}
          >
            {orientation === 'horizontal' ? (
              <AlignVerticalDistributeCenter className="h-4 w-4" />
            ) : (
              <AlignHorizontalDistributeCenter className="h-4 w-4" />
            )}
          </Button>

          <div className="h-6 w-px bg-border" />

          {/* Zoom buttons */}
          <Button variant="outline" size="sm" disabled={zoomLevel === 'year'} onClick={zoomOut} className="gap-1">
            <ZoomOut className="h-4 w-4" /> Menos
          </Button>
          <div className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
            {zoomLevel === 'year' ? 'Anos' : zoomLevel === 'month' ? 'Meses' : 'Dias'}
          </div>
          <Button
            variant="outline" size="sm" disabled={zoomLevel === 'day'}
            onClick={() => { if (data.groups.length > 0) zoomIn(data.groups[0].key); }}
            className="gap-1"
          >
            <ZoomIn className="h-4 w-4" /> Mais
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap bg-muted/30 rounded-lg p-3">
        <Select
          value={selectedYear ? String(selectedYear) : 'all'}
          onValueChange={(v) => {
            if (v === 'all') { setSelectedYear(null); setSelectedMonth(null); setZoomLevel('year'); }
            else { setSelectedYear(parseInt(v)); setSelectedMonth(null); setZoomLevel('month'); }
          }}
        >
          <SelectTrigger className="w-[120px] h-9 rounded-full text-sm"><SelectValue placeholder="Ano" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos anos</SelectItem>
            {(zoomLevel === 'year' ? data.groups.map(g => g.key) : [String(selectedYear)]).map(y => (
              <SelectItem key={y} value={y!}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedMonth ? String(selectedMonth) : 'all'}
          disabled={!selectedYear}
          onValueChange={(v) => {
            if (v === 'all') { setSelectedMonth(null); setZoomLevel('month'); }
            else { setSelectedMonth(parseInt(v)); setZoomLevel('day'); }
          }}
        >
          <SelectTrigger className="w-[140px] h-9 rounded-full text-sm"><SelectValue placeholder="Mes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos meses</SelectItem>
            {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="h-6 w-px bg-border mx-1" />

        <Select value={filterPublisher || 'all'} onValueChange={(v) => setFilterPublisher(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px] h-9 rounded-full text-sm"><SelectValue placeholder="Editora" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas editoras</SelectItem>
            {filters?.publishers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterSeries || 'all'} onValueChange={(v) => setFilterSeries(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px] h-9 rounded-full text-sm"><SelectValue placeholder="Serie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas series</SelectItem>
            {filters?.series.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
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
          <button onClick={() => { setSelectedYear(null); setSelectedMonth(null); setZoomLevel('year'); setExpandedGroup(null); }} className="text-primary hover:underline">Todos</button>
          {selectedYear && (
            <>
              <span className="text-muted-foreground mx-1">›</span>
              {zoomLevel === 'day' ? (
                <button onClick={() => { setSelectedMonth(null); setZoomLevel('month'); setExpandedGroup(null); }} className="text-primary hover:underline">{selectedYear}</button>
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

      {/* Timeline */}
      <div className="bg-card border border-border rounded-xl p-6 overflow-hidden">
        {orientation === 'horizontal' ? (
          <HorizontalTimeline
            groups={data.groups}
            zoomLevel={zoomLevel}
            locale={locale}
            scrollRef={scrollRef}
            expandedGroup={expandedGroup}
            setExpandedGroup={setExpandedGroup}
            onZoomIn={zoomIn}
            getLabel={getTimeLabel}
            onCoverClick={setZoomedItem}
          />
        ) : (
          <VerticalTimeline
            groups={data.groups}
            zoomLevel={zoomLevel}
            locale={locale}
            expandedGroup={expandedGroup}
            setExpandedGroup={setExpandedGroup}
            onZoomIn={zoomIn}
            getLabel={getTimeLabel}
            onCoverClick={setZoomedItem}
          />
        )}

        {data.groups.length === 0 && (
          <div className="text-center text-muted-foreground py-12">Nenhum gibi lido neste periodo</div>
        )}
      </div>

      {/* Cover zoom modal */}
      {zoomedItem && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setZoomedItem(null)}>
          <div className="relative max-w-sm" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setZoomedItem(null)} className="absolute -top-3 -right-3 bg-background border border-border rounded-full w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground z-10">
              <X className="h-4 w-4" />
            </button>
            {zoomedItem.coverImageUrl && (
              <img src={zoomedItem.coverImageUrl} alt={zoomedItem.title} className="max-h-[70vh] w-auto rounded-lg shadow-2xl" />
            )}
            <div className="mt-3 text-center">
              <p className="text-white font-semibold">{zoomedItem.title}</p>
              {zoomedItem.publisher && <p className="text-white/60 text-sm">{zoomedItem.publisher}</p>}
              <p className="text-primary text-sm mt-1">Lido em {formatDate(zoomedItem.readAt)}</p>
              <Link
                href={`/${locale}/catalog/${zoomedItem.slug || zoomedItem.id}`}
                className="inline-block mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                onClick={() => setZoomedItem(null)}
              >
                Ver detalhes
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === Horizontal Timeline ===

function HorizontalTimeline({
  groups, zoomLevel, locale, scrollRef, expandedGroup, setExpandedGroup, onZoomIn, getLabel, onCoverClick,
}: {
  groups: TimelineGroup[];
  zoomLevel: ZoomLevel;
  locale: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  expandedGroup: string | null;
  setExpandedGroup: (key: string | null) => void;
  onZoomIn: (key: string) => void;
  getLabel: (g: TimelineGroup) => string;
  onCoverClick?: (item: TimelineItem) => void;
}) {
  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <div className="min-w-max px-4">
        {/* Top row (even) */}
        <div className="flex items-end min-h-[140px]">
          {groups.map((g, i) => (
            <NodeCard key={g.key} group={g} position={i % 2 === 0 ? 'show' : 'spacer'} side="above" label={getLabel(g)} locale={locale}
              zoomLevel={zoomLevel} isExpanded={expandedGroup === g.key}
              onToggleExpand={() => setExpandedGroup(expandedGroup === g.key ? null : g.key)}
              onZoomIn={() => onZoomIn(g.key)} onCoverClick={onCoverClick} />
          ))}
        </div>

        {/* Line with dots */}
        <div className="relative h-[3px] bg-gradient-to-r from-primary/20 via-primary to-primary/20 rounded-full">
          {groups.map((g, i) => {
            const left = groups.length <= 1 ? 50 : (i / (groups.length - 1)) * 100;
            return (
              <div key={g.key} className="absolute w-4 h-4 bg-primary rounded-full border-[3px] border-background shadow cursor-pointer hover:scale-125 transition-transform"
                style={{ left: `${left}%`, top: '-6px', transform: 'translateX(-50%)' }}
                onClick={() => zoomLevel !== 'day' ? onZoomIn(g.key) : setExpandedGroup(expandedGroup === g.key ? null : g.key)} />
            );
          })}
        </div>

        {/* Bottom row (odd) */}
        <div className="flex items-start min-h-[140px]">
          {groups.map((g, i) => (
            <NodeCard key={g.key} group={g} position={i % 2 === 1 ? 'show' : 'spacer'} side="below" label={getLabel(g)} locale={locale}
              zoomLevel={zoomLevel} isExpanded={expandedGroup === g.key}
              onToggleExpand={() => setExpandedGroup(expandedGroup === g.key ? null : g.key)}
              onZoomIn={() => onZoomIn(g.key)} onCoverClick={onCoverClick} />
          ))}
        </div>
      </div>

      {/* Expanded view */}
      {expandedGroup && <ExpandedView group={groups.find(g => g.key === expandedGroup)!} locale={locale} onClose={() => setExpandedGroup(null)} onCoverClick={onCoverClick} />}
    </div>
  );
}

// === Vertical Timeline ===

function VerticalTimeline({
  groups, zoomLevel, locale, expandedGroup, setExpandedGroup, onZoomIn, getLabel, onCoverClick,
}: {
  groups: TimelineGroup[];
  zoomLevel: ZoomLevel;
  locale: string;
  expandedGroup: string | null;
  setExpandedGroup: (key: string | null) => void;
  onZoomIn: (key: string) => void;
  getLabel: (g: TimelineGroup) => string;
  onCoverClick?: (item: TimelineItem) => void;
}) {
  return (
    <div className="relative pl-8">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-0 bottom-0 w-[3px] bg-gradient-to-b from-primary/20 via-primary to-primary/20 rounded-full" />

      {groups.map((g) => (
        <div key={g.key} className="relative mb-8">
          {/* Dot */}
          <div className="absolute left-[-21px] top-3 w-4 h-4 bg-primary rounded-full border-[3px] border-background shadow z-10" />

          {/* Date badge */}
          <div className="mb-2">
            <span className="inline-block bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
              {getLabel(g)}
            </span>
            <span className="text-xs text-muted-foreground ml-2">{g.count} gibi{g.count !== 1 ? 's' : ''}</span>
          </div>

          {/* Covers grid — 10 visible, expand on click */}
          <div className="flex flex-wrap gap-2">
            {(expandedGroup === g.key ? g.items : g.items.slice(0, 10)).map((item) => (
              <CoverCard key={item.id} item={item} locale={locale} onClick={onCoverClick} />
            ))}
            {g.count > 10 && expandedGroup !== g.key && (
              <button
                onClick={() => setExpandedGroup(g.key)}
                className="w-16 h-24 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center text-sm font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
              >
                +{g.count - 10}
              </button>
            )}
            {expandedGroup === g.key && g.count > 10 && (
              <button
                onClick={() => setExpandedGroup(null)}
                className="w-16 h-24 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center text-xs text-muted-foreground hover:text-primary transition-all"
              >
                Menos
              </button>
            )}
          </div>

          {/* Zoom in */}
          {zoomLevel !== 'day' && g.count > 0 && (
            <button onClick={() => onZoomIn(g.key)} className="text-xs text-primary/60 hover:text-primary mt-1 flex items-center gap-1">
              <ZoomIn className="h-3 w-3" /> {zoomLevel === 'year' ? 'Ver meses' : 'Ver dias'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// === Node Card (horizontal mode) ===

function NodeCard({
  group, position, side, label, locale, zoomLevel, isExpanded, onToggleExpand, onZoomIn, onCoverClick,
}: {
  group: TimelineGroup;
  position: 'show' | 'spacer';
  side: 'above' | 'below';
  label: string;
  locale: string;
  zoomLevel: ZoomLevel;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onZoomIn: () => void;
  onCoverClick?: (item: TimelineItem) => void;
}) {
  const width = Math.max(160, Math.min(group.items.length * 54, 320));

  if (position === 'spacer') {
    return <div className="flex-shrink-0" style={{ width: `${width}px` }} />;
  }

  return (
    <div className="flex-shrink-0 flex flex-col items-center px-2" style={{ width: `${width}px` }}>
      {/* Connector: below cards have connector on top, above cards on bottom */}
      {side === 'below' && <div className="w-px h-6 bg-primary/30" />}

      <div
        className="bg-primary/5 border border-primary/20 rounded-xl p-3 w-full hover:border-primary/40 transition-all cursor-pointer"
        onClick={() => zoomLevel !== 'day' ? onZoomIn() : onToggleExpand()}
      >
        <div className="text-center mb-2">
          <span className="inline-block bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
            {label}
          </span>
        </div>

        <div className="flex flex-wrap justify-center gap-1">
          {group.items.slice(0, 5).map((item) => (
            <CoverThumb key={item.id} item={item} locale={locale} onClick={onCoverClick} />
          ))}
          {group.count > 5 && (
            <div className="w-12 h-16 rounded bg-muted/50 flex items-center justify-center text-xs font-bold text-muted-foreground">
              +{group.count - 5}
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-2">
          {group.count} gibi{group.count !== 1 ? 's' : ''}
        </p>
      </div>

      {side === 'above' && <div className="w-px h-6 bg-primary/30" />}
    </div>
  );
}

// === Expanded View (all covers from a group) ===

function ExpandedView({ group, locale, onClose, onCoverClick }: { group: TimelineGroup; locale: string; onClose: () => void; onCoverClick?: (item: TimelineItem) => void }) {
  if (!group) return null;

  return (
    <div className="mt-6 border-t border-border pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{group.count} gibis lidos</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs gap-1">
          <X className="h-3 w-3" /> Fechar
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        {group.items.map((item) => (
          <CoverCard key={item.id} item={item} locale={locale} onClick={onCoverClick} />
        ))}
      </div>
    </div>
  );
}

// === Cover Card (bigger — for vertical & expanded) ===

function CoverCard({ item, onClick }: { item: TimelineItem; locale: string; onClick?: (item: TimelineItem) => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        onClick={() => onClick?.(item)}
        className="block w-16 h-24 rounded-lg overflow-hidden border border-border/50 hover:border-primary shadow-sm hover:shadow-lg transition-all"
        style={{
          transform: hovered ? 'scale(1.15) translateY(-4px)' : 'scale(1)',
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          zIndex: hovered ? 30 : 1,
          position: 'relative',
        }}
      >
        {item.coverImageUrl ? (
          <img src={item.coverImageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full bg-muted flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}
      </button>

      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-popover border border-border rounded-lg px-2 py-1 shadow-lg text-[10px] whitespace-nowrap max-w-[200px]">
            <p className="font-semibold truncate">{item.title}</p>
            <p className="text-primary">{formatDate(item.readAt)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// === Cover Thumb (smaller — for horizontal cards) ===

function CoverThumb({ item, onClick }: { item: TimelineItem; locale: string; onClick?: (item: TimelineItem) => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        onClick={() => onClick?.(item)}
        className="block w-12 h-16 rounded overflow-hidden border border-border/30 hover:border-primary transition-all"
        style={{
          transform: hovered ? 'scale(1.3) translateY(-3px)' : 'scale(1)',
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          zIndex: hovered ? 30 : 1,
          position: 'relative',
        }}
      >
        {item.coverImageUrl ? (
          <img src={item.coverImageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full bg-muted flex items-center justify-center">
            <BookOpen className="h-3 w-3 text-muted-foreground/40" />
          </div>
        )}
      </button>

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
