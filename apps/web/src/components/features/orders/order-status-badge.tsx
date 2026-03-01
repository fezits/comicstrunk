'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import type { OrderStatus, OrderItemStatus } from '@/lib/api/orders';

type StatusType = OrderStatus | OrderItemStatus;

const statusConfig: Record<
  string,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  PENDING: { variant: 'outline' },
  PAID: { variant: 'secondary' },
  PROCESSING: { variant: 'default' },
  SHIPPED: {
    variant: 'default',
    className: 'bg-blue-600 hover:bg-blue-700 text-white border-transparent',
  },
  DELIVERED: {
    variant: 'default',
    className: 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent',
  },
  COMPLETED: {
    variant: 'default',
    className: 'bg-green-600 hover:bg-green-700 text-white border-transparent',
  },
  CANCELLED: { variant: 'destructive' },
  DISPUTED: {
    variant: 'destructive',
    className: 'bg-orange-600 hover:bg-orange-700 text-white border-transparent',
  },
  REFUNDED: { variant: 'outline' },
};

interface OrderStatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const t = useTranslations('orders.statusLabels');

  const config = statusConfig[status] ?? { variant: 'outline' as const };

  const label = t(status);

  return (
    <Badge
      variant={config.variant}
      className={`${config.className ?? ''} ${className ?? ''}`}
    >
      {label}
    </Badge>
  );
}
