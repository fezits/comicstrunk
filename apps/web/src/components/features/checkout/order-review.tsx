'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, Package, User } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { CartItem } from '@/lib/api/cart';
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

interface SellerGroup {
  sellerId: string;
  sellerName: string;
  items: CartItem[];
  subtotal: number;
}

interface OrderReviewProps {
  items: CartItem[];
}

export function OrderReview({ items }: OrderReviewProps) {
  const t = useTranslations('checkout');
  const tMarketplace = useTranslations('marketplace');

  const sellerGroups: SellerGroup[] = useMemo(() => {
    const groupMap = new Map<string, SellerGroup>();

    for (const item of items) {
      const { seller } = item.collectionItem;
      if (!groupMap.has(seller.id)) {
        groupMap.set(seller.id, {
          sellerId: seller.id,
          sellerName: seller.name,
          items: [],
          subtotal: 0,
        });
      }
      const group = groupMap.get(seller.id)!;
      group.items.push(item);
      group.subtotal += item.collectionItem.salePrice ?? 0;
    }

    return Array.from(groupMap.values());
  }, [items]);

  const grandTotal = sellerGroups.reduce((sum, g) => sum + g.subtotal, 0);

  return (
    <div className="space-y-6">
      {/* Multi-seller notice */}
      {sellerGroups.length > 1 && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">{t('separateShipping')}</p>
        </div>
      )}

      {/* Seller groups */}
      {sellerGroups.map((group, idx) => (
        <div key={group.sellerId} className="space-y-3">
          {/* Seller header */}
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-medium">{group.sellerName}</span>
          </div>

          {/* Items */}
          <div className="space-y-2 pl-9">
            {group.items.map((item) => {
              const { collectionItem } = item;
              const condition = collectionItem.condition as ItemCondition;
              const conditionColor = conditionColors[condition] ?? '';
              const conditionLabel = tMarketplace(`conditionLabels.${condition}`);

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 text-sm"
                >
                  {/* Thumbnail */}
                  <div className="w-10 aspect-[2/3] rounded overflow-hidden bg-muted shrink-0">
                    {collectionItem.coverImageUrl ? (
                      <img
                        src={collectionItem.coverImageUrl}
                        alt={collectionItem.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  {/* Title + condition */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium line-clamp-1">{collectionItem.title}</p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${conditionColor}`}
                    >
                      {conditionLabel}
                    </Badge>
                  </div>

                  {/* Price */}
                  <span className="font-semibold text-primary shrink-0">
                    {formatPrice(collectionItem.salePrice ?? 0)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Subtotal */}
          <div className="flex items-center justify-between pl-9 text-sm">
            <span className="text-muted-foreground">{t('subtotal')}</span>
            <span className="font-medium">{formatPrice(group.subtotal)}</span>
          </div>

          {idx < sellerGroups.length - 1 && <Separator />}
        </div>
      ))}

      {/* Grand total */}
      <Separator />
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold">{t('total')}</span>
        <span className="text-xl font-bold text-primary">{formatPrice(grandTotal)}</span>
      </div>
    </div>
  );
}
