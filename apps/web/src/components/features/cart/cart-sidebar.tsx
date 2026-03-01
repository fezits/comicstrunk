'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ShoppingBag } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CartItemCard } from './cart-item-card';
import { CartSummary } from './cart-summary';
import { useCart } from '@/contexts/cart-context';

interface CartSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CartSidebar({ open, onOpenChange }: CartSidebarProps) {
  const t = useTranslations('cart');
  const locale = useLocale();
  const { cartItems, isLoading, refreshCart } = useCart();

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      refreshCart();
    }
    onOpenChange(nextOpen);
  };

  const handleItemRemoved = () => {
    refreshCart();
  };

  const handleCleared = () => {
    // Cart already refreshed inside CartSummary
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex flex-col p-0 sm:max-w-md">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription className="sr-only">
            {t('title')}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 px-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : cartItems.length === 0 ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-4">
            <ShoppingBag className="h-16 w-16 text-muted-foreground/30" />
            <div className="space-y-1">
              <p className="text-lg font-medium text-muted-foreground">{t('empty')}</p>
            </div>
            <Button asChild variant="outline" onClick={handleClose}>
              <Link href={`/${locale}/marketplace`}>{t('browseMarketplace')}</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Items list */}
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-3 pb-4">
                {cartItems.map((item) => (
                  <CartItemCard
                    key={item.id}
                    item={item}
                    onRemoved={handleItemRemoved}
                  />
                ))}
              </div>
            </ScrollArea>

            {/* Summary footer */}
            <div className="px-6 pb-6">
              <CartSummary
                items={cartItems}
                onCleared={handleCleared}
                onClose={handleClose}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
