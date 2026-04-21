'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { AlertTriangle, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DisputeStatusBadge } from './dispute-status-badge';
import { DisputeReasonBadge } from './dispute-reason-badge';
import {
  listBuyerDisputes,
  type Dispute,
  type DisputeStatus,
  type PaginationMeta,
} from '@/lib/api/disputes';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'Todas' },
  { value: 'OPEN', label: 'Abertas' },
  { value: 'IN_MEDIATION', label: 'Em mediacao' },
  { value: 'RESOLVED_REFUND', label: 'Reembolso total' },
  { value: 'RESOLVED_PARTIAL_REFUND', label: 'Reembolso parcial' },
  { value: 'RESOLVED_NO_REFUND', label: 'Sem reembolso' },
  { value: 'CANCELLED', label: 'Canceladas' },
];

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr));
}

export function BuyerDisputesPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const currentStatus = searchParams.get('status') ?? 'ALL';
  const currentPage = Number(searchParams.get('page') ?? '1');

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: DisputeStatus; page: number; limit: number } = {
        page: currentPage,
        limit: 10,
      };
      if (currentStatus !== 'ALL') {
        params.status = currentStatus as DisputeStatus;
      }
      const result = await listBuyerDisputes(params);
      setDisputes(result.data);
      setPagination(result.pagination);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [currentStatus, currentPage]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === 'status') {
      params.delete('page');
    }
    if (value === 'ALL' && key === 'status') {
      params.delete('status');
    } else {
      params.set(key, value);
    }
    router.push(`/${locale}/disputes?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Minhas Disputas</h1>

        {/* Status filter */}
        <Select
          value={currentStatus}
          onValueChange={(value) => updateParams('status', value)}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : disputes.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16 space-y-4">
          <Inbox className="h-16 w-16 text-muted-foreground/30 mx-auto" />
          <p className="text-lg text-muted-foreground">Voce nao tem disputas</p>
          <Button asChild variant="outline">
            <Link href={`/${locale}/orders`}>Ver meus pedidos</Link>
          </Button>
        </div>
      ) : (
        /* Dispute list */
        <div className="space-y-3">
          {disputes.map((dispute) => {
            const itemTitle =
              dispute.orderItem.collectionItem?.catalogEntry?.title ??
              `Item #${dispute.orderItemId.slice(0, 8)}`;

            return (
              <Link
                key={dispute.id}
                href={`/${locale}/disputes/${dispute.id}`}
                className="block"
              >
                <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      {/* Left: dispute info */}
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                          <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm line-clamp-1">
                            {itemTitle}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Pedido #{dispute.order.orderNumber} &middot;{' '}
                            {formatDate(dispute.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* Right: badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <DisputeReasonBadge reason={dispute.reason} />
                        <DisputeStatusBadge status={dispute.status} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => updateParams('page', String(currentPage - 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Pagina {currentPage} de {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pagination.totalPages}
            onClick={() => updateParams('page', String(currentPage + 1))}
          >
            Proxima
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
