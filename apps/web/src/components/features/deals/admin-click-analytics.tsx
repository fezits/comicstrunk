'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, MousePointerClick, Users, Tag } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getClickAnalytics,
  exportClicksCSV,
  listAllDeals,
  type ClickAnalytics,
} from '@/lib/api/deals';

type PeriodPreset = '7d' | '30d' | 'month' | 'custom';

function getDateRange(preset: PeriodPreset): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);

  switch (preset) {
    case '7d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return { startDate: start.toISOString().slice(0, 10), endDate };
    }
    case '30d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { startDate: start.toISOString().slice(0, 10), endDate };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: start.toISOString().slice(0, 10), endDate };
    }
    case 'custom':
      return { startDate: '', endDate: '' };
  }
}

export function AdminClickAnalytics() {
  const [analytics, setAnalytics] = useState<ClickAnalytics | null>(null);
  const [activeDealsCount, setActiveDealsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [period, setPeriod] = useState<PeriodPreset>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const getEffectiveDates = useCallback(() => {
    if (period === 'custom') {
      return { startDate: customStart, endDate: customEnd };
    }
    return getDateRange(period);
  }, [period, customStart, customEnd]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const dates = getEffectiveDates();
      const params: Record<string, string> = {};
      if (dates.startDate) params.startDate = dates.startDate;
      if (dates.endDate) params.endDate = dates.endDate;

      const [data, dealsResult] = await Promise.all([
        getClickAnalytics(params),
        listAllDeals({ page: 1, limit: 1 }),
      ]);

      setAnalytics(data);
      // Count active deals from total (approximation from pagination)
      setActiveDealsCount(dealsResult.pagination.total);
    } catch {
      toast.error('Erro ao carregar analytics');
    } finally {
      setLoading(false);
    }
  }, [getEffectiveDates]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const dates = getEffectiveDates();
      const params: Record<string, string> = {};
      if (dates.startDate) params.startDate = dates.startDate;
      if (dates.endDate) params.endDate = dates.endDate;

      const blob = await exportClicksCSV(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clicks-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Exportacao iniciada');
    } catch {
      toast.error('Erro ao exportar CSV');
    } finally {
      setExporting(false);
    }
  };

  const maxStoreClicks = analytics?.clicksByStore.length
    ? Math.max(...analytics.clicksByStore.map((s) => s.clicks))
    : 0;

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>Periodo</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Ultimos 7 dias</SelectItem>
              <SelectItem value="30d">Ultimos 30 dias</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {period === 'custom' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="analytics-start">De</Label>
              <Input
                id="analytics-start"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="analytics-end">Ate</Label>
              <Input
                id="analytics-end"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-40"
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchAnalytics}>
              Filtrar
            </Button>
          </>
        )}

        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exportando...' : 'Exportar CSV'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : analytics ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Cliques</CardTitle>
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalClicks.toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cliques Unicos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.uniqueUsers.toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ofertas Cadastradas</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeDealsCount}</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Clicks by Deal Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : analytics && analytics.clicksByDeal.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold mb-3">Cliques por Oferta</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Oferta</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.clicksByDeal.map((item) => (
                  <TableRow key={item.dealId}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {item.dealTitle}
                    </TableCell>
                    <TableCell className="text-sm">{item.storeName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.categoryName || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {item.clicks.toLocaleString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : !loading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Nenhum clique registrado no periodo.</p>
        </div>
      ) : null}

      {/* Clicks by Store - Bar Visualization */}
      {analytics && analytics.clicksByStore.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Cliques por Loja</h3>
          <div className="space-y-3">
            {analytics.clicksByStore.map((store) => (
              <div key={store.name} className="flex items-center gap-3">
                <span className="text-sm font-medium w-32 truncate text-right">
                  {store.name}
                </span>
                <div className="flex-1 h-6 rounded-md bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-md transition-all duration-300"
                    style={{
                      width: maxStoreClicks > 0
                        ? `${Math.max((store.clicks / maxStoreClicks) * 100, 2)}%`
                        : '0%',
                    }}
                  />
                </div>
                <span className="text-sm font-mono w-16 text-right">
                  {store.clicks.toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
