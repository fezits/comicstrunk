'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Shield,
  CheckCircle,
  Clock,
  DollarSign,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getDisputeStats } from '@/lib/api/disputes';

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatResolutionTime(hours: number | null): string {
  if (hours === null) return '-';
  if (hours < 1) return '< 1h';
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

interface DisputeStatsData {
  byStatus: Record<string, number>;
  totalDisputes: number;
  avgResolutionHours: number | null;
  totalRefundedAmount: number;
}

export function AdminDisputeStats() {
  const [stats, setStats] = useState<DisputeStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDisputeStats();
      setStats(data);
    } catch {
      toast.error('Erro ao carregar estatisticas de disputas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!stats) return null;

  const openCount = stats.byStatus['OPEN'] ?? 0;
  const inMediationCount = stats.byStatus['IN_MEDIATION'] ?? 0;
  const resolvedThisMonth =
    (stats.byStatus['RESOLVED_REFUND'] ?? 0) +
    (stats.byStatus['RESOLVED_PARTIAL_REFUND'] ?? 0) +
    (stats.byStatus['RESOLVED_NO_REFUND'] ?? 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Abertas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abertas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {openCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Aguardando resposta
            </p>
          </CardContent>
        </Card>

        {/* Em mediacao */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em mediacao</CardTitle>
            <Shield className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {inMediationCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Aguardando resolucao
            </p>
          </CardContent>
        </Card>

        {/* Resolvidas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolvidas</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {resolvedThisMonth}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total resolvidas
            </p>
          </CardContent>
        </Card>

        {/* Tempo medio de resolucao */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tempo medio resolucao
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatResolutionTime(stats.avgResolutionHours)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Media de duracao
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Total reembolsado */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Total reembolsado</p>
              <p className="text-xs text-muted-foreground">
                Soma de todos os reembolsos processados
              </p>
            </div>
          </div>
          <p className="text-xl font-bold text-primary">
            {formatBRL(stats.totalRefundedAmount)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
