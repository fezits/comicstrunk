'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  BookOpen,
  MapPin,
  Package,
  Truck,
  ExternalLink,
  DollarSign,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderStatusBadge } from './order-status-badge';
import { TrackingForm } from './tracking-form';
import {
  getOrder,
  type Order,
  type OrderItem,
  type OrderItemStatus,
} from '@/lib/api/orders';
import { useAuth } from '@/lib/auth/use-auth';

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

interface SellerOrderDetailProps {
  orderId: string;
}

export function SellerOrderDetail({ orderId }: SellerOrderDetailProps) {
  const t = useTranslations('seller');
  const tOrders = useTranslations('orders');
  const tMarketplace = useTranslations('marketplace');
  const locale = useLocale();
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

  const handleTrackingUpdated = () => {
    // Refresh order data to reflect SHIPPED status
    fetchOrder();
  };

  // Filter to only this seller's items
  const sellerItems: OrderItem[] = order
    ? order.orderItems.filter((item) => item.sellerId === user?.id)
    : [];

  // Financial summary
  const totalPrice = sellerItems.reduce((sum, item) => sum + item.priceSnapshot, 0);
  const totalCommission = sellerItems.reduce(
    (sum, item) => sum + item.commissionAmountSnapshot,
    0,
  );
  const totalSellerNet = sellerItems.reduce(
    (sum, item) => sum + item.sellerNetSnapshot,
    0,
  );

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
        <h2 className="text-2xl font-bold">{tOrders('orderNotFound')}</h2>
        <p className="text-muted-foreground">{tOrders('orderNotFoundDescription')}</p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/seller/orders`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToSellerOrders')}
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
          href={`/${locale}/seller/orders`}
          className="hover:text-foreground transition-colors"
        >
          {t('ordersTitle')}
        </Link>
        <span>/</span>
        <span className="text-foreground">#{order.orderNumber}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {tOrders('orderNumber')} #{order.orderNumber}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tOrders('date')}: {formatDate(order.createdAt)}
          </p>
        </div>
        <OrderStatusBadge status={order.status as OrderItemStatus} />
      </div>

      {/* Shipping Address */}
      {address && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {tOrders('shippingAddress')}
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

      {/* Seller's items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('yourItemsInOrder')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sellerItems.map((item) => {
            const collectionItem = (
              item as unknown as {
                collectionItem?: {
                  catalogEntry?: {
                    title?: string;
                    coverImageUrl?: string | null;
                  };
                  condition?: string;
                };
              }
            ).collectionItem;

            const title =
              collectionItem?.catalogEntry?.title ??
              `Item #${item.id.slice(0, 8)}`;
            const coverUrl = collectionItem?.catalogEntry?.coverImageUrl;
            const condition = collectionItem?.condition;

            const trackingUrl =
              item.trackingCode && item.carrier
                ? getTrackingUrl(item.trackingCode, item.carrier)
                : null;

            return (
              <div key={item.id} className="space-y-3">
                <div className="flex items-start gap-3 text-sm">
                  {/* Thumbnail */}
                  <div className="w-14 aspect-[2/3] rounded overflow-hidden bg-muted shrink-0">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-muted-foreground/40" />
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

                    {/* Financial details per item */}
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>
                        {t('priceSnapshot')}: {formatPrice(item.priceSnapshot)}
                      </p>
                      <p>
                        {t('commission')}: -{formatPrice(item.commissionAmountSnapshot)} (
                        {(item.commissionRateSnapshot * 100).toFixed(0)}%)
                      </p>
                      <p className="font-medium text-foreground">
                        {t('sellerNet')}: {formatPrice(item.sellerNetSnapshot)}
                      </p>
                    </div>

                    {/* Tracking info for shipped items */}
                    {(item.status === 'SHIPPED' || item.status === 'DELIVERED') &&
                      item.trackingCode && (
                        <div className="flex items-center gap-2 text-xs">
                          <Truck className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {item.trackingCode}
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
                              {tOrders('trackPackage')}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}
                  </div>

                  {/* Price */}
                  <span className="font-semibold text-primary shrink-0">
                    {formatPrice(item.priceSnapshot)}
                  </span>
                </div>

                {/* Tracking form for PROCESSING items */}
                {item.status === 'PROCESSING' && (
                  <div className="ml-[calc(3.5rem+0.75rem)]">
                    <TrackingForm
                      orderItemId={item.id}
                      onTrackingUpdated={handleTrackingUpdated}
                    />
                  </div>
                )}

                <Separator />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Financial summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            {t('financialSummary')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('priceSnapshot')}</span>
            <span>{formatPrice(totalPrice)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('commission')}</span>
            <span className="text-destructive">-{formatPrice(totalCommission)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between font-semibold">
            <span>{t('sellerNet')}</span>
            <span className="text-lg text-primary">{formatPrice(totalSellerNet)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
