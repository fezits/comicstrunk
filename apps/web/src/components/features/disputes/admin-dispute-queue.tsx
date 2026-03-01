'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { AlertTriangle, ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DisputeStatusBadge } from './dispute-status-badge';
import { DisputeReasonBadge } from './dispute-reason-badge';
import {
  listAllDisputes,
  type Dispute,
  type DisputeStatus,
  type PaginationMeta,
} from '@/lib/api/disputes';

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function isOlderThan48h(dateStr: string): boolean {
  const created = new Date(dateStr).getTime();
  const now = Date.now();
  return now - created > 48 * 60 * 60 * 1000;
}

function hasSellerResponse(dispute: Dispute): boolean {
  return dispute.messages.some((m) => m.sender.id === dispute.sellerId);
}

export function AdminDisputeQueue() {
  const locale = useLocale();

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: DisputeStatus; page: number; limit: number } = {
        page,
        limit: 20,
      };
      if (statusFilter !== 'all') {
        params.status = statusFilter as DisputeStatus;
      }
      const result = await listAllDisputes(params);
      setDisputes(result.data);
      setPagination(result.pagination);
    } catch {
      toast.error('Erro ao carregar disputas');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Status:
          </span>
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="OPEN">Abertas</SelectItem>
              <SelectItem value="IN_MEDIATION">Em mediacao</SelectItem>
              <SelectItem value="RESOLVED_REFUND">Reembolso total</SelectItem>
              <SelectItem value="RESOLVED_PARTIAL_REFUND">
                Reembolso parcial
              </SelectItem>
              <SelectItem value="RESOLVED_NO_REFUND">Sem reembolso</SelectItem>
              <SelectItem value="CANCELLED">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {pagination && (
          <span className="text-sm text-muted-foreground ml-auto">
            {pagination.total} disputa{pagination.total !== 1 ? 's' : ''}{' '}
            encontrada{pagination.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nenhuma disputa encontrada.</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">ID</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((dispute) => {
                  const isUrgent =
                    dispute.status === 'OPEN' && isOlderThan48h(dispute.createdAt);
                  const noSellerResponse =
                    dispute.status === 'OPEN' && !hasSellerResponse(dispute);

                  return (
                    <TableRow
                      key={dispute.id}
                      className={
                        isUrgent
                          ? 'border-l-2 border-l-red-500 bg-red-500/5'
                          : ''
                      }
                    >
                      <TableCell className="font-mono text-xs">
                        <Link
                          href={`/${locale}/admin/disputes/${dispute.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          ...{dispute.id.slice(-6)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          #{dispute.order.orderNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm truncate max-w-[120px] block">
                          {dispute.buyer.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-sm truncate max-w-[120px] block">
                            {dispute.seller.name}
                          </span>
                          {noSellerResponse && (
                            <Badge
                              variant="destructive"
                              className="text-[10px] px-1.5 py-0 whitespace-nowrap"
                            >
                              Sem resposta
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DisputeReasonBadge reason={dispute.reason} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DisputeStatusBadge status={dispute.status} />
                          {isUrgent && (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(dispute.createdAt)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm whitespace-nowrap">
                        {formatBRL(dispute.orderItem.priceSnapshot)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-8 w-8 p-0"
                        >
                          <Link
                            href={`/${locale}/admin/disputes/${dispute.id}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Proxima
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
