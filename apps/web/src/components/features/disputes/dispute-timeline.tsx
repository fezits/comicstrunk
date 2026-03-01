'use client';

import { Check, Circle, MessageSquare, Shield, X, AlertTriangle } from 'lucide-react';
import type { Dispute } from '@/lib/api/disputes';

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

interface TimelineEvent {
  id: string;
  label: string;
  date: string;
  icon: React.ReactNode;
  iconBg: string;
}

interface DisputeTimelineProps {
  dispute: Dispute;
}

export function DisputeTimeline({ dispute }: DisputeTimelineProps) {
  const events: TimelineEvent[] = [];

  // 1. Dispute opened
  events.push({
    id: 'opened',
    label: 'Disputa aberta',
    date: dispute.createdAt,
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    iconBg: 'border-yellow-500 bg-yellow-500 text-white',
  });

  // 2. Seller responses (messages that indicate seller responded)
  const sellerMessages = dispute.messages.filter(
    (m) => m.sender.id === dispute.sellerId,
  );
  if (sellerMessages.length > 0) {
    events.push({
      id: 'seller-responded',
      label: 'Vendedor respondeu',
      date: sellerMessages[0].createdAt,
      icon: <MessageSquare className="h-3.5 w-3.5" />,
      iconBg: 'border-blue-500 bg-blue-500 text-white',
    });
  }

  // 3. If in mediation (status changed after seller responded)
  if (
    dispute.status === 'IN_MEDIATION' ||
    dispute.status === 'RESOLVED_REFUND' ||
    dispute.status === 'RESOLVED_PARTIAL_REFUND' ||
    dispute.status === 'RESOLVED_NO_REFUND'
  ) {
    const mediationDate =
      sellerMessages.length > 0 ? sellerMessages[0].createdAt : dispute.updatedAt;
    events.push({
      id: 'in-mediation',
      label: 'Em mediacao',
      date: mediationDate,
      icon: <Shield className="h-3.5 w-3.5" />,
      iconBg: 'border-blue-600 bg-blue-600 text-white',
    });
  }

  // 4. Resolution events
  if (dispute.resolvedAt) {
    const resolutionLabels: Record<string, string> = {
      RESOLVED_REFUND: 'Resolvida - Reembolso total',
      RESOLVED_PARTIAL_REFUND: 'Resolvida - Reembolso parcial',
      RESOLVED_NO_REFUND: 'Resolvida - Sem reembolso',
    };
    const label = resolutionLabels[dispute.status] ?? 'Resolvida';
    const isRefund =
      dispute.status === 'RESOLVED_REFUND' ||
      dispute.status === 'RESOLVED_PARTIAL_REFUND';

    events.push({
      id: 'resolved',
      label,
      date: dispute.resolvedAt,
      icon: <Check className="h-3.5 w-3.5" />,
      iconBg: isRefund
        ? 'border-emerald-600 bg-emerald-600 text-white'
        : 'border-red-600 bg-red-600 text-white',
    });
  }

  // 5. Cancelled
  if (dispute.status === 'CANCELLED') {
    events.push({
      id: 'cancelled',
      label: 'Disputa cancelada',
      date: dispute.updatedAt,
      icon: <X className="h-3.5 w-3.5" />,
      iconBg: 'border-muted-foreground bg-muted-foreground text-white',
    });
  }

  return (
    <div className="space-y-0">
      {events.map((event, index) => {
        const isLast = index === events.length - 1;

        return (
          <div key={event.id} className="flex items-start gap-3">
            {/* Timeline column */}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${event.iconBg}`}
              >
                {event.icon}
              </div>
              {!isLast && (
                <div className="w-0.5 h-8 bg-muted-foreground/20" />
              )}
            </div>

            {/* Label + date */}
            <div className={isLast ? '' : 'pb-8'}>
              <p className="text-sm font-medium -mt-0.5">{event.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDateTime(event.date)}
              </p>
            </div>
          </div>
        );
      })}

      {/* Current status indicator for open/in mediation */}
      {(dispute.status === 'OPEN' || dispute.status === 'IN_MEDIATION') && (
        <div className="flex items-start gap-3 mt-2">
          <div className="flex flex-col items-center">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background">
              <Circle className="h-2.5 w-2.5 fill-primary text-primary animate-pulse" />
            </div>
          </div>
          <div className="-mt-0.5">
            <p className="text-sm font-medium text-primary">
              {dispute.status === 'OPEN'
                ? 'Aguardando resposta do vendedor'
                : 'Aguardando resolucao'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
