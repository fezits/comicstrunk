'use client';

import { Badge } from '@/components/ui/badge';
import type { DisputeStatus } from '@/lib/api/disputes';

const statusConfig: Record<
  DisputeStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  OPEN: {
    label: 'Aberta',
    variant: 'outline',
    className: 'border-yellow-500 text-yellow-600 dark:text-yellow-400',
  },
  IN_MEDIATION: {
    label: 'Em mediacao',
    variant: 'default',
    className: 'bg-blue-600 hover:bg-blue-700 text-white border-transparent',
  },
  RESOLVED_REFUND: {
    label: 'Reembolso total',
    variant: 'default',
    className: 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent',
  },
  RESOLVED_PARTIAL_REFUND: {
    label: 'Reembolso parcial',
    variant: 'default',
    className: 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent',
  },
  RESOLVED_NO_REFUND: {
    label: 'Sem reembolso',
    variant: 'destructive',
  },
  CANCELLED: {
    label: 'Cancelada',
    variant: 'secondary',
  },
};

interface DisputeStatusBadgeProps {
  status: DisputeStatus;
  className?: string;
}

export function DisputeStatusBadge({ status, className }: DisputeStatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, variant: 'outline' as const };

  return (
    <Badge
      variant={config.variant}
      className={`${config.className ?? ''} ${className ?? ''}`}
    >
      {config.label}
    </Badge>
  );
}
