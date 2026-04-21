'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ShoppingBag, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CartItemCard } from './cart-item-card';
import { CartSummary } from './cart-summary';
import { useCart } from '@/contexts/cart-context';

export function CartPage() {
  const t = useTranslations('cart');
  const locale = useLocale();
  const { cartItems, isLoading, refreshCart } = useCart();

  const handleItemRemoved = () => {
    refreshCart();
  };

  const handleCleared = () => {
    // CartSummary refreshes internally
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <ShoppingBag className="h-16 w-16 text-muted-foreground/30" />
        <p className="text-lg font-medium text-muted-foreground">{t('empty')}</p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/marketplace`}>{t('browseMarketplace')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('pageTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('itemsInCart', { count: cartItems.length })}
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${locale}/marketplace`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('continueShopping')}
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {cartItems.map((item) => (
            <CartItemCard
              key={item.id}
              item={item}
              onRemoved={handleItemRemoved}
            />
          ))}
        </div>

        <div>
          <CartSummary
            items={cartItems}
            onCleared={handleCleared}
          />
        </div>
      </div>
    </div>
  );
}
