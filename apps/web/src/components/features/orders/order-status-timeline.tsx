'use client';

import { useTranslations } from 'next-intl';
import { Check, Circle, X, AlertTriangle } from 'lucide-react';

import type { OrderStatus, OrderItemStatus } from '@/lib/api/orders';

// Standard lifecycle steps in order
const LIFECYCLE_STEPS = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
] as const;

// Terminal / branch states
const BRANCH_STATES = ['CANCELLED', 'DISPUTED', 'REFUNDED'] as const;

interface OrderStatusTimelineProps {
  status: OrderStatus | OrderItemStatus;
  createdAt: string;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

export function OrderStatusTimeline({
  status,
  createdAt,
  shippedAt,
  deliveredAt,
  cancelledAt,
}: OrderStatusTimelineProps) {
  const t = useTranslations('orders.statusLabels');

  const isBranch = (BRANCH_STATES as readonly string[]).includes(status);

  // Find the index of the current status in the lifecycle
  const currentIndex = LIFECYCLE_STEPS.indexOf(
    status as (typeof LIFECYCLE_STEPS)[number],
  );

  // For branch states, find the last "normal" step reached before branching
  const lastNormalIndex = isBranch
    ? getLastNormalIndex(status, shippedAt, deliveredAt)
    : currentIndex;

  function getLastNormalIndex(
    branchStatus: string,
    shipped: string | null | undefined,
    delivered: string | null | undefined,
  ): number {
    // Infer from available timestamps
    if (delivered) return LIFECYCLE_STEPS.indexOf('DELIVERED');
    if (shipped) return LIFECYCLE_STEPS.indexOf('SHIPPED');
    // If cancelled early, check status context
    if (branchStatus === 'CANCELLED' && cancelledAt) {
      // Could be cancelled from any step
      if (delivered) return LIFECYCLE_STEPS.indexOf('DELIVERED');
      if (shipped) return LIFECYCLE_STEPS.indexOf('SHIPPED');
      return LIFECYCLE_STEPS.indexOf('PAID'); // Minimum: at least PENDING
    }
    return LIFECYCLE_STEPS.indexOf('PENDING');
  }

  function getDateForStep(step: string): string | null {
    switch (step) {
      case 'PENDING':
        return createdAt;
      case 'SHIPPED':
        return shippedAt ?? null;
      case 'DELIVERED':
        return deliveredAt ?? null;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-0">
      {LIFECYCLE_STEPS.map((step, index) => {
        const isPast = index <= lastNormalIndex;
        const isCurrent = index === lastNormalIndex && !isBranch;
        const isActive = isPast || isCurrent;
        const isLast = index === LIFECYCLE_STEPS.length - 1;
        const date = getDateForStep(step);

        return (
          <div key={step} className="flex items-start gap-3">
            {/* Timeline column */}
            <div className="flex flex-col items-center">
              {/* Circle/check icon */}
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/30 bg-background text-muted-foreground/30'
                }`}
              >
                {isPast && index < lastNormalIndex ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isActive ? (
                  <Circle className="h-2.5 w-2.5 fill-current" />
                ) : (
                  <Circle className="h-2.5 w-2.5" />
                )}
              </div>
              {/* Connector line */}
              {(!isLast || isBranch) && (
                <div
                  className={`w-0.5 h-8 ${
                    isPast && !isLast
                      ? 'bg-primary'
                      : 'bg-muted-foreground/20'
                  }`}
                />
              )}
            </div>

            {/* Label + date */}
            <div className="pb-8 -mt-0.5">
              <p
                className={`text-sm font-medium ${
                  isActive ? 'text-foreground' : 'text-muted-foreground/50'
                }`}
              >
                {t(step)}
              </p>
              {date && isActive && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(date)}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* Branch state (CANCELLED, DISPUTED, REFUNDED) */}
      {isBranch && (
        <div className="flex items-start gap-3 -mt-4">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                status === 'CANCELLED' || status === 'REFUNDED'
                  ? 'border-destructive bg-destructive text-destructive-foreground'
                  : 'border-orange-500 bg-orange-500 text-white'
              }`}
            >
              {status === 'CANCELLED' || status === 'REFUNDED' ? (
                <X className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
            </div>
          </div>
          <div className="-mt-0.5">
            <p
              className={`text-sm font-medium ${
                status === 'CANCELLED' || status === 'REFUNDED'
                  ? 'text-destructive'
                  : 'text-orange-600 dark:text-orange-400'
              }`}
            >
              {t(status)}
            </p>
            {cancelledAt && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(cancelledAt)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
