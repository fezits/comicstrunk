'use client';

import { Badge } from '@/components/ui/badge';
import type { DisputeReason } from '@/lib/api/disputes';

const reasonLabels: Record<DisputeReason, string> = {
  NOT_RECEIVED: 'Nao recebido',
  DIFFERENT_FROM_LISTING: 'Diferente do anuncio',
  DAMAGED_IN_TRANSIT: 'Danificado no transporte',
  NOT_SHIPPED_ON_TIME: 'Nao enviado no prazo',
};

interface DisputeReasonBadgeProps {
  reason: DisputeReason;
  className?: string;
}

export function DisputeReasonBadge({ reason, className }: DisputeReasonBadgeProps) {
  const label = reasonLabels[reason] ?? reason;

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}
