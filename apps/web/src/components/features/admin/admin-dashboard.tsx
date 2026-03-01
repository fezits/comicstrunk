'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  ShoppingCart,
  DollarSign,
  Library,
  Clock,
  Scale,
  Mail,
  ArrowRight,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getDashboardMetrics, type DashboardMetrics } from '@/lib/api/admin';

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100);
}

export function AdminDashboard() {
  const locale = useLocale();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDashboardMetrics();
      setMetrics(data);
    } catch {
      toast.error('Erro ao carregar metricas do painel');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const kpis = metrics
    ? [
        {
          label: 'Usuarios totais',
          value: metrics.totalUsers.toLocaleString('pt-BR'),
          icon: Users,
          bgClass: 'bg-blue-500/10 text-blue-500',
        },
        {
          label: 'Novos este mes',
          value: metrics.newUsersThisMonth.toLocaleString('pt-BR'),
          icon: UserPlus,
          bgClass: 'bg-green-500/10 text-green-500',
        },
        {
          label: 'Pedidos hoje',
          value: metrics.ordersToday.toLocaleString('pt-BR'),
          icon: ShoppingCart,
          bgClass: 'bg-purple-500/10 text-purple-500',
        },
        {
          label: 'Receita do mes',
          value: formatBRL(metrics.revenueThisMonth),
          icon: DollarSign,
          bgClass: 'bg-green-500/10 text-green-500',
        },
        {
          label: 'Catalogo aprovado',
          value: metrics.catalogSize.toLocaleString('pt-BR'),
          icon: Library,
          bgClass: 'bg-orange-500/10 text-orange-500',
        },
        {
          label: 'Aprovacoes pendentes',
          value: metrics.pendingApprovals.toLocaleString('pt-BR'),
          icon: Clock,
          bgClass: 'bg-yellow-500/10 text-yellow-500',
        },
        {
          label: 'Disputas ativas',
          value: metrics.activeDisputes.toLocaleString('pt-BR'),
          icon: Scale,
          bgClass: 'bg-red-500/10 text-red-500',
        },
        {
          label: 'Mensagens nao lidas',
          value: metrics.unreadMessages.toLocaleString('pt-BR'),
          icon: Mail,
          bgClass: 'bg-blue-500/10 text-blue-500',
        },
      ]
    : [];

  const quickActions = [
    { label: 'Gerenciar Usuarios', href: `/${locale}/admin/users` },
    { label: 'Catalogo', href: `/${locale}/admin/catalog` },
    { label: 'Disputas', href: `/${locale}/admin/disputes` },
    { label: 'Pagamentos', href: `/${locale}/admin/payments` },
    { label: 'Documentos Legais', href: `/${locale}/admin/legal` },
    { label: 'Solicitacoes LGPD', href: `/${locale}/admin/lgpd` },
    { label: 'Mensagens de Contato', href: `/${locale}/admin/contact` },
    { label: 'Assinaturas', href: `/${locale}/admin/subscriptions` },
  ];

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {kpi.label}
                  </CardTitle>
                  <div className={`rounded-md p-2 ${kpi.bgClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Acoes rapidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.href}
              variant="outline"
              className="justify-between h-auto py-3"
              asChild
            >
              <Link href={action.href}>
                <span className="text-sm">{action.label}</span>
                <ArrowRight className="h-4 w-4 ml-2 shrink-0" />
              </Link>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
