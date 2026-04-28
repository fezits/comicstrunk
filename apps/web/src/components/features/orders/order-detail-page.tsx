'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BookOpen,
  MapPin,
  Package,
  Truck,
  ExternalLink,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { OrderStatusBadge } from './order-status-badge';
import { OrderStatusTimeline } from './order-status-timeline';
import { PaymentStatusSection } from './payment-status-section';
import {
  getOrder,
  cancelOrder,
  type Order,
  type OrderItem,
  type OrderStatus,
  type OrderItemStatus,
} from '@/lib/api/orders';

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
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

function getTrackingUrl(trackingCode: string, carrier: string): string | null {
  const normalizedCarrier = carrier.toLowerCase();
  if (
    normalizedCarrier.includes('correios') ||
    normalizedCarrier.includes('pac') ||
    normalizedCarrier.includes('sedex')
  ) {
    return `https://rastreamento.correios.com.br/app/index.php?objeto=${trackingCode}`;
  }
  return null;
}

interface ShippingAddressSnapshot {
  label?: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

interface SellerGroup {
  sellerId: string;
  items: OrderItem[];
}

interface OrderDetailPageProps {
  orderId: string;
}

export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
  const t = useTranslations('orders');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await getOrder(orderId);
      setOrder(data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 403) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleCancel = async () => {
    if (!order) return;
    setCancelling(true);
    try {
      const updated = await cancelOrder(order.id);
      setOrder(updated);
      setCancelDialogOpen(false);
      toast.success(t('orderCancelled'));
    } catch {
      toast.error(tCommon('error'));
    } finally {
      setCancelling(false);
    }
  };

  // Group items by seller
  const sellerGroups: SellerGroup[] = order
    ? Array.from(
        order.orderItems.reduce((map, item) => {
          if (!map.has(item.sellerId)) {
            map.set(item.sellerId, { sellerId: item.sellerId, items: [] });
          }
          map.get(item.sellerId)!.items.push(item);
          return map;
        }, new Map<string, SellerGroup>()),
      ).map(([, group]) => group)
    : [];

  const canCancel =
    order?.status === 'PENDING' || order?.status === 'PAID';

  const address = order?.shippingAddressSnapshot as ShippingAddressSnapshot | null;

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16 space-y-4">
        <Package className="h-16 w-16 text-muted-foreground/30 mx-auto" />
        <h2 className="text-2xl font-bold">{t('orderNotFound')}</h2>
        <p className="text-muted-foreground">{t('orderNotFoundDescription')}</p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/orders`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToOrders')}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/${locale}/orders`}
          className="hover:text-foreground transition-colors"
        >
          {t('title')}
        </Link>
        <span>/</span>
        <span className="text-foreground">#{order.orderNumber}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('orderNumber')} #{order.orderNumber}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('date')}: {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OrderStatusBadge status={order.status as OrderStatus} />
          <span className="text-xl font-bold text-primary">
            {formatPrice(order.totalAmount)}
          </span>
        </div>
      </div>

      {/* Status Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('status')}</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderStatusTimeline
            status={order.status as OrderStatus}
            createdAt={order.createdAt}
          />
        </CardContent>
      </Card>

      {/* Items by seller */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('items')}</CardTitle>
          {sellerGroups.length > 1 && (
            <p className="text-sm text-muted-foreground">
              {t('separateShipping')}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {sellerGroups.map((group, groupIdx) => (
            <div key={group.sellerId} className="space-y-3">
              {/* Seller header */}
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-medium">
                  {t('sellerShipsItem')}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-3 pl-9">
                {group.items.map((item) => (
                  <OrderItemCard
                    key={item.id}
                    item={item}
                  />
                ))}
              </div>

              {groupIdx < sellerGroups.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Shipping Address */}
      {address && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {t('shippingAddress')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-0.5">
              {address.label && (
                <p className="font-medium">{address.label}</p>
              )}
              <p>
                {address.street}, {address.number}
                {address.complement ? ` - ${address.complement}` : ''}
              </p>
              <p>
                {address.neighborhood} - {address.city}/{address.state}
              </p>
              <p>{address.zipCode}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment status */}
      <PaymentStatusSection orderId={order.id} orderStatus={order.status} />

      {/* Cancel button */}
      {canCancel && (
        <div className="flex justify-end">
          <Button
            variant="destructive"
            onClick={() => setCancelDialogOpen(true)}
          >
            {t('cancelOrder')}
          </Button>
        </div>
      )}

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancelOrder')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('confirmCancel')}</p>
            <p className="text-sm text-destructive">{t('cancelWarning')}</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
            >
              {tCommon('back')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? tCommon('loading') : t('cancelOrder')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === Per-item display component ===

function OrderItemCard({
  item,
}: {
  item: OrderItem;
  locale?: string;
}) {
  const t = useTranslations('orders');
  const tMarketplace = useTranslations('marketplace');

  const collectionItem = item.collectionItemId
    ? (item as unknown as { collectionItem?: { catalogEntry?: { title?: string; coverImageUrl?: string | null }; condition?: string } }).collectionItem
    : null;

  const title = collectionItem?.catalogEntry?.title ?? `Item #${item.id.slice(0, 8)}`;
  const coverUrl = collectionItem?.catalogEntry?.coverImageUrl;
  const condition = collectionItem?.condition;

  const trackingUrl =
    item.trackingCode && item.carrier
      ? getTrackingUrl(item.trackingCode, item.carrier)
      : null;

  return (
    <div className="flex items-start gap-3 text-sm">
      {/* Thumbnail */}
      <div className="w-12 aspect-[2/3] rounded overflow-hidden bg-muted shrink-0">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-medium line-clamp-1">{title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {condition && (
            <span className="text-xs text-muted-foreground">
              {tMarketplace(`conditionLabels.${condition}`)}
            </span>
          )}
          <OrderStatusBadge
            status={item.status as OrderItemStatus}
            className="text-[10px] px-1.5 py-0"
          />
        </div>

        {/* Tracking info for shipped items */}
        {item.status === 'SHIPPED' && item.trackingCode && (
          <div className="flex items-center gap-2 text-xs">
            <Truck className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              {t('trackingCode')}: {item.trackingCode}
            </span>
            {item.carrier && (
              <span className="text-muted-foreground">
                ({item.carrier})
              </span>
            )}
            {trackingUrl && (
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                {t('trackPackage')}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {/* Shipped date */}
        {item.shippedAt && (
          <p className="text-xs text-muted-foreground">
            {t('shippedAt')}: {new Intl.DateTimeFormat('pt-BR').format(new Date(item.shippedAt))}
          </p>
        )}

        {/* Delivered date */}
        {item.deliveredAt && (
          <p className="text-xs text-muted-foreground">
            {t('deliveredAt')}: {new Intl.DateTimeFormat('pt-BR').format(new Date(item.deliveredAt))}
          </p>
        )}
      </div>

      {/* Price */}
      <span className="font-semibold text-primary shrink-0">
        {formatPrice(item.priceSnapshot)}
      </span>
    </div>
  );
}
