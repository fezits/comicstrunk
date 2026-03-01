'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Package, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';

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
import { OrderStatusBadge } from './order-status-badge';
import {
  listBuyerOrders,
  type Order,
  type OrderStatus,
} from '@/lib/api/orders';
import type { PaginationMeta } from '@/lib/api/catalog';

const STATUS_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: 'ALL', labelKey: 'allStatuses' },
  { value: 'PENDING', labelKey: 'statusLabels.PENDING' },
  { value: 'PAID', labelKey: 'statusLabels.PAID' },
  { value: 'PROCESSING', labelKey: 'statusLabels.PROCESSING' },
  { value: 'SHIPPED', labelKey: 'statusLabels.SHIPPED' },
  { value: 'DELIVERED', labelKey: 'statusLabels.DELIVERED' },
  { value: 'COMPLETED', labelKey: 'statusLabels.COMPLETED' },
  { value: 'CANCELLED', labelKey: 'statusLabels.CANCELLED' },
];

function formatPrice(value: number): string {
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

export function BuyerOrdersPage() {
  const t = useTranslations('orders');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const currentStatus = searchParams.get('status') ?? 'ALL';
  const currentPage = Number(searchParams.get('page') ?? '1');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: OrderStatus; page: number; limit: number } = {
        page: currentPage,
        limit: 10,
      };
      if (currentStatus !== 'ALL') {
        params.status = currentStatus as OrderStatus;
      }
      const result = await listBuyerOrders(params);
      setOrders(result.data);
      setPagination(result.pagination);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [currentStatus, currentPage]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === 'status') {
      params.delete('page'); // Reset page when filter changes
    }
    if (value === 'ALL' && key === 'status') {
      params.delete('status');
    } else {
      params.set(key, value);
    }
    router.push(`/${locale}/orders?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>

        {/* Status filter */}
        <Select
          value={currentStatus}
          onValueChange={(value) => updateParams('status', value)}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
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
      ) : orders.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16 space-y-4">
          <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mx-auto" />
          <p className="text-lg text-muted-foreground">{t('noOrders')}</p>
          <Button asChild variant="outline">
            <Link href={`/${locale}/marketplace`}>{t('browseMarketplace')}</Link>
          </Button>
        </div>
      ) : (
        /* Order list */
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/${locale}/orders/${order.id}`}
              className="block"
            >
              <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Left: order info */}
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">
                          {t('orderNumber')} #{order.orderNumber}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t('date')}: {formatDate(order.createdAt)} &middot;{' '}
                          {t('items')}: {order.orderItems.length}
                        </p>
                      </div>
                    </div>

                    {/* Right: status + total */}
                    <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                      <OrderStatusBadge status={order.status as OrderStatus} />
                      <span className="text-lg font-bold text-primary">
                        {formatPrice(order.totalAmount)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
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
            {t('previousPage')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('pageOf', { current: currentPage, total: pagination.totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pagination.totalPages}
            onClick={() => updateParams('page', String(currentPage + 1))}
          >
            {t('nextPage')}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
