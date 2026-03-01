'use client';

import { Badge } from '@/components/ui/badge';

type DealType = 'COUPON' | 'PROMOTION';

const typeConfig: Record<
  DealType,
  { label: string; className: string }
> = {
  COUPON: {
    label: 'Cupom',
    className: 'bg-orange-500/90 hover:bg-orange-500 text-white border-transparent',
  },
  PROMOTION: {
    label: 'Promocao',
    className: 'bg-blue-500/90 hover:bg-blue-500 text-white border-transparent',
  },
};

interface DealTypeBadgeProps {
  type: DealType;
  className?: string;
}

export function DealTypeBadge({ type, className }: DealTypeBadgeProps) {
  const config = typeConfig[type] ?? { label: type, className: '' };

  return (
    <Badge
      variant="default"
      className={`${config.className} ${className ?? ''}`}
    >
      {config.label}
    </Badge>
  );
}
