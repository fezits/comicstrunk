'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { clearCart, type CartItem } from '@/lib/api/cart';
import { useCart } from '@/contexts/cart-context';

function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

interface CartSummaryProps {
  items: CartItem[];
  onCleared: () => void;
  onClose?: () => void;
}

export function CartSummary({ items, onCleared, onClose }: CartSummaryProps) {
  const t = useTranslations('cart');
  const locale = useLocale();
  const { refreshCart } = useCart();

  const totalAmount = items.reduce((sum, item) => {
    return sum + (item.collectionItem.salePrice ?? 0);
  }, 0);

  const hasExpiredItems = items.some((item) => {
    const expiry = new Date(item.expiresAt).getTime();
    return Date.now() >= expiry;
  });

  const isEmpty = items.length === 0;
  const checkoutDisabled = isEmpty || hasExpiredItems;

  const handleClear = async () => {
    try {
      await clearCart();
      await refreshCart();
      toast.success(t('cartCleared'));
      onCleared();
    } catch {
      // Silently fail
    }
  };

  return (
    <div className="space-y-3 pt-3">
      <Separator />

      {/* Totals */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {t('itemCount', { count: items.length })}
        </span>
        <span className="font-bold text-lg">{formatPrice(totalAmount)}</span>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button
          className="w-full"
          size="lg"
          disabled={checkoutDisabled}
          asChild={!checkoutDisabled}
          onClick={onClose}
        >
          {checkoutDisabled ? (
            <span>{t('checkout')}</span>
          ) : (
            <Link href={`/${locale}/checkout`}>{t('checkout')}</Link>
          )}
        </Button>

        {!isEmpty && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-destructive hover:text-destructive"
            onClick={handleClear}
          >
            <Trash2 className="h-4 w-4" />
            {t('clearCart')}
          </Button>
        )}
      </div>
    </div>
  );
}
