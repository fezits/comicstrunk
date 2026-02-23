'use client';

import { useTranslations } from 'next-intl';
import { BookOpen, Eye, Tag, DollarSign } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import type { CollectionStats as CollectionStatsType } from '@/lib/api/collection';

interface CollectionStatsProps {
  stats: CollectionStatsType | null;
  loading?: boolean;
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <div className="h-6 w-12 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-xl font-bold">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CollectionStats({ stats, loading }: CollectionStatsProps) {
  const t = useTranslations('collection.stats');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={BookOpen}
        label={t('total')}
        value={stats?.totalItems ?? 0}
        loading={loading}
      />
      <StatCard
        icon={Eye}
        label={t('read')}
        value={stats?.totalRead ?? 0}
        loading={loading}
      />
      <StatCard
        icon={Tag}
        label={t('forSale')}
        value={stats?.totalForSale ?? 0}
        loading={loading}
      />
      <StatCard
        icon={DollarSign}
        label={t('totalValue')}
        value={formatCurrency(stats?.totalValuePaid ?? 0)}
        loading={loading}
      />
    </div>
  );
}
