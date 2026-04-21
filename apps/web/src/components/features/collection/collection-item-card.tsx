'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { BookOpen, Eye, EyeOff, Tag, DollarSign } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CollectionItem, ItemCondition } from '@/lib/api/collection';

interface CollectionItemCardProps {
  item: CollectionItem;
  onToggleRead?: (id: string, isRead: boolean) => void;
  onToggleSale?: (id: string) => void;
}

const conditionColors: Record<ItemCondition, string> = {
  NEW: 'bg-green-500/10 text-green-600 border-green-500/20',
  VERY_GOOD: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  GOOD: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  FAIR: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  POOR: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export function CollectionItemCard({ item, onToggleRead, onToggleSale }: CollectionItemCardProps) {
  const locale = useLocale();
  const t = useTranslations('collection');
  const entry = item.catalogEntry;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Card className={`h-full overflow-hidden transition-shadow hover:shadow-lg group${item.isRead ? ' border-l-4 border-l-green-500' : ''}`}>
      <Link href={`/${locale}/collection/${item.id}`} className="block">
        {/* Cover */}
        <div className="aspect-[2/3] bg-muted flex items-center justify-center overflow-hidden relative">
          {entry.coverImageUrl ? (
            <img
              src={entry.coverImageUrl}
              alt={entry.title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <BookOpen className="h-12 w-12 text-muted-foreground/40" />
          )}

          {/* Read overlay */}
          {item.isRead && (
            <div className="absolute inset-0 bg-green-500/10" />
          )}

          {/* Badges overlay */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {item.isRead && (
              <Badge className="text-xs bg-green-500/20 text-green-600 border-green-500/30 border">
                <Eye className="h-3 w-3 mr-1" />
                {t('readBadge')}
              </Badge>
            )}
            {item.isForSale && (
              <Badge className="text-xs bg-green-600 hover:bg-green-700">
                <DollarSign className="h-3 w-3 mr-1" />
                {item.salePrice ? formatCurrency(item.salePrice) : t('forSaleBadge')}
              </Badge>
            )}
          </div>
        </div>
      </Link>

      <CardContent className="p-4 space-y-2">
        {/* Title */}
        <Link href={`/${locale}/collection/${item.id}`}>
          <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
            {entry.title}
          </h3>
        </Link>

        {/* Author & Publisher */}
        <p className="text-sm text-muted-foreground truncate">
          {[entry.author, entry.publisher].filter(Boolean).join(' — ')}
        </p>

        {/* Condition & Quantity */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={conditionColors[item.condition]}>
            {t(`condition.${item.condition}`)}
          </Badge>
          {item.quantity > 1 && (
            <Badge variant="outline" className="text-xs">
              x{item.quantity}
            </Badge>
          )}
        </div>

        {/* Series badge */}
        {entry.series && (
          <Badge variant="secondary" className="text-xs">
            {entry.series.title}
          </Badge>
        )}

        {/* Quick actions */}
        <div className="flex items-center gap-1 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => {
              e.preventDefault();
              onToggleRead?.(item.id, !item.isRead);
            }}
          >
            {item.isRead ? (
              <EyeOff className="h-3 w-3 mr-1" />
            ) : (
              <Eye className="h-3 w-3 mr-1" />
            )}
            {item.isRead ? t('markUnread') : t('markRead')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => {
              e.preventDefault();
              onToggleSale?.(item.id);
            }}
          >
            <Tag className="h-3 w-3 mr-1" />
            {item.isForSale ? t('removeSale') : t('markForSale')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
