'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, ShoppingBag } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressSelector } from './address-selector';
import { OrderReview } from './order-review';
import { getCart, type CartItem } from '@/lib/api/cart';
import { listAddresses, type ShippingAddress } from '@/lib/api/shipping';
import { createOrder } from '@/lib/api/orders';

export function CheckoutPage() {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const router = useRouter();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch cart and addresses on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        const [items, addrs] = await Promise.all([getCart(), listAddresses()]);

        if (cancelled) return;

        if (items.length === 0) {
          router.replace(`/${locale}/marketplace`);
          return;
        }

        setCartItems(items);
        setAddresses(addrs);

        // Pre-select default address
        const defaultAddr = addrs.find((a) => a.isDefault);
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
        } else if (addrs.length > 0) {
          setSelectedAddressId(addrs[0].id);
        }
      } catch {
        toast.error(t('orderError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [locale, router, t]);

  const handleAddressCreated = (address: ShippingAddress) => {
    setAddresses((prev) => [...prev, address]);
  };

  const hasExpiredItems = cartItems.some((item) => {
    return Date.now() >= new Date(item.expiresAt).getTime();
  });

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      toast.error(t('selectAddressRequired'));
      return;
    }

    if (hasExpiredItems) {
      toast.error(t('cartExpired'));
      return;
    }

    setSubmitting(true);
    try {
      const order = await createOrder(selectedAddressId);
      toast.success(t('orderCreated'));
      router.push(`/${locale}/checkout/payment?orderId=${order.id}`);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        toast.error(t('staleCart'));
      } else if (status === 400) {
        toast.error(t('cartExpired'));
      } else {
        toast.error(t('orderError'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16 space-y-4">
        <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mx-auto" />
        <p className="text-lg text-muted-foreground">{t('emptyCart')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>

      {/* Expired items warning */}
      {hasExpiredItems && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{t('cartExpired')}</p>
        </div>
      )}

      {/* Step 1: Cart Review */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('cartReview')}</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderReview items={cartItems} />
        </CardContent>
      </Card>

      {/* Step 2: Shipping Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('shippingAddress')}</CardTitle>
        </CardHeader>
        <CardContent>
          <AddressSelector
            addresses={addresses}
            selectedId={selectedAddressId}
            onSelect={setSelectedAddressId}
            onAddressCreated={handleAddressCreated}
          />
        </CardContent>
      </Card>

      {/* Step 3: Place Order */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('orderSummary')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('total')}</span>
            <span className="text-xl font-bold text-primary">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(
                cartItems.reduce(
                  (sum, item) => sum + (item.collectionItem.salePrice ?? 0),
                  0,
                ),
              )}
            </span>
          </div>

          <Button
            className="w-full gap-2"
            size="lg"
            onClick={handlePlaceOrder}
            disabled={submitting || hasExpiredItems || !selectedAddressId}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('processing')}
              </>
            ) : (
              t('placeOrder')
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
