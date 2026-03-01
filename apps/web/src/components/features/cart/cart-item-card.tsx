'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BookOpen, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CartCountdown, useCartCountdown } from './cart-countdown';
import { removeFromCart, type CartItem } from '@/lib/api/cart';
import { useCart } from '@/contexts/cart-context';
import type { ItemCondition } from '@/lib/api/collection';

const conditionColors: Record<ItemCondition, string> = {
  NEW: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  VERY_GOOD: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  GOOD: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  FAIR: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  POOR: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
};

function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

interface CartItemCardProps {
  item: CartItem;
  onRemoved: () => void;
}

export function CartItemCard({ item, onRemoved }: CartItemCardProps) {
  const t = useTranslations('cart');
  const tMarketplace = useTranslations('marketplace');
  const locale = useLocale();
  const { decrementCount } = useCart();
  const { isExpired } = useCartCountdown(item.expiresAt);
  const [removing, setRemoving] = useState(false);

  const { collectionItem } = item;
  const condition = collectionItem.condition as ItemCondition;
  const conditionColor = conditionColors[condition] ?? '';
  const conditionLabel = tMarketplace(`conditionLabels.${condition}`);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await removeFromCart(item.id);
      decrementCount();
      toast.success(t('itemRemoved'));
      onRemoved();
    } catch {
      toast.error(t('removeItem'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div
      className={`flex gap-3 p-3 rounded-lg border ${
        isExpired
          ? 'border-destructive/30 bg-destructive/5 opacity-60'
          : 'border-border bg-card'
      }`}
    >
      {/* Cover image thumbnail */}
      <Link
        href={`/${locale}/marketplace/${collectionItem.id}`}
        className="shrink-0 w-16 aspect-[2/3] rounded overflow-hidden bg-muted"
      >
        {collectionItem.coverImageUrl ? (
          <img
            src={collectionItem.coverImageUrl}
            alt={collectionItem.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-muted-foreground/40" />
          </div>
        )}
      </Link>

      {/* Item details */}
      <div className="flex-1 min-w-0 space-y-1">
        <Link
          href={`/${locale}/marketplace/${collectionItem.id}`}
          className="text-sm font-medium leading-tight line-clamp-2 hover:text-primary transition-colors"
        >
          {collectionItem.title}
        </Link>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${conditionColor}`}>
            {conditionLabel}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {collectionItem.seller.name}
          </span>
        </div>

        <div className="text-sm font-bold text-primary">
          {collectionItem.salePrice != null ? formatPrice(collectionItem.salePrice) : '--'}
        </div>

        <CartCountdown expiresAt={item.expiresAt} />
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={handleRemove}
        disabled={removing}
        aria-label={t('removeItem')}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
